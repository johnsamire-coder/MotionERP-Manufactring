import { randomUUID } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { PostingEngineService } from '../accounting/posting-engine.service';
import { CatalogNotFoundError } from '../catalog/catalog.errors';
import { CatalogService } from '../catalog/catalog.service';
import type { ItemRecord } from '../catalog/catalog.types';
import { InventoryNotFoundError, InventoryValidationError } from './inventory.errors';
import { InventoryRepository } from './inventory.repository';
import type {
  CreateMovementInput,
  CreateReservationInput,
  CreateWarehouseInput,
  StockBalanceRecord,
  StockMovementRecord,
  StockReservationRecord,
  WarehouseRecord,
  StockLedgerEntryRecord,
  ItemBatchRecord,
  BatchBalanceRecord,
  CreateItemBatchInput,
  ItemBatchStatus,
  SerialNumberRecord,
  CreateSerialNumberInput,
  SerialNumberStatus,
  ReconcileStockInput,
  ReconcileStockResult,
  LandedCostVoucherRecord,
  CreateLandedCostVoucherInput,
  MovementPurpose,
  MovementType,
  TransferStockInput,
  TransferStockResult,
} from './inventory.types';

// Which accounting directions each business purpose may use (plan item 3).
const PURPOSE_MOVEMENT_TYPES: Record<MovementPurpose, readonly MovementType[]> = {
  general: ['receipt', 'issue', 'transfer_in', 'transfer_out', 'adjustment'],
  material_transfer_for_manufacture: ['transfer_out', 'transfer_in'],
  manufacture_consumption: ['issue'],
};

@Injectable()
export class InventoryService {
  constructor(
    private readonly repository: InventoryRepository,
    @Optional() private readonly postingEngine?: PostingEngineService,
    @Optional() private readonly catalogService?: CatalogService,
  ) {}

  async getWarehouses(): Promise<WarehouseRecord[]> {
    return this.repository.listWarehouses();
  }

  async createWarehouse(input: CreateWarehouseInput): Promise<WarehouseRecord> {
    const code = normalizeCode(input.code);
    const name = normalizeName(input.name);
    const existing = await this.repository.findWarehouseByCode(code);
    if (existing) {
      throw new InventoryValidationError(`a warehouse with code "${code}" already exists`);
    }
    return this.repository.insertWarehouse({ id: randomUUID(), code, name, orgNodeId: input.orgNodeId });
  }

  async getBalances(): Promise<StockBalanceRecord[]> {
    return this.repository.listBalances();
  }

  async getMovements(): Promise<StockMovementRecord[]> {
    return this.repository.listMovements();
  }

