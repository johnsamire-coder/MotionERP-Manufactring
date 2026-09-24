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
import { item, itemCategory } from '../catalog/catalog.schema';
import { warehouse } from '../inventory/inventory.schema';
import { orgNode } from '../organization/organization.schema';

export const planningSchema = pgSchema('planning');

/**
 * Sales Forecast — ERPNext parity build (14 Sep 2026): the first of three
 * Material Planning masters (Sales Forecast, then a Production-Plan-shaped
 * Material Request, then Production Plan itself, which will consume all
 * three). "For" is scoped to Item Category only for now (our closest match
 * to ERPNext's Item Group) — there is no Territory concept in Motion yet,
 * so that option is deferred until a real need for it appears.
 * "Based On" is scoped to job_order only for now (our closest match to
 * ERPNext's Sales Order) — Sales Invoice / Quantity Forecast are ERPNext
 * options with no Motion equivalent yet.
 */
export const salesForecast = planningSchema.table(
  'sales_forecast',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    forecastNumber: text('forecast_number').notNull(),
    orgNodeId: uuid('org_node_id')
      .notNull()
      .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    itemCategoryId: uuid('item_category_id')
      .notNull()
      .references(() => itemCategory.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    warehouseId: uuid('warehouse_id').references(() => warehouse.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    fromDate: timestamp('from_date', { withTimezone: true }).notNull(),
    toDate: timestamp('to_date', { withTimezone: true }).notNull(),
    basedOn: text('based_on').notNull().default('job_order'),
    forecastPeriodicity: text('forecast_periodicity').notNull().default('monthly'),
    status: text('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('sales_forecast_number_unique').on(t.forecastNumber),
    check('sales_forecast_based_on_valid', sql`${t.basedOn} in ('job_order')`),
    check(
      'sales_forecast_periodicity_valid',
      sql`${t.forecastPeriodicity} in ('monthly', 'quarterly', 'half_yearly', 'yearly')`,
    ),
    check('sales_forecast_status_valid', sql`${t.status} in ('draft', 'submitted')`),
    check('sales_forecast_dates_valid', sql`${t.toDate} >= ${t.fromDate}`),
    index('sales_forecast_org_node_idx').on(t.orgNodeId),
    index('sales_forecast_item_category_idx').on(t.itemCategoryId),
  ],
);

export const salesForecastLine = planningSchema.table(
  'sales_forecast_line',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salesForecastId: uuid('sales_forecast_id')
      .notNull()
      .references(() => salesForecast.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    warehouseId: uuid('warehouse_id').references(() => warehouse.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    forecastQuantity: numeric('forecast_quantity', { precision: 24, scale: 6 }).notNull(),
    plannedQuantity: numeric('planned_quantity', { precision: 24, scale: 6 }),
    lineNumber: integer('line_number').notNull().default(0),
  },
  (t) => [
    check('sales_forecast_line_forecast_qty_positive', sql`${t.forecastQuantity} > 0`),
    index('sales_forecast_line_forecast_idx').on(t.salesForecastId),
    index('sales_forecast_line_item_idx').on(t.itemId),
  ],
);

export type SalesForecast = typeof salesForecast.$inferSelect;
export type SalesForecastLine = typeof salesForecastLine.$inferSelect;

/**
 * Material Request — ERPNext parity build (14 Sep 2026): the second of
 * three Material Planning masters. Lives in the `planning` schema (distinct
 * PostgreSQL schema from `production.material_request`, which is Motion's
 * own deviation-control feature and is untouched by this build). Variable
 * name prefixed `planningMaterialRequest` to avoid any naming collision if
 * both modules are ever imported together.
 * `purpose` mirrors ERPNext's real options relevant here; Sales Order /
 * Purchase Order Item linkage is deferred (no such masters exist in Motion
 * yet) — `jobOrderReference` (plain text, not a FK, same pattern as
 * elsewhere) is the closest available link back to a source document.
 */
export const planningMaterialRequest = planningSchema.table(
  'material_request',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestNumber: text('request_number').notNull(),
    orgNodeId: uuid('org_node_id')
      .notNull()
      .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    purpose: text('purpose').notNull().default('manufacture'),
    transactionDate: timestamp('transaction_date', { withTimezone: true }).notNull().defaultNow(),
    requiredByDate: timestamp('required_by_date', { withTimezone: true }),
    jobOrderReference: text('job_order_reference'),
    status: text('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('planning_material_request_number_unique').on(t.requestNumber),
    check(
      'planning_material_request_purpose_valid',
      sql`${t.purpose} in ('purchase', 'material_transfer', 'material_issue', 'manufacture')`,
    ),
    check(
      'planning_material_request_status_valid',
      sql`${t.status} in ('draft', 'submitted', 'cancelled')`,
    ),
    index('planning_material_request_org_node_idx').on(t.orgNodeId),
    index('planning_material_request_job_order_idx').on(t.jobOrderReference),
  ],
);

export const planningMaterialRequestLine = planningSchema.table(
  'material_request_line',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    materialRequestId: uuid('material_request_id')
      .notNull()
      .references(() => planningMaterialRequest.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    warehouseId: uuid('warehouse_id').references(() => warehouse.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    quantity: numeric('quantity', { precision: 24, scale: 6 }).notNull(),
    scheduleDate: timestamp('schedule_date', { withTimezone: true }),
    lineNumber: integer('line_number').notNull().default(0),
  },
  (t) => [
    check('planning_material_request_line_qty_positive', sql`${t.quantity} > 0`),
    index('planning_material_request_line_request_idx').on(t.materialRequestId),
    index('planning_material_request_line_item_idx').on(t.itemId),
  ],
);

export type PlanningMaterialRequest = typeof planningMaterialRequest.$inferSelect;
export type PlanningMaterialRequestLine = typeof planningMaterialRequestLine.$inferSelect;

/**
 * Production Plan — ERPNext parity build (14 Sep 2026): the third and final
 * Material Planning master, consuming the previous two (Sales Forecast,
 * Material Request) plus Job Order (our Sales Order equivalent) as its
 * "Production Plan By" source. Each item line points to a specific
 * APPROVED BOM (validated at Work Order creation time, same rule as
 * Work Order itself) and can spawn a real Work Order via the "Create Work
 * Orders" action — same cross-module pattern as elsewhere (D2/D20).
 */
export const productionPlan = planningSchema.table(
  'production_plan',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planNumber: text('plan_number').notNull(),
    orgNodeId: uuid('org_node_id')
      .notNull()
      .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    planBy: text('plan_by').notNull().default('job_order'),
    fromDate: timestamp('from_date', { withTimezone: true }).notNull(),
    toDate: timestamp('to_date', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('production_plan_number_unique').on(t.planNumber),
    check(
      'production_plan_by_valid',
      sql`${t.planBy} in ('job_order', 'material_request', 'sales_forecast')`,
    ),
    check(
      'production_plan_status_valid',
      sql`${t.status} in ('draft', 'submitted', 'completed', 'closed')`,
    ),
    check('production_plan_dates_valid', sql`${t.toDate} >= ${t.fromDate}`),
    index('production_plan_org_node_idx').on(t.orgNodeId),
  ],
);

export const productionPlanItem = planningSchema.table(
  'production_plan_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productionPlanId: uuid('production_plan_id')
      .notNull()
      .references(() => productionPlan.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    productItemId: uuid('product_item_id')
      .notNull()
      .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    bomId: uuid('bom_id').notNull(),
    qtyToPlan: numeric('qty_to_plan', { precision: 24, scale: 6 }).notNull(),
    warehouseId: uuid('warehouse_id').references(() => warehouse.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    workOrderId: uuid('work_order_id'),
    lineNumber: integer('line_number').notNull().default(0),
  },
  (t) => [
    check('production_plan_item_qty_positive', sql`${t.qtyToPlan} > 0`),
    index('production_plan_item_plan_idx').on(t.productionPlanId),
    index('production_plan_item_product_idx').on(t.productItemId),
  ],
);

export type ProductionPlan = typeof productionPlan.$inferSelect;
export type ProductionPlanItem = typeof productionPlanItem.$inferSelect;

/**
 * Item Lead Time — ERPNext parity build: fourth Material Planning master.
 * "Manufacturing Time" and "Purchase Time" are the two ERPNext tabs
 * (Capacity Planning Detail sub-table deferred to a later iteration — it
 * needs Work Center linkage and computed formulas, out of scope for this
 * pass). Supplier is referenced by a plain-text name (not a FK), same D2/D20
 * pattern as elsewhere, since no dedicated Supplier module link exists yet
 * for cross-schema references from `planning`.
 */
export const itemLeadTime = planningSchema.table(
  'item_lead_time',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    orgNodeId: uuid('org_node_id')
      .notNull()
      .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    manufacturingTimeHours: numeric('manufacturing_time_hours', { precision: 12, scale: 4 }),
    isManufacturingLeadTime: boolean('is_manufacturing_lead_time').notNull().default(false),
    manufacturingBufferDays: numeric('manufacturing_buffer_days', { precision: 8, scale: 2 }),
    purchaseTimeDays: numeric('purchase_time_days', { precision: 8, scale: 2 }),
    isPurchaseLeadTime: boolean('is_purchase_lead_time').notNull().default(false),
    purchaseBufferDays: numeric('purchase_buffer_days', { precision: 8, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('item_lead_time_item_unique').on(t.itemId),
    index('item_lead_time_org_node_idx').on(t.orgNodeId),
  ],
);

export const supplierLeadTime = planningSchema.table(
  'supplier_lead_time',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemLeadTimeId: uuid('item_lead_time_id')
      .notNull()
      .references(() => itemLeadTime.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    supplierName: text('supplier_name').notNull(),
    leadTimeDays: numeric('lead_time_days', { precision: 8, scale: 2 }).notNull(),
  },
  (t) => [
    check('supplier_lead_time_days_positive', sql`${t.leadTimeDays} > 0`),
    index('supplier_lead_time_item_lead_time_idx').on(t.itemLeadTimeId),
  ],
);

export type ItemLeadTime = typeof itemLeadTime.$inferSelect;
export type SupplierLeadTime = typeof supplierLeadTime.$inferSelect;

/**
 * Master Production Schedule — ERPNext parity build: a per-item x period
 * forecast/plan, feeding Production Plan as an alternative "Plan By" source
 * alongside Sales Forecast (ERPNext's MPS/Sales Forecast are structurally
 * near-identical; MPS is scoped to a single item, Sales Forecast to a whole
 * Item Category). "Distribute Quantities Evenly" is a pure frontend
 * calculation (no backend state needed) and is not modeled here.
 */
export const masterProductionSchedule = planningSchema.table(
  'master_production_schedule',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mpsNumber: text('mps_number').notNull(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    orgNodeId: uuid('org_node_id')
      .notNull()
      .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    warehouseId: uuid('warehouse_id').references(() => warehouse.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    fromDate: timestamp('from_date', { withTimezone: true }).notNull(),
    toDate: timestamp('to_date', { withTimezone: true }).notNull(),
    totalForecastQuantity: numeric('total_forecast_quantity', { precision: 24, scale: 6 }),
    projectedQuantity: numeric('projected_quantity', { precision: 24, scale: 6 }),
    plannedQuantity: numeric('planned_quantity', { precision: 24, scale: 6 }),
    status: text('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('mps_number_unique').on(t.mpsNumber),
    check('mps_periodicity_status_valid', sql`${t.status} in ('draft', 'submitted')`),
    check('mps_dates_valid', sql`${t.toDate} >= ${t.fromDate}`),
    index('mps_org_node_idx').on(t.orgNodeId),
    index('mps_item_idx').on(t.itemId),
  ],
);

export const mpsScheduleLine = planningSchema.table(
  'mps_schedule_line',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    masterProductionScheduleId: uuid('master_production_schedule_id')
      .notNull()
      .references(() => masterProductionSchedule.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    period: text('period').notNull(),
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }).notNull(),
    forecastQuantity: numeric('forecast_quantity', { precision: 24, scale: 6 }).notNull(),
    plannedQuantity: numeric('planned_quantity', { precision: 24, scale: 6 }),
    lineNumber: integer('line_number').notNull().default(0),
  },
  (t) => [
    check(
      'mps_schedule_line_period_valid',
      sql`${t.period} in ('week', 'month', 'quarter', 'year')`,
    ),
    check('mps_schedule_line_forecast_qty_positive', sql`${t.forecastQuantity} > 0`),
    index('mps_schedule_line_mps_idx').on(t.masterProductionScheduleId),
  ],
);

export type MasterProductionSchedule = typeof masterProductionSchedule.$inferSelect;
export type MpsScheduleLine = typeof mpsScheduleLine.$inferSelect;

/**
 * Sales Forecast Period Distribution — ERPNext parity addition: allows
 * spreading a Sales Forecast's total quantity across explicit named
 * periods (matching ERPNext's "Period Distribution" table), separate from
 * the per-item `sales_forecast_line` quantities. "Distribute Quantities
 * Evenly" is a pure frontend calculation over these rows, not a stored
 * server action.
 */
export const salesForecastPeriodLine = planningSchema.table(
  'sales_forecast_period_line',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salesForecastId: uuid('sales_forecast_id')
      .notNull()
      .references(() => salesForecast.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    periodName: text('period_name').notNull(),
    forecastQuantity: numeric('forecast_quantity', { precision: 24, scale: 6 }).notNull(),
    plannedQuantity: numeric('planned_quantity', { precision: 24, scale: 6 }),
    lineNumber: integer('line_number').notNull().default(0),
  },
  (t) => [
    check('sales_forecast_period_line_qty_positive', sql`${t.forecastQuantity} > 0`),
    index('sales_forecast_period_line_forecast_idx').on(t.salesForecastId),
  ],
);

export type SalesForecastPeriodLine = typeof salesForecastPeriodLine.$inferSelect;
