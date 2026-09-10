import { Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { stockBalance, stockMovement, stockReservation, warehouse } from './inventory.schema';
import type {
  CreateMovementInput, CreateReservationInput, CreateWarehouseInput, MovementType,
  ReservationStatus, StockBalanceRecord, StockMovementRecord, StockReservationRecord,
  WarehouseRecord, WarehouseStatus,
} from './inventory.types';

const warehouseColumns = {
  id: warehouse.id, code: warehouse.code, name: warehouse.name,
  orgNodeId: warehouse.orgNodeId, status: warehouse.status,
  createdAt: warehouse.createdAt, updatedAt: warehouse.updatedAt,
};
const movementColumns = {
  id: stockMovement.id, itemId: stockMovement.itemId, warehouseId: stockMovement.warehouseId,
  movementType: stockMovement.movementType, quantity: stockMovement.quantity,
  movementDate: stockMovement.movementDate, note: stockMovement.note, createdAt: stockMovement.createdAt,
};
const reservationColumns = {
  id: stockReservation.id, itemId: stockReservation.itemId, warehouseId: stockReservation.warehouseId,
  quantity: stockReservation.quantity, source: stockReservation.source, status: stockReservation.status,
  createdAt: stockReservation.createdAt, releasedAt: stockReservation.releasedAt,
};

interface WarehouseRow { id: string; code: string; name: string; orgNodeId: string; status: string; createdAt: Date; updatedAt: Date; }
interface MovementRow { id: string; itemId: string; warehouseId: string; movementType: string; quantity: string; movementDate: Date; note: string | null; createdAt: Date; }
interface BalanceRow { id: string; itemId: string; warehouseId: string; onHand: string; reserved: string; updatedAt: Date; }
interface ReservationRow { id: string; itemId: string; warehouseId: string; quantity: string; source: string; status: string; createdAt: Date; releasedAt: Date | null; }

function toWarehouseRecord(row: WarehouseRow): WarehouseRecord {
  return { id: row.id, code: row.code, name: row.name, orgNodeId: row.orgNodeId, status: row.status as WarehouseStatus,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
function toMovementRecord(row: MovementRow): StockMovementRecord {
  return { id: row.id, itemId: row.itemId, warehouseId: row.warehouseId, movementType: row.movementType as MovementType,
    quantity: row.quantity, movementDate: row.movementDate.toISOString(), note: row.note, createdAt: row.createdAt.toISOString() };
}
function toBalanceRecord(row: BalanceRow): StockBalanceRecord {
  const available = (Number(row.onHand) - Number(row.reserved)).toString();
  return { id: row.id, itemId: row.itemId, warehouseId: row.warehouseId, onHand: row.onHand, reserved: row.reserved,
    available, updatedAt: row.updatedAt.toISOString() };
}
function toReservationRecord(row: ReservationRow): StockReservationRecord {
  return { id: row.id, itemId: row.itemId, warehouseId: row.warehouseId, quantity: row.quantity, source: row.source,
    status: row.status as ReservationStatus, createdAt: row.createdAt.toISOString(),
    releasedAt: row.releasedAt ? row.releasedAt.toISOString() : null };
}

@Injectable()
export class InventoryRepository {
  constructor(private readonly database: DatabaseService) {}

  async listWarehouses(): Promise<WarehouseRecord[]> {
    const rows = await this.database.db.select(warehouseColumns).from(warehouse).orderBy(asc(warehouse.code));
    return rows.map(toWarehouseRecord);
  }
  async findWarehouseById(id: string): Promise<WarehouseRecord | null> {
    const rows = await this.database.db.select(warehouseColumns).from(warehouse).where(eq(warehouse.id, id)).limit(1);
    return rows[0] ? toWarehouseRecord(rows[0]) : null;
  }
  async findWarehouseByCode(code: string): Promise<WarehouseRecord | null> {
    const rows = await this.database.db.select(warehouseColumns).from(warehouse).where(eq(warehouse.code, code)).limit(1);
    return rows[0] ? toWarehouseRecord(rows[0]) : null;
  }
  async insertWarehouse(input: CreateWarehouseInput & { id: string }): Promise<WarehouseRecord> {
    const rows = await this.database.db.insert(warehouse).values({
      id: input.id, code: input.code, name: input.name, orgNodeId: input.orgNodeId,
    }).returning(warehouseColumns);
    return toWarehouseRecord(rows[0]!);
  }

  async listBalances(): Promise<StockBalanceRecord[]> {
    const rows = await this.database.db.select({
      id: stockBalance.id, itemId: stockBalance.itemId, warehouseId: stockBalance.warehouseId,
      onHand: stockBalance.onHand, reserved: stockBalance.reserved, updatedAt: stockBalance.updatedAt,
    }).from(stockBalance).orderBy(asc(stockBalance.itemId));
    return rows.map(toBalanceRecord);
  }
  async findBalance(itemId: string, warehouseId: string): Promise<BalanceRow | null> {
    const rows = await this.database.db.select({
      id: stockBalance.id, itemId: stockBalance.itemId, warehouseId: stockBalance.warehouseId,
      onHand: stockBalance.onHand, reserved: stockBalance.reserved, updatedAt: stockBalance.updatedAt,
    }).from(stockBalance).where(and(eq(stockBalance.itemId, itemId), eq(stockBalance.warehouseId, warehouseId))).limit(1);
    return rows[0] ?? null;
  }
  async insertMovement(input: CreateMovementInput & { id: string; signedQuantity: string }): Promise<StockMovementRecord> {
    const rows = await this.database.db.insert(stockMovement).values({
      id: input.id, itemId: input.itemId, warehouseId: input.warehouseId,
      movementType: input.movementType, quantity: input.signedQuantity,
      movementDate: input.movementDate ? new Date(input.movementDate) : new Date(),
      note: input.note ?? null,
    }).returning(movementColumns);
    return toMovementRecord(rows[0]!);
  }
  async listMovements(): Promise<StockMovementRecord[]> {
    const rows = await this.database.db.select(movementColumns).from(stockMovement).orderBy(asc(stockMovement.createdAt));
    return rows.map(toMovementRecord);
  }
  async applyDelta(itemId: string, warehouseId: string, delta: string): Promise<void> {
    const existing = await this.findBalance(itemId, warehouseId);
    if (existing) {
      await this.database.db.execute(sql`UPDATE ${stockBalance} SET on_hand = on_hand + ${delta}::numeric WHERE id = ${existing.id}`);
    } else {
      await this.database.db.insert(stockBalance).values({ itemId, warehouseId, onHand: delta, reserved: '0' });
    }
  }
  async applyReservedDelta(itemId: string, warehouseId: string, delta: string): Promise<void> {
    const existing = await this.findBalance(itemId, warehouseId);
    if (existing) {
      await this.database.db.execute(sql`UPDATE ${stockBalance} SET reserved = reserved + ${delta}::numeric WHERE id = ${existing.id}`);
    } else {
      await this.database.db.insert(stockBalance).values({ itemId, warehouseId, onHand: '0', reserved: delta });
    }
  }

  async listReservations(): Promise<StockReservationRecord[]> {
    const rows = await this.database.db.select(reservationColumns).from(stockReservation).orderBy(asc(stockReservation.createdAt));
    return rows.map(toReservationRecord);
  }
  async findReservationById(id: string): Promise<StockReservationRecord | null> {
    const rows = await this.database.db.select(reservationColumns).from(stockReservation).where(eq(stockReservation.id, id)).limit(1);
    return rows[0] ? toReservationRecord(rows[0]) : null;
  }
  async insertReservation(input: CreateReservationInput & { id: string }): Promise<StockReservationRecord> {
    const rows = await this.database.db.insert(stockReservation).values({
      id: input.id, itemId: input.itemId, warehouseId: input.warehouseId,
      quantity: input.quantity, source: input.source,
    }).returning(reservationColumns);
    return toReservationRecord(rows[0]!);
  }
  async setReservationReleased(id: string): Promise<StockReservationRecord> {
    const rows = await this.database.db.update(stockReservation)
      .set({ status: 'released', releasedAt: new Date() })
      .where(eq(stockReservation.id, id)).returning(reservationColumns);
    return toReservationRecord(rows[0]!);
  }
}
