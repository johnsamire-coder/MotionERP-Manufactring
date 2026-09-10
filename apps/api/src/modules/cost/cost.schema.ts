import { sql } from 'drizzle-orm';
import { check, index, numeric, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const costSchema = pgSchema('cost');

export const costComponentType = costSchema.table('component_type', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('component_type_code_format', sql`${t.code} ~ '^[a-z_][a-z0-9_]*$'`),
]);

export const jobCostSheet = costSchema.table('job_cost_sheet', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobOrderReference: text('job_order_reference').notNull().unique(),
  currencyCode: text('currency_code').notNull().default('EGP'),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('job_cost_sheet_status_valid', sql`${t.status} in ('draft', 'active', 'closed')`),
  index('idx_job_cost_sheet_reference').on(t.jobOrderReference),
]);

export const costEntry = costSchema.table('entry', {
  id: uuid('id').primaryKey().defaultRandom(),
  costSheetId: uuid('cost_sheet_id')
    .notNull()
    .references(() => jobCostSheet.id, { onDelete: 'cascade' }),
  componentTypeId: uuid('component_type_id')
    .notNull()
    .references(() => costComponentType.id, { onDelete: 'restrict' }),
  entryType: text('entry_type').notNull(), // 'estimated' | 'actual'
  amount: numeric('amount', { precision: 12, scale: 4 }).notNull(),
  currencyCode: text('currency_code').notNull(),
  description: text('description'),
  sourceReference: text('source_reference'), // e.g., BOM id, work center id
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('cost_entry_type_valid', sql`${t.entryType} in ('estimated', 'actual')`),
  check('cost_entry_amount_positive', sql`${t.amount} > 0`),
  index('idx_cost_entry_sheet').on(t.costSheetId),
  index('idx_cost_entry_type').on(t.componentTypeId),
  index('idx_cost_entry_recorded_at').on(t.recordedAt),
]);

export type CostComponentType = typeof costComponentType.$inferSelect;
export type JobCostSheet = typeof jobCostSheet.$inferSelect;
export type CostEntry = typeof costEntry.$inferSelect;
export type CostEntryType = 'estimated' | 'actual';
