import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InventoryNotFoundError, InventoryValidationError } from './inventory.errors';
import { InventoryRepository } from './inventory.repository';
import type {
  CreateMovementInput, CreateReservationInput, CreateWarehouseInput,
  StockBalanceRecord, StockMovementRecord, StockReservationRecord, WarehouseRecord,
} from './inventory.types';

@Injectable()
export class InventoryService {
  constructor(private readonly repository: InventoryRepository) {}

  async getWarehouses(): Promise<WarehouseRecord[]> { return this.repository.listWarehouses(); }

  async createWarehouse(input: CreateWarehouseInput): Promise<WarehouseRecord> {
    const code = normalizeCode(input.code);
    const name = normalizeName(input.name);
    const existing = await this.repository.findWarehouseByCode(code);
    if (existing) throw new InventoryValidationError(`a warehouse with code "${code}" already exists`);
    return this.repository.insertWarehouse({ id: randomUUID(), code, name, orgNodeId: input.orgNodeId });
  }

  async getBalances(): Promise<StockBalanceRecord[]> { return this.repository.listBalances(); }
  async getMovements(): Promise<StockMovementRecord[]> { return this.repository.listMovements(); }

  async createMovement(input: CreateMovementInput): Promise<StockMovementRecord> {
    const quantityNum = Number(input.quantity);
    if (!Number.isFinite(quantityNum) || quantityNum <= 0) {
      throw new InventoryValidationError('quantity must be a positive number');
    }
    const warehouseRecord = await this.repository.findWarehouseById(input.warehouseId);
    if (!warehouseRecord) throw new InventoryNotFoundError(`warehouse ${input.warehouseId} does not exist`);

    const isDecrease = input.movementType === 'issue' || input.movementType === 'transfer_out';
    const signedQuantity = isDecrease ? `-${input.quantity}` : input.quantity;

    if (isDecrease) {
      // Compare against AVAILABLE (on_hand - reserved) from the very first
      // version of this unit this time — reservations make goods off-limits
      // for anything except the document that reserved them (D31, and the
      // owner's explicit job-order reservation requirement).
      const balance = await this.repository.findBalance(input.itemId, input.warehouseId);
      const currentOnHand = balance ? Number(balance.onHand) : 0;
      const currentReserved = balance ? Number(balance.reserved) : 0;
      const currentAvailable = currentOnHand - currentReserved;
      if (currentAvailable < quantityNum) {
        throw new InventoryValidationError(`insufficient stock: available ${currentAvailable}, requested ${quantityNum}`);
      }
    }

    const movement = await this.repository.insertMovement({
      id: randomUUID(), itemId: input.itemId, warehouseId: input.warehouseId,
      movementType: input.movementType, quantity: input.quantity, signedQuantity,
      movementDate: input.movementDate, note: input.note,
    });
    await this.repository.applyDelta(input.itemId, input.warehouseId, signedQuantity);
    return movement;
  }

  async getReservations(): Promise<StockReservationRecord[]> { return this.repository.listReservations(); }

  async reserveStock(input: CreateReservationInput): Promise<StockReservationRecord> {
    const quantityNum = Number(input.quantity);
    if (!Number.isFinite(quantityNum) || quantityNum <= 0) {
      throw new InventoryValidationError('reservation quantity must be a positive number');
    }
    if (!input.source || input.source.trim().length === 0) {
      throw new InventoryValidationError('reservation source is required');
    }
    const warehouseRecord = await this.repository.findWarehouseById(input.warehouseId);
    if (!warehouseRecord) throw new InventoryNotFoundError(`warehouse ${input.warehouseId} does not exist`);

    const balance = await this.repository.findBalance(input.itemId, input.warehouseId);
    const currentOnHand = balance ? Number(balance.onHand) : 0;
    const currentReserved = balance ? Number(balance.reserved) : 0;
    const currentAvailable = currentOnHand - currentReserved;
    if (currentAvailable < quantityNum) {
      throw new InventoryValidationError(`insufficient available stock to reserve: available ${currentAvailable}, requested ${quantityNum}`);
    }

    const reservation = await this.repository.insertReservation({
      id: randomUUID(), itemId: input.itemId, warehouseId: input.warehouseId,
      quantity: input.quantity, source: input.source.trim(),
    });
    await this.repository.applyReservedDelta(input.itemId, input.warehouseId, input.quantity);
    return reservation;
  }

  async releaseReservation(id: string): Promise<StockReservationRecord> {
    const reservation = await this.repository.findReservationById(id);
    if (!reservation) throw new InventoryNotFoundError(`reservation ${id} does not exist`);
    if (reservation.status === 'released') return reservation;
    await this.repository.applyReservedDelta(reservation.itemId, reservation.warehouseId, `-${reservation.quantity}`);
    return this.repository.setReservationReleased(id);
  }
}

function normalizeCode(raw: unknown): string {
  if (typeof raw !== 'string') throw new InventoryValidationError('code is required');
  const trimmed = raw.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(trimmed)) throw new InventoryValidationError('code must match ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$');
  return trimmed;
}
function normalizeName(raw: unknown): string {
  if (typeof raw !== 'string') throw new InventoryValidationError('name is required');
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new InventoryValidationError('name must not be blank');
  return trimmed;
}
