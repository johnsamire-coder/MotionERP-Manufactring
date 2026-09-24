// ============================================================
// Motion ERP — Audit Trail & Security Log Schema
// Step 94
// ============================================================
import { uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { pgSchema } from 'drizzle-orm/pg-core';

export const auditSchema = pgSchema('audit');

export const auditLog = auditSchema.table('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  entityName: text('entity_name').notNull(), // e.g. "journal_entry", "sales_invoice", "accounting_period"
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(), // CREATE, UPDATE, DELETE, POST, REVERSE, CLOSE, REOPEN
  performedBy: uuid('performed_by'),
  performedByName: text('performed_by_name'),
  companyId: uuid('company_id'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  oldValues: text('old_values'), // JSON String
  newValues: text('new_values'), // JSON String
  details: text('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type AuditLogRecord = typeof auditLog.$inferSelect;
export type NewAuditLogRecord = typeof auditLog.$inferInsert;
