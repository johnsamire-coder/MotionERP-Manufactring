import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { orgNode } from '../organization/organization.schema';

export const accountingSchema = pgSchema('accounting');

// ==================== EXISTING TABLES (unchanged) ====================

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

/** Chart of accounts is scoped per company/activity (org_node). */
export const chartOfAccounts = accountingSchema.table('chart_of_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  orgNodeId: uuid('org_node_id').references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  accountTypeId: uuid('account_type_id')
    .notNull()
    .references(() => accountType.id, { onDelete: 'restrict' }),
  parentId: uuid('parent_id').references((): AnyPgColumn => chartOfAccounts.id, { onDelete: 'set null' }),
  isLeaf: text('is_leaf').notNull().default('yes'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('chart_of_accounts_org_code_unique').on(t.orgNodeId, t.code),
  check('chart_of_accounts_is_leaf_valid', sql`${t.isLeaf} in ('yes', 'no')`),
  check('chart_of_accounts_status_valid', sql`${t.status} in ('active', 'inactive')`),
  index('idx_chart_of_accounts_parent').on(t.parentId),
  index('idx_chart_of_accounts_type').on(t.accountTypeId),
  index('idx_chart_of_accounts_org_node').on(t.orgNodeId),
]);

// ==================== NEW TABLES (Step 1) ====================

/** Fiscal years — each company has its own fiscal calendar. */
export const fiscalYear = accountingSchema.table('fiscal_year', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  name: text('name').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  isClosed: boolean('is_closed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('fiscal_year_org_name_unique').on(t.orgNodeId, t.name),
  index('idx_fiscal_year_org_node').on(t.orgNodeId),
  check('fiscal_year_dates_valid', sql`${t.endDate} > ${t.startDate}`),
]);

/** Monthly accounting periods within a fiscal year. */
export const accountingPeriod = accountingSchema.table('accounting_period', {
  id: uuid('id').primaryKey().defaultRandom(),
  fiscalYearId: uuid('fiscal_year_id')
    .notNull()
    .references(() => fiscalYear.id, { onDelete: 'cascade' }),
  periodNumber: integer('period_number').notNull(),
  name: text('name').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('accounting_period_fy_number_unique').on(t.fiscalYearId, t.periodNumber),
  check('accounting_period_status_valid', sql`${t.status} in ('open', 'closed', 'locked')`),
  check('accounting_period_dates_valid', sql`${t.endDate} >= ${t.startDate}`),
  index('idx_accounting_period_fy').on(t.fiscalYearId),
]);

/** Cost centers for expense tracking (departments, production lines, etc.). */
export const costCenter = accountingSchema.table('cost_center', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  parentId: uuid('parent_id').references((): AnyPgColumn => costCenter.id, { onDelete: 'set null' }),
  isGroup: boolean('is_group').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('cost_center_org_code_unique').on(t.orgNodeId, t.code),
  index('idx_cost_center_org_node').on(t.orgNodeId),
  index('idx_cost_center_parent').on(t.parentId),
]);

