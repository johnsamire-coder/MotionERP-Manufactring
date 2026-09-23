export type WarehouseStatus = 'active' | 'inactive' | 'archived';
export type MovementType = 'receipt' | 'issue' | 'transfer_in' | 'transfer_out' | 'adjustment';
/**
 * What a movement is for. Kept apart from MovementType, which drives the accounting direction:
 * - material_transfer_for_manufacture: raw material moved to a production (WIP) warehouse (transfer_out / transfer_in)
 * - manufacture_consumption: material actually consumed by production (issue)
 */
export type MovementPurpose = 'general' | 'material_transfer_for_manufacture' | 'manufacture_consumption';
export type ReservationStatus = 'active' | 'released';
export type ItemBatchStatus = 'active' | 'expired' | 'quarantined' | 'recalled';
export type SerialNumberStatus = 'active' | 'delivered' | 'under_maintenance' | 'decommissioned';
export type LandedCostStatus = 'draft' | 'posted' | 'cancelled';
export type LandedCostDistributeMethod = 'by_amount' | 'by_quantity';

export interface WarehouseRecord {
  id: string;
  code: string;
  name: string;
  orgNodeId: string;
  status: WarehouseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWarehouseInput {
  code: string;
  name: string;
  orgNodeId: string;
}

export interface StockBalanceRecord {
  id: string;
  itemId: string;
  warehouseId: string;
  onHand: string;
  reserved: string;
  available: string;
  updatedAt: string;
  averageCost: string;
  totalValue: string;
  lastPurchaseCost: string | null;
  lastPurchaseAt: string | null;
}

export interface StockMovementRecord {
  id: string;
  itemId: string;
  warehouseId: string;
  movementType: MovementType;
  purpose: MovementPurpose;
  quantity: string;
  movementDate: string;
  note: string | null;
  createdAt: string;
  unitCost: string | null;
  totalValue: string | null;
  sourceModule: string | null;
  sourceId: string | null;
  batchId?: string | null;
  serialNos?: string[];
}

export interface CreateMovementInput {
  itemId: string;
  warehouseId: string;
  movementType: MovementType;
  quantity: string;
  movementDate?: string;
  note?: string;
  unitCost?: string;
  sourceModule?: string;
  sourceId?: string;
  /** Allow a movement dated before the latest movement of the same item/warehouse (requires backdateReason). */
  allowBackdate?: boolean;
  backdateReason?: string;
  /** Required for batch-tracked items (catalog item.hasBatchNo). */
  batchId?: string;
  /** Required for serial-tracked items (catalog item.hasSerialNo): one serial per unit. */
  serialNos?: string[];
  /** Defaults to 'general'. */
  purpose?: MovementPurpose;
  /**
   * Receipt against an approved supplier quotation (the purchase order, plan item 12): the
   * cumulative received quantity may exceed the ordered one only within the over-receipt %.
   */
  purchaseOrderId?: string;
}

export interface TransferStockInput {
  itemId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: string;
  purpose?: MovementPurpose;
  batchId?: string;
  serialNos?: string[];
  movementDate?: string;
  note?: string;
  sourceModule?: string;
  sourceId?: string;
}

export interface TransferStockResult {
  transferOut: StockMovementRecord;
  transferIn: StockMovementRecord;
}

export interface StockReservationRecord {
  id: string;
  itemId: string;
  warehouseId: string;
  quantity: string;
  source: string;
  status: ReservationStatus;
  createdAt: string;
  releasedAt: string | null;
}

export interface CreateReservationInput {
  itemId: string;
  warehouseId: string;
  quantity: string;
  source: string;
}

// --- Stock Ledger Entry Types ---
export interface StockLedgerEntryRecord {
  id: string;
  itemId: string;
  warehouseId: string;
  movementId: string | null;
  batchId?: string | null;
  quantityChange: string;
  balanceQtyAfter: string;
  incomingRate: string;
  valuationRate: string;
  stockValueChange: string;
  stockValueAfter: string;
  createdAt: string;
}

export interface CreateStockLedgerEntryInput {
  itemId: string;
  warehouseId: string;
  movementId?: string | null;
  batchId?: string | null;
  quantityChange: string;
  balanceQtyAfter: string;
  incomingRate?: string;
  valuationRate?: string;
  stockValueChange?: string;
  stockValueAfter?: string;
}

// --- Medical Batch & Lot Tracking Types ---
export interface ItemBatchRecord {
  id: string;
  batchNumber: string;
  itemId: string;
  orgNodeId: string;
  manufacturingDate: string | null;
  expiryDate: string | null;
  status: ItemBatchStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItemBatchInput {
  batchNumber: string;
  itemId: string;
  orgNodeId: string;
  manufacturingDate?: string;
  expiryDate?: string;
  notes?: string;
}

export interface BatchBalanceRecord {
  id: string;
  batchId: string;
  itemId: string;
  warehouseId: string;
  quantity: string;
  valuationRate: string;
  totalValue: string;
  updatedAt: string;
}

// --- Serial Number Tracking Types ---
export interface SerialNumberRecord {
  id: string;
  serialNo: string;
  itemId: string;
  warehouseId: string | null;
  batchId: string | null;
  orgNodeId: string;
  status: SerialNumberStatus;
  purchaseReceiptId: string | null;
  deliveryOrderId: string | null;
  workOrderId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSerialNumberInput {
  serialNo: string;
  itemId: string;
  orgNodeId: string;
  warehouseId?: string;
  batchId?: string;
  purchaseReceiptId?: string;
  workOrderId?: string;
  notes?: string;
}

// --- Stock Reconciliation Types ---
export interface ReconcileStockInput {
  itemId: string;
  warehouseId: string;
  physicalQty: string;
  note?: string;
}

export interface ReconcileStockResult {
  itemId: string;
  warehouseId: string;
  previousQty: string;
  physicalQty: string;
  differenceQty: string;
  adjustmentType: 'surplus' | 'shortage' | 'none';
  movementRecord?: StockMovementRecord;
}

// --- Landed Cost Voucher Types ---
export interface LandedCostItemRecord {
  id: string;
  voucherId: string;
  receiptMovementId: string;
  itemId: string;
  warehouseId: string;
  quantity: string;
  originalRate: string;
  allocatedExpense: string;
  newValuationRate: string;
  createdAt: string;
}

export interface LandedCostVoucherRecord {
  id: string;
  voucherNumber: string;
  orgNodeId: string;
  postingDate: string;
  totalExpenseAmount: string;
  distributeMethod: LandedCostDistributeMethod;
  expenseAccountId: string;
  status: LandedCostStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: LandedCostItemRecord[];
}

export interface CreateLandedCostItemInput {
  receiptMovementId: string;
  itemId: string;
  warehouseId: string;
  quantity: string;
  originalRate: string;
}

export interface CreateLandedCostVoucherInput {
  orgNodeId: string;
  postingDate?: string;
  totalExpenseAmount: string;
  distributeMethod?: LandedCostDistributeMethod;
  expenseAccountId: string;
  notes?: string;
  items: CreateLandedCostItemInput[];
}