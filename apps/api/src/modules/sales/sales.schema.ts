import { sql } from 'drizzle-orm';
import { check, index, integer, numeric, pgSchema, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { item } from '../catalog/catalog.schema';
import { customer, supplier } from '../crm/crm.schema';

export const salesSchema = pgSchema('sales');

/**
 * Unified quotation entity for BOTH directions (D37): 'outgoing' = we quote a
 * customer; 'incoming' = a supplier quotes us. Exactly one of customerId /
 * supplierId is set, matching `direction`. This keeps the two flows visually
 * and structurally parallel while remaining one table, one API, one lifecycle.
 */
export const quotation = salesSchema.table('quotation', {
  id: uuid('id').primaryKey().defaultRandom(),
  quotationNumber: text('quotation_number').notNull(),
  direction: text('direction').notNull(),
  customerId: uuid('customer_id').references(() => customer.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  supplierId: uuid('supplier_id').references(() => supplier.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  quotationDate: timestamp('quotation_date', { withTimezone: true }).notNull(),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  status: text('status').notNull().default('draft'),
  currency: text('currency').notNull().default('EGP'),
  /** The customer's own PO reference, recorded once they approve (free text — it's their number, not ours). */
  customerPoReference: text('customer_po_reference'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('quotation_number_unique').on(t.quotationNumber),
  check('quotation_direction_valid', sql`${t.direction} in ('outgoing', 'incoming')`),
  check('quotation_status_valid', sql`${t.status} in ('draft', 'sent', 'approved', 'rejected', 'expired')`),
  check(
    'quotation_party_matches_direction',
    sql`(${t.direction} = 'outgoing' and ${t.customerId} is not null and ${t.supplierId} is null)
     or (${t.direction} = 'incoming' and ${t.supplierId} is not null and ${t.customerId} is null)`,
  ),
  index('quotation_customer_idx').on(t.customerId),
  index('quotation_supplier_idx').on(t.supplierId),
]);

export const quotationLine = salesSchema.table('quotation_line', {
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
}, (t) => [
  check('quotation_line_quantity_positive', sql`${t.quantity} > 0`),
  check('quotation_line_price_non_negative', sql`${t.unitPrice} >= 0`),
  index('quotation_line_quotation_idx').on(t.quotationId),
  index('quotation_line_item_idx').on(t.itemId),
]);

export type Quotation = typeof quotation.$inferSelect;
export type QuotationLine = typeof quotationLine.$inferSelect;