  async createMovement(input: CreateMovementInput): Promise<StockMovementRecord> {
    const quantityNum = Number(input.quantity);
    if (!Number.isFinite(quantityNum) || quantityNum <= 0) {
      throw new InventoryValidationError('quantity must be a positive number');
    }
    const warehouseRecord = await this.repository.findWarehouseById(input.warehouseId);
    if (!warehouseRecord) {
      throw new InventoryNotFoundError(`warehouse ${input.warehouseId} does not exist`);
    }

    // Backdating guard: a movement may not be dated before the latest recorded
    // movement of the same item/warehouse, unless explicitly allowed with a reason.
    const movementDate = input.movementDate ? new Date(input.movementDate) : new Date();
    if (Number.isNaN(movementDate.getTime())) {
      throw new InventoryValidationError(`movementDate "${input.movementDate}" is not a valid date`);
    }
    let note = input.note;
    const latestMovementDate = await this.repository.findLatestMovementDate(input.itemId, input.warehouseId);
    if (latestMovementDate && movementDate.getTime() < latestMovementDate.getTime()) {
      if (!input.allowBackdate) {
        throw new InventoryValidationError(
          `backdated movement rejected: movementDate ${movementDate.toISOString()} is before the latest movement ` +
          `${latestMovementDate.toISOString()} for this item/warehouse (set allowBackdate with a backdateReason to override)`,
        );
      }
      const reason = input.backdateReason?.trim();
      if (!reason) {
        throw new InventoryValidationError('backdateReason is required when allowBackdate is true');
      }
      note = note ? `[BACKDATED: ${reason}] ${note}` : `[BACKDATED: ${reason}]`;
    }

    const purpose = input.purpose ?? 'general';
    const allowedTypes = PURPOSE_MOVEMENT_TYPES[purpose];
    if (!allowedTypes) {
      throw new InventoryValidationError(`unknown movement purpose "${purpose}"`);
    }
    if (!allowedTypes.includes(input.movementType)) {
      throw new InventoryValidationError(
        `purpose "${purpose}" only allows movement types: ${allowedTypes.join(', ')} (got "${input.movementType}")`,
      );
    }

    const isDecrease = input.movementType === 'issue' || input.movementType === 'transfer_out';
    const signedQuantity = isDecrease ? `-${input.quantity}` : input.quantity;

    // Per-batch costing: batch-tracked items must name a batch; issues use that batch's own cost.
    // Serial-tracked items must list one serial per unit, validated before anything is written.
    const tracking = await this.getItemTracking(input.itemId);
    const batchContext = await this.resolveBatchContext(input, tracking, isDecrease, movementDate, quantityNum);
    const serialPlan = await this.resolveSerials(input, tracking, isDecrease, quantityNum, batchContext?.batchId ?? null);

    if (isDecrease) {
      const balance = await this.repository.findBalance(input.itemId, input.warehouseId);
      const currentOnHand = balance ? Number(balance.onHand) : 0;
      const currentReserved = balance ? Number(balance.reserved) : 0;
      const currentAvailable = currentOnHand - currentReserved;
      if (currentAvailable < quantityNum) {
        throw new InventoryValidationError(`insufficient stock: available ${currentAvailable}, requested ${quantityNum}`);
      }
    }

    const bal = await this.repository.findBalance(input.itemId, input.warehouseId);
    const oldQty = bal ? Number(bal.onHand) : 0;
    const oldAvg = bal ? Number(bal.averageCost) : 0;
    let movementUnitCost: number;

    if (isDecrease) {
      movementUnitCost = batchContext
        ? (batchContext.quantity > 0 ? batchContext.totalValue / batchContext.quantity : 0)
        : oldAvg;
    } else {
      if (input.unitCost === undefined || input.unitCost === null || input.unitCost === '') {
        throw new InventoryValidationError('unitCost is required for receipts and inbound transfers');
      }
      movementUnitCost = Number(input.unitCost);
      if (!Number.isFinite(movementUnitCost) || movementUnitCost < 0) {
        throw new InventoryValidationError('unitCost must be a non-negative number');
      }
    }

    // Issuing a whole batch removes its exact value (no rounding residue).
    const movementTotalValue = batchContext && isDecrease && quantityNum === batchContext.quantity
      ? batchContext.totalValue
      : movementUnitCost * quantityNum;
    const newQty = isDecrease ? oldQty - quantityNum : oldQty + quantityNum;
    let newAvg: number;
    let newStockValue: number;
    if (batchContext) {
      // Item value = sum of its batch values; the item average is derived from it.
      const oldValue = bal ? Number(bal.totalValue) : 0;
      newStockValue = newQty > 0 ? (isDecrease ? oldValue - movementTotalValue : oldValue + movementTotalValue) : 0;
      newAvg = newQty > 0 ? newStockValue / newQty : 0;
    } else {
      newAvg = isDecrease
        ? oldAvg
        : (newQty > 0 ? ((oldQty * oldAvg) + movementTotalValue) / newQty : movementUnitCost);
      newStockValue = newQty * newAvg;
    }

    const movement = await this.repository.insertMovement({
      id: randomUUID(),
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      movementType: input.movementType,
      quantity: input.quantity,
      signedQuantity,
      movementDate: movementDate.toISOString(),
      note,
      unitCost: movementUnitCost.toFixed(6),
      totalValue: movementTotalValue.toFixed(4),
      sourceModule: input.sourceModule,
      sourceId: input.sourceId,
      batchId: batchContext?.batchId,
      purpose,
    });

    await this.repository.applyDelta(input.itemId, input.warehouseId, signedQuantity);

    if (serialPlan) {
      await this.applySerialMovement(serialPlan, movement.id, input, isDecrease, batchContext?.batchId ?? null, warehouseRecord.orgNodeId);
    }

    if (batchContext) {
      const batchQty = isDecrease ? batchContext.quantity - quantityNum : batchContext.quantity + quantityNum;
      const batchValue = batchQty > 0
        ? (isDecrease ? batchContext.totalValue - movementTotalValue : batchContext.totalValue + movementTotalValue)
        : 0;
      await this.repository.upsertBatchBalance({
        batchId: batchContext.batchId,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        quantity: batchQty.toFixed(6),
        valuationRate: (batchQty > 0 ? batchValue / batchQty : 0).toFixed(6),
        totalValue: batchValue.toFixed(6),
      });
    }
    
    await this.repository.applyValuation(input.itemId, input.warehouseId, {
      averageCost: newAvg.toFixed(6),
      totalValue: newStockValue.toFixed(4),
      lastPurchaseCost: input.movementType === 'receipt' ? movementUnitCost.toFixed(6) : undefined,
    });

    await this.repository.insertLedgerEntry({
      id: randomUUID(),
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      movementId: movement.id,
      batchId: batchContext?.batchId,
      quantityChange: signedQuantity,
      balanceQtyAfter: newQty.toFixed(6),
      incomingRate: isDecrease ? '0' : movementUnitCost.toFixed(6),
      valuationRate: newAvg.toFixed(6),
      stockValueChange: isDecrease ? `-${movementTotalValue.toFixed(4)}` : movementTotalValue.toFixed(4),
      stockValueAfter: newStockValue.toFixed(4),
    });

    if (this.postingEngine && movementTotalValue > 0) {
      await this.postingEngine.postStockMovement({
        movementId: movement.id,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        orgNodeId: warehouseRecord.orgNodeId,
        movementType: input.movementType,
        quantity: input.quantity,
        unitCost: movementUnitCost.toFixed(6),
        totalValue: movementTotalValue.toFixed(4),
        movementDate: movementDate.toISOString(),
        note,
        sourceModule: input.sourceModule,
        sourceId: input.sourceId,
      });
    }

    return serialPlan ? { ...movement, serialNos: serialPlan.map((p) => p.serialNo) } : movement;
  }

