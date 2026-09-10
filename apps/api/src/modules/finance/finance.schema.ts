import { sql } from 'drizzle-orm';
import { check, index, numeric, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const financeSchema = pgSchema('finance');

export const collection = financeSchema.table('collection', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobOrderReference: text('job_order_reference').notNull(),
  collectionNumber: text('collection_number').notNull().unique(),
  collectionDate: timestamp('collection_date', { withTimezone: true }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 4 }).notNull(),
  currencyCode: text('currency_code').notNull().default('EGP'),
  paymentMethod: text('payment_method').notNull(),
  referenceNumber: text('reference_number'),
  notes: text('notes'),
  status: text('status').notNull().default('completed'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('collection_payment_method_valid', sql`${t.paymentMethod} in ('cash', 'bank_transfer', 'check', 'credit_card')`),
  check('collection_status_valid', sql`${t.status} in ('pending', 'completed', 'cancelled')`),
  check('collection_amount_positive', sql`${t.amount} > 0`),
  index('idx_collection_job_order').on(t.jobOrderReference),
  index('idx_collection_number').on(t.collectionNumber),
  index('idx_collection_date').on(t.collectionDate),
]);

export const retention = financeSchema.table('retention', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobOrderReference: text('job_order_reference').notNull(),
  retentionNumber: text('retention_number').notNull().unique(),
  originalAmount: numeric('original_amount', { precision: 12, scale: 4 }).notNull(),
  releasedAmount: numeric('released_amount', { precision: 12, scale: 4 }).notNull().default('0'),
  currencyCode: text('currency_code').notNull().default('EGP'),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  releaseDate: timestamp('release_date', { withTimezone: true }),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('retention_status_valid', sql`${t.status} in ('active', 'released', 'expired', 'cancelled')`),
  check('retention_amounts_valid', sql`${t.originalAmount} > 0 AND ${t.releasedAmount} >= 0 AND ${t.releasedAmount} <= ${t.originalAmount}`),
  index('idx_retention_job_order').on(t.jobOrderReference),
  index('idx_retention_number').on(t.retentionNumber),
  index('idx_retention_due_date').on(t.dueDate),
]);

export type Collection = typeof collection.$inferSelect;
export type Retention = typeof retention.$inferSelect;
export type CollectionStatus = 'pending' | 'completed' | 'cancelled';
export type RetentionStatus = 'active' | 'released' | 'expired' | 'cancelled';
