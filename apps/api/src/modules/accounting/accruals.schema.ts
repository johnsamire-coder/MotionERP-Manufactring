// ============================================================
// Motion ERP — Accruals, Prepaids & Provisions Schema
// Step 64 | Migration 0054
// ============================================================
import {
  pgTable,
  uuid,
  text,
  numeric,
  date,
  timestamp,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core';

// ── Enums ────────────────────────────────────
export const accrualStatusEnum = pgEnum('accrual_status', [
  'draft',
  'posted',
  'reversed',
]);

export const prepaidStatusEnum = pgEnum('prepaid_status', [
  'active',
  'fully_amortized',
  'cancelled',
]);

export const provisionTypeEnum = pgEnum('provision_type', [
  'warranty',
  'bad_debt',
  'legal',
  'other',
]);

export const provisionStatusEnum = pgEnum('provision_status', [
  'draft',
  'posted',
  'utilized',
  'reversed',
]);

// ── 1. Accrual Entry (المصاريف المستحقة) ─────
// مثال: أجور الفنيين عن أغسطس لسه ما اتدفعتش
// القيد: Dr Expense / Cr Accrued Liability
export const accrualEntry = pgTable('accrual_entry', {
  id:                 uuid('id').defaultRandom().primaryKey(),
  entryNumber:        text('entry_number').notNull().unique(),
  companyId:          uuid('company_id').notNull(),
  fiscalYearId:       uuid('fiscal_year_id').notNull(),
  periodId:           uuid('period_id').notNull(),
  accrualDate:        date('accrual_date').notNull(),
  description:        text('description').notNull(),

  // الحسابات
  expenseAccountId:   uuid('expense_account_id').notNull(),   // Dr
  liabilityAccountId: uuid('liability_account_id').notNull(), // Cr
  costCenterId:       uuid('cost_center_id'),

  // المبلغ
  amount:             numeric('amount', { precision: 18, scale: 4 }).notNull(),

  // الحالة
  status:             accrualStatusEnum('status').default('draft').notNull(),
  journalEntryId:     uuid('journal_entry_id'),

  // Audit
  createdBy:          uuid('created_by').notNull(),
  createdAt:          timestamp('created_at').defaultNow().notNull(),
  updatedAt:          timestamp('updated_at').defaultNow().notNull(),
});

// ── 2. Prepaid Expense (المصاريف المقدمة) ────
// مثال: إيجار 12 شهر مدفوع مقدماً
// القيد الأول: Dr Prepaid Asset / Cr Bank
// قيد شهري:    Dr Expense / Cr Prepaid Asset
export const prepaidExpense = pgTable('prepaid_expense', {
  id:                uuid('id').defaultRandom().primaryKey(),
  entryNumber:       text('entry_number').notNull().unique(),
  companyId:         uuid('company_id').notNull(),
  fiscalYearId:      uuid('fiscal_year_id').notNull(),
  periodId:          uuid('period_id').notNull(),
  startDate:         date('start_date').notNull(),
  endDate:           date('end_date').notNull(),
  description:       text('description').notNull(),

  // الحسابات
  prepaidAccountId:  uuid('prepaid_account_id').notNull(),  // Asset
  expenseAccountId:  uuid('expense_account_id').notNull(),  // Expense
  costCenterId:      uuid('cost_center_id'),

  // المبالغ
  totalAmount:       numeric('total_amount', { precision: 18, scale: 4 }).notNull(),
  monthlyAmount:     numeric('monthly_amount', { precision: 18, scale: 4 }).notNull(),
  monthsCount:       integer('months_count').notNull(),
  amortizedAmount:   numeric('amortized_amount', { precision: 18, scale: 4 }).default('0').notNull(),
  remainingAmount:   numeric('remaining_amount', { precision: 18, scale: 4 }).notNull(),

  // الحالة
  status:            prepaidStatusEnum('status').default('active').notNull(),

  // Audit
  createdBy:         uuid('created_by').notNull(),
  createdAt:         timestamp('created_at').defaultNow().notNull(),
  updatedAt:         timestamp('updated_at').defaultNow().notNull(),
});

// ── 3. Provision (المخصصات) ──────────────────
// مثال: مخصص ضمان طبي 2% من المبيعات
// القيد: Dr Warranty Expense / Cr Warranty Provision
export const provision = pgTable('provision', {
  id:                uuid('id').defaultRandom().primaryKey(),
  provisionNumber:   text('provision_number').notNull().unique(),
  companyId:         uuid('company_id').notNull(),
  fiscalYearId:      uuid('fiscal_year_id').notNull(),
  periodId:          uuid('period_id').notNull(),
  provisionDate:     date('provision_date').notNull(),

  // النوع
  provisionType:     provisionTypeEnum('provision_type').notNull(),
  description:       text('description').notNull(),

  // الحسابات
  expenseAccountId:  uuid('expense_account_id').notNull(),   // Dr
  provisionAccountId:uuid('provision_account_id').notNull(), // Cr (Liability)
  costCenterId:      uuid('cost_center_id'),

  // الحساب
  baseAmount:        numeric('base_amount', { precision: 18, scale: 4 }).notNull(),
  ratePercentage:    numeric('rate_percentage', { precision: 8, scale: 4 }).notNull(),
  provisionAmount:   numeric('provision_amount', { precision: 18, scale: 4 }).notNull(),

  // ربط بالضمان الطبي
  relatedInvoiceId:  uuid('related_invoice_id'),
  warrantyMonths:    integer('warranty_months'),

  // الحالة
  status:            provisionStatusEnum('status').default('draft').notNull(),
  journalEntryId:    uuid('journal_entry_id'),

  // Audit
  createdBy:         uuid('created_by').notNull(),
  createdAt:         timestamp('created_at').defaultNow().notNull(),
  updatedAt:         timestamp('updated_at').defaultNow().notNull(),
});

// ── Type Exports ─────────────────────────────
export type AccrualEntry     = typeof accrualEntry.$inferSelect;
export type NewAccrualEntry  = typeof accrualEntry.$inferInsert;
export type PrepaidExpense   = typeof prepaidExpense.$inferSelect;
export type NewPrepaidExpense= typeof prepaidExpense.$inferInsert;
export type Provision        = typeof provision.$inferSelect;
export type NewProvision     = typeof provision.$inferInsert;