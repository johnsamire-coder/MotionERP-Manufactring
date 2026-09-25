import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';

interface JobOrder {
  id: string;
  jobOrderNumber: string;
}
interface CostSummary {
  jobOrderReference: string;
  currencyCode: string;
  estimatedTotal: string;
  actualTotal: string;
  variance: string;
  margin: string;
  entries: { componentType: string; estimated: string; actual: string; variance: string }[];
}
interface VarianceLine {
  requestId: string;
  itemId: string;
  warehouseId: string;
  status: string;
  deviationReason: string | null;
  plannedQuantity: string;
  requestedQuantity: string;
  issuedQuantity: string | null;
  actualUsedQuantity: string | null;
  overRequestQuantity: string;
  usageVarianceQuantity: string | null;
  notReturnedQuantity: string | null;
  actualRate: string | null;
  plannedValue: string | null;
  issuedValue: string | null;
  usedValue: string | null;
  usageVarianceValue: string | null;
}
interface VarianceReport {
  lines: VarianceLine[];
  totals: {
    plannedValue: string;
    issuedValue: string;
    usedValue: string;
    usageVarianceValue: string;
    notReturnedValue: string;
  };
  pendingLines: number;
}
interface Item {
  id: string;
  code: string;
  name: string;
}

const COMPONENT_LABEL: Record<string, string> = {
  material: 'خامات',
  labor: 'عمالة',
  overhead: 'أعباء',
  subcontract: 'تشغيل لدى الغير',
};
const STATUS_LABEL: Record<string, string> = {
  pending_review: 'مستني مراجعة',
  approved: 'معتمد',
  issued: 'اتصرف',
  closed: 'مقفول',
};
const card = 'bg-white p-5 rounded-2xl shadow-sm border border-slate-200';
const n = (v: string | null | undefined): string =>
  v == null ? '—' : Number(v).toLocaleString('ar-EG', { maximumFractionDigits: 2 });
/** Variance tone: more than planned (cost overrun) is unfavourable. */
const tone = (v: string | null | undefined): string =>
  v == null || Math.abs(Number(v)) < 0.005
    ? ''
    : Number(v) > 0
      ? 'text-rose-600 font-bold'
      : 'text-emerald-700 font-bold';

/**
 * المخطط مقابل الفعلي لأمر الشغل، من البيانات الحقيقية:
 * - التكلفة التقديرية مقابل الفعلية لكل عنصر (خامات، عمالة، أعباء) من كارت تكلفة أمر الشغل.
 * - الخامات: الكمية المخططة مقابل المطلوبة والمصروفة والمستهلكة فعلًا، متقيّمة بسعر الصرف الفعلي
 *   (المتوسط المرجّح وقت الصرف). انحراف الاستهلاك = (المستهلك − المخطط) × السعر.
 */
