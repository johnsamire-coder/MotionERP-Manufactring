import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import {
  batchBalance,
  itemBatch,
  landedCostItem,
  landedCostVoucher,
  serialNumber,
  stockMovementSerial,
  stockBalance,
  stockLedgerEntry,
  stockMovement,
  stockReservation,
  warehouse,
} from './inventory.schema';
import type {
  CreateMovementInput,
  CreateReservationInput,
  CreateWarehouseInput,
  MovementType,
  MovementPurpose,
  ReservationStatus,
  ReservationType,
  StockBalanceRecord,
  StockMovementRecord,
  StockReservationRecord,
  WarehouseRecord,
  WarehouseStatus,
  StockLedgerEntryRecord,
  CreateStockLedgerEntryInput,
  ItemBatchRecord,
  BatchBalanceRecord,
  CreateItemBatchInput,
  ItemBatchStatus,
  SerialNumberRecord,
  CreateSerialNumberInput,
  SerialNumberStatus,
  LandedCostVoucherRecord,
  LandedCostItemRecord,
  CreateLandedCostVoucherInput,
  LandedCostStatus,
} from './inventory.types';
import type { LandedCostDistributeMethod } from './inventory.types';

const warehouseColumns = {
  id: warehouse.id,
  code: warehouse.code,
  name: warehouse.name,
  orgNodeId: warehouse.orgNodeId,
  status: warehouse.status,
  parentWarehouseId: warehouse.parentWarehouseId,
  isGroup: warehouse.isGroup,
  createdAt: warehouse.createdAt,
  updatedAt: warehouse.updatedAt,
};
const movementColumns = {
  id: stockMovement.id,
  itemId: stockMovement.itemId,
  warehouseId: stockMovement.warehouseId,
  movementType: stockMovement.movementType,
  purpose: stockMovement.purpose,
  quantity: stockMovement.quantity,
  movementDate: stockMovement.movementDate,
  note: stockMovement.note,
  createdAt: stockMovement.createdAt,
  unitCost: stockMovement.unitCost,
  totalValue: stockMovement.totalValue,
  sourceModule: stockMovement.sourceModule,
  sourceId: stockMovement.sourceId,
  batchId: stockMovement.batchId,
};
const reservationColumns = {
  id: stockReservation.id,
  itemId: stockReservation.itemId,
  warehouseId: stockReservation.warehouseId,
  quantity: stockReservation.quantity,
  source: stockReservation.source,
  reservationType: stockReservation.reservationType,
  status: stockReservation.status,
  createdAt: stockReservation.createdAt,
  releasedAt: stockReservation.releasedAt,
};
const ledgerColumns = {
  id: stockLedgerEntry.id,
  itemId: stockLedgerEntry.itemId,
  warehouseId: stockLedgerEntry.warehouseId,
  movementId: stockLedgerEntry.movementId,
  batchId: stockLedgerEntry.batchId,
  quantityChange: stockLedgerEntry.quantityChange,
  balanceQtyAfter: stockLedgerEntry.balanceQtyAfter,
  incomingRate: stockLedgerEntry.incomingRate,
  valuationRate: stockLedgerEntry.valuationRate,
  stockValueChange: stockLedgerEntry.stockValueChange,
  stockValueAfter: stockLedgerEntry.stockValueAfter,
  createdAt: stockLedgerEntry.createdAt,
};
const batchColumns = {
  id: itemBatch.id,
  batchNumber: itemBatch.batchNumber,
  itemId: itemBatch.itemId,
  orgNodeId: itemBatch.orgNodeId,
  manufacturingDate: itemBatch.manufacturingDate,
  expiryDate: itemBatch.expiryDate,
  status: itemBatch.status,
  notes: itemBatch.notes,
  createdAt: itemBatch.createdAt,
  updatedAt: itemBatch.updatedAt,
};
const serialColumns = {
  id: serialNumber.id,
  serialNo: serialNumber.serialNo,
  itemId: serialNumber.itemId,
  warehouseId: serialNumber.warehouseId,
  batchId: serialNumber.batchId,
  orgNodeId: serialNumber.orgNodeId,
  status: serialNumber.status,
  purchaseReceiptId: serialNumber.purchaseReceiptId,
  deliveryOrderId: serialNumber.deliveryOrderId,
  workOrderId: serialNumber.workOrderId,
  notes: serialNumber.notes,
  createdAt: serialNumber.createdAt,
  updatedAt: serialNumber.updatedAt,
};
const lcvColumns = {
  id: landedCostVoucher.id,
  voucherNumber: landedCostVoucher.voucherNumber,
  orgNodeId: landedCostVoucher.orgNodeId,
  postingDate: landedCostVoucher.postingDate,
  totalExpenseAmount: landedCostVoucher.totalExpenseAmount,
  distributeMethod: landedCostVoucher.distributeMethod,
  expenseAccountId: landedCostVoucher.expenseAccountId,
  status: landedCostVoucher.status,
  notes: landedCostVoucher.notes,
  createdAt: landedCostVoucher.createdAt,
  updatedAt: landedCostVoucher.updatedAt,
};
const lciColumns = {
  id: landedCostItem.id,
  voucherId: landedCostItem.voucherId,
  receiptMovementId: landedCostItem.receiptMovementId,
  itemId: landedCostItem.itemId,
  warehouseId: landedCostItem.warehouseId,
  quantity: landedCostItem.quantity,
  originalRate: landedCostItem.originalRate,
  allocatedExpense: landedCostItem.allocatedExpense,
  newValuationRate: landedCostItem.newValuationRate,
  createdAt: landedCostItem.createdAt,
};

