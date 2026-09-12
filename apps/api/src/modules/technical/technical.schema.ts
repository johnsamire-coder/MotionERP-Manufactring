import { sql } from 'drizzle-orm';
import { check, index, integer, numeric, pgSchema, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { item } from '../catalog/catalog.schema';
import { orgNode } from '../organization/organization.schema';

export const technicalSchema = pgSchema('technical');

/** A technical document reference (shop drawing, cutting list) for a job order. No file storage yet — just a named reference and version. */
export const technicalDocument = technicalSchema.table('technical_document', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobOrderReference: text('job_order_reference').notNull(),
  orgNodeId: uuid('org_node_id').references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  documentType: text('document_type').notNull(),
  fileReference: text('file_reference').notNull(),
  version: integer('version').notNull().default(1),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('technical_document_type_valid', sql`${t.documentType} in ('shop_drawing', 'cutting_list', 'other')`),
  index('technical_document_job_order_idx').on(t.jobOrderReference),
  index('technical_document_org_node_idx').on(t.orgNodeId),
]);

/**
 * BOM is scoped to a Job Order (not just an item, per the owner's explicit
 * correction of the original design) — a custom job can need a BOM tailored
 * to it, versioned, reviewed by the technical office. `jobOrderReference` is
 * plain text, matching the pattern used throughout (D2/D20).
 *
 * `orgNodeId` is inherited from the referenced job order at creation time
 * (same pattern as production_plan), so BOMs can be filtered/reported by
 * company/activity without re-querying sales.
 */
export const bom = technicalSchema.table('bom', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobOrderReference: text('job_order_reference').notNull(),
  orgNodeId: uuid('org_node_id').references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  productItemId: uuid('product_item_id')
    .notNull()
    .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  version: integer('version').notNull().default(1),
  outputQuantity: numeric('output_quantity', { precision: 24, scale: 6 }).notNull().default('1'),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('bom_job_order_version_unique').on(t.jobOrderReference, t.version),
  check('bom_output_quantity_positive', sql`${t.outputQuantity} > 0`),
  check('bom_status_valid', sql`${t.status} in ('draft', 'approved', 'archived')`),
  index('bom_job_order_idx').on(t.jobOrderReference),
  index('bom_org_node_idx').on(t.orgNodeId),
]);

export const bomLine = technicalSchema.table('bom_line', {
  id: uuid('id').primaryKey().defaultRandom(),
  bomId: uuid('bom_id')
    .notNull()
    .references(() => bom.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  componentItemId: uuid('component_item_id')
    .notNull()
    .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  quantity: numeric('quantity', { precision: 24, scale: 6 }).notNull(),
  lineNumber: integer('line_number').notNull().default(0),
}, (t) => [
  check('bom_line_quantity_positive', sql`${t.quantity} > 0`),
  index('bom_line_bom_idx').on(t.bomId),
  index('bom_line_component_idx').on(t.componentItemId),
]);

export type TechnicalDocument = typeof technicalDocument.$inferSelect;
export type Bom = typeof bom.$inferSelect;
export type BomLine = typeof bomLine.$inferSelect;
