import { sql } from 'drizzle-orm';
import { check, index, integer, numeric, pgSchema, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
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
export const salesForecast = planningSchema.table('sales_forecast', {
  id: uuid('id').primaryKey().defaultRandom(),
  forecastNumber: text('forecast_number').notNull(),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  itemCategoryId: uuid('item_category_id')
    .notNull()
    .references(() => itemCategory.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  warehouseId: uuid('warehouse_id').references(() => warehouse.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  fromDate: timestamp('from_date', { withTimezone: true }).notNull(),
  toDate: timestamp('to_date', { withTimezone: true }).notNull(),
  basedOn: text('based_on').notNull().default('job_order'),
  forecastPeriodicity: text('forecast_periodicity').notNull().default('monthly'),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('sales_forecast_number_unique').on(t.forecastNumber),
  check('sales_forecast_based_on_valid', sql`${t.basedOn} in ('job_order')`),
  check('sales_forecast_periodicity_valid', sql`${t.forecastPeriodicity} in ('monthly', 'quarterly', 'half_yearly', 'yearly')`),
  check('sales_forecast_status_valid', sql`${t.status} in ('draft', 'submitted')`),
  check('sales_forecast_dates_valid', sql`${t.toDate} >= ${t.fromDate}`),
  index('sales_forecast_org_node_idx').on(t.orgNodeId),
  index('sales_forecast_item_category_idx').on(t.itemCategoryId),
]);

export const salesForecastLine = planningSchema.table('sales_forecast_line', {
  id: uuid('id').primaryKey().defaultRandom(),
  salesForecastId: uuid('sales_forecast_id')
    .notNull()
    .references(() => salesForecast.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  itemId: uuid('item_id')
    .notNull()
    .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  warehouseId: uuid('warehouse_id').references(() => warehouse.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  forecastQuantity: numeric('forecast_quantity', { precision: 24, scale: 6 }).notNull(),
  plannedQuantity: numeric('planned_quantity', { precision: 24, scale: 6 }),
  lineNumber: integer('line_number').notNull().default(0),
}, (t) => [
  check('sales_forecast_line_forecast_qty_positive', sql`${t.forecastQuantity} > 0`),
  index('sales_forecast_line_forecast_idx').on(t.salesForecastId),
  index('sales_forecast_line_item_idx').on(t.itemId),
]);

export type SalesForecast = typeof salesForecast.$inferSelect;
export type SalesForecastLine = typeof salesForecastLine.$inferSelect;
