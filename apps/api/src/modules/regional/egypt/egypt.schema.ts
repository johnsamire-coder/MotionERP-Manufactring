import { sql } from 'drizzle-orm';
import { check, jsonb, pgSchema, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

/**
 * Regional layer — Egypt (plan item 48). Kept apart from the core modules: it reads invoices,
 * customers and items by UUID (D2) and never changes them.
 */
export const regionalEgSchema = pgSchema('regional_eg');

export const etaIssuerConfig = regionalEgSchema.table(
  'eta_issuer_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgNodeId: uuid('org_node_id').notNull(),
    rin: text('rin').notNull(),
    name: text('name').notNull(),
    activityCode: text('activity_code').notNull(),
    address: jsonb('address')
      .$type<{
        branchID: string;
        country: string;
        governate: string;
        regionCity: string;
        street: string;
        buildingNumber: string;
      }>()
      .notNull(),
    documentVersion: text('document_version').notNull().default('1.0'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('eta_issuer_org_unique').on(t.orgNodeId),
    check('eta_issuer_version_valid', sql`${t.documentVersion} in ('0.9', '1.0')`),
  ],
);

export const etaPartyProfile = regionalEgSchema.table(
  'eta_party_profile',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id').notNull(),
    receiverType: text('receiver_type').notNull(),
    taxId: text('tax_id'),
    name: text('name').notNull(),
    address: jsonb('address').$type<{
      country: string;
      governate: string;
      regionCity: string;
      street: string;
      buildingNumber: string;
    }>(),
  },
  (t) => [
    unique('eta_party_customer_unique').on(t.customerId),
    check('eta_party_type_valid', sql`${t.receiverType} in ('B', 'P', 'F')`),
  ],
);

export const etaItemCode = regionalEgSchema.table(
  'eta_item_code',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemId: uuid('item_id').notNull(),
    itemType: text('item_type').notNull().default('EGS'),
    itemCode: text('item_code').notNull(),
    unitType: text('unit_type').notNull().default('EA'),
    taxSubType: text('tax_sub_type').notNull().default('V009'),
  },
  (t) => [
    unique('eta_item_code_item_unique').on(t.itemId),
    check('eta_item_type_valid', sql`${t.itemType} in ('EGS', 'GS1')`),
  ],
);

export const etaDocument = regionalEgSchema.table(
  'eta_document',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salesInvoiceId: uuid('sales_invoice_id').notNull(),
    status: text('status').notNull().default('draft'),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    documentUuid: text('document_uuid'),
    signature: text('signature'),
    submissionUuid: text('submission_uuid'),
    problems: jsonb('problems')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    response: jsonb('response'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('eta_document_invoice_unique').on(t.salesInvoiceId),
    check(
      'eta_document_status_valid',
      sql`${t.status} in ('draft', 'ready', 'signed', 'submitted', 'rejected')`,
    ),
  ],
);
