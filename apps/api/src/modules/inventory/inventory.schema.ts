import { sql } from 'drizzle-orm';
import { check, index, numeric, pgSchema, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { item } from '../catalog/catalog.schema';
import { orgNode } from '../organization/organization.schema';

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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('warehouse_code_unique').on(t.code),
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
  quantity: numeric('quantity', { precision: 24, scale: 6 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 18, scale: 6 }),
  totalValue: numeric('total_value', { precision: 18, scale: 4 }),
  sourceModule: text('source_module'),
  sourceId: text('source_id'),
  movementDate: timestamp('movement_date', { withTimezone: true }).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
}, (t) => [
  check('stock_movement_type_valid', sql`${t.movementType} in ('receipt', 'issue', 'transfer_in', 'transfer_out', 'adjustment')`),
  check('stock_movement_quantity_not_zero', sql`${t.quantity} <> 0`),
  index('stock_movement_item_warehouse_idx').on(t.itemId, t.warehouseId),
  index('stock_movement_date_idx').on(t.movementDate),
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
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  releasedAt: timestamp('released_at', { withTimezone: true }),
}, (t) => [
  check('stock_reservation_quantity_positive', sql`${t.quantity} > 0`),
  check('stock_reservation_status_valid', sql`${t.status} in ('active', 'released')`),
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

// ==================== 2. منظومة تتبع التشغيلات والسيريال الطبي (الجديد) ====================

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
  status: text('status').notNull().default('active'), // active | expired | quarantined | recalled
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
  status: text('status').notNull().default('active'), // active | delivered | under_maintenance | decommissioned
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

export type Warehouse = typeof warehouse.$inferSelect;
export type StockBalance = typeof stockBalance.$inferSelect;
export type StockMovement = typeof stockMovement.$inferSelect;
export type StockReservation = typeof stockReservation.$inferSelect;
export type StockLedgerEntry = typeof stockLedgerEntry.$inferSelect;
export type ItemBatch = typeof itemBatch.$inferSelect;
export type SerialNumber = typeof serialNumber.$inferSelect;

export type ItemBatchStatus = 'active' | 'expired' | 'quarantined' | 'recalled';
export type SerialNumberStatus = 'active' | 'delivered' | 'under_maintenance' | 'decommissioned';