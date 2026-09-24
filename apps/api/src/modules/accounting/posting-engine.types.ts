export type PostingMovementType =
  'receipt' | 'issue' | 'transfer_in' | 'transfer_out' | 'adjustment';

export interface StockMovementPostingPayload {
  movementId: string;
  itemId: string;
  warehouseId: string;
  orgNodeId: string;
  movementType: PostingMovementType;
  quantity: string;
  unitCost: string;
  totalValue: string;
  movementDate?: string;
  note?: string | null;
  sourceModule?: string | null;
  sourceId?: string | null;
  costCenterId?: string;
  jobOrderId?: string;
}

export interface ResolvedAccounts {
  inventoryAccountId: string;
  contraAccountId: string;
}
