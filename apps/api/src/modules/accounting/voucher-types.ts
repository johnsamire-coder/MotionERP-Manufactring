import type { AccountRole } from './account-roles';

/** The 17 journal entry types (plan item 34), ERPNext's "Entry Type" list. */
export type VoucherType =
  | 'journal_entry' | 'inter_company_journal_entry' | 'bank_entry' | 'cash_entry' | 'credit_card_entry' | 'debit_note' | 'credit_note'
  | 'contra_entry' | 'excise_entry' | 'write_off_entry' | 'opening_entry' | 'depreciation_entry' | 'exchange_rate_revaluation'
  | 'exchange_gain_or_loss' | 'deferred_revenue' | 'deferred_expense' | 'reversal_of_itc';

export const VOUCHER_TYPES: Record<VoucherType, { label: string; rule: string }> = {
  journal_entry: { label: 'قيد يومية عام', rule: 'مفيش شرط خاص' },
  inter_company_journal_entry: { label: 'قيد بين الشركات', rule: 'لازم مرجع للقيد المقابل في الشركة التانية' },
  bank_entry: { label: 'قيد بنك', rule: 'سطر واحد على الأقل على حساب بنك' },
  cash_entry: { label: 'قيد نقدية', rule: 'سطر واحد على الأقل على حساب خزينة' },
  credit_card_entry: { label: 'قيد بطاقة ائتمان', rule: 'سطر واحد على الأقل على حساب بنك' },
  debit_note: { label: 'إشعار مدين', rule: 'لازم سطر عليه طرف (عميل أو مورد)' },
  credit_note: { label: 'إشعار دائن', rule: 'لازم سطر عليه طرف (عميل أو مورد)' },
  contra_entry: { label: 'قيد تحويل بين بنك وخزينة', rule: 'كل السطور على حسابات بنك أو خزينة بس' },
  excise_entry: { label: 'قيد رسوم إنتاج', rule: 'سطر واحد على الأقل على حساب ضرائب' },
  write_off_entry: { label: 'قيد شطب', rule: 'سطر على حساب الشطب الافتراضي للشركة (لو متحدد)' },
  opening_entry: { label: 'قيد افتتاحي', rule: 'ممنوع على حسابات الإيرادات والمصروفات' },
  depreciation_entry: { label: 'قيد إهلاك', rule: 'سطر على مصروف إهلاك وسطر على مجمع إهلاك' },
  exchange_rate_revaluation: { label: 'إعادة تقييم عملة', rule: 'سطر على حساب فروق العملة الافتراضي (لو متحدد)' },
  exchange_gain_or_loss: { label: 'أرباح/خسائر فروق عملة', rule: 'سطر على حساب فروق العملة الافتراضي (لو متحدد)' },
  deferred_revenue: { label: 'إيراد مؤجل', rule: 'سطر واحد على الأقل على حساب إيراد' },
  deferred_expense: { label: 'مصروف مؤجل', rule: 'سطر واحد على الأقل على حساب مصروف' },
  reversal_of_itc: { label: 'عكس خصم ضريبة المدخلات', rule: 'سطر واحد على الأقل على حساب ضرائب' },
};

export const isVoucherType = (v: string): v is VoucherType => Object.prototype.hasOwnProperty.call(VOUCHER_TYPES, v);

const INCOME: readonly AccountRole[] = ['income_account', 'direct_income', 'indirect_income'];
const EXPENSE: readonly AccountRole[] = ['expense_account', 'direct_expense', 'indirect_expense', 'cost_of_goods_sold', 'depreciation'];

export interface VoucherLine { role: AccountRole | null; accountId: string; hasParty: boolean; }

/** Why a manual entry of this type is not acceptable as written, or null (pure). */
export function voucherTypeProblem(
  type: VoucherType,
  lines: VoucherLine[],
  ctx: { reference?: string | null; writeOffAccountId?: string | null; exchangeAccountId?: string | null } = {},
): string | null {
  const label = VOUCHER_TYPES[type].label;
  const any = (roles: readonly AccountRole[]): boolean => lines.some((l) => l.role !== null && roles.includes(l.role));
  const need = (ok: boolean): string | null => (ok ? null : `${label}: ${VOUCHER_TYPES[type].rule}`);
  switch (type) {
    case 'bank_entry': case 'credit_card_entry': return need(any(['bank']));
    case 'cash_entry': return need(any(['cash']));
    case 'contra_entry': return need(lines.every((l) => l.role === 'bank' || l.role === 'cash'));
    case 'debit_note': case 'credit_note': return need(lines.some((l) => l.hasParty));
    case 'excise_entry': case 'reversal_of_itc': return need(any(['tax']));
    case 'opening_entry': return need(!any([...INCOME, ...EXPENSE]));
    case 'depreciation_entry': return need(any(['depreciation']) && any(['accumulated_depreciation']));
    case 'deferred_revenue': return need(any(INCOME));
    case 'deferred_expense': return need(any(EXPENSE));
    case 'inter_company_journal_entry': return need(Boolean(ctx.reference?.trim()));
    case 'write_off_entry': return need(!ctx.writeOffAccountId || lines.some((l) => l.accountId === ctx.writeOffAccountId));
    case 'exchange_rate_revaluation': case 'exchange_gain_or_loss':
      return need(!ctx.exchangeAccountId || lines.some((l) => l.accountId === ctx.exchangeAccountId));
    default: return null;
  }
}

/** Type given to automatic entries from their source event. */
export function voucherTypeForSource(sourceEventType?: string | null): VoucherType {
  if (sourceEventType === 'asset_depreciation') return 'depreciation_entry';
  if (sourceEventType === 'opening_balance') return 'opening_entry';
  return 'journal_entry';
}
