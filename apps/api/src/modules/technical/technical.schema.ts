import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, numeric, pgSchema, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { item } from '../catalog/catalog.schema';
import { warehouse } from '../inventory/inventory.schema';
import { orgNode } from '../organization/organization.schema';
export const technicalSchema = pgSchema('technical');
/** A technical document reference (shop drawing, cutting list) for a job order. No file storage yet — just a named reference and version. Unchanged: this is a Motion-specific feature, not part of ERPNext parity work. */
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
 * BOM (Bill of Materials) — ERPNext parity redesign (13 Sep 2026 decision):
 * scoped to a PRODUCT ITEM (Master), not a Job Order, matching ERPNext's
 * real "Item to Manufacture" field exactly. A job-order-specific BOM was the
 * original Motion design; that idea is deferred to the "Motion extras" phase
 * after full ERPNext parity is reached (see master document Part 7/11).
 *
 * orgNodeId is mandatory and user-supplied directly (like sales.quotation) —
 * there is no job order here to inherit it from. `version`/`status` (draft/
 * approved/archived) are a Motion addition on top of ERPNext's real fields
 * (Is Active, Is Default, Is Phantom BOM, Allow Alternative Item, Quality
 * Inspection Required, Consume Components Based On, Default Source/Target
 * Warehouse) — an extra review safety layer, not a deviation.
 */
export const bom = technicalSchema.table('bom', {
  id: uuid('id').primaryKey().defaultRandom(),
  productItemId: uuid('product_item_id')
    .notNull()
    .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  version: integer('version').notNull().default(1),
  outputQuantity: numeric('output_quantity', { precision: 24, scale: 6 }).notNull().default('1'),
  isActive: boolean('is_active').notNull().default(true),
  isDefault: boolean('is_default').notNull().default(false),
  isPhantomBom: boolean('is_phantom_bom').notNull().default(false),
  allowAlternativeItem: boolean('allow_alternative_item').notNull().default(false),
  qualityInspectionRequired: boolean('quality_inspection_required').notNull().default(false),
  consumeComponentsBasedOn: text('consume_components_based_on').notNull().default('bom'),
  defaultSourceWarehouseId: uuid('default_source_warehouse_id').references(() => warehouse.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  defaultTargetWarehouseId: uuid('default_target_warehouse_id').references(() => warehouse.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('bom_item_version_unique').on(t.productItemId, t.version),
  check('bom_output_quantity_positive', sql`${t.outputQuantity} > 0`),
  check('bom_status_valid', sql`${t.status} in ('draft', 'approved', 'archived')`),
  check('bom_consume_based_on_valid', sql`${t.consumeComponentsBasedOn} in ('bom', 'material_transferred_for_manufacture')`),
  index('bom_item_idx').on(t.productItemId),
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
