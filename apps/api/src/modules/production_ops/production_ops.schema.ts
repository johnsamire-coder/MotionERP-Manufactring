import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, numeric, pgSchema, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { item } from '../catalog/catalog.schema';
import { employee } from '../hr/hr.schema';
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

/**
 * Work Order â€” ERPNext parity build (13 Sep 2026): built strictly on top of
 * an approved BOM (bomId mandatory, matching ERPNext's mandatory "BOM No"),
 * matching ERPNext's real Work Order fields for Materials/warehouses/status.
 * jobOrderReference is a Motion-specific addition kept optional from day one
 * (owner's explicit choice) â€” it plays no role in ERPNext's own lifecycle.
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
  useMultiLevelBom: boolean('use_multi_level_bom').notNull().default(false),
  considerScrapItems: boolean('consider_scrap_items').notNull().default(false),
  materialConsumptionPercentage: numeric('material_consumption_percentage', { precision: 6, scale: 2 }).notNull().default('100'),
  materialTransferMode: text('material_transfer_mode').notNull().default('transfer'),
  trackOperations: boolean('track_operations').notNull().default(false),
  status: text('status').notNull().default('not_started'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('work_order_number_unique').on(t.workOrderNumber),
  check('work_order_qty_positive', sql`${t.qtyToManufacture} > 0`),
  check('work_order_status_valid', sql`${t.status} in ('not_started', 'in_progress', 'completed', 'stopped', 'closed')`),
  check('work_order_material_transfer_mode_valid', sql`${t.materialTransferMode} in ('transfer', 'move')`),
  index('work_order_product_item_idx').on(t.productItemId),
  index('work_order_bom_idx').on(t.bomId),
  index('work_order_org_node_idx').on(t.orgNodeId),
  index('work_order_job_order_idx').on(t.jobOrderReference),
]);

/**
 * Job Card â€” extended 14 Sep 2026 for ERPNext parity: workOrderId is an
 * OPTIONAL link (owner's explicit choice, consistent with Work Order's own
 * optional jobOrderReference) â€” jobOrderReference remains mandatory and
 * unchanged so existing labor-cost-by-job-order reporting keeps working.
 * forQuantity/completedQuantity/processLossQuantity/allowOverproduction and
 * operatorEmployeeId are ERPNext's real Job Card fields. Workstation Type
 * and a formal Time Logs child table are added separately below/next.
 */