export function PlannedVsActualPage(): JSX.Element {
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [ref, setRef] = useState('');
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [report, setReport] = useState<VarianceReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const itemName = useMemo(() => {
    const m = new Map(items.map((i) => [i.id, `${i.code} — ${i.name}`]));
    return (id: string): string => m.get(id) ?? id.slice(0, 8);
  }, [items]);

  useEffect(() => {
    void Promise.all([
      api.get<{ jobOrders: JobOrder[] }>('/sales/job-orders'),
      api.get<{ items: Item[] }>('/catalog/items?lang=ar'),
    ])
      .then(([j, i]) => {
        setJobOrders(j.jobOrders);
        setItems(i.items);
        if (j.jobOrders[0]) setRef(j.jobOrders[0].jobOrderNumber);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'فشل تحميل أوامر الشغل'),
      );
  }, []);

  useEffect(() => {
    if (!ref) return;
    setError(null);
    void Promise.all([
      api
        .get<{ summary?: CostSummary } & Partial<CostSummary>>(
          `/cost/jobs/${encodeURIComponent(ref)}/summary`,
        )
        .then((r) => r.summary ?? (r.entries ? (r as CostSummary) : null))
        .catch(() => null),
      api.get<VarianceReport>(
        `/production/job-orders/${encodeURIComponent(ref)}/material-variance`,
      ),
    ])
      .then(([s, r]) => {
        setSummary(s);
        setReport(r);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'فشل تحميل التقرير'),
      );
  }, [ref]);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className={card}>
        <h1 className="text-2xl font-bold text-slate-900">المخطط مقابل الفعلي</h1>
        <p className="text-sm text-slate-500 mt-1">
          لكل أمر شغل: التكلفة التقديرية مقابل الفعلية لكل عنصر، والخامات المخططة مقابل المصروفة
          والمستهلكة فعلًا بسعر الصرف الحقيقي. الأحمر = أكتر من المخطط (غير مواتي)، والأخضر = أقل.
        </p>
        <label className="block text-xs font-bold text-slate-600 mt-4 max-w-sm">
          أمر الشغل
          <select
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
          >
            {jobOrders.length === 0 && <option value="">مفيش أوامر شغل</option>}
            {jobOrders.map((j) => (
              <option key={j.id} value={j.jobOrderNumber}>
                {j.jobOrderNumber}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="text-sm bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-3">
          {error}
        </div>
      )}

      {summary && (
        <div className={`${card} overflow-x-auto`}>
          <h2 className="font-bold mb-3">
            التكلفة التقديرية مقابل الفعلية ({summary.currencyCode})
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-200">
                <th className="text-right py-2">العنصر</th>
                <th className="text-right py-2">التقديري</th>
                <th className="text-right py-2">الفعلي</th>
                <th className="text-right py-2">الانحراف</th>
              </tr>
            </thead>
            <tbody>
              {summary.entries.map((e) => (
                <tr key={e.componentType} className="border-b border-slate-100">
                  <td className="py-2">{COMPONENT_LABEL[e.componentType] ?? e.componentType}</td>
                  <td className="py-2">{n(e.estimated)}</td>
                  <td className="py-2">{n(e.actual)}</td>
                  <td className={`py-2 ${tone(e.variance)}`}>{n(e.variance)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="py-2">الإجمالي</td>
                <td className="py-2">{n(summary.estimatedTotal)}</td>
                <td className="py-2">{n(summary.actualTotal)}</td>
                <td className={`py-2 ${tone(summary.variance)}`}>{n(summary.variance)}</td>
              </tr>
            </tbody>
          </table>
          {summary.entries.length === 0 && (
            <p className="text-sm text-slate-400 mt-2">
              لسه مفيش تكاليف مسجلة على أمر الشغل ده (من شاشة "تكلفة وربحية أوامر الشغل")
            </p>
          )}
        </div>
      )}

      {report && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            {[
              ['قيمة المخطط', report.totals.plannedValue, ''],
              ['قيمة المصروف', report.totals.issuedValue, ''],
              ['قيمة المستهلك', report.totals.usedValue, ''],
              [
                'انحراف الاستهلاك',
                report.totals.usageVarianceValue,
                tone(report.totals.usageVarianceValue),
              ],
              ['مصروف ومرجعش المخزن', report.totals.notReturnedValue, ''],
            ].map(([title, value, cls]) => (
              <div key={title} className={card}>
                <div className="text-xs text-slate-500">{title}</div>
                <div className={`text-xl font-bold ${cls}`}>{n(value)}</div>
              </div>
            ))}
          </div>

          <div className={`${card} overflow-x-auto`}>
            <h2 className="font-bold mb-3">الخامات: المخطط مقابل الفعلي</h2>
            {report.pendingLines > 0 && (
              <p className="text-xs text-amber-700 mb-2">
                {report.pendingLines} طلب لسه متصرفش، فملوش قيمة لحد ما يتصرف.
              </p>
            )}
            {report.lines.length === 0 ? (
              <p className="text-sm text-slate-400">
                مفيش طلبات خامات على أمر الشغل ده (من شاشة "صرف الخامات للإنتاج")
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-slate-200">
                    <th className="text-right py-2">الصنف</th>
                    <th className="text-right py-2">الحالة</th>
                    <th className="text-right py-2">المخطط</th>
                    <th className="text-right py-2">المطلوب</th>
                    <th className="text-right py-2">المصروف</th>
                    <th className="text-right py-2">المستهلك</th>
                    <th className="text-right py-2">انحراف الكمية</th>
                    <th className="text-right py-2">سعر الصرف</th>
                    <th className="text-right py-2">انحراف القيمة</th>
                    <th className="text-right py-2">سبب الزيادة</th>
                  </tr>
                </thead>
                <tbody>
                  {report.lines.map((l) => (
                    <tr key={l.requestId} className="border-b border-slate-100">
                      <td className="py-2">{itemName(l.itemId)}</td>
                      <td className="py-2 text-xs">{STATUS_LABEL[l.status] ?? l.status}</td>
                      <td className="py-2">{n(l.plannedQuantity)}</td>
                      <td className={`py-2 ${tone(l.overRequestQuantity)}`}>
                        {n(l.requestedQuantity)}
                      </td>
                      <td className="py-2">{n(l.issuedQuantity)}</td>
                      <td className="py-2">{n(l.actualUsedQuantity)}</td>
                      <td className={`py-2 ${tone(l.usageVarianceQuantity)}`}>
                        {n(l.usageVarianceQuantity)}
                      </td>
                      <td className="py-2">{n(l.actualRate)}</td>
                      <td className={`py-2 ${tone(l.usageVarianceValue)}`}>
                        {n(l.usageVarianceValue)}
                      </td>
                      <td className="py-2 text-xs text-slate-500">{l.deviationReason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default PlannedVsActualPage;
