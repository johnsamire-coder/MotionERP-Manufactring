import { sql } from 'drizzle-orm';
import { check, index, numeric, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { orgNode } from '../organization/organization.schema';
import { chartOfAccounts } from './accounting.schema';

export const accrualSchema = pgSchema('accrual');

// ==================== 1. المصروفات المستحقة (Accrued Expenses) ====================
// مثال: مرتبات أغسطس المستحقة في 31 أغسطس والصرف الفعلي في 5 سبتمبر

export const accruedExpense = accrualSchema.table(
  'accrued_expense',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    voucherNumber: text('voucher_number').notNull().unique(),
    orgNodeId: uuid('org_node_id')
      .notNull()
      .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    expenseAccountId: uuid('expense_account_id')
      .notNull()
      .references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
    accruedLiabilityAccountId: uuid('accrued_liability_account_id')
      .notNull()
      .references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
    accrualDate: timestamp('accrual_date', { withTimezone: true }).notNull(),
    reversalDate: timestamp('reversal_date', { withTimezone: true }),
    amount: numeric('amount', { precision: 14, scale: 4 }).notNull(),
    description: text('description').notNull(),
    status: text('status').notNull().default('accrued'),
    journalEntryId: uuid('journal_entry_id'),
    reversalJournalEntryId: uuid('reversal_journal_entry_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('accrued_expense_status_valid', sql`${t.status} in ('accrued', 'reversed', 'cancelled')`),
    check('accrued_expense_amount_positive', sql`${t.amount} > 0`),
    index('idx_accrued_expense_org').on(t.orgNodeId),
    index('idx_accrued_expense_date').on(t.accrualDate),
  ],
);

// ==================== 2. المصروفات المدفوعة مقدماً (Prepaid Expenses) ====================
// مثال: إيجار المصنع 120,000 ج لمدة سنة = 10,000 ج/شهر

export const prepaidExpense = accrualSchema.table(
  'prepaid_expense',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    voucherNumber: text('voucher_number').notNull().unique(),
    orgNodeId: uuid('org_node_id')
      .notNull()
      .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    prepaidAssetAccountId: uuid('prepaid_asset_account_id')
      .notNull()
      .references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
    expenseAccountId: uuid('expense_account_id')
      .notNull()
      .references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
    paymentDate: timestamp('payment_date', { withTimezone: true }).notNull(),
    coverageStartDate: timestamp('coverage_start_date', { withTimezone: true }).notNull(),
    coverageEndDate: timestamp('coverage_end_date', { withTimezone: true }).notNull(),
    totalAmount: numeric('total_amount', { precision: 14, scale: 4 }).notNull(),
    monthlyAmortization: numeric('monthly_amortization', { precision: 14, scale: 4 }).notNull(),
    consumedAmount: numeric('consumed_amount', { precision: 14, scale: 4 }).notNull().default('0'),
    remainingAmount: numeric('remaining_amount', { precision: 14, scale: 4 }).notNull(),
    status: text('status').notNull().default('active'),
    description: text('description').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'prepaid_expense_status_valid',
      sql`${t.status} in ('active', 'fully_consumed', 'cancelled')`,
    ),
    check('prepaid_expense_amount_positive', sql`${t.totalAmount} > 0`),
    check('prepaid_expense_dates_valid', sql`${t.coverageEndDate} > ${t.coverageStartDate}`),
    index('idx_prepaid_expense_org').on(t.orgNodeId),
    index('idx_prepaid_expense_dates').on(t.coverageStartDate, t.coverageEndDate),
  ],
);

// ==================== 3. مخصص الضمان الطبي (Warranty Provision) ====================
// مثال: مخصص 2% من مبيعات الأجهزة الطبية لتغطية صيانة الضمان

export const warrantyProvision = accrualSchema.table(
  'warranty_provision',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provisionNumber: text('provision_number').notNull().unique(),
    orgNodeId: uuid('org_node_id')
      .notNull()
      .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    warrantyExpenseAccountId: uuid('warranty_expense_account_id')
      .notNull()
      .references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
    provisionLiabilityAccountId: uuid('provision_liability_account_id')
      .notNull()
      .references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
    provisionDate: timestamp('provision_date', { withTimezone: true }).notNull(),
    salesInvoiceId: uuid('sales_invoice_id'),
    baseAmount: numeric('base_amount', { precision: 14, scale: 4 }).notNull(),
    provisionRate: numeric('provision_rate', { precision: 5, scale: 2 }).notNull(),
    provisionAmount: numeric('provision_amount', { precision: 14, scale: 4 }).notNull(),
    utilizedAmount: numeric('utilized_amount', { precision: 14, scale: 4 }).notNull().default('0'),
    remainingAmount: numeric('remaining_amount', { precision: 14, scale: 4 }).notNull(),
    warrantyExpiryDate: timestamp('warranty_expiry_date', { withTimezone: true }),
    status: text('status').notNull().default('active'),
    description: text('description').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'warranty_provision_status_valid',
      sql`${t.status} in ('active', 'fully_utilized', 'expired', 'cancelled')`,
    ),
    check(
      'warranty_provision_rate_valid',
      sql`${t.provisionRate} > 0 AND ${t.provisionRate} <= 100`,
    ),
    check('warranty_provision_amount_positive', sql`${t.provisionAmount} > 0`),
    index('idx_warranty_provision_org').on(t.orgNodeId),
    index('idx_warranty_provision_date').on(t.provisionDate),
  ],
);

export type AccruedExpense = typeof accruedExpense.$inferSelect;
export type PrepaidExpense = typeof prepaidExpense.$inferSelect;
export type WarrantyProvision = typeof warrantyProvision.$inferSelect;
export type AccruedExpenseStatus = 'accrued' | 'reversed' | 'cancelled';
export type PrepaidExpenseStatus = 'active' | 'fully_consumed' | 'cancelled';
export type WarrantyProvisionStatus = 'active' | 'fully_utilized' | 'expired' | 'cancelled';