export const productionStep = productionOpsSchema.table('production_step', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobOrderReference: text('job_order_reference').notNull(),
  workOrderId: uuid('work_order_id').references(() => workOrder.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  orgNodeId: uuid('org_node_id').references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  workCenterId: uuid('work_center_id')
    .notNull()
    .references(() => workCenter.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  operationName: text('operation_name').notNull(),
  standardTimeMinutes: numeric('standard_time_minutes', { precision: 12, scale: 4 }).notNull(),
  actualTimeMinutes: numeric('actual_time_minutes', { precision: 12, scale: 4 }),
  forQuantity: numeric('for_quantity', { precision: 24, scale: 6 }),
  completedQuantity: numeric('completed_quantity', { precision: 24, scale: 6 }).notNull().default('0'),
  processLossQuantity: numeric('process_loss_quantity', { precision: 24, scale: 6 }),
  allowOverproduction: boolean('allow_overproduction').notNull().default(false),
  overproductionPercentage: numeric('overproduction_percentage', { precision: 6, scale: 3 }),
  operatorEmployeeId: uuid('operator_employee_id').references(() => employee.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  sequence: integer('sequence').notNull().default(0),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('production_step_standard_time_positive', sql`${t.standardTimeMinutes} > 0`),
  check('production_step_status_valid', sql`${t.status} in ('pending', 'in_progress', 'done')`),
  check('production_step_completed_qty_non_negative', sql`${t.completedQuantity} >= 0`),
  index('production_step_job_order_idx').on(t.jobOrderReference),
  index('production_step_work_order_idx').on(t.workOrderId),
  index('production_step_work_center_idx').on(t.workCenterId),
  index('production_step_org_node_idx').on(t.orgNodeId),
]);

/** Time Logs â€” ERPNext's real per-shift execution record for a Job Card. Multiple entries per step are expected (pause/resume). */
export const productionStepTimeLog = productionOpsSchema.table('production_step_time_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  productionStepId: uuid('production_step_id')
    .notNull()
    .references(() => productionStep.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  fromTime: timestamp('from_time', { withTimezone: true }).notNull(),
  toTime: timestamp('to_time', { withTimezone: true }),
  timeInMinutes: numeric('time_in_minutes', { precision: 12, scale: 4 }),
  completedQuantity: numeric('completed_quantity', { precision: 24, scale: 6 }),
  processLossQuantity: numeric('process_loss_quantity', { precision: 24, scale: 6 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('production_step_time_log_step_idx').on(t.productionStepId),
]);

/** Workstation Type â€” ERPNext Setup master: a simple classification for workstations (Machine / Assembly Line / ...). */
export const workstationType = productionOpsSchema.table('workstation_type', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('workstation_type_code_unique').on(t.code),
  check('workstation_type_code_format', sql`${t.code} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`),
  check('workstation_type_status_valid', sql`${t.status} in ('active', 'inactive')`),
]);

/** Operation â€” ERPNext Setup master: a reusable operation template (name, default work center, standard time) referenced from BOM Operations and Job Cards. */
export const operation = productionOpsSchema.table('operation', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  defaultWorkCenterId: uuid('default_work_center_id').references(() => workCenter.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  standardTimeMinutes: numeric('standard_time_minutes', { precision: 12, scale: 4 }),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('operation_code_unique').on(t.code),
  check('operation_code_format', sql`${t.code} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`),
  check('operation_status_valid', sql`${t.status} in ('active', 'inactive')`),
]);

export type WorkCenter = typeof workCenter.$inferSelect;
export type WorkOrder = typeof workOrder.$inferSelect;
export type ProductionStep = typeof productionStep.$inferSelect;
export type ProductionStepTimeLog = typeof productionStepTimeLog.$inferSelect;
export type WorkstationType = typeof workstationType.$inferSelect;
export type Operation = typeof operation.$inferSelect;

/**
 * Downtime Entry â€” ERPNext parity build: tracks unplanned/planned stoppage
 * time on a Work Center, with optional operator and root-cause reason.
 * `stoppageMinutes` is nullable and computed at close time (stopTime -
 * startTime), matching ERPNext's own auto-computed "Downtime" field.
 */
export const downtimeEntry = productionOpsSchema.table('downtime_entry', {
  id: uuid('id').primaryKey().defaultRandom(),
  workCenterId: uuid('work_center_id')
    .notNull()
    .references(() => workCenter.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  operatorEmployeeId: uuid('operator_employee_id').references(() => employee.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  stopReason: text('stop_reason').notNull(),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  stopTime: timestamp('stop_time', { withTimezone: true }),
  stoppageMinutes: numeric('stoppage_minutes', { precision: 12, scale: 2 }),
  remarks: text('remarks'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('downtime_entry_times_valid', sql`${t.stopTime} is null or ${t.stopTime} >= ${t.startTime}`),
  index('downtime_entry_work_center_idx').on(t.workCenterId),
]);

export type DowntimeEntry = typeof downtimeEntry.$inferSelect;

/**
 * Work Order Operations — ERPNext parity: embedded operations breakdown
 * within a Work Order, shown when trackOperations is true. Real FK to
 * work_order and work_center since both live in this same module (no
 * cross-module boundary issue).
 */
export const workOrderOperation = productionOpsSchema.table('work_order_operation', {
  id: uuid('id').primaryKey().defaultRandom(),
  workOrderId: uuid('work_order_id')
    .notNull()
    .references(() => workOrder.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  name: text('name').notNull(),
  workCenterId: uuid('work_center_id').references(() => workCenter.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  plannedStartTime: timestamp('planned_start_time', { withTimezone: true }),
  plannedEndTime: timestamp('planned_end_time', { withTimezone: true }),
  processLossQuantity: numeric('process_loss_quantity', { precision: 24, scale: 6 }),
  sequentialOrder: integer('sequential_order').notNull().default(0),
}, (t) => [
  index('work_order_operation_wo_idx').on(t.workOrderId),
]);

export type WorkOrderOperation = typeof workOrderOperation.$inferSelect;
