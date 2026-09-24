import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';

interface FiscalYearRecord {
  id: string;
  orgNodeId: string;
  name: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
}
interface PeriodRecord {
  id: string;
  periodNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed' | 'locked';
}
interface AccountRecord {
  id: string;
  code: string;
  name: string;
  isLeaf: boolean;
  status: string;
}
interface ClosingLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debitAmount: string;
  creditAmount: string;
}
interface YearEndPreview {
  fiscalYearName: string;
  isClosed: boolean;
  totalRevenue: string;
  totalCostsAndExpenses: string;
  netProfit: string;
  draftEntries: number;
  trialBalanceDebit: string;
  trialBalanceCredit: string;
  closingLines: ClosingLine[];
  ready: boolean;
  problems: string[];
}

const STATUS_LABEL: Record<PeriodRecord['status'], string> = {
  open: 'مفتوحة',
  closed: 'مقفولة',
  locked: 'مقفولة نهائيًا',
};

const day = (iso: string): string => iso.slice(0, 10);

const message = (err: unknown, fallback: string): string =>
  err instanceof ApiError ? err.message : fallback;

/**
 * إقفال الفترات والسنة المالية على بيانات حقيقية:
 * - الفترات الشهرية: فتح وقفل من `accounting/periods/:id/status`.
 * - الإقفال السنوي: معاينة وتنفيذ من `accounting/year-end` (قيد إقفال للأرباح المحتجزة).
 */
