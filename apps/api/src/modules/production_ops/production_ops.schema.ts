import { sql } from 'drizzle-orm';
import { check, index, integer, numeric, pgSchema, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { orgNode } from '../organization/organization.schema';

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

/** One actual production step of a Job Order's routing. Standard time is the plan; actual time is recorded when the step is closed, driving real labor cost. */
export const productionStep = productionOpsSchema.table('production_step', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobOrderReference: text('job_order_reference').notNull(),
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
]);

export type WorkCenter = typeof workCenter.$inferSelect;
export type ProductionStep = typeof productionStep.$inferSelect;