  private async getItemTracking(itemId: string): Promise<ItemRecord | null> {
    if (!this.catalogService) return null;
    try {
      return await this.catalogService.getItem(itemId);
    } catch (err) {
      if (err instanceof CatalogNotFoundError) throw new InventoryNotFoundError(`item ${itemId} does not exist`);
      throw err;
    }
  }

  private async resolveBatchContext(
    input: CreateMovementInput,
    tracking: ItemRecord | null,
    isDecrease: boolean,
    movementDate: Date,
    quantityNum: number,
  ): Promise<{ batchId: string; quantity: number; totalValue: number } | null> {
    if (!tracking?.hasBatchNo) {
      if (input.batchId) {
        throw new InventoryValidationError(`item ${input.itemId} is not batch-tracked; batchId must not be set`);
      }
      return null;
    }
    if (!input.batchId) {
      throw new InventoryValidationError(`item ${input.itemId} is batch-tracked: batchId is required for every stock movement`);
    }
    const batch = await this.repository.findBatchById(input.batchId);
    if (!batch) throw new InventoryNotFoundError(`item batch ${input.batchId} does not exist`);
    if (batch.itemId !== input.itemId) {
      throw new InventoryValidationError(`batch ${batch.batchNumber} belongs to a different item`);
    }
    if (isDecrease) {
      if (batch.status !== 'active') {
        throw new InventoryValidationError(`batch ${batch.batchNumber} is "${batch.status}" and cannot be issued`);
      }
      if (batch.expiryDate && new Date(batch.expiryDate).getTime() < movementDate.getTime()) {
        throw new InventoryValidationError(`batch ${batch.batchNumber} expired on ${batch.expiryDate} and cannot be issued`);
      }
    } else if (batch.status === 'recalled') {
      throw new InventoryValidationError(`batch ${batch.batchNumber} is recalled and cannot receive stock`);
    }
    const balance = await this.repository.findBatchBalance(batch.id, input.warehouseId);
    const quantity = balance ? Number(balance.quantity) : 0;
    const totalValue = balance ? Number(balance.totalValue) : 0;
    if (isDecrease && quantity < quantityNum) {
      throw new InventoryValidationError(
        `insufficient stock in batch ${batch.batchNumber}: available ${quantity}, requested ${quantityNum}`,
      );
    }
    return { batchId: batch.id, quantity, totalValue };
  }

