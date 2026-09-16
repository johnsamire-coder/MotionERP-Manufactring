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
  operationId: uuid('operation_id'),
  standardTimeMinutes: numeric('standard_time_minutes', { precision: 12, scale: 4 }),
}, (t) => [
  check('bom_line_quantity_positive', sql`${t.quantity} > 0`),
  index('bom_line_bom_idx').on(t.bomId),
  index('bom_line_component_idx').on(t.componentItemId),
]);
export type TechnicalDocument = typeof technicalDocument.$inferSelect;
export type Bom = typeof bom.$inferSelect;
export type BomLine = typeof bomLine.$inferSelect;

/**
 * BOM Creator — ERPNext parity build: a draft multi-level BOM tree tool
 * (distinct from a real BOM document). `bomCreatorItem` self-references via
 * `parentId` to represent unlimited tree depth — a node with `parentId
 * null` is a direct component of the root product; any node can be marked
 * `isSubAssembly` to signal it should become its own real BOM document (with
 * its own children as that BOM's lines) when "Create BOMs" runs. "Update
 * Cost" is deferred — Motion has no item-pricing system yet to compute
 * costs from. "Validate BOM Tree" is folded into the createBoms action
 * itself (structural checks run there, no separate persisted validation
 * state).
 */
export const bomCreator = technicalSchema.table('bom_creator', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorNumber: text('creator_number').notNull(),
  productItemId: uuid('product_item_id')
    .notNull()
    .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  quantityToProduce: numeric('quantity_to_produce', { precision: 24, scale: 6 }).notNull().default('1'),
  allowAlternativeItem: boolean('allow_alternative_item').notNull().default(false),
  remarks: text('remarks'),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('bom_creator_number_unique').on(t.creatorNumber),
  check('bom_creator_qty_positive', sql`${t.quantityToProduce} > 0`),
  check('bom_creator_status_valid', sql`${t.status} in ('draft', 'completed')`),
  index('bom_creator_org_node_idx').on(t.orgNodeId),
]);

export const bomCreatorItem = technicalSchema.table('bom_creator_item', {
  id: uuid('id').primaryKey().defaultRandom(),
  bomCreatorId: uuid('bom_creator_id')
    .notNull()
    .references(() => bomCreator.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  parentId: uuid('parent_id'),
  componentItemId: uuid('component_item_id')
    .notNull()
    .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  quantity: numeric('quantity', { precision: 24, scale: 6 }).notNull(),
  isSubAssembly: boolean('is_sub_assembly').notNull().default(false),
  generatedBomId: uuid('generated_bom_id'),
  lineNumber: integer('line_number').notNull().default(0),
}, (t) => [
  check('bom_creator_item_qty_positive', sql`${t.quantity} > 0`),
  index('bom_creator_item_creator_idx').on(t.bomCreatorId),
  index('bom_creator_item_parent_idx').on(t.parentId),
]);

export type BomCreator = typeof bomCreator.$inferSelect;
export type BomCreatorItem = typeof bomCreatorItem.$inferSelect;
