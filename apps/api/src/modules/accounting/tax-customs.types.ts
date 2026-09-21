// ============================================================
// Motion ERP — Egyptian Tax Authority & Customs Types
// Step 74
// ============================================================

export type TaxSettlementStatus = 'draft' | 'filed' | 'paid';
export type WhtDirection = 'deducted_by_us' | 'deducted_from_us';
export type WhtStatus = 'recorded' | 'declared' | 'settled';
export type CustomsStatus = 'draft' | 'cleared' | 'capitalized';

export interface Form41QuarterSummary {
  quarter: number;
  year: string;
  totalSuppliersCount: number;
  totalTaxableBase: string;
  totalWhtDeducted: string;
  goodsDeductionsTotal: string;    // 1%
  servicesDeductionsTotal: string; // 3%
}

export interface VatReturnReport {
  taxPeriod: string;
  grossSales14: string;
  outputVat14: string;
  grossPurchases14: string;
  inputVat14: string;
  vatPaidAtCustoms: string;
  totalRecoverableInputVat: string;
  netVatDueOrCredit: string;
  isCreditCarryForward: boolean;
}

// ── Accounting Journal Templates ─────────────
export const VAT_SETTLEMENT_POSTING = {
  debit:  'output_vat_account',
  credit: ['input_vat_account', 'tax_authority_payable_account'],
} as const;

export const CUSTOMS_CLEARANCE_POSTING = {
  debit:  ['customs_expense_or_wip', 'input_vat_customs_account'],
  credit: 'bank_or_customs_authority',
} as const;