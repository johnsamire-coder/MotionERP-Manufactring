import { sql } from 'drizzle-orm';
import { check, index, numeric, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { item } from '../catalog/catalog.schema';
import { warehouse } from '../inventory/inventory.schema';
import { orgNode } from '../organization/organization.schema';

export const productionSchema = pgSchema('production');

export const materialRequest = productionSchema.table('material_request', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobOrderReference: text('job_order_reference').notNull(),
  orgNodeId: uuid('org_node_id').references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
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
  index('material_request_org_node_idx').on(t.orgNodeId),
]);

export type MaterialRequest = typeof materialRequest.$inferSelect;
