import { sql } from 'drizzle-orm';
import { check, index, integer, numeric, pgSchema, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { item } from '../catalog/catalog.schema';
import { warehouse } from '../inventory/inventory.schema';
import { orgNode } from '../organization/organization.schema';
import { bom } from '../technical/technical.schema';

export const productionOpsSchema = pgSchema('production_ops');

export const workCenter = productionOpsSchema.table('work_center', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  ratePerMinute: numeric('rate_per_minute', { precision: 12, scale: 4 }).notNull().default('0'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('work_center_code_unique').on(t.code),
  check('work_center_code_format', sql`${t.code} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`),
  check('work_center_rate_non_negative', sql`${t.ratePerMinute} >= 0`),
  check('work_center_status_valid', sql`${t.status} in ('active', 'inactive', 'archived')`),
  index('work_center_org_node_idx').on(t.orgNodeId),
]);

export const productionStep = productionOpsSchema.table('production_step', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobOrderReference: text('job_order_reference').notNull(),
  orgNodeId: uuid('org_node_id').references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  workCenterId: uuid('work_center_id')
    .notNull()
    .references(() => workCenter.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  operationName: text('operation_name').notNull(),
  standardTimeMinutes: numeric('standard_time_minutes', { precision: 12, scale: 4 }).notNull(),
  actualTimeMinutes: numeric('actual_time_minutes', { precision: 12, scale: 4 }),
  sequence: integer('sequence').notNull().default(0),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('production_step_standard_time_positive', sql`${t.standardTimeMinutes} > 0`),
  check('production_step_status_valid', sql`${t.status} in ('pending', 'in_progress', 'done')`),
  index('production_step_job_order_idx').on(t.jobOrderReference),
  index('production_step_work_center_idx').on(t.workCenterId),
  index('production_step_org_node_idx').on(t.orgNodeId),
]);

/**
 * Work Order — ERPNext parity build (13 Sep 2026): built strictly on top of
 * an approved BOM (bomId mandatory, matching ERPNext's mandatory "BOM No"),
 * matching ERPNext's real Work Order fields for Materials/warehouses/status.
 * jobOrderReference is a Motion-specific addition kept optional from day one
 * (owner's explicit choice) — it plays no role in ERPNext's own lifecycle.
 */
export const workOrder = productionOpsSchema.table('work_order', {
  id: uuid('id').primaryKey().defaultRandom(),
  workOrderNumber: text('work_order_number').notNull(),
  productItemId: uuid('product_item_id')
    .notNull()
    .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  bomId: uuid('bom_id')
    .notNull()
    .references(() => bom.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  jobOrderReference: text('job_order_reference'),
  qtyToManufacture: numeric('qty_to_manufacture', { precision: 24, scale: 6 }).notNull(),
  sourceWarehouseId: uuid('source_warehouse_id').references(() => warehouse.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  wipWarehouseId: uuid('wip_warehouse_id').references(() => warehouse.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  finishedGoodsWarehouseId: uuid('finished_goods_warehouse_id')
    .notNull()
    .references(() => warehouse.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  plannedStartDate: timestamp('planned_start_date', { withTimezone: true }),
  actualStartDate: timestamp('actual_start_date', { withTimezone: true }),
  actualEndDate: timestamp('actual_end_date', { withTimezone: true }),
  status: text('status').notNull().default('not_started'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('work_order_number_unique').on(t.workOrderNumber),
  check('work_order_qty_positive', sql`${t.qtyToManufacture} > 0`),
  check('work_order_status_valid', sql`${t.status} in ('not_started', 'in_progress', 'completed', 'stopped', 'closed')`),
  index('work_order_product_item_idx').on(t.productItemId),
  index('work_order_bom_idx').on(t.bomId),
  index('work_order_org_node_idx').on(t.orgNodeId),
  index('work_order_job_order_idx').on(t.jobOrderReference),
]);

export type WorkCenter = typeof workCenter.$inferSelect;
export type ProductionStep = typeof productionStep.$inferSelect;
export type WorkOrder = typeof workOrder.$inferSelect;
