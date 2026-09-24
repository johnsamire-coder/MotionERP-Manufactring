/**
 * Standard account roles (plan item 32) — ERPNext's full "Account Type" list (30 today; the plan
 * counted 28). Each role declares the normal balance it needs and the behaviour it enforces.
 */
export type AccountRole =
  | 'accumulated_depreciation' | 'asset_received_but_not_billed' | 'bank' | 'cash' | 'chargeable' | 'capital_work_in_progress'
  | 'cost_of_goods_sold' | 'current_asset' | 'current_liability' | 'depreciation' | 'direct_expense' | 'direct_income' | 'equity'
  | 'expense_account' | 'expenses_included_in_asset_valuation' | 'expenses_included_in_valuation' | 'fixed_asset' | 'income_account'
  | 'indirect_expense' | 'indirect_income' | 'liability' | 'payable' | 'receivable' | 'round_off' | 'service_received_but_not_billed'
  | 'stock' | 'stock_adjustment' | 'stock_received_but_not_billed' | 'tax' | 'temporary';

export interface AccountRoleSpec {
  label: string;
  /** Normal balance the account's type must have; null = either. */
  normalBalance: 'debit' | 'credit' | null;
  /** Manual journal lines on this account must name a party of this type. */
  requiresParty?: 'customer' | 'supplier';
  /** Only system postings (stock movements…) may touch it; manual journal entries are refused. */
  systemOnly?: string;
}

export const ACCOUNT_ROLES: Record<AccountRole, AccountRoleSpec> = {
  accumulated_depreciation: { label: 'مجمع الإهلاك', normalBalance: 'credit' },
  asset_received_but_not_billed: { label: 'أصول مستلمة ولم تُفوتر', normalBalance: 'credit' },
  bank: { label: 'بنك', normalBalance: 'debit' },
  cash: { label: 'نقدية / خزينة', normalBalance: 'debit' },
  chargeable: { label: 'قابل للتحميل', normalBalance: null },
  capital_work_in_progress: { label: 'أصول تحت التنفيذ', normalBalance: 'debit' },
  cost_of_goods_sold: { label: 'تكلفة البضاعة المباعة', normalBalance: 'debit' },
  current_asset: { label: 'أصول متداولة', normalBalance: 'debit' },
  current_liability: { label: 'خصوم متداولة', normalBalance: 'credit' },
  depreciation: { label: 'مصروف إهلاك', normalBalance: 'debit' },
  direct_expense: { label: 'مصروفات مباشرة', normalBalance: 'debit' },
  direct_income: { label: 'إيرادات مباشرة', normalBalance: 'credit' },
  equity: { label: 'حقوق ملكية', normalBalance: 'credit' },
  expense_account: { label: 'حساب مصروف', normalBalance: 'debit' },
  expenses_included_in_asset_valuation: { label: 'مصروفات محمّلة على تقييم الأصول', normalBalance: 'credit' },
  expenses_included_in_valuation: { label: 'مصروفات محمّلة على تقييم المخزون', normalBalance: 'credit' },
  fixed_asset: { label: 'أصول ثابتة', normalBalance: 'debit' },
  income_account: { label: 'حساب إيراد', normalBalance: 'credit' },
  indirect_expense: { label: 'مصروفات غير مباشرة', normalBalance: 'debit' },
  indirect_income: { label: 'إيرادات غير مباشرة', normalBalance: 'credit' },
  liability: { label: 'خصوم', normalBalance: 'credit' },
  payable: { label: 'دائنون (موردين)', normalBalance: 'credit', requiresParty: 'supplier' },
  receivable: { label: 'مدينون (عملاء)', normalBalance: 'debit', requiresParty: 'customer' },
  round_off: { label: 'فروق تقريب', normalBalance: null },
  service_received_but_not_billed: { label: 'خدمات مستلمة ولم تُفوتر', normalBalance: 'credit' },
  stock: { label: 'مخزون', normalBalance: 'debit', systemOnly: 'حركات المخزون' },
  stock_adjustment: { label: 'تسويات مخزون', normalBalance: null },
  stock_received_but_not_billed: { label: 'بضاعة مستلمة ولم تُفوتر (GRNI)', normalBalance: 'credit' },
  tax: { label: 'ضرائب', normalBalance: null },
  temporary: { label: 'حساب مؤقت (أرصدة افتتاحية)', normalBalance: null },
};

export const isAccountRole = (v: string): v is AccountRole => Object.prototype.hasOwnProperty.call(ACCOUNT_ROLES, v);

/** Why a manual journal line may not use this account as written, or null when it may. */
export function manualLineProblem(
  account: { code: string; role: AccountRole | null },
  line: { partyType?: string | null; partyId?: string | null },
): string | null {
  if (!account.role) return null;
  const spec = ACCOUNT_ROLES[account.role];
  if (spec.systemOnly) return `الحساب ${account.code} (${spec.label}) بيتحدّث من ${spec.systemOnly} بس — مينفعش قيد يدوي عليه`;
  if (spec.requiresParty && (line.partyType !== spec.requiresParty || !line.partyId)) {
    return `الحساب ${account.code} (${spec.label}) لازم السطر يحدد ${spec.requiresParty === 'customer' ? 'العميل' : 'المورد'}`;
  }
  return null;
}
