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

// ==================== 1. أنواع الحسابات ودليل الحسابات ====================

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
  code: text('code').notNull(),
  name: text('name').notNull(),
  orgNodeId: uuid('org_node_id').references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  accountTypeId: uuid('account_type_id')
    .notNull()
    .references(() => accountType.id, { onDelete: 'restrict' }),
  parentId: uuid('parent_id').references((): AnyPgColumn => chartOfAccounts.id, { onDelete: 'set null' }),
  isLeaf: text('is_leaf').notNull().default('yes'),
  status: text('status').notNull().default('active'),
  /** Standard account role (plan item 32), see account-roles.ts. NULL = plain account, no special behaviour. */
  accountRole: text('account_role'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('chart_of_accounts_org_code_unique').on(t.orgNodeId, t.code),
  check('chart_of_accounts_is_leaf_valid', sql`${t.isLeaf} in ('yes', 'no')`),
  check('chart_of_accounts_status_valid', sql`${t.status} in ('active', 'inactive')`),
  check('chart_of_accounts_role_valid', sql`${t.accountRole} is null or ${t.accountRole} in ('accumulated_depreciation', 'asset_received_but_not_billed', 'bank', 'cash', 'chargeable', 'capital_work_in_progress', 'cost_of_goods_sold', 'current_asset', 'current_liability', 'depreciation', 'direct_expense', 'direct_income', 'equity', 'expense_account', 'expenses_included_in_asset_valuation', 'expenses_included_in_valuation', 'fixed_asset', 'income_account', 'indirect_expense', 'indirect_income', 'liability', 'payable', 'receivable', 'round_off', 'service_received_but_not_billed', 'stock', 'stock_adjustment', 'stock_received_but_not_billed', 'tax', 'temporary')`),
  index('idx_chart_of_accounts_parent').on(t.parentId),
  index('idx_chart_of_accounts_type').on(t.accountTypeId),
  index('idx_chart_of_accounts_org_node').on(t.orgNodeId),
]);

