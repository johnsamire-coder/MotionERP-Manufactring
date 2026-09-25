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
import { item } from '../catalog/catalog.schema';
import { customer, supplier } from '../crm/crm.schema';
import { orgNode } from '../organization/organization.schema';

export const salesSchema = pgSchema('sales');

/**
 * Unified quotation entity for BOTH directions (D37): 'outgoing' = we quote a
 * customer; 'incoming' = a supplier quotes us. Exactly one of customerId /
 * supplierId is set, matching `direction`. This keeps the two flows visually
 * and structurally parallel while remaining one table, one API, one lifecycle.
 */
export const quotation = salesSchema.table(
  'quotation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quotationNumber: text('quotation_number').notNull(),
    direction: text('direction').notNull(),
    customerId: uuid('customer_id').references(() => customer.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    supplierId: uuid('supplier_id').references(() => supplier.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    /** Which company/activity node this quotation belongs to. Nullable for now (existing rows have none); will become NOT NULL once backfilled in a later step. */
    orgNodeId: uuid('org_node_id').references(() => orgNode.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    quotationDate: timestamp('quotation_date', { withTimezone: true }).notNull(),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    status: text('status').notNull().default('draft'),
    currency: text('currency').notNull().default('EGP'),
    /** The customer's own PO reference, recorded once they approve (free text — it's their number, not ours). */
    customerPoReference: text('customer_po_reference'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('quotation_number_unique').on(t.quotationNumber),
    check('quotation_direction_valid', sql`${t.direction} in ('outgoing', 'incoming')`),
    check(
      'quotation_status_valid',
      sql`${t.status} in ('draft', 'sent', 'approved', 'rejected', 'expired')`,
    ),
    check(
      'quotation_party_matches_direction',
      sql`(${t.direction} = 'outgoing' and ${t.customerId} is not null and ${t.supplierId} is null)
     or (${t.direction} = 'incoming' and ${t.supplierId} is not null and ${t.customerId} is null)`,
    ),
    index('quotation_customer_idx').on(t.customerId),
    index('quotation_supplier_idx').on(t.supplierId),
    index('quotation_org_node_idx').on(t.orgNodeId),
  ],
);

export const quotationLine = salesSchema.table(
  'quotation_line',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quotationId: uuid('quotation_id')
      .notNull()
      .references(() => quotation.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    quantity: numeric('quantity', { precision: 24, scale: 6 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 20, scale: 4 }).notNull(),
    lineNumber: integer('line_number').notNull().default(0),
  },
  (t) => [
    check('quotation_line_quantity_positive', sql`${t.quantity} > 0`),
    check('quotation_line_price_non_negative', sql`${t.unitPrice} >= 0`),
    index('quotation_line_quotation_idx').on(t.quotationId),
    index('quotation_line_item_idx').on(t.itemId),
  ],
);

export type Quotation = typeof quotation.$inferSelect;

/**
 * Job Order — the central operational hub described by the owner. It does
 * NOT copy data from other units; it only holds REFERENCES (plain strings/IDs
 * describing "what led to this"), keeping every other unit fully independent
 * (D2/D20). Later phases (planning, technical office, production, quality,
 * costing, delivery, collections) each reference the job order's id the same
 * way, rather than the job order absorbing their data.
 */
export const jobOrder = salesSchema.table(
  'job_order',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobOrderNumber: text('job_order_number').notNull(),
    source: text('source').notNull(),
    /** Free-text reference to the approved quotation, when source = 'quotation'. Not a FK on purpose. */
    quotationReference: text('quotation_reference'),
    customerId: uuid('customer_id').references(() => customer.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    /** Which company/activity node this job order belongs to. Nullable for now (existing rows have none); will become NOT NULL once backfilled in a later step. */
    orgNodeId: uuid('org_node_id').references(() => orgNode.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    status: text('status').notNull().default('draft'),
    financialReviewPassed: text('financial_review_passed').notNull().default('false'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('job_order_number_unique').on(t.jobOrderNumber),
    check('job_order_source_valid', sql`${t.source} in ('quotation', 'internal')`),
    check(
      'job_order_status_valid',
      sql`${t.status} in ('draft', 'approved', 'in_progress', 'completed', 'cancelled')`,
    ),
    check('job_order_financial_review_valid', sql`${t.financialReviewPassed} in ('true', 'false')`),
    index('job_order_customer_idx').on(t.customerId),
    index('job_order_org_node_idx').on(t.orgNodeId),
  ],
);

export type JobOrder = typeof jobOrder.$inferSelect;

export type QuotationLine = typeof quotationLine.$inferSelect;

// ==================== طلب عرض أسعار لعدة موردين (RFQ — بند 7) ====================

/**
 * Request for Quotation: one request sent to several suppliers; each supplier's answer is
 * stored as a normal incoming quotation linked back through rfq_supplier. Items, suppliers
 * and material requests belong to other modules, so they are plain UUIDs / text here (D2).
 */
export const rfq = salesSchema.table(
  'rfq',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rfqNumber: text('rfq_number').notNull(),
    orgNodeId: uuid('org_node_id'),
    rfqDate: timestamp('rfq_date', { withTimezone: true }).notNull(),
    respondBy: timestamp('respond_by', { withTimezone: true }),
    status: text('status').notNull().default('draft'),
    materialRequestReference: text('material_request_reference'),
    awardedSupplierId: uuid('awarded_supplier_id'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('rfq_number_unique').on(t.rfqNumber),
    check('rfq_status_valid', sql`${t.status} in ('draft', 'sent', 'closed', 'cancelled')`),
  ],
);

export const rfqLine = salesSchema.table(
  'rfq_line',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rfqId: uuid('rfq_id')
      .notNull()
      .references(() => rfq.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
    itemId: uuid('item_id').notNull(),
    quantity: numeric('quantity', { precision: 24, scale: 6 }).notNull(),
    lineNumber: integer('line_number').notNull().default(0),
  },
  (t) => [
    unique('rfq_line_item_unique').on(t.rfqId, t.itemId),
    check('rfq_line_quantity_positive', sql`${t.quantity} > 0`),
    index('rfq_line_rfq_idx').on(t.rfqId),
  ],
);

export const rfqSupplier = salesSchema.table(
  'rfq_supplier',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rfqId: uuid('rfq_id')
      .notNull()
      .references(() => rfq.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
    supplierId: uuid('supplier_id').notNull(),
    status: text('status').notNull().default('pending'),
    quotationId: uuid('quotation_id').references(() => quotation.id, {
      onUpdate: 'cascade',
      onDelete: 'set null',
    }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (t) => [
    unique('rfq_supplier_unique').on(t.rfqId, t.supplierId),
    check('rfq_supplier_status_valid', sql`${t.status} in ('pending', 'received', 'declined')`),
    index('rfq_supplier_rfq_idx').on(t.rfqId),
  ],
);

// ==================== قواعد التسعير (بند 16) ====================

/**
 * Pricing rule (ERPNext-style, simplified). Applies to one item or an item category, for selling or
 * buying, optionally for one party, within a quantity range and validity window. Two kinds:
 * - price:   discount_percentage, discount_amount (per unit) or a fixed rate;
 * - product: free_qty of free_item (default: the same item), optionally for every min_qty (recursive).
 * Items / categories / parties belong to other modules: plain UUIDs checked in the service (D2).
 */
export const pricingRule = salesSchema.table(
  'pricing_rule',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    title: text('title').notNull(),
    appliesTo: text('applies_to').notNull(),
    applyOn: text('apply_on').notNull(),
    itemId: uuid('item_id'),
    categoryId: uuid('category_id'),
    partyId: uuid('party_id'),
    minQty: numeric('min_qty', { precision: 24, scale: 6 }).notNull().default('0'),
    maxQty: numeric('max_qty', { precision: 24, scale: 6 }),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    priority: integer('priority').notNull().default(0),
    ruleType: text('rule_type').notNull(),
    discountPercentage: numeric('discount_percentage', { precision: 6, scale: 3 }),
    discountAmount: numeric('discount_amount', { precision: 20, scale: 4 }),
    rate: numeric('rate', { precision: 20, scale: 4 }),
    freeItemId: uuid('free_item_id'),
    freeQty: numeric('free_qty', { precision: 24, scale: 6 }),
    recursive: boolean('recursive').notNull().default(false),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('pricing_rule_code_unique').on(t.code),
    check('pricing_rule_applies_to_valid', sql`${t.appliesTo} in ('selling', 'buying')`),
    check(
      'pricing_rule_apply_on_valid',
      sql`(${t.applyOn} = 'item' and ${t.itemId} is not null) or (${t.applyOn} = 'item_category' and ${t.categoryId} is not null)`,
    ),
    check('pricing_rule_type_valid', sql`${t.ruleType} in ('price', 'product')`),
    check(
      'pricing_rule_price_one_of',
      sql`${t.ruleType} <> 'price' or ((${t.discountPercentage} is not null)::int + (${t.discountAmount} is not null)::int + (${t.rate} is not null)::int) = 1`,
    ),
    check('pricing_rule_product_free_qty', sql`${t.ruleType} <> 'product' or ${t.freeQty} > 0`),
    check('pricing_rule_status_valid', sql`${t.status} in ('active', 'disabled')`),
    check(
      'pricing_rule_qty_range',
      sql`${t.minQty} >= 0 and (${t.maxQty} is null or ${t.maxQty} >= ${t.minQty})`,
    ),
    index('pricing_rule_item_idx').on(t.itemId),
    index('pricing_rule_category_idx').on(t.categoryId),
  ],
);
