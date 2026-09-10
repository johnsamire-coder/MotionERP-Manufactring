export type WarehouseStatus = 'active' | 'inactive' | 'archived';
export type MovementType = 'receipt' | 'issue' | 'transfer_in' | 'transfer_out' | 'adjustment';
export type ReservationStatus = 'active' | 'released';

export interface WarehouseRecord {
  id: string; code: string; name: string; orgNodeId: string;
  status: WarehouseStatus; createdAt: string; updatedAt: string;
}
export interface CreateWarehouseInput { code: string; name: string; orgNodeId: string; }

export interface StockBalanceRecord {
  id: string; itemId: string; warehouseId: string;
  onHand: string; reserved: string; available: string; updatedAt: string;
}

export interface StockMovementRecord {
  id: string; itemId: string; warehouseId: string; movementType: MovementType;
  quantity: string; movementDate: string; note: string | null; createdAt: string;
}
export interface CreateMovementInput {
  itemId: string; warehouseId: string; movementType: MovementType;
  quantity: string; movementDate?: string; note?: string;
}

export interface StockReservationRecord {
  id: string; itemId: string; warehouseId: string; quantity: string;
  source: string; status: ReservationStatus; createdAt: string; releasedAt: string | null;
}
export interface CreateReservationInput {
  itemId: string; warehouseId: string; quantity: string; source: string;
}
