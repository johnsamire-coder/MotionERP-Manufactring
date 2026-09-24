import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';

interface ItemRecord {
  id: string;
  code: string;
  name: string;
}
interface SupplierRecord {
  id: string;
  code: string;
  name: string;
}
interface RfqRecord {
  id: string;
  rfqNumber: string;
  status: 'draft' | 'sent' | 'closed' | 'cancelled';
  awardedSupplierId: string | null;
  lines: Array<{ itemId: string; quantity: string }>;
  suppliers: Array<{
    supplierId: string;
    status: 'pending' | 'received' | 'declined';
    quotationId: string | null;
  }>;
}
interface Comparison {
  suppliers: Array<{ supplierId: string; status: string; total: string | null }>;
  lines: Array<{
    itemId: string;
    quantity: string;
    offers: Array<{ supplierId: string; unitPrice: string; lineTotal: string; isLowest: boolean }>;
  }>;
  lowestTotalSupplierId: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'مسودة',
  sent: 'اتبعت',
  closed: 'اتقفل',
  cancelled: 'اتلغى',
  pending: 'مستني الرد',
  received: 'ردّ',
  declined: 'اعتذر',
};

/** طلبات عروض الأسعار لعدة موردين (بند 7): إنشاء، إرسال، تسجيل الردود، مقارنة، اختيار. */
export function RfqPage(): JSX.Element {
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [rfqs, setRfqs] = useState<RfqRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // create form
  const [lines, setLines] = useState<Array<{ itemId: string; quantity: string }>>([
    { itemId: '', quantity: '1' },
  ]);
  const [chosenSuppliers, setChosenSuppliers] = useState<string[]>([]);
  // response form: supplierId -> itemId -> price
  const [prices, setPrices] = useState<Record<string, Record<string, string>>>({});

  const itemName = useMemo(
    () => new Map(items.map((i) => [i.id, `${i.code} — ${i.name}`])),
    [items],
  );
  const supplierName = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const selected = rfqs.find((r) => r.id === selectedId) ?? null;

  async function reload(): Promise<void> {
    const res = await api.get<{ rfqs: RfqRecord[] }>('/sales/rfqs');
    setRfqs(res.rfqs);
  }

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const [i, s] = await Promise.all([
          api.get<{ items: ItemRecord[] }>('/catalog/items').catch(() => ({ items: [] })),
          api
            .get<{ suppliers: SupplierRecord[] }>('/crm/suppliers')
            .catch(() => ({ suppliers: [] })),
        ]);
        setItems(i.items);
        setSuppliers(s.suppliers);
        await reload();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'فشل تحميل البيانات');
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setComparison(null);
      return;
    }
    api
      .get<{ comparison: Comparison }>(`/sales/rfqs/${selectedId}/comparison`)
      .then((r) => setComparison(r.comparison))
      .catch(() => setComparison(null));
  }, [selectedId, rfqs]);

  async function run(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشلت العملية');
    } finally {
      setBusy(false);
    }
  }

  const create = (): Promise<void> =>
    run(async () => {
      const res = await api.post<{ rfq: RfqRecord }>('/sales/rfqs', {
        lines: lines.filter((l) => l.itemId),
        supplierIds: chosenSuppliers,
      });
      setSelectedId(res.rfq.id);
      setLines([{ itemId: '', quantity: '1' }]);
      setChosenSuppliers([]);
    });

  const respond = (supplierId: string): Promise<void> =>
    run(() =>
      api.post(`/sales/rfqs/${selectedId}/suppliers/${supplierId}/response`, {
        lines: (selected?.lines ?? []).map((l) => ({
          itemId: l.itemId,
          unitPrice: prices[supplierId]?.[l.itemId] ?? '',
        })),
      }),
    );

  const box = 'bg-white p-5 rounded-2xl shadow-sm border border-slate-200';
  const input = 'border border-slate-300 rounded-lg px-3 py-2 text-sm';
  const btn = 'px-4 py-2 rounded-lg text-sm font-bold cursor-pointer disabled:opacity-50';

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className={box}>
        <h1 className="text-2xl font-bold text-slate-900">طلبات عروض الأسعار (RFQ)</h1>
        <p className="text-sm text-slate-500 mt-1">
          طلب واحد لكذا مورد، سجّل ردودهم، قارن الأسعار جنب بعض، واختار المورد.
        </p>
      </div>

      {error && (
        <div className="text-sm bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-3">
          {error}
        </div>
      )}

      <div className={`${box} space-y-4`}>
        <h3 className="font-bold text-slate-900">طلب جديد</h3>
        {lines.map((l, idx) => (
          <div key={idx} className="flex gap-2">
            <select
              aria-label={`صنف ${idx + 1}`}
              className={`${input} flex-1`}
              value={l.itemId}
              onChange={(e) =>
                setLines(lines.map((x, i) => (i === idx ? { ...x, itemId: e.target.value } : x)))
              }
            >
              <option value="">— الصنف —</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code} — {i.name}
                </option>
              ))}
            </select>
            <input
              aria-label={`كمية ${idx + 1}`}
              className={`${input} w-28`}
              value={l.quantity}
              onChange={(e) =>
                setLines(lines.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))
              }
            />
          </div>
        ))}
        <button
          className={`${btn} bg-slate-100 text-slate-700`}
          onClick={() => setLines([...lines, { itemId: '', quantity: '1' }])}
        >
          + صنف
        </button>
        <div>
          <p className="text-xs font-bold text-slate-600 mb-2">الموردين (اتنين أو أكتر)</p>
          <div className="flex flex-wrap gap-3">
            {suppliers.map((s) => (
              <label key={s.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={chosenSuppliers.includes(s.id)}
                  onChange={(e) =>
                    setChosenSuppliers(
                      e.target.checked
                        ? [...chosenSuppliers, s.id]
                        : chosenSuppliers.filter((x) => x !== s.id),
                    )
                  }
                />
                {s.name}
              </label>
            ))}
          </div>
        </div>
        <button
          className={`${btn} bg-teal-600 text-white`}
          disabled={busy}
          onClick={() => void create()}
        >
          إنشاء الطلب
        </button>
      </div>

      <div className={box}>
        <h3 className="font-bold text-slate-900 mb-3">الطلبات</h3>
        <div className="flex flex-wrap gap-2">
          {rfqs.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`${btn} ${r.id === selectedId ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              {r.rfqNumber} · {STATUS_LABEL[r.status]}
            </button>
          ))}
          {rfqs.length === 0 && <p className="text-sm text-slate-400">لسه مفيش طلبات</p>}
        </div>
      </div>

      {selected && (
        <div className={`${box} space-y-5`}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">
              {selected.rfqNumber} — {STATUS_LABEL[selected.status]}
            </h3>
            <div className="flex gap-2">
              {selected.status === 'draft' && (
                <button
                  className={`${btn} bg-indigo-600 text-white`}
                  disabled={busy}
                  onClick={() => void run(() => api.post(`/sales/rfqs/${selected.id}/send`, {}))}
                >
                  إرسال للموردين
                </button>
              )}
              {(selected.status === 'draft' || selected.status === 'sent') && (
                <button
                  className={`${btn} bg-rose-50 text-rose-700`}
                  disabled={busy}
                  onClick={() => void run(() => api.post(`/sales/rfqs/${selected.id}/cancel`, {}))}
                >
                  إلغاء
                </button>
              )}
            </div>
          </div>

          {selected.status === 'sent' &&
            selected.suppliers
              .filter((s) => s.status === 'pending')
              .map((s) => (
                <div
                  key={s.supplierId}
                  className="border border-slate-200 rounded-xl p-4 space-y-2"
                >
                  <p className="text-sm font-bold">
                    رد {supplierName.get(s.supplierId) ?? s.supplierId}
                  </p>
                  {selected.lines.map((l) => (
                    <label key={l.itemId} className="flex items-center gap-2 text-sm">
                      <span className="flex-1">
                        {itemName.get(l.itemId) ?? l.itemId} × {Number(l.quantity)}
                      </span>
                      <input
                        aria-label={`سعر ${supplierName.get(s.supplierId)} ${itemName.get(l.itemId)}`}
                        className={`${input} w-32`}
                        placeholder="سعر الوحدة"
                        value={prices[s.supplierId]?.[l.itemId] ?? ''}
                        onChange={(e) =>
                          setPrices({
                            ...prices,
                            [s.supplierId]: { ...prices[s.supplierId], [l.itemId]: e.target.value },
                          })
                        }
                      />
                    </label>
                  ))}
                  <div className="flex gap-2">
                    <button
                      className={`${btn} bg-teal-600 text-white`}
                      disabled={busy}
                      onClick={() => void respond(s.supplierId)}
                    >
                      تسجيل الرد
                    </button>
                    <button
                      className={`${btn} bg-slate-100 text-slate-700`}
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          api.post(
                            `/sales/rfqs/${selected.id}/suppliers/${s.supplierId}/decline`,
                            {},
                          ),
                        )
                      }
                    >
                      اعتذر
                    </button>
                  </div>
                </div>
              ))}

          {comparison && (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-3">الصنف</th>
                    {comparison.suppliers.map((s) => (
                      <th key={s.supplierId} className="p-3">
                        {supplierName.get(s.supplierId) ?? s.supplierId}
                        <span className="block text-[10px] text-slate-400">
                          {STATUS_LABEL[s.status]}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.lines.map((l) => (
                    <tr key={l.itemId} className="border-t border-slate-100">
                      <td className="p-3">
                        {itemName.get(l.itemId) ?? l.itemId} × {Number(l.quantity)}
                      </td>
                      {comparison.suppliers.map((s) => {
                        const o = l.offers.find((x) => x.supplierId === s.supplierId);
                        return (
                          <td
                            key={s.supplierId}
                            className={`p-3 ${o?.isLowest ? 'bg-emerald-50 font-bold text-emerald-700' : ''}`}
                          >
                            {o ? `${Number(o.unitPrice)} (${Number(o.lineTotal)})` : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-300 font-bold">
                    <td className="p-3">الإجمالي</td>
                    {comparison.suppliers.map((s) => (
                      <td
                        key={s.supplierId}
                        className={`p-3 ${s.supplierId === comparison.lowestTotalSupplierId ? 'text-emerald-700' : ''}`}
                      >
                        {s.total !== null ? Number(s.total) : '—'}
                        {selected.status === 'sent' && s.status === 'received' && (
                          <button
                            className={`${btn} mr-2 bg-emerald-600 text-white text-xs`}
                            disabled={busy}
                            onClick={() =>
                              void run(() =>
                                api.post(`/sales/rfqs/${selected.id}/award`, {
                                  supplierId: s.supplierId,
                                }),
                              )
                            }
                          >
                            اختيار
                          </button>
                        )}
                        {selected.awardedSupplierId === s.supplierId && (
                          <span className="mr-2 text-xs text-emerald-700">✔ اتختار</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RfqPage;