/** Per-company default account mappings for automatic posting. */
export const companyAccountingConfig = accountingSchema.table('company_accounting_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .unique()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  baseCurrency: text('base_currency').notNull().default('EGP'),
  inventoryValuationMethod: text('inventory_valuation_method').notNull().default('weighted_average'),
  defaultGrniAccountId: uuid('default_grni_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  defaultWipAccountId: uuid('default_wip_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  defaultCogsAccountId: uuid('default_cogs_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  defaultMfgVarianceAccountId: uuid('default_mfg_variance_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  defaultPayableAccountId: uuid('default_payable_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  defaultReceivableAccountId: uuid('default_receivable_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  defaultInputTaxAccountId: uuid('default_input_tax_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  defaultOutputTaxAccountId: uuid('default_output_tax_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  defaultScrapAccountId: uuid('default_scrap_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  defaultStockAdjustmentAccountId: uuid('default_stock_adjustment_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  defaultOhAppliedAccountId: uuid('default_oh_applied_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('company_config_valuation_valid', sql`${t.inventoryValuationMethod} in ('weighted_average', 'fifo', 'standard')`),
]);

/** Maps items/warehouses/categories to default accounts for auto-posting. */
export const accountDetermination = accountingSchema.table('account_determination', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  determinationType: text('determination_type').notNull(),
  referenceId: uuid('reference_id'),
  accountPurpose: text('account_purpose').notNull(),
  accountId: uuid('account_id')
    .notNull()
    .references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('account_det_type_valid', sql`${t.determinationType} in ('item_category', 'warehouse', 'default')`),
  check('account_det_purpose_valid', sql`${t.accountPurpose} in ('inventory', 'cogs', 'revenue', 'wip', 'purchase', 'scrap', 'stock_adjustment', 'input_tax', 'output_tax', 'payable', 'receivable')`),
  index('idx_account_det_org').on(t.orgNodeId),
  index('idx_account_det_type_ref').on(t.determinationType, t.referenceId),
]);

// ==================== MODIFIED TABLES (new nullable columns) ====================

/** Journal entries — enhanced with fiscal year, period, and posting engine fields. */
export const journalEntry = accountingSchema.table('journal_entry', {
  id: uuid('id').primaryKey().defaultRandom(),
  entryNumber: text('entry_number').notNull().unique(),
  orgNodeId: uuid('org_node_id').references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  reference: text('reference'),
  description: text('description').notNull(),
  entryDate: timestamp('entry_date', { withTimezone: true }).notNull(),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  status: text('status').notNull().default('draft'),
  // --- New columns for Posting Engine (all nullable = backward compatible) ---
  fiscalYearId: uuid('fiscal_year_id').references(() => fiscalYear.id, { onDelete: 'set null' }),
  periodId: uuid('period_id').references(() => accountingPeriod.id, { onDelete: 'set null' }),
  isAutoGenerated: boolean('is_auto_generated').notNull().default(false),
  idempotencyKey: text('idempotency_key').unique(),
  sourceEventType: text('source_event_type'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('journal_entry_status_valid', sql`${t.status} in ('draft', 'posted', 'cancelled')`),
  index('idx_journal_entry_reference').on(t.reference),
  index('idx_journal_entry_date').on(t.entryDate),
  index('idx_journal_entry_org_node').on(t.orgNodeId),
  index('idx_journal_entry_fy').on(t.fiscalYearId),
  index('idx_journal_entry_period').on(t.periodId),
]);

/** Journal lines — enhanced with party and cost center tracking. */
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
  // --- New columns for sub-ledger tracking (all nullable = backward compatible) ---
  partyType: text('party_type'),
  partyId: uuid('party_id'),
  costCenterId: uuid('cost_center_id').references(() => costCenter.id, { onDelete: 'set null' }),
  jobOrderId: uuid('job_order_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('journal_line_amounts_valid', sql`${t.debitAmount} >= 0 AND ${t.creditAmount} >= 0 AND (${t.debitAmount} > 0 OR ${t.creditAmount} > 0)`),
  check('journal_line_party_type_valid', sql`${t.partyType} is null or ${t.partyType} in ('customer', 'supplier')`),
  index('idx_journal_line_entry').on(t.journalEntryId),
  index('idx_journal_line_account').on(t.accountId),
  index('idx_journal_line_cost_center').on(t.costCenterId),
  index('idx_journal_line_party').on(t.partyType, t.partyId),
]);

// ==================== TYPES ====================

export type AccountType = typeof accountType.$inferSelect;
export type ChartOfAccounts = typeof chartOfAccounts.$inferSelect;
export type FiscalYear = typeof fiscalYear.$inferSelect;
export type AccountingPeriod = typeof accountingPeriod.$inferSelect;
export type CostCenter = typeof costCenter.$inferSelect;
export type CompanyAccountingConfig = typeof companyAccountingConfig.$inferSelect;
export type AccountDetermination = typeof accountDetermination.$inferSelect;
export type JournalEntry = typeof journalEntry.$inferSelect;
export type JournalLine = typeof journalLine.$inferSelect;
export type JournalEntryStatus = 'draft' | 'posted' | 'cancelled';
export type AccountingPeriodStatus = 'open' | 'closed' | 'locked';