import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  numeric,
  text,
  timestamp,
  pgSchema,
  uuid,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { orgNode } from '../organization/organization.schema';

export const crmSchema = pgSchema('crm');

export const supplier = crmSchema.table(
  'supplier',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    contactPhone: text('contact_phone'),
    contactEmail: text('contact_email'),
    orgNodeId: uuid('org_node_id')
      .notNull()
      .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    status: text('status').notNull().default('active'),
    // Supplier hold (plan item 8): all = RFQs, quotations, invoices and payments; invoices / payments only.
    // hold_release_date (optional) lifts the hold automatically once reached.
    holdType: text('hold_type'),
    holdReason: text('hold_reason'),
    holdReleaseDate: timestamp('hold_release_date', { withTimezone: true }),
    /** Supplier group (plan item 28) — a leaf of the supplier group tree. */
    supplierGroupId: uuid('supplier_group_id').references((): AnyPgColumn => partyGroup.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('supplier_code_unique').on(t.code),
    check(
      'supplier_hold_type_valid',
      sql`${t.holdType} is null or ${t.holdType} in ('all', 'invoices', 'payments')`,
    ),
    check('supplier_code_format', sql`${t.code} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`),
    check('supplier_name_not_blank', sql`length(btrim(${t.name})) > 0`),
    check('supplier_status_valid', sql`${t.status} in ('active', 'inactive', 'archived')`),
    index('supplier_org_node_idx').on(t.orgNodeId),
    index('supplier_group_idx').on(t.supplierGroupId),
  ],
);

/**
 * Unified prospect/customer entity — a "lead" is simply a customer with
 * status='lead'. Transitions to 'active' automatically the first time one of
 * its quotations is approved (D37: differences are configuration/state, not
 * separate code paths or tables).
 */
export const customer = crmSchema.table(
  'customer',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    contactPhone: text('contact_phone'),
    contactEmail: text('contact_email'),
    orgNodeId: uuid('org_node_id')
      .notNull()
      .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    status: text('status').notNull().default('lead'),
    /** Credit limit in the base currency (plan item 6). NULL = no limit. */
    creditLimit: numeric('credit_limit', { precision: 18, scale: 4 }),
    /** Customer group (plan item 28) — a leaf of the customer group tree. */
    customerGroupId: uuid('customer_group_id').references((): AnyPgColumn => partyGroup.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('customer_code_unique').on(t.code),
    check(
      'customer_credit_limit_non_negative',
      sql`${t.creditLimit} is null or ${t.creditLimit} >= 0`,
    ),
    check('customer_code_format', sql`${t.code} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`),
    check('customer_name_not_blank', sql`length(btrim(${t.name})) > 0`),
    check('customer_status_valid', sql`${t.status} in ('lead', 'active', 'inactive', 'archived')`),
    index('customer_org_node_idx').on(t.orgNodeId),
    index('customer_group_idx').on(t.customerGroupId),
  ],
);

/** Simple CRM log: every visit/call/email/note against a customer, in one place. */
export const customerInteraction = crmSchema.table(
  'customer_interaction',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customer.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    interactionType: text('interaction_type').notNull(),
    interactionDate: timestamp('interaction_date', { withTimezone: true }).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'customer_interaction_type_valid',
      sql`${t.interactionType} in ('visit', 'call', 'email', 'note')`,
    ),
    index('customer_interaction_customer_idx').on(t.customerId),
  ],
);

export type Supplier = typeof supplier.$inferSelect;
export type Customer = typeof customer.$inferSelect;
export type CustomerInteraction = typeof customerInteraction.$inferSelect;

/**
 * Opportunity (plan item 17): the stage between an interested lead and a formal quotation.
 * open → qualified → quoted → won | lost. The quotation lives in the sales module, so it is
 * referenced by plain UUID (D2); items likewise.
 */
export const opportunity = crmSchema.table(
  'opportunity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    opportunityNumber: text('opportunity_number').notNull(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customer.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    title: text('title').notNull(),
    source: text('source'),
    expectedAmount: numeric('expected_amount', { precision: 18, scale: 4 }),
    probability: integer('probability').notNull().default(10),
    expectedCloseDate: timestamp('expected_close_date', { withTimezone: true }),
    stage: text('stage').notNull().default('open'),
    lostReason: text('lost_reason'),
    quotationId: uuid('quotation_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('opportunity_number_unique').on(t.opportunityNumber),
    check(
      'opportunity_stage_valid',
      sql`${t.stage} in ('open', 'qualified', 'quoted', 'won', 'lost')`,
    ),
    check('opportunity_probability_range', sql`${t.probability} between 0 and 100`),
    check(
      'opportunity_lost_needs_reason',
      sql`${t.stage} <> 'lost' or ${t.lostReason} is not null`,
    ),
    index('opportunity_customer_idx').on(t.customerId),
    index('opportunity_quotation_idx').on(t.quotationId),
  ],
);

export const opportunityItem = crmSchema.table(
  'opportunity_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunity.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
    itemId: uuid('item_id').notNull(),
    quantity: numeric('quantity', { precision: 24, scale: 6 }).notNull(),
    expectedRate: numeric('expected_rate', { precision: 20, scale: 4 }),
  },
  (t) => [
    check('opportunity_item_quantity_positive', sql`${t.quantity} > 0`),
    index('opportunity_item_opportunity_idx').on(t.opportunityId),
  ],
);

/**
 * Lead → Contact → Prospect → Customer (plan item 25). A lead is a person we may sell to;
 * "contact" is proven by at least one logged activity (call / visit / email) before the lead
 * may be marked interested; a prospect groups the interested leads of one company; converting
 * creates the real customer. Contact/Address as standalone entities is plan item 26 (owner's call).
 */
