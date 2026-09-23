import { sql } from 'drizzle-orm';
import { check, numeric, pgSchema, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { orgNode } from '../organization/organization.schema';

export const settingsSchema = pgSchema('settings');

/**
 * One profile per legal company, holding branding info (logo + display name
 * override) used by report headers/footers. `orgNodeId` should reference a
 * node of type 'legal_company', enforced at the service layer (not a DB
 * check, since org_node.nodeType is data, not a fixed enum in the schema).
 */
export const companyProfile = settingsSchema.table('company_profile', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  displayName: text('display_name'),
  logoUrl: text('logo_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('company_profile_org_node_unique').on(t.orgNodeId),
  check('company_profile_display_name_not_blank', sql`${t.displayName} is null or length(btrim(${t.displayName})) > 0`),
]);

/**
 * Purchasing over-allowances (plan item 12), in percent. orgNodeId NULL = the global default;
 * a row on an org node applies to it and everything under it (nearest row wins).
 * - order:   supplier-offered quantity over the RFQ requested quantity
 * - receipt: quantity received over the approved supplier order
 * - billing: purchase invoice amount over the received value
 */
export const purchaseAllowance = settingsSchema.table('purchase_allowance', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgNodeId: uuid('org_node_id').references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  overOrderPct: numeric('over_order_pct', { precision: 5, scale: 2 }).notNull().default('0'),
  overReceiptPct: numeric('over_receipt_pct', { precision: 5, scale: 2 }).notNull().default('0'),
  overBillingPct: numeric('over_billing_pct', { precision: 5, scale: 2 }).notNull().default('0'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('purchase_allowance_org_node_unique').on(t.orgNodeId).nullsNotDistinct(),
  check('purchase_allowance_range', sql`${t.overOrderPct} between 0 and 100 and ${t.overReceiptPct} between 0 and 100 and ${t.overBillingPct} between 0 and 100`),
]);

export type CompanyProfile = typeof companyProfile.$inferSelect;
