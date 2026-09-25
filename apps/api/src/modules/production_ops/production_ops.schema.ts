import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgSchema,
  text,
  timestamp,
  uuid,
  unique,
} from 'drizzle-orm/pg-core';
import { item } from '../catalog/catalog.schema';
import { employee } from '../hr/hr.schema';
import { warehouse } from '../inventory/inventory.schema';
import { orgNode } from '../organization/organization.schema';
import { bom } from '../technical/technical.schema';
import { supplier } from '../crm/crm.schema';
import { chartOfAccounts } from '../accounting/accounting.schema';

export const productionOpsSchema = pgSchema('production_ops');

export const workCenter = productionOpsSchema.table(
  'work_center',
  {
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
  },
  (t) => [
    unique('work_center_code_unique').on(t.code),
    check('work_center_code_format', sql`${t.code} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`),
    check('work_center_rate_non_negative', sql`${t.ratePerMinute} >= 0`),
    check('work_center_status_valid', sql`${t.status} in ('active', 'inactive', 'archived')`),
    index('work_center_org_node_idx').on(t.orgNodeId),
  ],
);

export const workOrder = productionOpsSchema.table(
  'work_order',
  {
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
    sourceWarehouseId: uuid('source_warehouse_id').references(() => warehouse.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    wipWarehouseId: uuid('wip_warehouse_id').references(() => warehouse.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    finishedGoodsWarehouseId: uuid('finished_goods_warehouse_id')
      .notNull()
      .references(() => warehouse.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    plannedStartDate: timestamp('planned_start_date', { withTimezone: true }),
    actualStartDate: timestamp('actual_start_date', { withTimezone: true }),
    actualEndDate: timestamp('actual_end_date', { withTimezone: true }),
    useMultiLevelBom: boolean('use_multi_level_bom').notNull().default(false),
    considerScrapItems: boolean('consider_scrap_items').notNull().default(false),
    materialConsumptionPercentage: numeric('material_consumption_percentage', {
      precision: 6,
      scale: 2,
    })
      .notNull()
      .default('100'),
    materialTransferMode: text('material_transfer_mode').notNull().default('transfer'),
    trackOperations: boolean('track_operations').notNull().default(false),
    status: text('status').notNull().default('not_started'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('work_order_number_unique').on(t.workOrderNumber),
    check('work_order_qty_positive', sql`${t.qtyToManufacture} > 0`),
    check(
      'work_order_status_valid',
      sql`${t.status} in ('not_started', 'in_progress', 'completed', 'stopped', 'closed')`,
    ),
    check(
      'work_order_material_transfer_mode_valid',
      sql`${t.materialTransferMode} in ('transfer', 'move')`,
    ),
    index('work_order_product_item_idx').on(t.productItemId),
    index('work_order_bom_idx').on(t.bomId),
    index('work_order_org_node_idx').on(t.orgNodeId),
    index('work_order_job_order_idx').on(t.jobOrderReference),
  ],
);

export const productionStep = productionOpsSchema.table(
  'production_step',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobOrderReference: text('job_order_reference').notNull(),
    workOrderId: uuid('work_order_id').references(() => workOrder.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    orgNodeId: uuid('org_node_id').references(() => orgNode.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    workCenterId: uuid('work_center_id')
      .notNull()
      .references(() => workCenter.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    operationName: text('operation_name').notNull(),
    standardTimeMinutes: numeric('standard_time_minutes', { precision: 12, scale: 4 }).notNull(),
    actualTimeMinutes: numeric('actual_time_minutes', { precision: 12, scale: 4 }),
    forQuantity: numeric('for_quantity', { precision: 24, scale: 6 }),
    completedQuantity: numeric('completed_quantity', { precision: 24, scale: 6 })
      .notNull()
      .default('0'),
    processLossQuantity: numeric('process_loss_quantity', { precision: 24, scale: 6 }),
    allowOverproduction: boolean('allow_overproduction').notNull().default(false),
    overproductionPercentage: numeric('overproduction_percentage', { precision: 6, scale: 3 }),
    operatorEmployeeId: uuid('operator_employee_id').references(() => employee.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    sequence: integer('sequence').notNull().default(0),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('production_step_standard_time_positive', sql`${t.standardTimeMinutes} > 0`),
    check('production_step_status_valid', sql`${t.status} in ('pending', 'in_progress', 'done')`),
    check('production_step_completed_qty_non_negative', sql`${t.completedQuantity} >= 0`),
    index('production_step_job_order_idx').on(t.jobOrderReference),
    index('production_step_work_order_idx').on(t.workOrderId),
    index('production_step_work_center_idx').on(t.workCenterId),
    index('production_step_org_node_idx').on(t.orgNodeId),
  ],
);

export const productionStepTimeLog = productionOpsSchema.table(
  'production_step_time_log',
  {
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
  },
  (t) => [index('production_step_time_log_step_idx').on(t.productionStepId)],
);

export const workstationType = productionOpsSchema.table(
  'workstation_type',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('workstation_type_code_unique').on(t.code),
    check('workstation_type_code_format', sql`${t.code} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`),
    check('workstation_type_status_valid', sql`${t.status} in ('active', 'inactive')`),
  ],
);

export const operation = productionOpsSchema.table(
  'operation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    defaultWorkCenterId: uuid('default_work_center_id').references(() => workCenter.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    standardTimeMinutes: numeric('standard_time_minutes', { precision: 12, scale: 4 }),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('operation_code_unique').on(t.code),
    check('operation_code_format', sql`${t.code} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`),
    check('operation_status_valid', sql`${t.status} in ('active', 'inactive')`),
  ],
);

export const downtimeEntry = productionOpsSchema.table(
  'downtime_entry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workCenterId: uuid('work_center_id')
      .notNull()
      .references(() => workCenter.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    operatorEmployeeId: uuid('operator_employee_id').references(() => employee.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    stopReason: text('stop_reason').notNull(),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    stopTime: timestamp('stop_time', { withTimezone: true }),
    stoppageMinutes: numeric('stoppage_minutes', { precision: 12, scale: 2 }),
    remarks: text('remarks'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'downtime_entry_times_valid',
      sql`${t.stopTime} is null or ${t.stopTime} >= ${t.startTime}`,
    ),
    index('downtime_entry_work_center_idx').on(t.workCenterId),
  ],
);

export const workOrderOperation = productionOpsSchema.table(
  'work_order_operation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workOrderId: uuid('work_order_id')
      .notNull()
      .references(() => workOrder.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    name: text('name').notNull(),
    workCenterId: uuid('work_center_id').references(() => workCenter.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    plannedStartTime: timestamp('planned_start_time', { withTimezone: true }),
    plannedEndTime: timestamp('planned_end_time', { withTimezone: true }),
    processLossQuantity: numeric('process_loss_quantity', { precision: 24, scale: 6 }),
    sequentialOrder: integer('sequential_order').notNull().default(0),
  },
  (t) => [index('work_order_operation_wo_idx').on(t.workOrderId)],
);

export const productionStepMaterial = productionOpsSchema.table(
  'production_step_material',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productionStepId: uuid('production_step_id')
      .notNull()
      .references(() => productionStep.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    requiredQuantity: numeric('required_quantity', { precision: 24, scale: 6 }).notNull(),
    consumedQuantity: numeric('consumed_quantity', { precision: 24, scale: 6 })
      .notNull()
      .default('0'),
    warehouseId: uuid('warehouse_id').references(() => warehouse.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    lineNumber: integer('line_number').notNull().default(0),
  },
  (t) => [
    index('production_step_material_step_idx').on(t.productionStepId),
    index('production_step_material_item_idx').on(t.itemId),
  ],
);

// ==================== 7. منظومة تشغيل العمليات الخارجية لدى الغير (الجديد) ====================

export const subcontractingOrder = productionOpsSchema.table(
  'subcontracting_order',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    voucherNumber: text('voucher_number').notNull().unique(), // رقم إذن التشغيل الخارجي التلقائي
    orgNodeId: uuid('org_node_id')
      .notNull()
      .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => supplier.id, { onUpdate: 'cascade', onDelete: 'restrict' }), // مقاول الباطن
    workOrderId: uuid('work_order_id').references(() => workOrder.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }), // أمر الإنتاج المرتبط
    postingDate: timestamp('posting_date', { withTimezone: true }).notNull(),

    totalServiceCost: numeric('total_service_cost', { precision: 14, scale: 4 }).notNull(), // إجمالي قيمة مصنعية المقاول الخارجي
    serviceAccountId: uuid('service_account_id')
      .notNull()
      .references(() => chartOfAccounts.id, { onDelete: 'restrict' }), // حساب استحقاق خدمات مقاولي الباطن

    status: text('status').notNull().default('draft'), // draft | posted | partially_received | completed | cancelled
    /** Plan item 45: the subcontractor's purchase invoice for the service (finance UUID, D2). */
    purchaseInvoiceId: uuid('purchase_invoice_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'subcontracting_order_status_valid',
      sql`${t.status} in ('draft', 'posted', 'partially_received', 'completed', 'cancelled')`,
    ),
    check('subcontracting_service_cost_positive', sql`${t.totalServiceCost} > 0`),
    index('idx_subcontract_supplier').on(t.supplierId),
    index('idx_subcontract_wo').on(t.workOrderId),
    index('idx_subcontract_date').on(t.postingDate),
  ],
);

export const subcontractingItem = productionOpsSchema.table(
  'subcontracting_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subcontractingOrderId: uuid('subcontracting_order_id')
      .notNull()
      .references(() => subcontractingOrder.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => item.id, { onDelete: 'restrict' }),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouse.id, { onDelete: 'restrict' }), // مخزن عهدة المقاول الخارجي
    quantity: numeric('quantity', { precision: 24, scale: 6 }).notNull(),
    rawMaterialCost: numeric('raw_material_cost', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'), // تكلفة الخامات المرسلة
    serviceRate: numeric('service_rate', { precision: 14, scale: 4 }).notNull(), // سعر مصنعية القطعة الواحدة للمقاول
    newValuationRate: numeric('new_valuation_rate', { precision: 18, scale: 6 }).notNull(), // التكلفة المدمجة النهائية للقطعة
    /** Plan item 45: quantity already received back from the subcontractor. */
    receivedQty: numeric('received_qty', { precision: 24, scale: 6 }).notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_subcontract_item_order').on(t.subcontractingOrderId),
    index('idx_subcontract_item_item').on(t.itemId),
  ],
);

export type WorkCenter = typeof workCenter.$inferSelect;
export type WorkOrder = typeof workOrder.$inferSelect;
export type ProductionStep = typeof productionStep.$inferSelect;
export type ProductionStepTimeLog = typeof productionStepTimeLog.$inferSelect;
export type WorkstationType = typeof workstationType.$inferSelect;
export type Operation = typeof operation.$inferSelect;
export type DowntimeEntry = typeof downtimeEntry.$inferSelect;
export type WorkOrderOperation = typeof workOrderOperation.$inferSelect;
export type ProductionStepMaterial = typeof productionStepMaterial.$inferSelect;
export type SubcontractingOrder = typeof subcontractingOrder.$inferSelect;
export type SubcontractingItem = typeof subcontractingItem.$inferSelect;