  private async resolveSerials(
    input: CreateMovementInput,
    tracking: ItemRecord | null,
    isDecrease: boolean,
    quantityNum: number,
    batchId: string | null,
  ): Promise<Array<{ serialNo: string; existing: SerialNumberRecord | null }> | null> {
    if (!tracking?.hasSerialNo) {
      if (input.serialNos && input.serialNos.length > 0) {
        throw new InventoryValidationError(`item ${input.itemId} is not serial-tracked; serialNos must not be set`);
      }
      return null;
    }
    if (!Number.isInteger(quantityNum)) {
      throw new InventoryValidationError('quantity must be a whole number for serial-tracked items');
    }
    const serialNos = (input.serialNos ?? []).map((s) => s.trim()).filter((s) => s.length > 0);
    if (serialNos.length !== quantityNum) {
      throw new InventoryValidationError(
        `item ${input.itemId} is serial-tracked: ${quantityNum} serial numbers required, got ${serialNos.length}`,
      );
    }
    const duplicate = serialNos.find((s, idx) => serialNos.indexOf(s) !== idx);
    if (duplicate) throw new InventoryValidationError(`serial number "${duplicate}" is listed more than once`);

    const plan: Array<{ serialNo: string; existing: SerialNumberRecord | null }> = [];
    for (const serialNo of serialNos) {
      const existing = await this.repository.findSerialByNo(input.itemId, serialNo);
      if (isDecrease) {
        if (!existing) throw new InventoryNotFoundError(`serial number "${serialNo}" does not exist for this item`);
        if (existing.status !== 'active' || existing.warehouseId !== input.warehouseId) {
          throw new InventoryValidationError(`serial number "${serialNo}" is not in stock in this warehouse`);
        }
        if (batchId && existing.batchId !== batchId) {
          throw new InventoryValidationError(`serial number "${serialNo}" does not belong to the selected batch`);
        }
      } else if (existing) {
        if (existing.status === 'active' && existing.warehouseId) {
          throw new InventoryValidationError(`serial number "${serialNo}" is already in stock`);
        }
        if (existing.status === 'decommissioned') {
          throw new InventoryValidationError(`serial number "${serialNo}" is decommissioned and cannot be received`);
        }
      }
      plan.push({ serialNo, existing });
    }
    return plan;
  }

  private async applySerialMovement(
    plan: Array<{ serialNo: string; existing: SerialNumberRecord | null }>,
    movementId: string,
    input: CreateMovementInput,
    isDecrease: boolean,
    batchId: string | null,
    orgNodeId: string,
  ): Promise<void> {
    const serialIds: string[] = [];
    for (const { serialNo, existing } of plan) {
      if (isDecrease) {
        // issue = left the company; transfer_out = in transit until the matching transfer_in.
        await this.repository.moveSerial(existing!.id, {
          status: input.movementType === 'issue' ? 'delivered' : 'active',
          warehouseId: null,
        });
        serialIds.push(existing!.id);
      } else if (existing) {
        await this.repository.moveSerial(existing.id, { status: 'active', warehouseId: input.warehouseId, batchId });
        serialIds.push(existing.id);
      } else {
        const created = await this.repository.insertSerial({
          id: randomUUID(),
          serialNo,
          itemId: input.itemId,
          orgNodeId,
          warehouseId: input.warehouseId,
          batchId: batchId ?? undefined,
        });
        serialIds.push(created.id);
      }
    }
    await this.repository.insertMovementSerials(movementId, serialIds);
  }

  async getMovementSerialNos(movementId: string): Promise<string[]> {
    return this.repository.listMovementSerialNos(movementId);
  }

  async getSerialMovements(serialId: string): Promise<StockMovementRecord[]> {
    await this.getSerial(serialId);
    return this.repository.listSerialMovements(serialId);
  }

  async getBatchBalances(itemId?: string, warehouseId?: string, batchId?: string): Promise<BatchBalanceRecord[]> {
    return this.repository.listBatchBalances(itemId, warehouseId, batchId);
  }

  /**
   * Moves stock between two warehouses as a transfer_out + transfer_in pair at the source cost
   * (batch cost for batch-tracked items). Used e.g. for "material transfer for manufacture".
   */
  async transferStock(input: TransferStockInput): Promise<TransferStockResult> {
    if (input.fromWarehouseId === input.toWarehouseId) {
      throw new InventoryValidationError('fromWarehouseId and toWarehouseId must be different');
    }
    const purpose = input.purpose ?? 'general';
    if (purpose === 'manufacture_consumption') {
      throw new InventoryValidationError('manufacture_consumption is an issue, not a transfer');
    }
    const target = await this.repository.findWarehouseById(input.toWarehouseId);
    if (!target) throw new InventoryNotFoundError(`warehouse ${input.toWarehouseId} does not exist`);

    // Both legs share one date; check the target leg's backdating rule before moving anything out.
    const movementDate = input.movementDate ? new Date(input.movementDate) : new Date();
    if (Number.isNaN(movementDate.getTime())) {
      throw new InventoryValidationError(`movementDate "${input.movementDate}" is not a valid date`);
    }
    const latestAtTarget = await this.repository.findLatestMovementDate(input.itemId, input.toWarehouseId);
    if (latestAtTarget && movementDate.getTime() < latestAtTarget.getTime()) {
      throw new InventoryValidationError(
        `backdated movement rejected: movementDate ${movementDate.toISOString()} is before the latest movement ` +
        `${latestAtTarget.toISOString()} in the target warehouse`,
      );
    }

    const shared = {
      itemId: input.itemId,
      quantity: input.quantity,
      purpose,
      batchId: input.batchId,
      serialNos: input.serialNos,
      movementDate: movementDate.toISOString(),
      note: input.note,
      sourceModule: input.sourceModule,
      sourceId: input.sourceId,
    };
    const transferOut = await this.createMovement({ ...shared, warehouseId: input.fromWarehouseId, movementType: 'transfer_out' });
    const transferIn = await this.createMovement({
      ...shared,
      warehouseId: input.toWarehouseId,
      movementType: 'transfer_in',
      unitCost: transferOut.unitCost ?? '0',
    });
    return { transferOut, transferIn };
  }

