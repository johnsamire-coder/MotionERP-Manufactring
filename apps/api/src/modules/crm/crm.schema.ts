import { sql } from 'drizzle-orm';
import { check, index, text, timestamp, pgSchema, uuid, unique } from 'drizzle-orm/pg-core';
import { orgNode } from '../organization/organization.schema';

export const crmSchema = pgSchema('crm');

export const supplier = crmSchema.table('supplier', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('supplier_code_unique').on(t.code),
  check('supplier_code_format', sql`${t.code} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`),
  check('supplier_name_not_blank', sql`length(btrim(${t.name})) > 0`),
  check('supplier_status_valid', sql`${t.status} in ('active', 'inactive', 'archived')`),
  index('supplier_org_node_idx').on(t.orgNodeId),
]);

/**
 * Unified prospect/customer entity — a "lead" is simply a customer with
 * status='lead'. Transitions to 'active' automatically the first time one of
 * its quotations is approved (D37: differences are configuration/state, not
 * separate code paths or tables).
 */
export const customer = crmSchema.table('customer', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  status: text('status').notNull().default('lead'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('customer_code_unique').on(t.code),
  check('customer_code_format', sql`${t.code} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`),
  check('customer_name_not_blank', sql`length(btrim(${t.name})) > 0`),
  check('customer_status_valid', sql`${t.status} in ('lead', 'active', 'inactive', 'archived')`),
  index('customer_org_node_idx').on(t.orgNodeId),
]);

/** Simple CRM log: every visit/call/email/note against a customer, in one place. */
export const customerInteraction = crmSchema.table('customer_interaction', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customer.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  interactionType: text('interaction_type').notNull(),
  interactionDate: timestamp('interaction_date', { withTimezone: true }).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check(
    'customer_interaction_type_valid',
    sql`${t.interactionType} in ('visit', 'call', 'email', 'note')`,
  ),
  index('customer_interaction_customer_idx').on(t.customerId),
]);

export type Supplier = typeof supplier.$inferSelect;
export type Customer = typeof customer.$inferSelect;
export type CustomerInteraction = typeof customerInteraction.$inferSelect;
