import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';

type BatchStatus = 'active' | 'expired' | 'quarantined' | 'recalled';
interface Batch {
  id: string;
  batchNumber: string;
  itemId: string;
  manufacturingDate: string | null;
  expiryDate: string | null;
  status: BatchStatus;
  notes: string | null;
}
interface Movement {
  id: string;
  warehouseId: string;
  movementType: string;
  purpose: string;
  quantity: string;
  movementDate: string;
  unitCost: string | null;
  totalValue: string | null;
  sourceModule: string | null;
  sourceId: string | null;
  note: string | null;
}
interface Balance {
  id: string;
  warehouseId: string;
  quantity: string;
  valuationRate: string;
  totalValue: string;
}
interface Serial {
  id: string;
  serialNo: string;
  warehouseId: string | null;
  status: string;
  deliveryOrderId: string | null;
  workOrderId: string | null;
}
interface Trace {
  batch: Batch;
  movements: Movement[];
  balances: Balance[];
  serials: Serial[];
}
interface Item {
  id: string;
  code: string;
  name: string;
  hasBatchNo: boolean;
}
interface Warehouse {
  id: string;
  code: string;
  name: string;
}

const STATUS_LABEL: Record<BatchStatus, string> = {
  active: 'نشط',
  expired: 'منتهي الصلاحية',
  quarantined: 'محجوز (حجر)',
  recalled: 'مستدعى',
};
const STATUS_TONE: Record<BatchStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  expired: 'bg-amber-100 text-amber-800',
  quarantined: 'bg-orange-100 text-orange-800',
  recalled: 'bg-rose-100 text-rose-700',
};
const MOVE_LABEL: Record<string, string> = {
  receipt: 'استلام',
  issue: 'صرف',
  transfer_in: 'تحويل وارد',
  transfer_out: 'تحويل صادر',
  adjustment: 'تسوية',
};
const SERIAL_LABEL: Record<string, string> = {
  active: 'في المخزن',
  delivered: 'اتسلّم للعميل',
  under_maintenance: 'في الصيانة',
  decommissioned: 'مكهّن',
};
const input = 'mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm';
const label = 'block text-xs font-bold text-slate-600';
const card = 'bg-white p-5 rounded-2xl shadow-sm border border-slate-200';
const btn = 'px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50';
const d = (v: string | null): string => (v ? new Date(v).toLocaleDateString('ar-EG') : '—');
const n = (v: string | null): string =>
  v == null ? '—' : Number(v).toLocaleString('ar-EG', { maximumFractionDigits: 4 });

function isExpired(b: Batch): boolean {
  return !!b.expiryDate && new Date(b.expiryDate).getTime() < Date.now();
}

/**
 * تتبع اللوطات والسيريال والاستدعاء، من البيانات الحقيقية للمخزون:
 * - اختار الصنف واللوط، وشوف كل حركاته (استلام، صرف للإنتاج، تحويل، تسليم)، ورصيده في كل مخزن،
 *   والسيريالات اللي منه ووصلت فين.
 * - حجز أو استدعاء اللوط بيمنع صرفه من أي مخزن لحد ما يرجع "نشط".
 * - وضع "الاستدعاء" بيعرض كل اللوطات المحجوزة والمستدعاة والمنتهية.
 */