  async getReservations(): Promise<StockReservationRecord[]> {
    return this.repository.listReservations();
  }

  async reserveStock(input: CreateReservationInput): Promise<StockReservationRecord> {
    const quantityNum = Number(input.quantity);
    if (!Number.isFinite(quantityNum) || quantityNum <= 0) {
      throw new InventoryValidationError('reservation quantity must be a positive number');
    }
    if (!input.source || input.source.trim().length === 0) {
      throw new InventoryValidationError('reservation source is required');
    }
    const warehouseRecord = await this.repository.findWarehouseById(input.warehouseId);
    if (!warehouseRecord) {
      throw new InventoryNotFoundError(`warehouse ${input.warehouseId} does not exist`);
    }

    const balance = await this.repository.findBalance(input.itemId, input.warehouseId);
    const currentOnHand = balance ? Number(balance.onHand) : 0;
    const currentReserved = balance ? Number(balance.reserved) : 0;
    const currentAvailable = currentOnHand - currentReserved;
    if (currentAvailable < quantityNum) {
      throw new InventoryValidationError(`insufficient available stock to reserve: available ${currentAvailable}, requested ${quantityNum}`);
    }

    const reservation = await this.repository.insertReservation({
      id: randomUUID(),
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      quantity: input.quantity,
      source: input.source,
    });
    await this.repository.applyReservedDelta(input.itemId, input.warehouseId, input.quantity);
    return reservation;
  }

  async releaseReservation(id: string): Promise<StockReservationRecord> {
    const reservation = await this.repository.findReservationById(id);
    if (!reservation) {
      throw new InventoryNotFoundError(`reservation ${id} does not exist`);
    }
    if (reservation.status === 'released') return reservation;
    await this.repository.applyReservedDelta(reservation.itemId, reservation.warehouseId, `-${reservation.quantity}`);
    return this.repository.setReservationReleased(id);
  }

  async getLedgerEntries(itemId?: string, warehouseId?: string): Promise<StockLedgerEntryRecord[]> {
    return this.repository.listLedgerEntries(itemId, warehouseId);
  }

  // --- Medical Batch & Lot Tracking ---
  async getBatches(itemId?: string, orgNodeId?: string): Promise<ItemBatchRecord[]> {
    return this.repository.listBatches(itemId, orgNodeId);
  }

  async getBatch(id: string): Promise<ItemBatchRecord> {
    const batch = await this.repository.findBatchById(id);
    if (!batch) throw new InventoryNotFoundError(`item batch ${id} does not exist`);
    return batch;
  }

  async createBatch(input: CreateItemBatchInput): Promise<ItemBatchRecord> {
    if (!input.batchNumber || input.batchNumber.trim().length === 0) {
      throw new InventoryValidationError('batchNumber is required');
    }
    if (!input.itemId) throw new InventoryValidationError('itemId is required');
    if (!input.orgNodeId) throw new InventoryValidationError('orgNodeId is required');

    const existing = await this.repository.findBatchByNumber(input.itemId, input.batchNumber.trim());
    if (existing) {
      throw new InventoryValidationError(`batch number "${input.batchNumber}" already exists for this item`);
    }

    // Expiry rules from the item: derive expiry from shelf life, and require it for expiry-tracked items.
    let expiryDate = input.expiryDate;
    const tracking = await this.getItemTracking(input.itemId);
    if (!expiryDate && input.manufacturingDate && tracking?.shelfLifeInDays != null) {
      const derived = new Date(input.manufacturingDate);
      derived.setUTCDate(derived.getUTCDate() + tracking.shelfLifeInDays);
      expiryDate = derived.toISOString();
    }
    if (tracking?.hasExpiryDate && !expiryDate) {
      throw new InventoryValidationError(
        'expiryDate is required for this item (or give manufacturingDate and set the item shelfLifeInDays)',
      );
    }
    if (expiryDate && input.manufacturingDate && new Date(expiryDate) < new Date(input.manufacturingDate)) {
      throw new InventoryValidationError('expiryDate cannot be before manufacturingDate');
    }

    return this.repository.insertBatch({
      ...input,
      expiryDate,
      id: randomUUID(),
      batchNumber: input.batchNumber.trim(),
    });
  }