function toBatchBalanceRecord(r: typeof batchBalance.$inferSelect): BatchBalanceRecord {
  return {
    id: r.id,
    batchId: r.batchId,
    itemId: r.itemId,
    warehouseId: r.warehouseId,
    quantity: r.quantity,
    valuationRate: r.valuationRate,
    totalValue: r.totalValue,
    updatedAt: r.updatedAt.toISOString(),
  };
}

@Injectable()
export class InventoryRepository {
  constructor(private readonly database: DatabaseService) {}

  // --- Warehouses ---
  async listWarehouses(): Promise<WarehouseRecord[]> {
    const rows = await this.database.db
      .select(warehouseColumns)
      .from(warehouse)
      .orderBy(asc(warehouse.code));
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      orgNodeId: r.orgNodeId,
      status: r.status as WarehouseStatus,
      parentWarehouseId: r.parentWarehouseId,
      isGroup: r.isGroup,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }
  async findWarehouseById(id: string): Promise<WarehouseRecord | null> {
    const rows = await this.database.db
      .select(warehouseColumns)
      .from(warehouse)
      .where(eq(warehouse.id, id))
      .limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      orgNodeId: r.orgNodeId,
      status: r.status as WarehouseStatus,
      parentWarehouseId: r.parentWarehouseId,
      isGroup: r.isGroup,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
  async findWarehouseByCode(code: string): Promise<WarehouseRecord | null> {
    const rows = await this.database.db
      .select(warehouseColumns)
      .from(warehouse)
      .where(eq(warehouse.code, code))
      .limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      orgNodeId: r.orgNodeId,
      status: r.status as WarehouseStatus,
      parentWarehouseId: r.parentWarehouseId,
      isGroup: r.isGroup,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
  async insertWarehouse(input: CreateWarehouseInput & { id: string }): Promise<WarehouseRecord> {
    const rows = await this.database.db
      .insert(warehouse)
      .values({
        id: input.id,
        code: input.code,
        name: input.name,
        orgNodeId: input.orgNodeId,
      })
      .returning(warehouseColumns);
    const r = rows[0]!;
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      orgNodeId: r.orgNodeId,
      status: r.status as WarehouseStatus,
      parentWarehouseId: r.parentWarehouseId,
      isGroup: r.isGroup,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async setWarehouseTree(
    id: string,
    fields: { parentWarehouseId?: string | null; isGroup?: boolean },
  ): Promise<void> {
    await this.database.db
      .update(warehouse)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(warehouse.id, id));
  }

  /** Whether any stock ever touched the warehouse (movements or balance rows). */
  async warehouseHasStockHistory(id: string): Promise<boolean> {
    const m = await this.database.db
      .select({ id: stockMovement.id })
      .from(stockMovement)
      .where(eq(stockMovement.warehouseId, id))
      .limit(1);
    if (m.length > 0) return true;
    const b = await this.database.db
      .select({ id: stockBalance.id })
      .from(stockBalance)
      .where(eq(stockBalance.warehouseId, id))
      .limit(1);
    return b.length > 0;
  }

  // --- Stock Balances & Movements ---
  async listBalances(): Promise<StockBalanceRecord[]> {
    const rows = await this.database.db
      .select({
        id: stockBalance.id,
        itemId: stockBalance.itemId,
        warehouseId: stockBalance.warehouseId,
        onHand: stockBalance.onHand,
        reserved: stockBalance.reserved,
        updatedAt: stockBalance.updatedAt,
        averageCost: stockBalance.averageCost,
        totalValue: stockBalance.totalValue,
        lastPurchaseCost: stockBalance.lastPurchaseCost,
        lastPurchaseAt: stockBalance.lastPurchaseAt,
      })
      .from(stockBalance)
      .orderBy(asc(stockBalance.itemId));
    return rows.map((row) => ({
      id: row.id,
      itemId: row.itemId,
      warehouseId: row.warehouseId,
      onHand: row.onHand,
      reserved: row.reserved,
      available: (Number(row.onHand) - Number(row.reserved)).toString(),
      updatedAt: row.updatedAt.toISOString(),
      averageCost: row.averageCost,
      totalValue: row.totalValue,
      lastPurchaseCost: row.lastPurchaseCost,
      lastPurchaseAt: row.lastPurchaseAt ? row.lastPurchaseAt.toISOString() : null,
    }));
  }

  async findBalance(itemId: string, warehouseId: string) {
    const rows = await this.database.db
      .select({
        id: stockBalance.id,
        itemId: stockBalance.itemId,
        warehouseId: stockBalance.warehouseId,
        onHand: stockBalance.onHand,
        reserved: stockBalance.reserved,
        updatedAt: stockBalance.updatedAt,
        averageCost: stockBalance.averageCost,
        totalValue: stockBalance.totalValue,
        lastPurchaseCost: stockBalance.lastPurchaseCost,
        lastPurchaseAt: stockBalance.lastPurchaseAt,
      })
      .from(stockBalance)
      .where(and(eq(stockBalance.itemId, itemId), eq(stockBalance.warehouseId, warehouseId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async insertMovement(
    input: CreateMovementInput & { id: string; signedQuantity: string; totalValue?: string },
  ): Promise<StockMovementRecord> {
    const rows = await this.database.db
      .insert(stockMovement)
      .values({
        id: input.id,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        movementType: input.movementType,
        purpose: input.purpose ?? 'general',
        quantity: input.signedQuantity,
        movementDate: input.movementDate ? new Date(input.movementDate) : new Date(),
        note: input.note ?? null,
        unitCost: input.unitCost ?? null,
        totalValue: input.totalValue ?? null,
        sourceModule: input.sourceModule ?? null,
        sourceId: input.sourceId ?? null,
        batchId: input.batchId ?? null,
      })
      .returning(movementColumns);
    const r = rows[0]!;
    return {
      id: r.id,
      itemId: r.itemId,
      warehouseId: r.warehouseId,
      movementType: r.movementType as MovementType,
      purpose: r.purpose as MovementPurpose,
      quantity: r.quantity,
      movementDate: r.movementDate.toISOString(),
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      unitCost: r.unitCost,
      totalValue: r.totalValue,
      sourceModule: r.sourceModule,
      sourceId: r.sourceId,
      batchId: r.batchId,
    };
  }

  async findLatestMovementDate(itemId: string, warehouseId: string): Promise<Date | null> {
    const rows = await this.database.db
      .select({ movementDate: stockMovement.movementDate })
      .from(stockMovement)
      .where(and(eq(stockMovement.itemId, itemId), eq(stockMovement.warehouseId, warehouseId)))
      .orderBy(desc(stockMovement.movementDate))
      .limit(1);
    return rows[0]?.movementDate ?? null;
  }

  // --- Batch Balances (per-batch costing) ---
  async findBatchBalance(batchId: string, warehouseId: string): Promise<BatchBalanceRecord | null> {
    const rows = await this.database.db
      .select()
      .from(batchBalance)
      .where(and(eq(batchBalance.batchId, batchId), eq(batchBalance.warehouseId, warehouseId)))
      .limit(1);
    return rows[0] ? toBatchBalanceRecord(rows[0]) : null;
  }

  async listBatchBalances(
    itemId?: string,
    warehouseId?: string,
    batchId?: string,
  ): Promise<BatchBalanceRecord[]> {
    const conditions = [];
    if (itemId) conditions.push(eq(batchBalance.itemId, itemId));
    if (warehouseId) conditions.push(eq(batchBalance.warehouseId, warehouseId));
    if (batchId) conditions.push(eq(batchBalance.batchId, batchId));
    const query = this.database.db.select().from(batchBalance);
    const rows =
      conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(asc(batchBalance.updatedAt))
        : await query.orderBy(asc(batchBalance.updatedAt));
    return rows.map(toBatchBalanceRecord);
  }

  async upsertBatchBalance(input: {
    batchId: string;
    itemId: string;
    warehouseId: string;
    quantity: string;
    valuationRate: string;
    totalValue: string;
  }): Promise<BatchBalanceRecord> {
    const rows = await this.database.db
      .insert(batchBalance)
      .values({
        batchId: input.batchId,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        valuationRate: input.valuationRate,
        totalValue: input.totalValue,
      })
      .onConflictDoUpdate({
        target: [batchBalance.batchId, batchBalance.warehouseId],
        set: {
          quantity: input.quantity,
          valuationRate: input.valuationRate,
          totalValue: input.totalValue,
          updatedAt: new Date(),
        },
      })
      .returning();
    return toBatchBalanceRecord(rows[0]!);
  }

  /** Quantity already received for an item against a purchase order (plan item 12). */
  async sumReceivedForOrder(purchaseOrderId: string, itemId: string): Promise<number> {
    const rows = await this.database.db
      .select({ total: sql<string>`coalesce(sum(${stockMovement.quantity}), 0)` })
      .from(stockMovement)
      .where(
        and(
          eq(stockMovement.sourceModule, 'purchase_order'),
          eq(stockMovement.sourceId, purchaseOrderId),
          eq(stockMovement.itemId, itemId),
          eq(stockMovement.movementType, 'receipt'),
        ),
      );
    return Number(rows[0]?.total ?? 0);
  }

  async findMovementById(id: string): Promise<StockMovementRecord | null> {
    const rows = await this.database.db
      .select(movementColumns)
      .from(stockMovement)
      .where(eq(stockMovement.id, id))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      itemId: r.itemId,
      warehouseId: r.warehouseId,
      movementType: r.movementType as MovementType,
      purpose: r.purpose as MovementPurpose,
      quantity: r.quantity,
      movementDate: r.movementDate.toISOString(),
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      unitCost: r.unitCost,
      totalValue: r.totalValue,
      sourceModule: r.sourceModule,
      sourceId: r.sourceId,
      batchId: r.batchId,
    };
  }

  async listMovements(): Promise<StockMovementRecord[]> {
    const rows = await this.database.db
      .select(movementColumns)
      .from(stockMovement)
      .orderBy(asc(stockMovement.createdAt));
    return rows.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      warehouseId: r.warehouseId,
      movementType: r.movementType as MovementType,
      purpose: r.purpose as MovementPurpose,
      quantity: r.quantity,
      movementDate: r.movementDate.toISOString(),
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      unitCost: r.unitCost,
      totalValue: r.totalValue,
      sourceModule: r.sourceModule,
      sourceId: r.sourceId,
      batchId: r.batchId,
    }));
  }

  async applyDelta(itemId: string, warehouseId: string, delta: string): Promise<void> {
    const existing = await this.findBalance(itemId, warehouseId);
    if (existing) {
      await this.database.db.execute(
        sql`UPDATE ${stockBalance} SET on_hand = on_hand + ${delta}::numeric WHERE id = ${existing.id}`,
      );
    } else {
      await this.database.db
        .insert(stockBalance)
        .values({ itemId, warehouseId, onHand: delta, reserved: '0' });
    }
  }

  async applyValuation(
    itemId: string,
    warehouseId: string,
    v: { averageCost: string; totalValue: string; lastPurchaseCost?: string },
  ): Promise<void> {
    const existing = await this.findBalance(itemId, warehouseId);
    if (!existing) return;
    if (v.lastPurchaseCost !== undefined) {
      await this.database.db.execute(
        sql`UPDATE ${stockBalance} SET average_cost = ${v.averageCost}::numeric, total_value = ${v.totalValue}::numeric, last_purchase_cost = ${v.lastPurchaseCost}::numeric, last_purchase_at = now() WHERE id = ${existing.id}`,
      );
    } else {
      await this.database.db.execute(
        sql`UPDATE ${stockBalance} SET average_cost = ${v.averageCost}::numeric, total_value = ${v.totalValue}::numeric WHERE id = ${existing.id}`,
      );
    }
  }

  async applyReservedDelta(itemId: string, warehouseId: string, delta: string): Promise<void> {
    const existing = await this.findBalance(itemId, warehouseId);
    if (existing) {
      await this.database.db.execute(
        sql`UPDATE ${stockBalance} SET reserved = reserved + ${delta}::numeric WHERE id = ${existing.id}`,
      );
    } else {
      await this.database.db
        .insert(stockBalance)
        .values({ itemId, warehouseId, onHand: '0', reserved: delta });
    }
  }

  // --- Reservations ---
  async listReservations(): Promise<StockReservationRecord[]> {
    const rows = await this.database.db
      .select(reservationColumns)
      .from(stockReservation)
      .orderBy(asc(stockReservation.createdAt));
    return rows.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      warehouseId: r.warehouseId,
      quantity: r.quantity,
      source: r.source,
      reservationType: r.reservationType as ReservationType,
      status: r.status as ReservationStatus,
      createdAt: r.createdAt.toISOString(),
      releasedAt: r.releasedAt ? r.releasedAt.toISOString() : null,
    }));
  }
  async findReservationById(id: string): Promise<StockReservationRecord | null> {
    const rows = await this.database.db
      .select(reservationColumns)
      .from(stockReservation)
      .where(eq(stockReservation.id, id))
      .limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      itemId: r.itemId,
      warehouseId: r.warehouseId,
      quantity: r.quantity,
      source: r.source,
      reservationType: r.reservationType as ReservationType,
      status: r.status as ReservationStatus,
      createdAt: r.createdAt.toISOString(),
      releasedAt: r.releasedAt ? r.releasedAt.toISOString() : null,
    };
  }
  async insertReservation(
    input: CreateReservationInput & { id: string },
  ): Promise<StockReservationRecord> {
    const rows = await this.database.db
      .insert(stockReservation)
      .values({
        id: input.id,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        source: input.source,
        reservationType: input.reservationType ?? 'sales_order',
      })
      .returning(reservationColumns);
    const r = rows[0]!;
    return {
      id: r.id,
      itemId: r.itemId,
      warehouseId: r.warehouseId,
      quantity: r.quantity,
      source: r.source,
      reservationType: r.reservationType as ReservationType,
      status: r.status as ReservationStatus,
      createdAt: r.createdAt.toISOString(),
      releasedAt: r.releasedAt ? r.releasedAt.toISOString() : null,
    };
  }
  async setReservationReleased(id: string): Promise<StockReservationRecord> {
    const rows = await this.database.db
      .update(stockReservation)
      .set({ status: 'released', releasedAt: new Date() })
      .where(eq(stockReservation.id, id))
      .returning(reservationColumns);
    const r = rows[0]!;
    return {
      id: r.id,
      itemId: r.itemId,
      warehouseId: r.warehouseId,
      quantity: r.quantity,
      source: r.source,
      reservationType: r.reservationType as ReservationType,
      status: r.status as ReservationStatus,
      createdAt: r.createdAt.toISOString(),
      releasedAt: r.releasedAt ? r.releasedAt.toISOString() : null,
    };
  }

  // --- Stock Ledger Entry ---
  async insertLedgerEntry(
    input: CreateStockLedgerEntryInput & { id: string },
  ): Promise<StockLedgerEntryRecord> {
    const rows = await this.database.db
      .insert(stockLedgerEntry)
      .values({
        id: input.id,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        movementId: input.movementId ?? null,
        batchId: input.batchId ?? null,
        quantityChange: input.quantityChange,
        balanceQtyAfter: input.balanceQtyAfter,
        incomingRate: input.incomingRate ?? '0',
        valuationRate: input.valuationRate ?? '0',
        stockValueChange: input.stockValueChange ?? '0',
        stockValueAfter: input.stockValueAfter ?? '0',
      })
      .returning(ledgerColumns);
    const r = rows[0]!;
    return {
      id: r.id,
      itemId: r.itemId,
      warehouseId: r.warehouseId,
      movementId: r.movementId,
      batchId: r.batchId,
      quantityChange: r.quantityChange,
      balanceQtyAfter: r.balanceQtyAfter,
      incomingRate: r.incomingRate,
      valuationRate: r.valuationRate,
      stockValueChange: r.stockValueChange,
      stockValueAfter: r.stockValueAfter,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async findLatestLedgerEntry(
    itemId: string,
    warehouseId: string,
  ): Promise<StockLedgerEntryRecord | null> {
    const rows = await this.database.db
      .select(ledgerColumns)
      .from(stockLedgerEntry)
      .where(
        and(eq(stockLedgerEntry.itemId, itemId), eq(stockLedgerEntry.warehouseId, warehouseId)),
      )
      .orderBy(desc(stockLedgerEntry.createdAt))
      .limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      itemId: r.itemId,
      warehouseId: r.warehouseId,
      movementId: r.movementId,
      batchId: r.batchId,
      quantityChange: r.quantityChange,
      balanceQtyAfter: r.balanceQtyAfter,
      incomingRate: r.incomingRate,
      valuationRate: r.valuationRate,
      stockValueChange: r.stockValueChange,
      stockValueAfter: r.stockValueAfter,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async listLedgerEntries(
    itemId?: string,
    warehouseId?: string,
  ): Promise<StockLedgerEntryRecord[]> {
    const conditions = [];
    if (itemId) conditions.push(eq(stockLedgerEntry.itemId, itemId));
    if (warehouseId) conditions.push(eq(stockLedgerEntry.warehouseId, warehouseId));

    const query = this.database.db.select(ledgerColumns).from(stockLedgerEntry);
    const rows =
      conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(asc(stockLedgerEntry.createdAt))
        : await query.orderBy(asc(stockLedgerEntry.createdAt));

    return rows.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      warehouseId: r.warehouseId,
      movementId: r.movementId,
      batchId: r.batchId,
      quantityChange: r.quantityChange,
      balanceQtyAfter: r.balanceQtyAfter,
      incomingRate: r.incomingRate,
      valuationRate: r.valuationRate,
      stockValueChange: r.stockValueChange,
      stockValueAfter: r.stockValueAfter,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // --- Medical Batch & Lot Management ---
  async findBatchByNumber(itemId: string, batchNumber: string): Promise<ItemBatchRecord | null> {
    const rows = await this.database.db
      .select(batchColumns)
      .from(itemBatch)
      .where(and(eq(itemBatch.itemId, itemId), eq(itemBatch.batchNumber, batchNumber)))
      .limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      batchNumber: r.batchNumber,
      itemId: r.itemId,
      orgNodeId: r.orgNodeId,
      manufacturingDate: r.manufacturingDate ? r.manufacturingDate.toISOString() : null,
      expiryDate: r.expiryDate ? r.expiryDate.toISOString() : null,
      status: r.status as ItemBatchStatus,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async findBatchById(id: string): Promise<ItemBatchRecord | null> {
    const rows = await this.database.db
      .select(batchColumns)
      .from(itemBatch)
      .where(eq(itemBatch.id, id))
      .limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      batchNumber: r.batchNumber,
      itemId: r.itemId,
      orgNodeId: r.orgNodeId,
      manufacturingDate: r.manufacturingDate ? r.manufacturingDate.toISOString() : null,
      expiryDate: r.expiryDate ? r.expiryDate.toISOString() : null,
      status: r.status as ItemBatchStatus,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async listBatches(itemId?: string, orgNodeId?: string): Promise<ItemBatchRecord[]> {
    const conditions = [];
    if (itemId) conditions.push(eq(itemBatch.itemId, itemId));
    if (orgNodeId) conditions.push(eq(itemBatch.orgNodeId, orgNodeId));

    const query = this.database.db.select(batchColumns).from(itemBatch);
    const rows =
      conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(desc(itemBatch.createdAt))
        : await query.orderBy(desc(itemBatch.createdAt));

    return rows.map((r) => ({
      id: r.id,
      batchNumber: r.batchNumber,
      itemId: r.itemId,
      orgNodeId: r.orgNodeId,
      manufacturingDate: r.manufacturingDate ? r.manufacturingDate.toISOString() : null,
      expiryDate: r.expiryDate ? r.expiryDate.toISOString() : null,
      status: r.status as ItemBatchStatus,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async insertBatch(input: CreateItemBatchInput & { id: string }): Promise<ItemBatchRecord> {
    const rows = await this.database.db
      .insert(itemBatch)
      .values({
        id: input.id,
        batchNumber: input.batchNumber,
        itemId: input.itemId,
        orgNodeId: input.orgNodeId,
        manufacturingDate: input.manufacturingDate ? new Date(input.manufacturingDate) : null,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        notes: input.notes ?? null,
        status: 'active',
      })
      .returning(batchColumns);
    const r = rows[0]!;
    return {
      id: r.id,
      batchNumber: r.batchNumber,
      itemId: r.itemId,
      orgNodeId: r.orgNodeId,
      manufacturingDate: r.manufacturingDate ? r.manufacturingDate.toISOString() : null,
      expiryDate: r.expiryDate ? r.expiryDate.toISOString() : null,
      status: r.status as ItemBatchStatus,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async setBatchStatus(id: string, status: ItemBatchStatus): Promise<ItemBatchRecord> {
    const rows = await this.database.db
      .update(itemBatch)
      .set({ status, updatedAt: new Date() })
      .where(eq(itemBatch.id, id))
      .returning(batchColumns);
    const r = rows[0]!;
    return {
      id: r.id,
      batchNumber: r.batchNumber,
      itemId: r.itemId,
      orgNodeId: r.orgNodeId,
      manufacturingDate: r.manufacturingDate ? r.manufacturingDate.toISOString() : null,
      expiryDate: r.expiryDate ? r.expiryDate.toISOString() : null,
      status: r.status as ItemBatchStatus,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  // --- Serial Number Tracking ---
  async findSerialByNo(itemId: string, serialNo: string): Promise<SerialNumberRecord | null> {
    const rows = await this.database.db
      .select(serialColumns)
      .from(serialNumber)
      .where(and(eq(serialNumber.itemId, itemId), eq(serialNumber.serialNo, serialNo)))
      .limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      serialNo: r.serialNo,
      itemId: r.itemId,
      warehouseId: r.warehouseId,
      batchId: r.batchId,
      orgNodeId: r.orgNodeId,
      status: r.status as SerialNumberStatus,
      purchaseReceiptId: r.purchaseReceiptId,
      deliveryOrderId: r.deliveryOrderId,
      workOrderId: r.workOrderId,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async findSerialById(id: string): Promise<SerialNumberRecord | null> {
    const rows = await this.database.db
      .select(serialColumns)
      .from(serialNumber)
      .where(eq(serialNumber.id, id))
      .limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      serialNo: r.serialNo,
      itemId: r.itemId,
      warehouseId: r.warehouseId,
      batchId: r.batchId,
      orgNodeId: r.orgNodeId,
      status: r.status as SerialNumberStatus,
      purchaseReceiptId: r.purchaseReceiptId,
      deliveryOrderId: r.deliveryOrderId,
      workOrderId: r.workOrderId,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async listSerials(
    itemId?: string,
    warehouseId?: string,
    batchId?: string,
  ): Promise<SerialNumberRecord[]> {
    const conditions = [];
    if (itemId) conditions.push(eq(serialNumber.itemId, itemId));
    if (warehouseId) conditions.push(eq(serialNumber.warehouseId, warehouseId));
    if (batchId) conditions.push(eq(serialNumber.batchId, batchId));

    const query = this.database.db.select(serialColumns).from(serialNumber);
    const rows =
      conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(desc(serialNumber.createdAt))
        : await query.orderBy(desc(serialNumber.createdAt));

    return rows.map((r) => ({
      id: r.id,
      serialNo: r.serialNo,
      itemId: r.itemId,
      warehouseId: r.warehouseId,
      batchId: r.batchId,
      orgNodeId: r.orgNodeId,
      status: r.status as SerialNumberStatus,
      purchaseReceiptId: r.purchaseReceiptId,
      deliveryOrderId: r.deliveryOrderId,
      workOrderId: r.workOrderId,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async insertSerial(input: CreateSerialNumberInput & { id: string }): Promise<SerialNumberRecord> {
    const rows = await this.database.db
      .insert(serialNumber)
      .values({
        id: input.id,
        serialNo: input.serialNo,
        itemId: input.itemId,
        orgNodeId: input.orgNodeId,
        warehouseId: input.warehouseId ?? null,
        batchId: input.batchId ?? null,
        purchaseReceiptId: input.purchaseReceiptId ?? null,
        workOrderId: input.workOrderId ?? null,
        notes: input.notes ?? null,
        status: 'active',
      })
      .returning(serialColumns);
    const r = rows[0]!;
    return {
      id: r.id,
      serialNo: r.serialNo,
      itemId: r.itemId,
      warehouseId: r.warehouseId,
      batchId: r.batchId,
      orgNodeId: r.orgNodeId,
      status: r.status as SerialNumberStatus,
      purchaseReceiptId: r.purchaseReceiptId,
      deliveryOrderId: r.deliveryOrderId,
      workOrderId: r.workOrderId,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async setSerialStatus(
    id: string,
    status: SerialNumberStatus,
    warehouseId?: string,
    deliveryOrderId?: string,
  ): Promise<SerialNumberRecord> {
    const updates: Partial<typeof serialNumber.$inferInsert> = { status, updatedAt: new Date() };
    if (warehouseId !== undefined) updates.warehouseId = warehouseId;
    if (deliveryOrderId !== undefined) updates.deliveryOrderId = deliveryOrderId;

    const rows = await this.database.db
      .update(serialNumber)
      .set(updates)
      .where(eq(serialNumber.id, id))
      .returning(serialColumns);
    const r = rows[0]!;
    return {
      id: r.id,
      serialNo: r.serialNo,
      itemId: r.itemId,
      warehouseId: r.warehouseId,
      batchId: r.batchId,
      orgNodeId: r.orgNodeId,
      status: r.status as SerialNumberStatus,
      purchaseReceiptId: r.purchaseReceiptId,
      deliveryOrderId: r.deliveryOrderId,
      workOrderId: r.workOrderId,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async moveSerial(
    id: string,
    changes: { status: SerialNumberStatus; warehouseId: string | null; batchId?: string | null },
  ): Promise<void> {
    await this.database.db
      .update(serialNumber)
      .set({
        status: changes.status,
        warehouseId: changes.warehouseId,
        ...(changes.batchId !== undefined ? { batchId: changes.batchId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(serialNumber.id, id));
  }

  async insertMovementSerials(movementId: string, serialIds: string[]): Promise<void> {
    if (serialIds.length === 0) return;
    await this.database.db
      .insert(stockMovementSerial)
      .values(serialIds.map((serialId) => ({ movementId, serialId })));
  }

  async listMovementSerialNos(movementId: string): Promise<string[]> {
    const rows = await this.database.db
      .select({ serialNo: serialNumber.serialNo })
      .from(stockMovementSerial)
      .innerJoin(serialNumber, eq(serialNumber.id, stockMovementSerial.serialId))
      .where(eq(stockMovementSerial.movementId, movementId))
      .orderBy(asc(serialNumber.serialNo));
    return rows.map((r) => r.serialNo);
  }

  async listSerialMovements(serialId: string): Promise<StockMovementRecord[]> {
    const rows = await this.database.db
      .select(movementColumns)
      .from(stockMovementSerial)
      .innerJoin(stockMovement, eq(stockMovement.id, stockMovementSerial.movementId))
      .where(eq(stockMovementSerial.serialId, serialId))
      .orderBy(asc(stockMovement.movementDate), asc(stockMovement.createdAt));
    return rows.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      warehouseId: r.warehouseId,
      movementType: r.movementType as MovementType,
      purpose: r.purpose as MovementPurpose,
      quantity: r.quantity,
      movementDate: r.movementDate.toISOString(),
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      unitCost: r.unitCost,
      totalValue: r.totalValue,
      sourceModule: r.sourceModule,
      sourceId: r.sourceId,
      batchId: r.batchId,
    }));
  }

  // --- Landed Cost Voucher Management ---
  async countLandedCostVouchers(): Promise<number> {
    const rows = await this.database.db
      .select({ id: landedCostVoucher.id })
      .from(landedCostVoucher);
    return rows.length;
  }

  async listLandedCostVouchers(orgNodeId?: string): Promise<LandedCostVoucherRecord[]> {
    const query = this.database.db.select(lcvColumns).from(landedCostVoucher);
    const rows = orgNodeId
      ? await query
          .where(eq(landedCostVoucher.orgNodeId, orgNodeId))
          .orderBy(desc(landedCostVoucher.postingDate))
      : await query.orderBy(desc(landedCostVoucher.postingDate));

    const results: LandedCostVoucherRecord[] = [];
    for (const r of rows) {
      const items = await this.database.db
        .select(lciColumns)
        .from(landedCostItem)
        .where(eq(landedCostItem.voucherId, r.id));
      results.push({
        id: r.id,
        voucherNumber: r.voucherNumber,
        orgNodeId: r.orgNodeId,
        postingDate: r.postingDate.toISOString(),
        totalExpenseAmount: r.totalExpenseAmount,
        distributeMethod: r.distributeMethod as LandedCostDistributeMethod,
        expenseAccountId: r.expenseAccountId,
        status: r.status as LandedCostStatus,
        notes: r.notes,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        items: items.map((i) => ({
          id: i.id,
          voucherId: i.voucherId,
          receiptMovementId: i.receiptMovementId,
          itemId: i.itemId,
          warehouseId: i.warehouseId,
          quantity: i.quantity,
          originalRate: i.originalRate,
          allocatedExpense: i.allocatedExpense,
          newValuationRate: i.newValuationRate,
          createdAt: i.createdAt.toISOString(),
        })),
      });
    }
    return results;
  }

  async findLandedCostVoucherById(id: string): Promise<LandedCostVoucherRecord | null> {
    const rows = await this.database.db
      .select(lcvColumns)
      .from(landedCostVoucher)
      .where(eq(landedCostVoucher.id, id))
      .limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    const items = await this.database.db
      .select(lciColumns)
      .from(landedCostItem)
      .where(eq(landedCostItem.voucherId, r.id));
    return {
      id: r.id,
      voucherNumber: r.voucherNumber,
      orgNodeId: r.orgNodeId,
      postingDate: r.postingDate.toISOString(),
      totalExpenseAmount: r.totalExpenseAmount,
      distributeMethod: r.distributeMethod as LandedCostDistributeMethod,
      expenseAccountId: r.expenseAccountId,
      status: r.status as LandedCostStatus,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      items: items.map((i) => ({
        id: i.id,
        voucherId: i.voucherId,
        receiptMovementId: i.receiptMovementId,
        itemId: i.itemId,
        warehouseId: i.warehouseId,
        quantity: i.quantity,
        originalRate: i.originalRate,
        allocatedExpense: i.allocatedExpense,
        newValuationRate: i.newValuationRate,
        createdAt: i.createdAt.toISOString(),
      })),
    };
  }

  async insertLandedCostVoucher(
    input: CreateLandedCostVoucherInput & {
      id: string;
      voucherNumber: string;
      computedItems: Array<{
        id: string;
        receiptMovementId: string;
        itemId: string;
        warehouseId: string;
        quantity: string;
        originalRate: string;
        allocatedExpense: string;
        newValuationRate: string;
      }>;
    },
  ): Promise<LandedCostVoucherRecord> {
    const rows = await this.database.db
      .insert(landedCostVoucher)
      .values({
        id: input.id,
        voucherNumber: input.voucherNumber,
        orgNodeId: input.orgNodeId,
        postingDate: input.postingDate ? new Date(input.postingDate) : new Date(),
        totalExpenseAmount: input.totalExpenseAmount,
        distributeMethod: input.distributeMethod ?? 'by_amount',
        expenseAccountId: input.expenseAccountId,
        status: 'draft',
        notes: input.notes ?? null,
      })
      .returning(lcvColumns);

    const insertedVoucher = rows[0]!;
    const insertedItems: LandedCostItemRecord[] = [];

    for (const item of input.computedItems) {
      const itemRows = await this.database.db
        .insert(landedCostItem)
        .values({
          id: item.id,
          voucherId: insertedVoucher.id,
          receiptMovementId: item.receiptMovementId,
          itemId: item.itemId,
          warehouseId: item.warehouseId,
          quantity: item.quantity,
          originalRate: item.originalRate,
          allocatedExpense: item.allocatedExpense,
          newValuationRate: item.newValuationRate,
        })
        .returning(lciColumns);

      const lci = itemRows[0]!;
      insertedItems.push({
        id: lci.id,
        voucherId: lci.voucherId,
        receiptMovementId: lci.receiptMovementId,
        itemId: lci.itemId,
        warehouseId: lci.warehouseId,
        quantity: lci.quantity,
        originalRate: lci.originalRate,
        allocatedExpense: lci.allocatedExpense,
        newValuationRate: lci.newValuationRate,
        createdAt: lci.createdAt.toISOString(),
      });
    }

    return {
      id: insertedVoucher.id,
      voucherNumber: insertedVoucher.voucherNumber,
      orgNodeId: insertedVoucher.orgNodeId,
      postingDate: insertedVoucher.postingDate.toISOString(),
      totalExpenseAmount: insertedVoucher.totalExpenseAmount,
      distributeMethod: insertedVoucher.distributeMethod as LandedCostDistributeMethod,
      expenseAccountId: insertedVoucher.expenseAccountId,
      status: insertedVoucher.status as LandedCostStatus,
      notes: insertedVoucher.notes,
      createdAt: insertedVoucher.createdAt.toISOString(),
      updatedAt: insertedVoucher.updatedAt.toISOString(),
      items: insertedItems,
    };
  }

  async setLandedCostVoucherStatus(
    id: string,
    status: LandedCostStatus,
  ): Promise<LandedCostVoucherRecord> {
    await this.database.db
      .update(landedCostVoucher)
      .set({ status, updatedAt: new Date() })
      .where(eq(landedCostVoucher.id, id));
    return (await this.findLandedCostVoucherById(id))!;
  }
}