export const prospect = crmSchema.table(
  'prospect',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    prospectNumber: text('prospect_number').notNull(),
    companyName: text('company_name').notNull(),
    industry: text('industry'),
    orgNodeId: uuid('org_node_id')
      .notNull()
      .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    status: text('status').notNull().default('open'),
    customerId: uuid('customer_id').references(() => customer.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('prospect_number_unique').on(t.prospectNumber),
    check('prospect_status_valid', sql`${t.status} in ('open', 'converted', 'lost')`),
    check(
      'prospect_converted_has_customer',
      sql`${t.status} <> 'converted' or ${t.customerId} is not null`,
    ),
    check('prospect_company_not_blank', sql`length(btrim(${t.companyName})) > 0`),
  ],
);

export const lead = crmSchema.table(
  'lead',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadNumber: text('lead_number').notNull(),
    personName: text('person_name').notNull(),
    companyName: text('company_name'),
    phone: text('phone'),
    email: text('email'),
    source: text('source'),
    orgNodeId: uuid('org_node_id')
      .notNull()
      .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    status: text('status').notNull().default('new'),
    prospectId: uuid('prospect_id').references(() => prospect.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    customerId: uuid('customer_id').references(() => customer.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    lostReason: text('lost_reason'),
    lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('lead_number_unique').on(t.leadNumber),
    check(
      'lead_status_valid',
      sql`${t.status} in ('new', 'contacted', 'interested', 'prospect', 'converted', 'lost', 'do_not_contact')`,
    ),
    check('lead_lost_needs_reason', sql`${t.status} <> 'lost' or ${t.lostReason} is not null`),
    check(
      'lead_converted_has_customer',
      sql`${t.status} <> 'converted' or ${t.customerId} is not null`,
    ),
    check('lead_person_not_blank', sql`length(btrim(${t.personName})) > 0`),
    index('lead_prospect_idx').on(t.prospectId),
    index('lead_email_idx').on(t.email),
    index('lead_phone_idx').on(t.phone),
  ],
);

export const leadActivity = crmSchema.table(
  'lead_activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => lead.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
    activityType: text('activity_type').notNull(),
    activityDate: timestamp('activity_date', { withTimezone: true }).notNull().defaultNow(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('lead_activity_type_valid', sql`${t.activityType} in ('call', 'visit', 'email', 'note')`),
    index('lead_activity_lead_idx').on(t.leadId),
  ],
);

/**
 * Customer / supplier groups as trees (plan item 28). Group nodes hold sub-groups; customers and
 * suppliers attach to leaf groups only. A customer group may carry a default credit limit that
 * its customers inherit (nearest ancestor wins) when they have no limit of their own (item 6).
 */
export const partyGroup = crmSchema.table(
  'party_group',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupType: text('group_type').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    parentGroupId: uuid('parent_group_id').references((): AnyPgColumn => partyGroup.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    isGroup: boolean('is_group').notNull().default(false),
    defaultCreditLimit: numeric('default_credit_limit', { precision: 18, scale: 4 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('party_group_type_code_unique').on(t.groupType, t.code),
    check('party_group_type_valid', sql`${t.groupType} in ('customer', 'supplier')`),
    check(
      'party_group_not_own_parent',
      sql`${t.parentGroupId} is null or ${t.parentGroupId} <> ${t.id}`,
    ),
    check(
      'party_group_credit_non_negative',
      sql`${t.defaultCreditLimit} is null or ${t.defaultCreditLimit} >= 0`,
    ),
    check(
      'party_group_credit_customer_only',
      sql`${t.defaultCreditLimit} is null or ${t.groupType} = 'customer'`,
    ),
    check('party_group_name_not_blank', sql`length(btrim(${t.name})) > 0`),
    index('party_group_parent_idx').on(t.parentGroupId),
  ],
);

/**
 * Plan item 26: contacts and addresses as their own records, linked to any party (customer,
 * supplier, lead) through party_link — the party is a type + UUID, validated in the service
 * (no cross-table FK), so one person or address can serve several parties.
 */
export const contact = crmSchema.table(
  'contact',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name'),
    designation: text('designation'),
    email: text('email'),
    phone: text('phone'),
    mobile: text('mobile'),
    status: text('status').notNull().default('active'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('contact_status_valid', sql`${t.status} in ('active', 'inactive')`),
    index('contact_email_idx').on(t.email),
  ],
);

export const address = crmSchema.table(
  'address',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    addressType: text('address_type').notNull().default('billing'),
    line1: text('line1').notNull(),
    line2: text('line2'),
    city: text('city').notNull(),
    governorate: text('governorate'),
    country: text('country').notNull().default('Egypt'),
    postalCode: text('postal_code'),
    phone: text('phone'),
    email: text('email'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'address_type_valid',
      sql`${t.addressType} in ('billing', 'shipping', 'office', 'warehouse', 'site', 'other')`,
    ),
    check('address_status_valid', sql`${t.status} in ('active', 'inactive')`),
  ],
);

export const partyLink = crmSchema.table(
  'party_link',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerType: text('owner_type').notNull(),
    ownerId: uuid('owner_id').notNull(),
    partyType: text('party_type').notNull(),
    partyId: uuid('party_id').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('party_link_unique').on(t.ownerType, t.ownerId, t.partyType, t.partyId),
    check('party_link_owner_type_valid', sql`${t.ownerType} in ('contact', 'address')`),
    check('party_link_party_type_valid', sql`${t.partyType} in ('customer', 'supplier', 'lead')`),
    index('party_link_party_idx').on(t.partyType, t.partyId),
    // At most one primary contact and one primary address per party.
    uniqueIndex('party_link_one_primary')
      .on(t.ownerType, t.partyType, t.partyId)
      .where(sql`${t.isPrimary}`),
  ],
);
