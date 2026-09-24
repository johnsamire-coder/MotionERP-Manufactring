import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const printingSchema = pgSchema('printing');

/** Print system (plan item 47): letterheads are kept apart from the templates they are printed with. */
export const letterhead = printingSchema.table(
  'letterhead',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgNodeId: uuid('org_node_id').notNull(),
    name: text('name').notNull(),
    headerHtml: text('header_html').notNull().default(''),
    footerHtml: text('footer_html').notNull().default(''),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('letterhead_org_name_unique').on(t.orgNodeId, t.name)],
);

export const printFormat = printingSchema.table(
  'print_format',
  {
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
  },
  (t) => [
    unique('print_format_code_unique').on(t.code),
    index('print_format_doctype_idx').on(t.documentType),
  ],
);

export const printLog = printingSchema.table(
  'print_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentType: text('document_type').notNull(),
    documentId: uuid('document_id'),
    printFormatId: uuid('print_format_id').references(() => printFormat.id, {
      onDelete: 'set null',
    }),
    userId: uuid('user_id'),
    printedAt: timestamp('printed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('print_log_document_idx').on(t.documentType, t.documentId),
    check('print_log_doc_type_not_blank', sql`length(${t.documentType}) > 0`),
  ],
);

/** Plan item 50: network printers reached over RAW / JetDirect (TCP 9100). */
export const printer = printingSchema.table(
  'printer',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    host: text('host').notNull(),
    port: integer('port').notNull().default(9100),
    /** What is sent: "text" = the document as plain UTF-8 text (receipt / line printers). */
    payloadFormat: text('payload_format').notNull().default('text'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    unique('printer_name_unique').on(t.name),
    check('printer_port_range', sql`${t.port} between 1 and 65535`),
    check('printer_payload_valid', sql`${t.payloadFormat} in ('text')`),
  ],
);

/** Plan item 50: bulk print jobs rendered in the background. */
export const printJob = printingSchema.table(
  'print_job',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentType: text('document_type').notNull(),
    documentIds: jsonb('document_ids').$type<string[]>().notNull(),
    printFormatId: uuid('print_format_id').references(() => printFormat.id, {
      onDelete: 'set null',
    }),
    printerId: uuid('printer_id').references(() => printer.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('queued'),
    done: integer('done').notNull().default(0),
    skipped: jsonb('skipped')
      .$type<Array<{ documentId: string; reason: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    output: text('output'),
    error: text('error'),
    userId: uuid('user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    check('print_job_status_valid', sql`${t.status} in ('queued', 'running', 'done', 'failed')`),
    index('print_job_status_idx').on(t.status),
  ],
);
