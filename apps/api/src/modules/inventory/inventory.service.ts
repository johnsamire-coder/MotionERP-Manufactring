import { randomUUID } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { PostingEngineService } from '../accounting/posting-engine.service';
import { CatalogNotFoundError } from '../catalog/catalog.errors';
import { CatalogService } from '../catalog/catalog.service';
import { SalesService } from '../sales/sales.service';
import { PurchaseAllowanceService } from '../settings/purchase-allowance.service';
import type { ItemRecord } from '../catalog/catalog.types';
import { InventoryNotFoundError, InventoryValidationError } from './inventory.errors';
import { InventoryRepository } from './inventory.repository';
import { InventoryAccessService } from './inventory-access.service';
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
import { RESERVING_TYPES, type ReservationType, type StockBinRecord } from './inventory.types';

const RESERVATION_TYPES: readonly ReservationType[] = [
  'sales_order', 'production', 'subcontract', 'production_plan', 'purchase_order', 'material_request', 'work_order',
];

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
    @Optional() private readonly access?: InventoryAccessService,
    @Optional() private readonly salesService?: SalesService,
    @Optional() private readonly allowances?: PurchaseAllowanceService,
  ) {}

  /**
   * Over-receipt allowance (plan item 12): a receipt against a purchase order (an approved
   * incoming quotation) may bring the received total above the ordered quantity only within
   * the configured %. Returns the source fields to stamp on the movement.
   */
  private async checkReceiptAgainstOrder(
    input: CreateMovementInput, quantityNum: number, orgNodeId: string,
  ): Promise<{ sourceModule: string; sourceId: string } | null> {
    if (!input.purchaseOrderId) return null;
    if (input.movementType !== 'receipt') throw new InventoryValidationError('purchaseOrderId only applies to receipts');
    if (!this.salesService) throw new InventoryValidationError('purchase orders are not available');
    const order = await this.salesService.getQuotation(input.purchaseOrderId).catch(() => null);
    if (!order || order.direction !== 'incoming') throw new InventoryNotFoundError(`purchase order ${input.purchaseOrderId} does not exist`);
    if (order.status !== 'approved') throw new InventoryValidationError(`purchase order ${order.quotationNumber} is "${order.status}", not approved`);
    const ordered = order.lines.filter((l) => l.itemId === input.itemId).reduce((a, l) => a + Number(l.quantity), 0);
    if (ordered <= 0) throw new InventoryValidationError(`item ${input.itemId} is not on purchase order ${order.quotationNumber}`);
    const received = await this.repository.sumReceivedForOrder(order.id, input.itemId);
    const pct = this.allowances ? (await this.allowances.resolve(orgNodeId)).overReceiptPct : 0;
    const max = PurchaseAllowanceService.limit(ordered, pct);
    if (received + quantityNum > max + 1e-9) {
      throw new InventoryValidationError(
        `الاستلام يتجاوز أمر الشراء ${order.quotationNumber}: المطلوب ${ordered}، المستلم سابقاً ${received}، ` +
        `الحالي ${quantityNum}، والحد المسموح ${Number(max.toFixed(4))} (نسبة السماح ${pct}%)`,
      );
    }
    return { sourceModule: 'purchase_order', sourceId: order.id };
  }

  async getMovement(id: string): Promise<StockMovementRecord> {
    const found = await this.repository.findMovementById(id);
    if (!found) throw new InventoryNotFoundError(`stock movement ${id} does not exist`);
    return found;
  }

  // --- User restrictions (plan item 5.2): no-ops without a logged-in, restricted user ---
  private async assertWarehouseAllowed(warehouseId: string): Promise<void> {
    if (this.access) await this.access.assertWarehouseAllowed(warehouseId);
  }

  private async filterByWarehouse<T extends { warehouseId: string | null }>(rows: T[], requestedWarehouseId?: string): Promise<T[]> {
    if (!this.access) return rows;
    if (requestedWarehouseId) await this.access.assertWarehouseAllowed(requestedWarehouseId);
    const allowed = await this.access.allowedWarehouseIds();
    return allowed ? rows.filter((r) => r.warehouseId !== null && allowed.has(r.warehouseId)) : rows;
  }

  async getWarehouses(): Promise<WarehouseRecord[]> {
    const warehouses = await this.repository.listWarehouses();
    const allowed = this.access ? await this.access.allowedWarehouseIds() : null;
    return allowed ? warehouses.filter((w) => allowed.has(w.id)) : warehouses;
  }

  async createWarehouse(input: CreateWarehouseInput): Promise<WarehouseRecord> {
    const code = normalizeCode(input.code);
    const name = normalizeName(input.name);
    if (this.access) await this.access.assertCanCreateWarehouse(input.orgNodeId);
    const existing = await this.repository.findWarehouseByCode(code);
    if (existing) {
      throw new InventoryValidationError(`a warehouse with code "${code}" already exists`);
    }
    return this.repository.insertWarehouse({ id: randomUUID(), code, name, orgNodeId: input.orgNodeId });
  }

  async getBalances(): Promise<StockBalanceRecord[]> {
    return this.filterByWarehouse(await this.repository.listBalances());
  }

  async getMovements(): Promise<StockMovementRecord[]> {
    return this.filterByWarehouse(await this.repository.listMovements());
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
    await this.assertWarehouseAllowed(input.warehouseId);
    const orderSource = await this.checkReceiptAgainstOrder(input, quantityNum, warehouseRecord.orgNodeId);

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
      sourceModule: orderSource?.sourceModule ?? input.sourceModule,
      sourceId: orderSource?.sourceId ?? input.sourceId,
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
    return this.filterByWarehouse(await this.repository.listBatchBalances(itemId, warehouseId, batchId), warehouseId);
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
    // Both ends must be allowed before anything leaves the source.
    await this.assertWarehouseAllowed(input.fromWarehouseId);
    await this.assertWarehouseAllowed(input.toWarehouseId);
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
    return this.filterByWarehouse(await this.repository.listReservations());
  }

  async reserveStock(input: CreateReservationInput): Promise<StockReservationRecord> {
    const quantityNum = Number(input.quantity);
    if (!Number.isFinite(quantityNum) || quantityNum <= 0) {
      throw new InventoryValidationError('reservation quantity must be a positive number');
    }
    await this.assertWarehouseAllowed(input.warehouseId);
    if (!input.source || input.source.trim().length === 0) {
      throw new InventoryValidationError('reservation source is required');
    }
    const warehouseRecord = await this.repository.findWarehouseById(input.warehouseId);
    if (!warehouseRecord) {
      throw new InventoryNotFoundError(`warehouse ${input.warehouseId} does not exist`);
    }

    const reservationType = input.reservationType ?? 'sales_order';
    if (!RESERVATION_TYPES.includes(reservationType)) {
      throw new InventoryValidationError(`reservationType must be one of: ${RESERVATION_TYPES.join(', ')}`);
    }
    // Plan item 13: only "reserving" types hold existing stock; ordered / indented / planned
    // quantities are expectations and neither need nor lock available stock.
    const reserving = RESERVING_TYPES.includes(reservationType);
    if (reserving) {
      const balance = await this.repository.findBalance(input.itemId, input.warehouseId);
      const currentOnHand = balance ? Number(balance.onHand) : 0;
      const currentReserved = balance ? Number(balance.reserved) : 0;
      const currentAvailable = currentOnHand - currentReserved;
      if (currentAvailable < quantityNum) {
        throw new InventoryValidationError(`insufficient available stock to reserve: available ${currentAvailable}, requested ${quantityNum}`);
      }
    }

    const reservation = await this.repository.insertReservation({
      id: randomUUID(),
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      quantity: input.quantity,
      source: input.source,
      reservationType,
    });
    if (reserving) await this.repository.applyReservedDelta(input.itemId, input.warehouseId, input.quantity);
    return reservation;
  }

  async releaseReservation(id: string): Promise<StockReservationRecord> {
    const reservation = await this.repository.findReservationById(id);
    if (!reservation) {
      throw new InventoryNotFoundError(`reservation ${id} does not exist`);
    }
    await this.assertWarehouseAllowed(reservation.warehouseId);
    if (reservation.status === 'released') return reservation;
    if (RESERVING_TYPES.includes(reservation.reservationType)) {
      await this.repository.applyReservedDelta(reservation.itemId, reservation.warehouseId, `-${reservation.quantity}`);
    }
    return this.repository.setReservationReleased(id);
  }

  /**
   * Bin view (plan item 13): per item / warehouse, actual stock plus each active reservation /
   * request type kept separate, with available and projected quantities derived from them.
   */
  async getBins(itemId?: string, warehouseId?: string): Promise<StockBinRecord[]> {
    const balances = (await this.getBalances())
      .filter((b) => (!itemId || b.itemId === itemId) && (!warehouseId || b.warehouseId === warehouseId));
    const reservations = (await this.getReservations())
      .filter((r) => r.status === 'active' && (!itemId || r.itemId === itemId) && (!warehouseId || r.warehouseId === warehouseId));
    const bins = new Map<string, { itemId: string; warehouseId: string; actual: number; by: Record<ReservationType, number> }>();
    const bin = (i: string, w: string): { itemId: string; warehouseId: string; actual: number; by: Record<ReservationType, number> } => {
      const key = `${i}|${w}`;
      let b = bins.get(key);
      if (!b) {
        b = { itemId: i, warehouseId: w, actual: 0, by: Object.fromEntries(RESERVATION_TYPES.map((t) => [t, 0])) as Record<ReservationType, number> };
        bins.set(key, b);
      }
      return b;
    };
    for (const b of balances) bin(b.itemId, b.warehouseId).actual = Number(b.onHand);
    for (const r of reservations) bin(r.itemId, r.warehouseId).by[r.reservationType] += Number(r.quantity);
    const f = (n: number): string => n.toFixed(6);
    return [...bins.values()].map((b) => {
      const reserved = RESERVING_TYPES.reduce((a, t) => a + b.by[t], 0);
      const expected = b.by.purchase_order + b.by.material_request + b.by.work_order;
      return {
        itemId: b.itemId, warehouseId: b.warehouseId, actualQty: f(b.actual),
        reservedQty: f(b.by.sales_order), reservedForProduction: f(b.by.production),
        reservedForSubcontract: f(b.by.subcontract), reservedForProductionPlan: f(b.by.production_plan),
        orderedQty: f(b.by.purchase_order), indentedQty: f(b.by.material_request), plannedQty: f(b.by.work_order),
        availableQty: f(b.actual - reserved), projectedQty: f(b.actual + expected - reserved),
      };
    });
  }

  async getLedgerEntries(itemId?: string, warehouseId?: string): Promise<StockLedgerEntryRecord[]> {
    return this.filterByWarehouse(await this.repository.listLedgerEntries(itemId, warehouseId), warehouseId);
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
    return this.filterByWarehouse(await this.repository.listSerials(itemId, warehouseId, batchId), warehouseId);
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
    await this.assertWarehouseAllowed(input.warehouseId);

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