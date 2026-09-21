// ============================================================
// Motion ERP — Accruals, Prepaids & Provisions Types
// Step 64
// ============================================================

// ── Accrual Types ────────────────────────────
export type AccrualStatus = 'draft' | 'posted' | 'reversed';

export interface AccrualEntryRecord {
  id: string;
  entryNumber: string;
  companyId: string;
  fiscalYearId: string;
  periodId: string;
  accrualDate: string;
  description: string;
  expenseAccountId: string;
  liabilityAccountId: string;
  costCenterId: string | null;
  amount: string;
  status: AccrualStatus;
  journalEntryId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Prepaid Types ────────────────────────────
export type PrepaidStatus = 'active' | 'fully_amortized' | 'cancelled';

export interface PrepaidExpenseRecord {
  id: string;
  entryNumber: string;
  companyId: string;
  fiscalYearId: string;
  periodId: string;
  startDate: string;
  endDate: string;
  description: string;
  prepaidAccountId: string;
  expenseAccountId: string;
  costCenterId: string | null;
  totalAmount: string;
  monthlyAmount: string;
  monthsCount: number;
  amortizedAmount: string;
  remainingAmount: string;
  status: PrepaidStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Provision Types ──────────────────────────
export type ProvisionType = 'warranty' | 'bad_debt' | 'legal' | 'other';
export type ProvisionStatus = 'draft' | 'posted' | 'utilized' | 'reversed';

export interface ProvisionRecord {
  id: string;
  provisionNumber: string;
  companyId: string;
  fiscalYearId: string;
  periodId: string;
  provisionDate: string;
  provisionType: ProvisionType;
  description: string;
  expenseAccountId: string;
  provisionAccountId: string;
  costCenterId: string | null;
  baseAmount: string;
  ratePercentage: string;
  provisionAmount: string;
  relatedInvoiceId: string | null;
  warrantyMonths: number | null;
  status: ProvisionStatus;
  journalEntryId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Amortization Schedule ────────────────────
export interface AmortizationLine {
  month: number;
  periodId: string;
  amount: string;
  isAmortized: boolean;
}

// ── Journal Entry Templates ──────────────────
export const ACCRUAL_POSTING = {
  debit:  'expense_account',
  credit: 'liability_account',
} as const;

export const PREPAID_INITIAL_POSTING = {
  debit:  'prepaid_account',
  credit: 'bank_account',
} as const;

export const PREPAID_MONTHLY_POSTING = {
  debit:  'expense_account',
  credit: 'prepaid_account',
} as const;

export const PROVISION_POSTING = {
  debit:  'expense_account',
  credit: 'provision_account',
} as const;

export const PROVISION_UTILIZATION = {
  debit:  'provision_account',
  credit: 'inventory_or_cash',
} as const;