// ==================== 2. السنوات والفترات المالية ومراكز التكلفة ====================

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
  // Plan item 33: the rest of the 19 company default accounts.
  defaultBankAccountId: uuid('default_bank_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  defaultCashAccountId: uuid('default_cash_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  defaultIncomeAccountId: uuid('default_income_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  defaultInventoryAccountId: uuid('default_inventory_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  defaultRoundOffAccountId: uuid('default_round_off_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  defaultWriteOffAccountId: uuid('default_write_off_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  defaultExchangeGainLossAccountId: uuid('default_exchange_gain_loss_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  defaultDepreciationExpenseAccountId: uuid('default_depreciation_expense_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  /** Plan item 33: when true, a stock movement whose accounts cannot be resolved is refused up front (instead of posting nothing). */
  enforceDefaultAccounts: boolean('enforce_default_accounts').notNull().default(false),
  /** Plan item 36: no journal entry may be dated on or before this day (ERPNext "Accounts Frozen Till"). */
  accountsFrozenUntil: timestamp('accounts_frozen_until', { withTimezone: true }),
  /** Plan item 38: book customer / supplier advances in their own accounts until allocated to an invoice. */
  bookAdvancesSeparately: boolean('book_advances_separately').notNull().default(false),
  defaultAdvanceReceivedAccountId: uuid('default_advance_received_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  defaultAdvancePaidAccountId: uuid('default_advance_paid_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('company_config_valuation_valid', sql`${t.inventoryValuationMethod} in ('weighted_average', 'fifo', 'standard')`),
]);

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

// ==================== 3. قيود اليومية ودفتر الأستاذ العام ====================

export const journalEntry = accountingSchema.table('journal_entry', {
  id: uuid('id').primaryKey().defaultRandom(),
  entryNumber: text('entry_number').notNull().unique(),
  orgNodeId: uuid('org_node_id').references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  reference: text('reference'),
  description: text('description').notNull(),
  entryDate: timestamp('entry_date', { withTimezone: true }).notNull(),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  status: text('status').notNull().default('draft'),
  fiscalYearId: uuid('fiscal_year_id').references(() => fiscalYear.id, { onDelete: 'set null' }),
  periodId: uuid('period_id').references(() => accountingPeriod.id, { onDelete: 'set null' }),
  isAutoGenerated: boolean('is_auto_generated').notNull().default(false),
  idempotencyKey: text('idempotency_key').unique(),
  sourceEventType: text('source_event_type'),
  /** Plan item 31: a posted entry is never cancelled — it is reversed once by a mirror entry that points back here. */
  reversalOfEntryId: uuid('reversal_of_entry_id').references((): AnyPgColumn => journalEntry.id, { onDelete: 'restrict' }),
  reversalReason: text('reversal_reason'),
  /** Plan item 34: one of the 17 journal entry types (voucher-types.ts). */
  voucherType: text('voucher_type').notNull().default('journal_entry'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('journal_entry_reversal_of_unique').on(t.reversalOfEntryId),
  check('journal_entry_voucher_type_valid', sql`${t.voucherType} in ('journal_entry', 'inter_company_journal_entry', 'bank_entry', 'cash_entry', 'credit_card_entry', 'debit_note', 'credit_note', 'contra_entry', 'excise_entry', 'write_off_entry', 'opening_entry', 'depreciation_entry', 'exchange_rate_revaluation', 'exchange_gain_or_loss', 'deferred_revenue', 'deferred_expense', 'reversal_of_itc')`),
  check('journal_entry_not_own_reversal', sql`${t.reversalOfEntryId} is null or ${t.reversalOfEntryId} <> ${t.id}`),
  check('journal_entry_status_valid', sql`${t.status} in ('draft', 'posted', 'cancelled')`),
  index('idx_journal_entry_reference').on(t.reference),
  index('idx_journal_entry_date').on(t.entryDate),
  index('idx_journal_entry_org_node').on(t.orgNodeId),
  index('idx_journal_entry_fy').on(t.fiscalYearId),
  index('idx_journal_entry_period').on(t.periodId),
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
  partyType: text('party_type'),
  partyId: uuid('party_id'),
  costCenterId: uuid('cost_center_id').references(() => costCenter.id, { onDelete: 'set null' }),
  jobOrderId: uuid('job_order_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('journal_line_amounts_valid', sql`${t.debitAmount} >= 0 AND ${t.creditAmount} >= 0 AND (${t.debitAmount} > 0 OR ${t.creditAmount} > 0)`),
  check('journal_line_party_type_valid', sql`${t.partyType} is null or ${t.partyType} in ('customer', 'supplier')`),
  index('idx_journal_line_entry').on(t.journalEntryId),
  index('idx_journal_line_account').on(t.accountId),
  index('idx_journal_line_cost_center').on(t.costCenterId),
  index('idx_journal_line_party').on(t.partyType, t.partyId),
]);

// ==================== 4. سجل الأصول الثابتة والماكينات وإهلاكها (الجديد) ====================

export const fixedAsset = accountingSchema.table('fixed_asset', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetCode: text('asset_code').notNull(),
  assetName: text('asset_name').notNull(),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  purchaseDate: timestamp('purchase_date', { withTimezone: true }).notNull(),
  purchaseCost: numeric('purchase_cost', { precision: 14, scale: 4 }).notNull(),
  usefulLifeMonths: integer('useful_life_months').notNull(),
  salvageValue: numeric('salvage_value', { precision: 14, scale: 4 }).notNull().default('0'),
  depreciationMethod: text('depreciation_method').notNull().default('straight_line'),
  
  // الحسابات المرتبطة في شجرة الحسابات
  assetAccountId: uuid('asset_account_id')
    .notNull()
    .references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
  accumulatedDepreciationAccountId: uuid('accumulated_depreciation_account_id')
    .notNull()
    .references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
  depreciationExpenseAccountId: uuid('depreciation_expense_account_id')
    .notNull()
    .references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
  costCenterId: uuid('cost_center_id').references(() => costCenter.id, { onDelete: 'set null' }),

  totalDepreciated: numeric('total_depreciated', { precision: 14, scale: 4 }).notNull().default('0'),
  status: text('status').notNull().default('active'), // active | fully_depreciated | disposed
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('fixed_asset_org_code_unique').on(t.orgNodeId, t.assetCode),
  check('fixed_asset_cost_positive', sql`${t.purchaseCost} > 0`),
  check('fixed_asset_life_positive', sql`${t.usefulLifeMonths} > 0`),
  check('fixed_asset_status_valid', sql`${t.status} in ('active', 'fully_depreciated', 'disposed')`),
  index('idx_fixed_asset_org').on(t.orgNodeId),
  index('idx_fixed_asset_cost_center').on(t.costCenterId),
]);

export const depreciationEntry = accountingSchema.table('depreciation_entry', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id')
    .notNull()
    .references(() => fixedAsset.id, { onDelete: 'cascade' }),
  periodId: uuid('period_id').references(() => accountingPeriod.id, { onDelete: 'set null' }),
  entryDate: timestamp('entry_date', { withTimezone: true }).notNull(),
  depreciationAmount: numeric('depreciation_amount', { precision: 14, scale: 4 }).notNull(),
  accumulatedAmountAfter: numeric('accumulated_amount_after', { precision: 14, scale: 4 }).notNull(),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntry.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('posted'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_depreciation_asset').on(t.assetId),
  index('idx_depreciation_period').on(t.periodId),
]);

export type AccountType = typeof accountType.$inferSelect;
export type ChartOfAccounts = typeof chartOfAccounts.$inferSelect;
export type FiscalYear = typeof fiscalYear.$inferSelect;
export type AccountingPeriod = typeof accountingPeriod.$inferSelect;
export type CostCenter = typeof costCenter.$inferSelect;
export type CompanyAccountingConfig = typeof companyAccountingConfig.$inferSelect;
export type AccountDetermination = typeof accountDetermination.$inferSelect;
export type JournalEntry = typeof journalEntry.$inferSelect;
export type JournalLine = typeof journalLine.$inferSelect;
export type FixedAsset = typeof fixedAsset.$inferSelect;
export type DepreciationEntry = typeof depreciationEntry.$inferSelect;

export type JournalEntryStatus = 'draft' | 'posted' | 'cancelled';
export type AccountingPeriodStatus = 'open' | 'closed' | 'locked';
export type FixedAssetStatus = 'active' | 'fully_depreciated' | 'disposed';
/**
 * Budget (plan item 40): an annual limit per expense account (optionally per cost center) with an
 * optional monthly distribution. Checked on every journal entry — creation and posting.
 */
export const budget = accountingSchema.table('budget', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgNodeId: uuid('org_node_id').notNull().references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  fiscalYearId: uuid('fiscal_year_id').notNull().references(() => fiscalYear.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
  costCenterId: uuid('cost_center_id').references(() => costCenter.id, { onDelete: 'restrict' }),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  /** JSON array of 12 percentages (months from the fiscal-year start) adding up to 100; NULL = annual check only. */
  monthlyPercentages: text('monthly_percentages'),
  actionIfExceeded: text('action_if_exceeded').notNull().default('stop'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('budget_fy_account_cc_unique').on(t.fiscalYearId, t.accountId, t.costCenterId).nullsNotDistinct(),
  check('budget_amount_non_negative', sql`${t.amount} >= 0`),
  check('budget_action_valid', sql`${t.actionIfExceeded} in ('stop', 'warn', 'ignore')`),
  index('idx_budget_account').on(t.accountId),
]);
