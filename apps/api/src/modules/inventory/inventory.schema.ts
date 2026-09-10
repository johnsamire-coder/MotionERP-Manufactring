import { sql } from 'drizzle-orm';
import { check, index, numeric, pgSchema, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { item } from '../catalog/catalog.schema';
import { orgNode } from '../organization/organization.schema';

export const inventorySchema = pgSchema('inventory');

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

/** Reservation ledger — separate from on_hand entirely (D31). A reservation only reduces
 * "available" (on_hand - reserved); it never touches on_hand. Released when goods are
 * actually issued, or when the source document is cancelled. */
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

export type Warehouse = typeof warehouse.$inferSelect;
export type StockBalance = typeof stockBalance.$inferSelect;
export type StockMovement = typeof stockMovement.$inferSelect;
export type StockReservation = typeof stockReservation.$inferSelect;
