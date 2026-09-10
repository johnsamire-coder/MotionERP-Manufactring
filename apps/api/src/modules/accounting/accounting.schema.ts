import { sql } from 'drizzle-orm';
import { AnyPgColumn, check, index, numeric, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const accountingSchema = pgSchema('accounting');

export const accountType = accountingSchema.table('account_type', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  normalBalance: text('normal_balance').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('account_type_normal_balance_valid', sql`${t.normalBalance} in ('debit', 'credit')`),
]);

export const chartOfAccounts = accountingSchema.table('chart_of_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  accountTypeId: uuid('account_type_id')
    .notNull()
    .references(() => accountType.id, { onDelete: 'restrict' }),
  parentId: uuid('parent_id').references((): AnyPgColumn => chartOfAccounts.id, { onDelete: 'set null' }),
  isLeaf: text('is_leaf').notNull().default('yes'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('chart_of_accounts_is_leaf_valid', sql`${t.isLeaf} in ('yes', 'no')`),
  check('chart_of_accounts_status_valid', sql`${t.status} in ('active', 'inactive')`),
  index('idx_chart_of_accounts_parent').on(t.parentId),
  index('idx_chart_of_accounts_type').on(t.accountTypeId),
]);

export const journalEntry = accountingSchema.table('journal_entry', {
  id: uuid('id').primaryKey().defaultRandom(),
  entryNumber: text('entry_number').notNull().unique(),
  reference: text('reference'),
  description: text('description').notNull(),
  entryDate: timestamp('entry_date', { withTimezone: true }).notNull(),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('journal_entry_status_valid', sql`${t.status} in ('draft', 'posted', 'cancelled')`),
  index('idx_journal_entry_reference').on(t.reference),
  index('idx_journal_entry_date').on(t.entryDate),
]);

export const journalLine = accountingSchema.table('journal_line', {
  id: uuid('id').primaryKey().defaultRandom(),
  journalEntryId: uuid('journal_entry_id')
    .notNull()
    .references(() => journalEntry.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id')
    .notNull()
    .references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
  debitAmount: numeric('debit_amount', { precision: 12, scale: 4 }).notNull().default('0'),
  creditAmount: numeric('credit_amount', { precision: 12, scale: 4 }).notNull().default('0'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('journal_line_amounts_valid', sql`${t.debitAmount} >= 0 AND ${t.creditAmount} >= 0 AND (${t.debitAmount} > 0 OR ${t.creditAmount} > 0)`),
  index('idx_journal_line_entry').on(t.journalEntryId),
  index('idx_journal_line_account').on(t.accountId),
]);

export type AccountType = typeof accountType.$inferSelect;
export type ChartOfAccounts = typeof chartOfAccounts.$inferSelect;
export type JournalEntry = typeof journalEntry.$inferSelect;
export type JournalLine = typeof journalLine.$inferSelect;
export type JournalEntryStatus = 'draft' | 'posted' | 'cancelled';
