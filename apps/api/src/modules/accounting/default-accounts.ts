import type { AccountRole } from './account-roles';
import type { CompanyAccountingConfigRecord } from './accounting.types';

/**
 * The 19 company default accounts (plan item 33) — the backbone of automatic postings.
 * `roles` lists the standard roles (item 32) the account may carry; an account without a role is accepted.
 */
export interface DefaultAccountSpec {
  key: keyof CompanyAccountingConfigRecord;
  label: string;
  roles: readonly AccountRole[];
  usedBy: string;
}

export const DEFAULT_ACCOUNTS: readonly DefaultAccountSpec[] = [
  {
    key: 'defaultReceivableAccountId',
    label: 'العملاء (مدينون)',
    roles: ['receivable'],
    usedBy: 'فواتير البيع والتحصيل',
  },
  {
    key: 'defaultPayableAccountId',
    label: 'الموردين (دائنون)',
    roles: ['payable'],
    usedBy: 'فواتير الشراء والمدفوعات',
  },
  { key: 'defaultBankAccountId', label: 'البنك', roles: ['bank'], usedBy: 'المدفوعات والتحويلات' },
  { key: 'defaultCashAccountId', label: 'الخزينة', roles: ['cash'], usedBy: 'المدفوعات النقدية' },
  {
    key: 'defaultIncomeAccountId',
    label: 'إيراد المبيعات',
    roles: ['income_account', 'direct_income'],
    usedBy: 'فواتير البيع',
  },
  {
    key: 'defaultCogsAccountId',
    label: 'تكلفة البضاعة المباعة',
    roles: ['cost_of_goods_sold'],
    usedBy: 'صرف المبيعات من المخزن',
  },
  {
    key: 'defaultInventoryAccountId',
    label: 'المخزون',
    roles: ['stock'],
    usedBy: 'كل حركات المخزون',
  },
  {
    key: 'defaultGrniAccountId',
    label: 'بضاعة مستلمة ولم تُفوتر',
    roles: ['stock_received_but_not_billed'],
    usedBy: 'استلام المشتريات',
  },
  {
    key: 'defaultStockAdjustmentAccountId',
    label: 'تسويات المخزون',
    roles: ['stock_adjustment'],
    usedBy: 'الجرد والصرف العام',
  },
  {
    key: 'defaultWipAccountId',
    label: 'إنتاج تحت التشغيل',
    roles: [],
    usedBy: 'صرف وإنتاج التصنيع',
  },
  {
    key: 'defaultMfgVarianceAccountId',
    label: 'فروق التصنيع',
    roles: [],
    usedBy: 'إقفال أوامر الإنتاج',
  },
  {
    key: 'defaultOhAppliedAccountId',
    label: 'تكاليف غير مباشرة محمّلة',
    roles: [],
    usedBy: 'تحميل التكاليف الصناعية',
  },
  { key: 'defaultScrapAccountId', label: 'الهالك', roles: [], usedBy: 'الهالك والفاقد' },
  {
    key: 'defaultInputTaxAccountId',
    label: 'ضريبة المدخلات',
    roles: ['tax'],
    usedBy: 'فواتير الشراء',
  },
  {
    key: 'defaultOutputTaxAccountId',
    label: 'ضريبة المخرجات',
    roles: ['tax'],
    usedBy: 'فواتير البيع',
  },
  {
    key: 'defaultRoundOffAccountId',
    label: 'فروق التقريب',
    roles: ['round_off'],
    usedBy: 'قروش الفواتير',
  },
  {
    key: 'defaultWriteOffAccountId',
    label: 'الإعدام / الشطب',
    roles: [],
    usedBy: 'شطب الأرصدة الصغيرة',
  },
  {
    key: 'defaultExchangeGainLossAccountId',
    label: 'فروق العملة',
    roles: [],
    usedBy: 'المعاملات بالعملة الأجنبية',
  },
  {
    key: 'defaultDepreciationExpenseAccountId',
    label: 'مصروف الإهلاك',
    roles: ['depreciation'],
    usedBy: 'إهلاك الأصول',
  },
];

export interface DefaultAccountStatus {
  key: string;
  label: string;
  usedBy: string;
  accountId: string | null;
  accountCode: string | null;
  ok: boolean;
  problem: string | null;
}

/** Checks one default account (pure). */
export function checkDefaultAccount(
  spec: DefaultAccountSpec,
  orgNodeId: string,
  account: { code: string; orgNodeId: string | null; isLeaf: boolean; status?: string } | null,
  role: string | null,
  accountId: string | null,
): string | null {
  if (!accountId) return 'مش متحدد';
  if (!account) return 'الحساب مش موجود';
  if (account.orgNodeId !== orgNodeId) return `الحساب ${account.code} تبع شركة تانية`;
  if (!account.isLeaf) return `الحساب ${account.code} حساب أب — لازم حساب فرعي`;
  if (account.status && account.status !== 'active') return `الحساب ${account.code} موقوف`;
  if (role && spec.roles.length > 0 && !spec.roles.includes(role as AccountRole))
    return `الحساب ${account.code} نوعه "${role}" — المتوقع ${spec.roles.join(' / ')}`;
  return null;
}
