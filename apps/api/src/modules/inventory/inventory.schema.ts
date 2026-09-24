import { sql } from 'drizzle-orm';
import { type AnyPgColumn, boolean, check, index, numeric, pgSchema, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { item } from '../catalog/catalog.schema';
import { orgNode } from '../organization/organization.schema';
import { chartOfAccounts } from '../accounting/accounting.schema';

export const inventorySchema = pgSchema('inventory');

// ==================== 1. المخازن والأرصدة والحركات ====================

export const warehouse = inventorySchema.table('warehouse', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  status: text('status').notNull().default('active'),
  // Warehouse tree (plan item 23): a group warehouse only groups children and never holds stock.
  parentWarehouseId: uuid('parent_warehouse_id').references((): AnyPgColumn => warehouse.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  isGroup: boolean('is_group').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('warehouse_code_unique').on(t.code),
  check('warehouse_not_own_parent', sql`${t.parentWarehouseId} is null or ${t.parentWarehouseId} <> ${t.id}`),
  index('warehouse_parent_idx').on(t.parentWarehouseId),
  check('warehouse_code_format', sql`${t.code} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`),
  check('warehouse_name_not_blank', sql`length(btrim(${t.name})) > 0`),
  check('warehouse_status_valid', sql`${t.status} in ('active', 'inactive', 'archived')`),
  index('warehouse_org_node_idx').on(t.orgNodeId),
]);

export const stockBalance = inventorySchema.table('stock_balance', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id')
    .notNull()
    .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  warehouseId: uuid('warehouse_id')
    .notNull()
    .references(() => warehouse.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  onHand: numeric('on_hand', { precision: 24, scale: 6 }).notNull().default('0'),
  reserved: numeric('reserved', { precision: 24, scale: 6 }).notNull().default('0'),
  averageCost: numeric('average_cost', { precision: 18, scale: 6 }).notNull().default('0'),
  totalValue: numeric('total_value', { precision: 18, scale: 4 }).notNull().default('0'),
  lastPurchaseCost: numeric('last_purchase_cost', { precision: 18, scale: 6 }),
  lastPurchaseAt: timestamp('last_purchase_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('stock_balance_item_warehouse_unique').on(t.itemId, t.warehouseId),
  check('stock_balance_on_hand_non_negative', sql`${t.onHand} >= 0`),
  check('stock_balance_reserved_non_negative', sql`${t.reserved} >= 0`),
  index('stock_balance_item_idx').on(t.itemId),
  index('stock_balance_warehouse_idx').on(t.warehouseId),
]);

export const stockMovement = inventorySchema.table('stock_movement', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id')
    .notNull()
    .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  warehouseId: uuid('warehouse_id')
    .notNull()
    .references(() => warehouse.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  movementType: text('movement_type').notNull(),
  // Business purpose, separate from the accounting direction in movement_type (plan item 3).
  purpose: text('purpose').notNull().default('general'),
  quantity: numeric('quantity', { precision: 24, scale: 6 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 18, scale: 6 }),
  totalValue: numeric('total_value', { precision: 18, scale: 4 }),
  sourceModule: text('source_module'),
  sourceId: text('source_id'),
  // Batch the movement belongs to (required for batch-tracked items). Same-module FK.
  batchId: uuid('batch_id')
    .references((): AnyPgColumn => itemBatch.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  movementDate: timestamp('movement_date', { withTimezone: true }).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
}, (t) => [
  check('stock_movement_type_valid', sql`${t.movementType} in ('receipt', 'issue', 'transfer_in', 'transfer_out', 'adjustment')`),
  check('stock_movement_quantity_not_zero', sql`${t.quantity} <> 0`),
  check('stock_movement_purpose_valid', sql`${t.purpose} in ('general', 'material_transfer_for_manufacture', 'manufacture_consumption')`),
  index('stock_movement_item_warehouse_idx').on(t.itemId, t.warehouseId),
  index('stock_movement_date_idx').on(t.movementDate),
  index('stock_movement_batch_idx').on(t.batchId),
]);

export const stockReservation = inventorySchema.table('stock_reservation', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id')
    .notNull()
    .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  warehouseId: uuid('warehouse_id')
    .notNull()
    .references(() => warehouse.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  quantity: numeric('quantity', { precision: 24, scale: 6 }).notNull(),
  source: text('source').notNull(),
  /**
   * Plan item 13 — what the quantity is for (ERPNext Bin columns):
   * reserving (lower availability): sales_order, production, subcontract, production_plan;
   * expected (raise projected qty): purchase_order (ordered), material_request (indented), work_order (planned).
   */
  reservationType: text('reservation_type').notNull().default('sales_order'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  releasedAt: timestamp('released_at', { withTimezone: true }),
}, (t) => [
  check('stock_reservation_quantity_positive', sql`${t.quantity} > 0`),
  check('stock_reservation_status_valid', sql`${t.status} in ('active', 'released')`),
  check('stock_reservation_type_valid', sql`${t.reservationType} in ('sales_order', 'production', 'subcontract', 'production_plan', 'purchase_order', 'material_request', 'work_order')`),
  index('stock_reservation_item_warehouse_idx').on(t.itemId, t.warehouseId),
]);

export const stockLedgerEntry = inventorySchema.table('stock_ledger_entry', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id')
    .notNull()
    .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  warehouseId: uuid('warehouse_id')
    .notNull()
    .references(() => warehouse.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  movementId: uuid('movement_id')
    .references(() => stockMovement.id, { onUpdate: 'cascade', onDelete: 'set null' }),
  batchId: uuid('batch_id')
    .references((): AnyPgColumn => itemBatch.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  quantityChange: numeric('quantity_change', { precision: 24, scale: 6 }).notNull(),
  balanceQtyAfter: numeric('balance_qty_after', { precision: 24, scale: 6 }).notNull(),
  incomingRate: numeric('incoming_rate', { precision: 24, scale: 6 }).notNull().default('0'),
  valuationRate: numeric('valuation_rate', { precision: 24, scale: 6 }).notNull().default('0'),
  stockValueChange: numeric('stock_value_change', { precision: 24, scale: 6 }).notNull().default('0'),
  stockValueAfter: numeric('stock_value_after', { precision: 24, scale: 6 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_stock_ledger_item_wh').on(t.itemId, t.warehouseId),
  index('idx_stock_ledger_created').on(t.createdAt),
]);

// ==================== 2. منظومة تتبع التشغيلات والسيريال الطبي ====================

export const itemBatch = inventorySchema.table('item_batch', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchNumber: text('batch_number').notNull(),
  itemId: uuid('item_id')
    .notNull()
    .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  manufacturingDate: timestamp('manufacturing_date', { withTimezone: true }),
  expiryDate: timestamp('expiry_date', { withTimezone: true }),
  status: text('status').notNull().default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('item_batch_item_batch_unique').on(t.itemId, t.batchNumber),
  check('item_batch_status_valid', sql`${t.status} in ('active', 'expired', 'quarantined', 'recalled')`),
  index('idx_item_batch_item').on(t.itemId),
  index('idx_item_batch_expiry').on(t.expiryDate),
  index('idx_item_batch_org').on(t.orgNodeId),
]);

export const serialNumber = inventorySchema.table('serial_number', {
  id: uuid('id').primaryKey().defaultRandom(),
  serialNo: text('serial_no').notNull(),
  itemId: uuid('item_id')
    .notNull()
    .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  warehouseId: uuid('warehouse_id')
    .references(() => warehouse.id, { onUpdate: 'cascade', onDelete: 'set null' }),
  batchId: uuid('batch_id')
    .references(() => itemBatch.id, { onUpdate: 'cascade', onDelete: 'set null' }),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  status: text('status').notNull().default('active'),
  purchaseReceiptId: uuid('purchase_receipt_id'),
  deliveryOrderId: uuid('delivery_order_id'),
  workOrderId: uuid('work_order_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('serial_number_item_unique').on(t.itemId, t.serialNo),
  check('serial_number_status_valid', sql`${t.status} in ('active', 'delivered', 'under_maintenance', 'decommissioned')`),
  index('idx_serial_number_item').on(t.itemId),
  index('idx_serial_number_wh').on(t.warehouseId),
  index('idx_serial_number_batch').on(t.batchId),
  index('idx_serial_number_org').on(t.orgNodeId),
]);

// رصيد وتكلفة كل دفعة في كل مخزن (تكلفة لكل دفعة — بند 2)
export const batchBalance = inventorySchema.table('batch_balance', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: uuid('batch_id')
    .notNull()
    .references(() => itemBatch.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  itemId: uuid('item_id').notNull(),
  warehouseId: uuid('warehouse_id')
    .notNull()
    .references(() => warehouse.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  quantity: numeric('quantity', { precision: 24, scale: 6 }).notNull().default('0'),
  valuationRate: numeric('valuation_rate', { precision: 24, scale: 6 }).notNull().default('0'),
  totalValue: numeric('total_value', { precision: 24, scale: 6 }).notNull().default('0'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('batch_balance_batch_warehouse_unique').on(t.batchId, t.warehouseId),
  check('batch_balance_quantity_non_negative', sql`${t.quantity} >= 0`),
  index('idx_batch_balance_item_wh').on(t.itemId, t.warehouseId),
]);

// ربط السيريال بحركة المخزون (بند 2ب) — سجل تتبّع لكل سيريال دخل أو خرج في حركة
export const stockMovementSerial = inventorySchema.table('stock_movement_serial', {
  id: uuid('id').primaryKey().defaultRandom(),
  movementId: uuid('movement_id')
    .notNull()
    .references(() => stockMovement.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  serialId: uuid('serial_id')
    .notNull()
    .references(() => serialNumber.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('stock_movement_serial_unique').on(t.movementId, t.serialId),
  index('idx_stock_movement_serial_serial').on(t.serialId),
]);

// إعادة الطلب لكل صنف/مخزن (بند 22)
/**
 * When the projected quantity (actual + expected − reserved, see the Bin view) falls to or below
 * reorder_level, the system suggests max(reorder_qty, reorder_level − projected).
 */
export const itemReorder = inventorySchema.table('item_reorder', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').notNull(),
  warehouseId: uuid('warehouse_id')
    .notNull()
    .references(() => warehouse.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  reorderLevel: numeric('reorder_level', { precision: 24, scale: 6 }).notNull(),
  reorderQty: numeric('reorder_qty', { precision: 24, scale: 6 }).notNull(),
  requestType: text('request_type').notNull().default('purchase'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('item_reorder_item_warehouse_unique').on(t.itemId, t.warehouseId),
  check('item_reorder_values_valid', sql`${t.reorderLevel} >= 0 and ${t.reorderQty} > 0`),
  check('item_reorder_request_type_valid', sql`${t.requestType} in ('purchase', 'transfer', 'manufacture')`),
]);

// ==================== 3. محرك تكلفة الواردات ورسملة الشحن (Landed Cost Engine) ====================

export const landedCostVoucher = inventorySchema.table('landed_cost_voucher', {
  id: uuid('id').primaryKey().defaultRandom(),
  voucherNumber: text('voucher_number').notNull().unique(), // رقم السند
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  postingDate: timestamp('posting_date', { withTimezone: true }).notNull(),
  totalExpenseAmount: numeric('total_expense_amount', { precision: 14, scale: 4 }).notNull(), // إجمالي مصاريف الشحن والجمارك
  distributeMethod: text('distribute_method').notNull().default('by_amount'), // by_amount | by_quantity
  expenseAccountId: uuid('expense_account_id')
    .notNull()
    .references(() => chartOfAccounts.id, { onDelete: 'restrict' }), // حساب وسيط الشحن / جاري شركة النقل
  status: text('status').notNull().default('draft'), // draft | posted | cancelled
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('landed_cost_voucher_status_valid', sql`${t.status} in ('draft', 'posted', 'cancelled')`),
  check('landed_cost_distribute_valid', sql`${t.distributeMethod} in ('by_amount', 'by_quantity')`),
  check('landed_cost_expense_positive', sql`${t.totalExpenseAmount} > 0`),
  index('idx_landed_cost_org').on(t.orgNodeId),
  index('idx_landed_cost_date').on(t.postingDate),
]);

export const landedCostItem = inventorySchema.table('landed_cost_item', {
  id: uuid('id').primaryKey().defaultRandom(),
  voucherId: uuid('voucher_id')
    .notNull()
    .references(() => landedCostVoucher.id, { onDelete: 'cascade' }),
  receiptMovementId: uuid('receipt_movement_id')
    .notNull()
    .references(() => stockMovement.id, { onDelete: 'restrict' }), // إذن استلام الخامات
  itemId: uuid('item_id')
    .notNull()
    .references(() => item.id, { onDelete: 'restrict' }),
  warehouseId: uuid('warehouse_id')
    .notNull()
    .references(() => warehouse.id, { onDelete: 'restrict' }),
  quantity: numeric('quantity', { precision: 24, scale: 6 }).notNull(),
  originalRate: numeric('original_rate', { precision: 18, scale: 6 }).notNull(),
  allocatedExpense: numeric('allocated_expense', { precision: 14, scale: 4 }).notNull(), // نصيب البند من مصاريف النقل
  newValuationRate: numeric('new_valuation_rate', { precision: 18, scale: 6 }).notNull(), // متوسط التكلفة الجديد بعد النقل
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_landed_cost_item_voucher').on(t.voucherId),
  index('idx_landed_cost_item_movement').on(t.receiptMovementId),
]);

export type Warehouse = typeof warehouse.$inferSelect;
export type StockBalance = typeof stockBalance.$inferSelect;
export type StockMovement = typeof stockMovement.$inferSelect;
export type StockReservation = typeof stockReservation.$inferSelect;
export type StockLedgerEntry = typeof stockLedgerEntry.$inferSelect;
export type ItemBatch = typeof itemBatch.$inferSelect;
export type BatchBalance = typeof batchBalance.$inferSelect;
export type SerialNumber = typeof serialNumber.$inferSelect;
export type LandedCostVoucher = typeof landedCostVoucher.$inferSelect;
export type LandedCostItem = typeof landedCostItem.$inferSelect;

export type ItemBatchStatus = 'active' | 'expired' | 'quarantined' | 'recalled';
export type SerialNumberStatus = 'active' | 'delivered' | 'under_maintenance' | 'decommissioned';
export type LandedCostStatus = 'draft' | 'posted' | 'cancelled';
export type LandedCostDistributeMethod = 'by_amount' | 'by_quantity';