  async setBatchStatus(id: string, status: ItemBatchStatus): Promise<ItemBatchRecord> {
    await this.getBatch(id);
    return this.repository.setBatchStatus(id, status);
  }

  // --- Serial Number Tracking ---
  async getSerials(itemId?: string, warehouseId?: string, batchId?: string): Promise<SerialNumberRecord[]> {
    return this.repository.listSerials(itemId, warehouseId, batchId);
  }

  async getSerial(id: string): Promise<SerialNumberRecord> {
    const serial = await this.repository.findSerialById(id);
    if (!serial) throw new InventoryNotFoundError(`serial number ${id} does not exist`);
    return serial;
  }

  async createSerialNumber(input: CreateSerialNumberInput): Promise<SerialNumberRecord> {
    if (!input.serialNo || input.serialNo.trim().length === 0) {
      throw new InventoryValidationError('serialNo is required');
    }
    if (!input.itemId) throw new InventoryValidationError('itemId is required');
    if (!input.orgNodeId) throw new InventoryValidationError('orgNodeId is required');

    const existing = await this.repository.findSerialByNo(input.itemId, input.serialNo.trim());
    if (existing) {
      throw new InventoryValidationError(`serial number "${input.serialNo}" already exists for this item`);
    }

    return this.repository.insertSerial({
      ...input,
      id: randomUUID(),
      serialNo: input.serialNo.trim(),
    });
  }

  async createSerialNumbersBulk(
    itemId: string,
    orgNodeId: string,
    serialNumbers: string[],
    warehouseId?: string,
    batchId?: string,
  ): Promise<SerialNumberRecord[]> {
    const results: SerialNumberRecord[] = [];
    for (const s of serialNumbers) {
      const trimmed = s.trim();
      if (!trimmed) continue;
      const created = await this.createSerialNumber({
        serialNo: trimmed,
        itemId,
        orgNodeId,
        warehouseId,
        batchId,
      });
      results.push(created);
    }
    return results;
  }

  async setSerialStatus(id: string, status: SerialNumberStatus, warehouseId?: string, deliveryOrderId?: string): Promise<SerialNumberRecord> {
    await this.getSerial(id);
    return this.repository.setSerialStatus(id, status, warehouseId, deliveryOrderId);
  }

  // --- Stock Reconciliation Engine ---
  async reconcileStock(input: ReconcileStockInput): Promise<ReconcileStockResult> {
    const targetPhysicalQty = Number(input.physicalQty);
    if (!Number.isFinite(targetPhysicalQty) || targetPhysicalQty < 0) {
      throw new InventoryValidationError('الكمية الفعلية للجرد يجب أن تكون رقماً موجباً أو صفراً');
    }

    const warehouseRecord = await this.repository.findWarehouseById(input.warehouseId);
    if (!warehouseRecord) {
      throw new InventoryNotFoundError(`المخزن ${input.warehouseId} غير موجود`);
    }

    // الجرد العادي بيكتب على رصيد الصنف مباشرة، فمينفعش مع الأصناف المتتبّعة بالدفعة/السيريال
    // (كان هيلخبط أرصدة الدفعات وحالة السيريالات). التسوية لازم تتم بحركة مخزون تحدد الدفعة/السيريال.
    const tracking = await this.getItemTracking(input.itemId);
    if (tracking?.hasBatchNo || tracking?.hasSerialNo) {
      const trackedBy = tracking.hasBatchNo && tracking.hasSerialNo
        ? 'الدفعة والسيريال'
        : tracking.hasBatchNo ? 'الدفعة' : 'السيريال';
      throw new InventoryValidationError(
        `لا يمكن جرد هذا الصنف بالجرد العادي لأنه متتبّع بـ${trackedBy}. ` +
        'استخدم حركة مخزون بدلاً منه: صرف (issue) للعجز أو تسوية (adjustment) للزيادة، مع تحديد الدفعة (batchId) و/أو أرقام السيريال (serialNos).',
      );
    }

    const bal = await this.repository.findBalance(input.itemId, input.warehouseId);
    const currentOnHand = bal ? Number(bal.onHand) : 0;
    const currentAvg = bal ? Number(bal.averageCost) : 0;
    const diff = targetPhysicalQty - currentOnHand;

    if (Math.abs(diff) < 0.000001) {
      return {
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        previousQty: currentOnHand.toFixed(6),
        physicalQty: targetPhysicalQty.toFixed(6),
        differenceQty: '0.000000',
        adjustmentType: 'none',
      };
    }

    const isSurplus = diff > 0;
    const diffQtyAbs = Math.abs(diff);
    const signedQty = diff.toFixed(6);
    const unitCost = currentAvg > 0 ? currentAvg : 0;
    const totalAdjustmentValue = diffQtyAbs * unitCost;

    const movement = await this.repository.insertMovement({
      id: randomUUID(),
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      movementType: 'adjustment',
      quantity: diffQtyAbs.toFixed(6),
      signedQuantity: signedQty,
      movementDate: new Date().toISOString(),
      note: input.note ?? `جرد وتسوية مخزنية: من ${currentOnHand} إلى ${targetPhysicalQty}`,
      unitCost: unitCost.toFixed(6),
      totalValue: totalAdjustmentValue.toFixed(4),
      sourceModule: 'inventory',
      sourceId: 'stock_reconciliation',
    });

    await this.repository.applyDelta(input.itemId, input.warehouseId, signedQty);
    await this.repository.applyValuation(input.itemId, input.warehouseId, {
      averageCost: unitCost.toFixed(6),
      totalValue: (targetPhysicalQty * unitCost).toFixed(4),
    });

    await this.repository.insertLedgerEntry({
      id: randomUUID(),
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      movementId: movement.id,
      quantityChange: signedQty,
      balanceQtyAfter: targetPhysicalQty.toFixed(6),
      incomingRate: unitCost.toFixed(6),
      valuationRate: unitCost.toFixed(6),
      stockValueChange: isSurplus ? totalAdjustmentValue.toFixed(4) : `-${totalAdjustmentValue.toFixed(4)}`,
      stockValueAfter: (targetPhysicalQty * unitCost).toFixed(4),
    });

    if (this.postingEngine && totalAdjustmentValue > 0) {
      await this.postingEngine.postStockMovement({
        movementId: movement.id,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        orgNodeId: warehouseRecord.orgNodeId,
        movementType: 'adjustment',
        quantity: signedQty,
        unitCost: unitCost.toFixed(6),
        totalValue: totalAdjustmentValue.toFixed(4),
        note: movement.note,
        sourceModule: 'inventory',
        sourceId: 'stock_reconciliation',
      });
    }

    return {
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      previousQty: currentOnHand.toFixed(6),
      physicalQty: targetPhysicalQty.toFixed(6),
      differenceQty: diff.toFixed(6),
      adjustmentType: isSurplus ? 'surplus' : 'shortage',
      movementRecord: movement,
    };
  }

