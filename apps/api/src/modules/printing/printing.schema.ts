import { sql } from 'drizzle-orm';
import { boolean, check, index, pgSchema, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const printingSchema = pgSchema('printing');

/** Print system (plan item 47): letterheads are kept apart from the templates they are printed with. */
export const letterhead = printingSchema.table('letterhead', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgNodeId: uuid('org_node_id').notNull(),
  name: text('name').notNull(),
  headerHtml: text('header_html').notNull().default(''),
  footerHtml: text('footer_html').notNull().default(''),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('letterhead_org_name_unique').on(t.orgNodeId, t.name)]);

export const printFormat = printingSchema.table('print_format', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  documentType: text('document_type').notNull(),
  template: text('template').notNull(),
  css: text('css').notNull().default(''),
  letterheadId: uuid('letterhead_id').references(() => letterhead.id, { onDelete: 'set null' }),
  isDefault: boolean('is_default').notNull().default(false),
  allowDraft: boolean('allow_draft').notNull().default(false),
  allowCancelled: boolean('allow_cancelled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('print_format_code_unique').on(t.code), index('print_format_doctype_idx').on(t.documentType)]);

export const printLog = printingSchema.table('print_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentType: text('document_type').notNull(),
  documentId: uuid('document_id'),
  printFormatId: uuid('print_format_id').references(() => printFormat.id, { onDelete: 'set null' }),
  userId: uuid('user_id'),
  printedAt: timestamp('printed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('print_log_document_idx').on(t.documentType, t.documentId),
  check('print_log_doc_type_not_blank', sql`length(${t.documentType}) > 0`),
]);
