import { sql } from 'drizzle-orm';
import { check, index, numeric, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { item } from '../catalog/catalog.schema';
import { warehouse } from '../inventory/inventory.schema';

export const productionSchema = pgSchema('production');

/**
 * Tracks the FOUR quantities the owner insisted on, and never auto-approves
 * a deviation: plannedQuantity (from BOM), requestedQuantity (what production
 * asked for), issuedQuantity (what was actually taken from the warehouse),
 * actualUsedQuantity (final, after any scrap — recorded at closeout).
 * A request exceeding plannedQuantity is held ('pending_review'), never
 * auto-approved (D9 owner requirement — this is the exact fix for the
 * original design's flaw of silent exact-BOM auto-issue).
 */
export const materialRequest = productionSchema.table('material_request', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobOrderReference: text('job_order_reference').notNull(),
  itemId: uuid('item_id')
    .notNull()
    .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  warehouseId: uuid('warehouse_id')
    .notNull()
    .references(() => warehouse.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  plannedQuantity: numeric('planned_quantity', { precision: 24, scale: 6 }).notNull(),
  requestedQuantity: numeric('requested_quantity', { precision: 24, scale: 6 }).notNull(),
  issuedQuantity: numeric('issued_quantity', { precision: 24, scale: 6 }),
  actualUsedQuantity: numeric('actual_used_quantity', { precision: 24, scale: 6 }),
  status: text('status').notNull().default('pending_review'),
  deviationReason: text('deviation_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('material_request_planned_non_negative', sql`${t.plannedQuantity} >= 0`),
  check('material_request_requested_positive', sql`${t.requestedQuantity} > 0`),
  check(
    'material_request_status_valid',
    sql`${t.status} in ('approved', 'pending_review', 'rejected', 'issued', 'closed')`,
  ),
  index('material_request_job_order_idx').on(t.jobOrderReference),
]);

export type MaterialRequest = typeof materialRequest.$inferSelect;