  // --- Landed Cost Voucher Engine ---
  async getLandedCostVouchers(orgNodeId?: string): Promise<LandedCostVoucherRecord[]> {
    return this.repository.listLandedCostVouchers(orgNodeId);
  }

  async getLandedCostVoucher(id: string): Promise<LandedCostVoucherRecord> {
    const found = await this.repository.findLandedCostVoucherById(id);
    if (!found) throw new InventoryNotFoundError(`Landed cost voucher ${id} does not exist`);
    return found;
  }

  async createLandedCostVoucher(input: CreateLandedCostVoucherInput): Promise<LandedCostVoucherRecord> {
    if (!input.orgNodeId) throw new InventoryValidationError('orgNodeId is required');
    if (!input.expenseAccountId) throw new InventoryValidationError('expenseAccountId is required');

    const totalExpense = Number(input.totalExpenseAmount);
    if (!Number.isFinite(totalExpense) || totalExpense <= 0) {
      throw new InventoryValidationError('totalExpenseAmount must be positive');
    }
    if (!input.items || input.items.length === 0) {
      throw new InventoryValidationError('Landed cost voucher must have at least one receipt item');
    }

    const distributeMethod = input.distributeMethod ?? 'by_amount';

    // Calculate basis sum for distribution
    let basisSum = 0;
    for (const item of input.items) {
      const qty = Number(item.quantity);
      const rate = Number(item.originalRate);
      if (qty <= 0 || rate < 0) throw new InventoryValidationError('Invalid receipt quantity or rate in item list');
      basisSum += distributeMethod === 'by_amount' ? (qty * rate) : qty;
    }

    if (basisSum === 0) throw new InventoryValidationError('Total distribution basis is zero');

    // Distribute expense onto each item
    const computedItems = input.items.map((item) => {
      const qty = Number(item.quantity);
      const rate = Number(item.originalRate);
      const itemBasis = distributeMethod === 'by_amount' ? (qty * rate) : qty;
      const allocated = (itemBasis / basisSum) * totalExpense;
      const addedRatePerUnit = allocated / qty;
      const newValuationRate = rate + addedRatePerUnit;

      return {
        id: randomUUID(),
        receiptMovementId: item.receiptMovementId,
        itemId: item.itemId,
        warehouseId: item.warehouseId,
        quantity: item.quantity,
        originalRate: item.originalRate,
        allocatedExpense: allocated.toFixed(4),
        newValuationRate: newValuationRate.toFixed(6),
      };
    });

    const sequence = (await this.repository.countLandedCostVouchers()) + 1;
    const year = new Date().getFullYear();
    const voucherNumber = `LCV-${year}-${String(sequence).padStart(6, '0')}`;

    return this.repository.insertLandedCostVoucher({
      ...input,
      id: randomUUID(),
      voucherNumber,
      totalExpenseAmount: totalExpense.toFixed(4),
      computedItems,
    });
  }