export function BatchTracePage({ mode = 'trace' }: { mode?: 'trace' | 'recall' }): JSX.Element {
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [itemId, setItemId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(mode === 'recall' ? 'problem' : '');
  const [trace, setTrace] = useState<Trace | null>(null);
  const [serialHistory, setSerialHistory] = useState<{ serial: Serial; moves: Movement[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const whName = (id: string | null): string => {
    if (!id) return '—';
    const w = warehouses.find((x) => x.id === id);
    return w ? `${w.code} — ${w.name}` : id.slice(0, 8);
  };

  async function loadBatches(): Promise<void> {
    setError(null);
    try {
      const q = itemId ? `?itemId=${itemId}` : '';
      setBatches((await api.get<{ batches: Batch[] }>(`/inventory/batches${q}`)).batches);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تحميل اللوطات');
    }
  }

  useEffect(() => {
    void Promise.all([
      api.get<{ items: Item[] }>('/catalog/items?lang=ar'),
      api.get<{ warehouses: Warehouse[] }>('/inventory/warehouses'),
    ])
      .then(([i, w]) => {
        setItems(i.items);
        setWarehouses(w.warehouses);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'فشل تحميل الأصناف والمخازن'),
      );
  }, []);

  useEffect(() => {
    void loadBatches();
  }, [itemId]);

  async function openTrace(id: string): Promise<void> {
    setError(null);
    setMsg(null);
    setSerialHistory(null);
    try {
      setTrace(await api.get<Trace>(`/inventory/batches/${id}/trace`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تحميل تتبع اللوط');
    }
  }

  async function setStatus(status: BatchStatus): Promise<void> {
    if (!trace) return;
    if (
      status !== 'active' &&
      !window.confirm(
        `تأكيد: ${STATUS_LABEL[status]} اللوط ${trace.batch.batchNumber}؟ مش هيتصرف من أي مخزن بعد كده.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/inventory/batches/${trace.batch.id}/status`, { status });
      await Promise.all([openTrace(trace.batch.id), loadBatches()]);
      setMsg(`اللوط ${trace.batch.batchNumber} بقى: ${STATUS_LABEL[status]}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تغيير حالة اللوط');
    } finally {
      setBusy(false);
    }
  }

  async function openSerial(s: Serial): Promise<void> {
    try {
      const r = await api.get<{ movements: Movement[] }>(`/inventory/serials/${s.id}/movements`);
      setSerialHistory({ serial: s, moves: r.movements });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تحميل تاريخ السيريال');
    }
  }

  const shown = batches.filter((b) => {
    if (search.trim() && !b.batchNumber.toLowerCase().includes(search.trim().toLowerCase()))
      return false;
    if (statusFilter === 'problem') return b.status !== 'active' || isExpired(b);
    if (statusFilter) return b.status === statusFilter;
    return true;
  });

  const onHand = trace ? trace.balances.reduce((s, b) => s + Number(b.quantity), 0) : 0;
  const issuedOut = trace
    ? trace.movements
        .filter((m) => m.movementType === 'issue')
        .reduce((s, m) => s + Math.abs(Number(m.quantity)), 0)
    : 0;
  const delivered = trace ? trace.serials.filter((s) => s.status === 'delivered').length : 0;

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className={card}>
        <h1 className="text-2xl font-bold text-slate-900">
          {mode === 'recall' ? 'غرفة الاستدعاء' : 'تتبع اللوطات والسيريال'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {mode === 'recall'
            ? 'كل اللوطات المحجوزة والمستدعاة والمنتهية. افتح أي لوط تشوف راح فين (صرف، تحويل، تسليم لعميل) وكام فاضل في كل مخزن.'
            : 'اختار الصنف واللوط، وشوف كل حركاته ورصيده في كل مخزن والسيريالات اللي منه. الحجز أو الاستدعاء بيمنع صرفه.'}
        </p>
      </div>

      <div className={`${card} grid grid-cols-1 md:grid-cols-4 gap-3 items-end`}>
        <label className={label}>
          الصنف
          <select className={input} value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">كل الأصناف</option>
            {items
              .filter((i) => i.hasBatchNo)
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code} — {i.name}
                </option>
              ))}
          </select>
        </label>
        <label className={label}>
          رقم اللوط
          <input
            className={input}
            placeholder="بحث برقم اللوط"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className={label}>
          الحالة
          <select
            className={input}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">الكل</option>
            <option value="problem">محجوز / مستدعى / منتهي</option>
            {(Object.keys(STATUS_LABEL) as BatchStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <button
          className="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer bg-teal-600 hover:bg-teal-700 text-white"
          onClick={() => void loadBatches()}
        >
          تحديث
        </button>
      </div>

      {error && (
        <div className="text-sm bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-3">
          {error}
        </div>
      )}
      {msg && (
        <div className="text-sm bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl p-3">
          {msg}
        </div>
      )}

      <div className={`${card} overflow-x-auto`}>
        <h2 className="font-bold mb-3">اللوطات ({shown.length})</h2>
        {shown.length === 0 ? (
          <p className="text-sm text-slate-400">مفيش لوطات بالشروط دي</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-200">
                <th className="text-right py-2">رقم اللوط</th>
                <th className="text-right py-2">الصنف</th>
                <th className="text-right py-2">تاريخ الإنتاج</th>
                <th className="text-right py-2">تاريخ الانتهاء</th>
                <th className="text-right py-2">الحالة</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((b) => {
                const it = itemById.get(b.itemId);
                return (
                  <tr
                    key={b.id}
                    className={`border-b border-slate-100 ${trace?.batch.id === b.id ? 'bg-teal-50' : ''}`}
                  >
                    <td className="py-2 font-mono" dir="ltr">
                      {b.batchNumber}
                    </td>
                    <td className="py-2">{it ? `${it.code} — ${it.name}` : '—'}</td>
                    <td className="py-2">{d(b.manufacturingDate)}</td>
                    <td className={`py-2 ${isExpired(b) ? 'text-rose-600 font-bold' : ''}`}>
                      {d(b.expiryDate)}
                    </td>
                    <td className="py-2">
                      <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_TONE[b.status]}`}>
                        {STATUS_LABEL[b.status]}
                      </span>
                    </td>
                    <td className="py-2 text-left">
                      <button
                        className={`${btn} bg-slate-100 hover:bg-slate-200`}
                        onClick={() => void openTrace(b.id)}
                      >
                        تتبع
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {trace && (
        <div className="space-y-6">
          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">
                  اللوط <span dir="ltr">{trace.batch.batchNumber}</span>{' '}
                  <span
                    className={`text-xs rounded-full px-2 py-0.5 ${STATUS_TONE[trace.batch.status]}`}
                  >
                    {STATUS_LABEL[trace.batch.status]}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {itemById.get(trace.batch.itemId)?.name ?? ''} · الانتهاء:{' '}
                  {d(trace.batch.expiryDate)}
                </p>
              </div>
              <div className="flex gap-2">
                {trace.batch.status !== 'quarantined' && (
                  <button
                    disabled={busy}
                    className={`${btn} bg-orange-500 hover:bg-orange-600 text-white`}
                    onClick={() => void setStatus('quarantined')}
                  >
                    حجز اللوط
                  </button>
                )}
                {trace.batch.status !== 'recalled' && (
                  <button
                    disabled={busy}
                    className={`${btn} bg-rose-600 hover:bg-rose-700 text-white`}
                    onClick={() => void setStatus('recalled')}
                  >
                    استدعاء اللوط
                  </button>
                )}
                {trace.batch.status !== 'active' && (
                  <button
                    disabled={busy}
                    className={`${btn} bg-emerald-600 hover:bg-emerald-700 text-white`}
                    onClick={() => void setStatus('active')}
                  >
                    إرجاعه نشط
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-center">
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs text-slate-500">الرصيد الحالي</div>
                <div className="text-xl font-bold">{n(String(onHand))}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs text-slate-500">اتصرف (إنتاج / بيع)</div>
                <div className="text-xl font-bold">{n(String(issuedOut))}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs text-slate-500">عدد الحركات</div>
                <div className="text-xl font-bold">{trace.movements.length}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs text-slate-500">سيريالات اتسلّمت لعملاء</div>
                <div className="text-xl font-bold">
                  {delivered} / {trace.serials.length}
                </div>
              </div>
            </div>
          </div>

          <div className={`${card} overflow-x-auto`}>
            <h3 className="font-bold mb-3">الرصيد في المخازن</h3>
            {trace.balances.length === 0 ? (
              <p className="text-sm text-slate-400">مفيش رصيد</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-slate-200">
                    <th className="text-right py-2">المخزن</th>
                    <th className="text-right py-2">الكمية</th>
                    <th className="text-right py-2">سعر التقييم</th>
                    <th className="text-right py-2">القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {trace.balances.map((b) => (
                    <tr key={b.id} className="border-b border-slate-100">
                      <td className="py-2">{whName(b.warehouseId)}</td>
                      <td className="py-2">{n(b.quantity)}</td>
                      <td className="py-2">{n(b.valuationRate)}</td>
                      <td className="py-2">{n(b.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={`${card} overflow-x-auto`}>
            <h3 className="font-bold mb-3">كل حركات اللوط (من الاستلام لحد النهاية)</h3>
            {trace.movements.length === 0 ? (
              <p className="text-sm text-slate-400">مفيش حركات</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-slate-200">
                    <th className="text-right py-2">التاريخ</th>
                    <th className="text-right py-2">النوع</th>
                    <th className="text-right py-2">المخزن</th>
                    <th className="text-right py-2">الكمية</th>
                    <th className="text-right py-2">القيمة</th>
                    <th className="text-right py-2">المستند المصدر</th>
                  </tr>
                </thead>
                <tbody>
                  {[...trace.movements]
                    .sort((a, b) => a.movementDate.localeCompare(b.movementDate))
                    .map((m) => (
                      <tr key={m.id} className="border-b border-slate-100">
                        <td className="py-2">{d(m.movementDate)}</td>
                        <td className="py-2">{MOVE_LABEL[m.movementType] ?? m.movementType}</td>
                        <td className="py-2">{whName(m.warehouseId)}</td>
                        <td className="py-2">{n(m.quantity)}</td>
                        <td className="py-2">{n(m.totalValue)}</td>
                        <td className="py-2 text-xs text-slate-500" dir="ltr">
                          {m.sourceModule
                            ? `${m.sourceModule} ${m.sourceId?.slice(0, 8) ?? ''}`
                            : (m.note ?? 'يدوي')}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={`${card} overflow-x-auto`}>
            <h3 className="font-bold mb-3">السيريالات من اللوط ده</h3>
            {trace.serials.length === 0 ? (
              <p className="text-sm text-slate-400">اللوط ده ملوش سيريالات</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-slate-200">
                    <th className="text-right py-2">السيريال</th>
                    <th className="text-right py-2">الحالة</th>
                    <th className="text-right py-2">المخزن</th>
                    <th className="text-right py-2">إذن التسليم</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {trace.serials.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100">
                      <td className="py-2 font-mono" dir="ltr">
                        {s.serialNo}
                      </td>
                      <td className="py-2">{SERIAL_LABEL[s.status] ?? s.status}</td>
                      <td className="py-2">{whName(s.warehouseId)}</td>
                      <td className="py-2 font-mono text-xs" dir="ltr">
                        {s.deliveryOrderId?.slice(0, 8) ?? '—'}
                      </td>
                      <td className="py-2 text-left">
                        <button
                          className={`${btn} bg-slate-100 hover:bg-slate-200`}
                          onClick={() => void openSerial(s)}
                        >
                          تاريخ السيريال
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {serialHistory && (
              <div className="mt-4 border-t border-slate-200 pt-3">
                <h4 className="text-sm font-bold mb-2">
                  تاريخ السيريال <span dir="ltr">{serialHistory.serial.serialNo}</span>
                </h4>
                {serialHistory.moves.length === 0 ? (
                  <p className="text-sm text-slate-400">مفيش حركات مسجلة للسيريال ده</p>
                ) : (
                  <ul className="text-sm space-y-1">
                    {serialHistory.moves.map((m) => (
                      <li key={m.id}>
                        {d(m.movementDate)} — {MOVE_LABEL[m.movementType] ?? m.movementType} —{' '}
                        {whName(m.warehouseId)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BatchTracePage;
