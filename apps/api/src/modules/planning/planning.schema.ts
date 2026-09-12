import { sql } from 'drizzle-orm';
import { check, index, integer, numeric, pgSchema, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { orgNode } from '../organization/organization.schema';

export const planningSchema = pgSchema('planning');

/**
 * One planning record per Job Order. `jobOrderReference` is a plain text
 * reference to the job order's number (not a FK) — planning is a separate
 * unit that only reads/records references to job orders, it does not own
 * them (D2/D20, same pattern already used for job_order.quotationReference).
 *
 * `orgNodeId` is copied from the referenced job order at creation time (same
 * inheritance pattern as job_order copying it from its quotation) so plans
 * can be filtered/reported by company/activity without re-querying sales.
 */
export const productionPlan = planningSchema.table('production_plan', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobOrderReference: text('job_order_reference').notNull(),
  orgNodeId: uuid('org_node_id').references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  priority: integer('priority').notNull().default(0),
  executionMode: text('execution_mode').notNull().default('internal'),
  internalQuantity: numeric('internal_quantity', { precision: 24, scale: 6 }),
  externalQuantity: numeric('external_quantity', { precision: 24, scale: 6 }),
  status: text('status').notNull().default('pending'),
  plannedStartDate: timestamp('planned_start_date', { withTimezone: true }),
  plannedEndDate: timestamp('planned_end_date', { withTimezone: true }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('production_plan_job_order_unique').on(t.jobOrderReference),
  check('production_plan_execution_mode_valid', sql`${t.executionMode} in ('internal', 'external', 'mixed')`),
  check('production_plan_status_valid', sql`${t.status} in ('pending', 'planned', 'locked')`),
  check(
    'production_plan_mixed_quantities',
    sql`${t.executionMode} <> 'mixed' or (${t.internalQuantity} > 0 and ${t.externalQuantity} > 0)`,
  ),
  index('production_plan_priority_idx').on(t.priority),
  index('production_plan_org_node_idx').on(t.orgNodeId),
]);

export type ProductionPlan = typeof productionPlan.$inferSelect;