  async postLandedCostVoucher(id: string): Promise<LandedCostVoucherRecord> {
    const voucher = await this.getLandedCostVoucher(id);
    if (voucher.status !== 'draft') {
      throw new InventoryValidationError(`Voucher ${id} is "${voucher.status}" and cannot be posted`);
    }

    // Capitalize expenses onto stock balance & stock ledger
    for (const item of voucher.items) {
      const addedExpenseVal = Number(item.allocatedExpense);
      const newRate = Number(item.newValuationRate);

      const bal = await this.repository.findBalance(item.itemId, item.warehouseId);
      const currentQty = bal ? Number(bal.onHand) : 0;
      const currentTotalVal = bal ? Number(bal.totalValue) : 0;
      const updatedTotalVal = currentTotalVal + addedExpenseVal;
      const updatedAvg = currentQty > 0 ? (updatedTotalVal / currentQty) : newRate;

      // Update Stock Valuation
      await this.repository.applyValuation(item.itemId, item.warehouseId, {
        averageCost: updatedAvg.toFixed(6),
        totalValue: updatedTotalVal.toFixed(4),
      });

      // Record Revaluation in Stock Ledger
      await this.repository.insertLedgerEntry({
        id: randomUUID(),
        itemId: item.itemId,
        warehouseId: item.warehouseId,
        movementId: item.receiptMovementId,
        quantityChange: '0.000000',
        balanceQtyAfter: currentQty.toFixed(6),
        incomingRate: '0.000000',
        valuationRate: updatedAvg.toFixed(6),
        stockValueChange: addedExpenseVal.toFixed(4),
        stockValueAfter: updatedTotalVal.toFixed(4),
      });
    }

    // Automated GL Entry for Capitalization:
    // [Dr: Inventory Asset (Warehouse-Specific) / Cr: Freight/Customs Expense Account]
    if (this.postingEngine && Number(voucher.totalExpenseAmount) > 0) {
      const firstItem = voucher.items[0]!;
      const accounts = await this.postingEngine.resolveStockMovementAccounts(
        voucher.orgNodeId,
        firstItem.warehouseId,
        'receipt',
      );

      if (accounts) {
        const draftJournal = await this.postingEngine['accountingService'].createEntry({
          orgNodeId: voucher.orgNodeId,
          description: `[Auto] رسملة مصاريف الشحن وتكلفة الواردات لسند ${voucher.voucherNumber}`,
          reference: voucher.voucherNumber,
          entryDate: voucher.postingDate,
          isAutoGenerated: true,
          idempotencyKey: `landed-cost-${voucher.id}`,
          sourceEventType: 'landed_cost',
          lines: [
            {
              accountId: accounts.inventoryAccountId,
              debitAmount: voucher.totalExpenseAmount,
              creditAmount: '0',
              description: `[Auto] رسملة تكلفة شحن المخزون: ${voucher.voucherNumber}`,
            },
            {
              accountId: voucher.expenseAccountId,
              debitAmount: '0',
              creditAmount: voucher.totalExpenseAmount,
              description: `[Auto] وسيط مصاريف الشحن والنقل: ${voucher.voucherNumber}`,
            },
          ],
        });

        await this.postingEngine['accountingService'].postEntry(draftJournal.id);
      }
    }

    return this.repository.setLandedCostVoucherStatus(id, 'posted');
  }

  async cancelLandedCostVoucher(id: string): Promise<LandedCostVoucherRecord> {
    const voucher = await this.getLandedCostVoucher(id);
    if (voucher.status === 'posted') {
      throw new InventoryValidationError(`Voucher ${id} is already posted and cannot be cancelled`);
    }
    return this.repository.setLandedCostVoucherStatus(id, 'cancelled');
  }
}

function normalizeCode(raw: unknown): string {
  if (typeof raw !== 'string') throw new InventoryValidationError('code is required');
  const trimmed = raw.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(trimmed)) {
    throw new InventoryValidationError('code must match ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$');
  }
  return trimmed;
}

function normalizeName(raw: unknown): string {
  if (typeof raw !== 'string') throw new InventoryValidationError('name is required');
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new InventoryValidationError('name must not be blank');
  return trimmed;
}