export function YearEndClosingPage(): JSX.Element {
  const [years, setYears] = useState<FiscalYearRecord[]>([]);
  const [yearId, setYearId] = useState('');
  const [periods, setPeriods] = useState<PeriodRecord[]>([]);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [retainedId, setRetainedId] = useState('');
  const [preview, setPreview] = useState<YearEndPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const [fy, acc] = await Promise.all([
          api.get<{ fiscalYears: FiscalYearRecord[] }>('/accounting/fiscal-years'),
          api.get<{ accounts: AccountRecord[] }>('/accounting/accounts'),
        ]);
        setYears(fy.fiscalYears);
        setAccounts(acc.accounts.filter((a) => a.isLeaf && a.status === 'active'));
        const firstOpen = fy.fiscalYears.find((y) => !y.isClosed) ?? fy.fiscalYears[0];
        if (firstOpen) setYearId(firstOpen.id);
      } catch (err) {
        setError(message(err, 'فشل تحميل السنوات المالية'));
      }
    })();
  }, []);

  async function loadPeriods(id: string): Promise<void> {
    setPreview(null);
    if (!id) {
      setPeriods([]);
      return;
    }
    try {
      const res = await api.get<{ periods: PeriodRecord[] }>(
        `/accounting/fiscal-years/${id}/periods`,
      );
      setPeriods(res.periods);
    } catch (err) {
      setError(message(err, 'فشل تحميل الفترات'));
    }
  }

  useEffect(() => {
    void loadPeriods(yearId);
  }, [yearId]);

  async function setStatus(period: PeriodRecord, status: 'open' | 'closed'): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.post(`/accounting/periods/${period.id}/status`, { status });
      await loadPeriods(yearId);
    } catch (err) {
      setError(message(err, 'فشل تغيير حالة الفترة'));
    } finally {
      setBusy(false);
    }
  }

  async function loadPreview(): Promise<void> {
    if (!yearId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const q = retainedId ? `?retainedEarningsAccountId=${retainedId}` : '';
      const res = await api.get<{ preview: YearEndPreview }>(
        `/accounting/year-end/${yearId}/preview${q}`,
      );
      setPreview(res.preview);
    } catch (err) {
      setError(message(err, 'فشل تحميل معاينة الإقفال'));
    } finally {
      setBusy(false);
    }
  }

  async function closeYear(): Promise<void> {
    if (!yearId || !retainedId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post<{ preview: YearEndPreview; closingEntry: { id: string } | null }>(
        `/accounting/year-end/${yearId}/close`,
        { retainedEarningsAccountId: retainedId },
      );
      setPreview(res.preview);
      setNotice(
        res.closingEntry
          ? 'اتقفلت السنة واترحّل قيد الإقفال للأرباح المحتجزة.'
          : 'اتقفلت السنة (مكانش فيه أرصدة إيرادات أو مصروفات تتقفل).',
      );
      const fy = await api.get<{ fiscalYears: FiscalYearRecord[] }>('/accounting/fiscal-years');
      setYears(fy.fiscalYears);
      await loadPeriods(yearId);
    } catch (err) {
      setError(message(err, 'فشل الإقفال السنوي'));
    } finally {
      setBusy(false);
    }
  }

  const year = years.find((y) => y.id === yearId);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">إقفال الفترات والسنة المالية</h1>
        <p className="text-sm text-slate-500 mt-1">
          الفترة المقفولة بتمنع أي قيد بتاريخ جواها. الإقفال السنوي بيصفّر حسابات الإيرادات
          والمصروفات ويرحّل صافي الربح للأرباح المحتجزة.
        </p>
      </div>

      {error && (
        <div className="text-sm bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-3">
          {error}
        </div>
      )}
      {notice && (
        <div className="text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl p-3">
          {notice}
        </div>
      )}

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <label className="block text-xs font-bold text-slate-600">
          السنة المالية
          <select
            className="mt-1 w-full md:w-80 border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={yearId}
            onChange={(e) => setYearId(e.target.value)}
          >
            {years.length === 0 && <option value="">— مفيش سنوات مالية —</option>}
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} ({day(y.startDate)} ← {day(y.endDate)}){y.isClosed ? ' — مقفولة' : ''}
              </option>
            ))}
          </select>
        </label>

        <h2 className="text-lg font-bold text-slate-900">الفترات الشهرية</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-200">
                <th className="text-right py-2">#</th>
                <th className="text-right py-2">الفترة</th>
                <th className="text-right py-2">من</th>
                <th className="text-right py-2">إلى</th>
                <th className="text-right py-2">الحالة</th>
                <th className="text-right py-2"></th>
              </tr>
            </thead>
            <tbody>
              {periods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-400">
                    مفيش فترات للسنة دي
                  </td>
                </tr>
              ) : (
                periods.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-2">{p.periodNumber}</td>
                    <td className="py-2 font-medium">{p.name}</td>
                    <td className="py-2">{day(p.startDate)}</td>
                    <td className="py-2">{day(p.endDate)}</td>
                    <td className="py-2">{STATUS_LABEL[p.status]}</td>
                    <td className="py-2 text-left">
                      {p.status === 'open' ? (
                        <button
                          onClick={() => void setStatus(p, 'closed')}
                          disabled={busy}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          قفل الفترة
                        </button>
                      ) : p.status === 'closed' && !year?.isClosed ? (
                        <button
                          onClick={() => void setStatus(p, 'open')}
                          disabled={busy}
                          className="px-3 py-1 border border-slate-300 hover:bg-slate-100 disabled:opacity-50 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          إعادة فتح
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">الإقفال السنوي</h2>
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <label className="block text-xs font-bold text-slate-600 flex-1">
            حساب الأرباح المحتجزة
            <select
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={retainedId}
              onChange={(e) => setRetainedId(e.target.value)}
            >
              <option value="">— اختر —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => void loadPreview()}
            disabled={busy || !yearId}
            className="px-5 py-2 border border-slate-300 hover:bg-slate-100 disabled:opacity-50 rounded-lg text-sm font-bold cursor-pointer"
          >
            معاينة
          </button>
          <button
            onClick={() => void closeYear()}
            disabled={busy || !yearId || !retainedId || !preview?.ready}
            className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold cursor-pointer"
          >
            تنفيذ الإقفال السنوي
          </button>
        </div>

        {preview && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-slate-50">
                <div className="text-xs text-slate-500">الإيرادات</div>
                <div className="font-bold">{preview.totalRevenue}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50">
                <div className="text-xs text-slate-500">التكاليف والمصروفات</div>
                <div className="font-bold">{preview.totalCostsAndExpenses}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50">
                <div className="text-xs text-slate-500">صافي الربح</div>
                <div className="font-bold">{preview.netProfit}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50">
                <div className="text-xs text-slate-500">ميزان المراجعة (مدين / دائن)</div>
                <div className="font-bold">
                  {preview.trialBalanceDebit} / {preview.trialBalanceCredit}
                </div>
              </div>
            </div>
            {preview.problems.length > 0 && (
              <ul className="text-sm bg-amber-50 text-amber-800 border border-amber-200 rounded-xl p-3 list-disc pr-6">
                {preview.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            {preview.closingLines.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-slate-200">
                    <th className="text-right py-2">الحساب</th>
                    <th className="text-right py-2">مدين</th>
                    <th className="text-right py-2">دائن</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.closingLines.map((l) => (
                    <tr key={l.accountId} className="border-b border-slate-100">
                      <td className="py-2">
                        {l.accountCode} — {l.accountName}
                      </td>
                      <td className="py-2">{l.debitAmount}</td>
                      <td className="py-2">{l.creditAmount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default YearEndClosingPage;
