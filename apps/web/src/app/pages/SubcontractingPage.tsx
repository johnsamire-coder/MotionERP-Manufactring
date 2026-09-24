import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';

interface Option {
  id: string;
  label: string;
}
interface OrgTreeNode {
  id: string;
  name: string;
  nodeType: string;
  children: OrgTreeNode[];
}
interface SubcontractingItem {
  id: string;
  itemId: string;
  warehouseId: string;
  quantity: string;
  rawMaterialCost: string;
  serviceRate: string;
  newValuationRate: string;
  receivedQty: string;
}
interface SubcontractingOrder {
  id: string;
  voucherNumber: string;
  orgNodeId: string;
  supplierId: string;
  postingDate: string;
  totalServiceCost: string;
  status: 'draft' | 'posted' | 'partially_received' | 'completed' | 'cancelled';
  purchaseInvoiceId: string | null;
  notes: string | null;
  items: SubcontractingItem[];
}
interface LineInput {
  itemId: string;
  warehouseId: string;
  quantity: string;
  rawMaterialCost: string;
  serviceRate: string;
}
interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  grandTotal: string;
  status: string;
}

const STATUS: Record<SubcontractingOrder['status'], { label: string; tone: string }> = {
  draft: { label: 'مسودة', tone: 'bg-slate-100 text-slate-700' },
  posted: { label: 'مرحّل — في انتظار الاستلام', tone: 'bg-amber-100 text-amber-800' },
  partially_received: { label: 'مستلم جزئيًا', tone: 'bg-sky-100 text-sky-800' },
  completed: { label: 'مكتمل', tone: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'ملغي', tone: 'bg-rose-100 text-rose-700' },
};
const input = 'mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm';
const label = 'block text-xs font-bold text-slate-600';
const button =
  'px-4 py-2 rounded-lg text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const emptyLine = (): LineInput => ({
  itemId: '',
  warehouseId: '',
  quantity: '1',
  rawMaterialCost: '0',
  serviceRate: '0',
});
const money = (v: number | string): string =>
  Number(v).toLocaleString('ar-EG', { maximumFractionDigits: 2 });
const message = (err: unknown, fallback: string): string =>
  err instanceof ApiError ? err.message : fallback;

function companies(nodes: OrgTreeNode[]): Option[] {
  return nodes.flatMap((n) => [
    ...(n.nodeType === 'legal_company' ? [{ id: n.id, label: n.name }] : []),
    ...companies(n.children),
  ]);
}

/**
 * التصنيع بالباطن (بند 45): أمر للمقاول بالخامة اللي معاه وسعر المصنعية، ترحيله بيثبت
 * المصنعية ويصرف الخامة من عهدته، والاستلام بيرجّع المنتج بالتكلفة المدمجة، وبعدين ربط فاتورته.
 */
export function SubcontractingPage(): JSX.Element {
  const [orders, setOrders] = useState<SubcontractingOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [items, setItems] = useState<Option[]>([]);
  const [warehouses, setWarehouses] = useState<Option[]>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [orgs, setOrgs] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [orgNodeId, setOrgNodeId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [serviceAccountId, setServiceAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineInput[]>([emptyLine()]);

  const [receiving, setReceiving] = useState<SubcontractingOrder | null>(null);
  const [receiptWarehouseId, setReceiptWarehouseId] = useState('');
  const [receiptQty, setReceiptQty] = useState<Record<string, string>>({});

  const [invoicing, setInvoicing] = useState<SubcontractingOrder | null>(null);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [invoiceId, setInvoiceId] = useState('');

  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of [...suppliers, ...items, ...warehouses]) map.set(o.id, o.label);
    return (id: string): string => map.get(id) ?? id.slice(0, 8);
  }, [suppliers, items, warehouses]);

  async function loadOrders(): Promise<void> {
    const res = await api.get<{ subcontractingOrders: SubcontractingOrder[] }>(
      '/production-ops/subcontracting',
    );
    setOrders(
      [...res.subcontractingOrders].sort((a, b) => b.voucherNumber.localeCompare(a.voucherNumber)),
    );
  }

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const [sup, itm, wh, acc, tree] = await Promise.all([
          api.get<{ suppliers: Array<{ id: string; code: string; name: string }> }>(
            '/crm/suppliers',
          ),
          api.get<{ items: Array<{ id: string; code: string; name: string }> }>(
            '/catalog/items?lang=ar',
          ),
          api.get<{ warehouses: Array<{ id: string; code: string; name: string }> }>(
            '/inventory/warehouses',
          ),
          api.get<{
            accounts: Array<{ id: string; code: string; name: string; isLeaf: boolean }>;
          }>('/accounting/accounts'),
          api.get<{ tree: OrgTreeNode[] }>('/organization/tree'),
        ]);
        setSuppliers(sup.suppliers.map((s) => ({ id: s.id, label: `${s.code} — ${s.name}` })));
        setItems(itm.items.map((i) => ({ id: i.id, label: `${i.code} — ${i.name}` })));
        setWarehouses(wh.warehouses.map((w) => ({ id: w.id, label: `${w.code} — ${w.name}` })));
        setAccounts(
          acc.accounts
            .filter((a) => a.isLeaf)
            .map((a) => ({ id: a.id, label: `${a.code} — ${a.name}` })),
        );
        const cos = companies(tree.tree);
        setOrgs(cos);
        if (cos[0]) setOrgNodeId(cos[0].id);
        await loadOrders();
      } catch (err) {
        setError(message(err, 'فشل تحميل البيانات'));
      }
    })();
  }, []);

  async function run(action: () => Promise<string>, fallback: string): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await action());
      await loadOrders();
    } catch (err) {
      setError(message(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  const totalService = lines.reduce(
    (s, l) => s + Number(l.quantity || 0) * Number(l.serviceRate || 0),
    0,
  );
  const updateLine = (i: number, field: keyof LineInput, value: string): void =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));

  const create = (): Promise<void> =>
    run(async () => {
      const res = await api.post<{ subcontractingOrder: SubcontractingOrder }>(
        '/production-ops/subcontracting',
        {
          orgNodeId,
          supplierId,
          serviceAccountId,
          totalServiceCost: totalService.toFixed(4),
          notes: notes || undefined,
          items: lines,
        },
      );
      setShowForm(false);
      setLines([emptyLine()]);
      setNotes('');
      return `اتعمل الأمر ${res.subcontractingOrder.voucherNumber} كمسودة`;
    }, 'فشل إنشاء الأمر');

  const post = (o: SubcontractingOrder): Promise<void> =>
    run(async () => {
      await api.post(`/production-ops/subcontracting/${o.id}/post`, {});
      return `اترحّل ${o.voucherNumber}: المصنعية اتسجلت والخامة اتصرفت من عهدة المقاول`;
    }, 'فشل الترحيل');

  const cancel = (o: SubcontractingOrder): Promise<void> =>
    run(async () => {
      await api.post(`/production-ops/subcontracting/${o.id}/cancel`, {});
      return `اتلغى ${o.voucherNumber}`;
    }, 'فشل الإلغاء');

  function openReceive(o: SubcontractingOrder): void {
    setInvoicing(null);
    setReceiving(o);
    setReceiptWarehouseId('');
    setReceiptQty(
      Object.fromEntries(
        o.items.map((i) => [i.id, String(Number(i.quantity) - Number(i.receivedQty))]),
      ),
    );
  }

  const receive = (): Promise<void> =>
    run(async () => {
      if (!receiving) return '';
      const wanted = receiving.items
        .map((i) => ({ subcontractingItemId: i.id, quantity: receiptQty[i.id] ?? '0' }))
        .filter((l) => Number(l.quantity) > 0);
      const res = await api.post<{ subcontractingOrder: SubcontractingOrder }>(
        `/production-ops/subcontracting/${receiving.id}/receive`,
        { warehouseId: receiptWarehouseId, lines: wanted },
      );
      setReceiving(null);
      return `اتسلّم على ${receiving.voucherNumber} — الحالة: ${STATUS[res.subcontractingOrder.status].label}`;
    }, 'فشل الاستلام');

  async function openInvoice(o: SubcontractingOrder): Promise<void> {
    setReceiving(null);
    setInvoicing(o);
    setInvoiceId('');
    try {
      const res = await api.get<{ purchaseInvoices: PurchaseInvoice[] }>(
        '/finance/purchase-invoices',
      );
      setInvoices(
        res.purchaseInvoices.filter(
          (p) => p.supplierId === o.supplierId && p.status !== 'cancelled',
        ),
      );
    } catch (err) {
      setError(message(err, 'فشل تحميل فواتير المورد'));
    }
  }

  const linkInvoice = (): Promise<void> =>
    run(async () => {
      if (!invoicing) return '';
      await api.post(`/production-ops/subcontracting/${invoicing.id}/invoice`, {
        purchaseInvoiceId: invoiceId,
      });
      setInvoicing(null);
      return `اتربطت فاتورة المقاول بـ ${invoicing.voucherNumber}`;
    }, 'فشل ربط الفاتورة');

  const canCreate =
    orgNodeId &&
    supplierId &&
    serviceAccountId &&
    totalService > 0 &&
    lines.every((l) => l.itemId && l.warehouseId && Number(l.quantity) > 0);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">التصنيع بالباطن</h1>
          <p className="text-sm text-slate-500 mt-1">
            ابعت الخامة لمخزن عهدة المقاول، واعمل الأمر، ورحّله (المصنعية بتتسجل والخامة بتتصرف من
            العهدة)، وبعدين استلم المنتج بالتكلفة المدمجة واربط فاتورة المقاول.
          </p>
        </div>
        <button
          className={`${button} bg-teal-600 hover:bg-teal-700 text-white`}
          onClick={() => setShowForm(!showForm)}
        >
          + أمر جديد
        </button>
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

      {showForm && (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-lg font-bold">أمر تصنيع بالباطن جديد</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className={label}>
              الشركة
              <select
                className={input}
                value={orgNodeId}
                onChange={(e) => setOrgNodeId(e.target.value)}
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              المقاول (المورد)
              <select
                className={input}
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">— اختر —</option>
                {suppliers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              حساب استحقاق المصنعية
              <select
                className={input}
                value={serviceAccountId}
                onChange={(e) => setServiceAccountId(e.target.value)}
              >
                <option value="">— اختر —</option>
                {accounts.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-slate-200">
                  <th className="text-right py-2">الصنف</th>
                  <th className="text-right py-2">مخزن عهدة المقاول</th>
                  <th className="text-right py-2">الكمية</th>
                  <th className="text-right py-2">تكلفة الخامة المرسلة (إجمالي)</th>
                  <th className="text-right py-2">مصنعية القطعة</th>
                  <th className="text-right py-2">التكلفة الجديدة للقطعة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const qty = Number(l.quantity) || 0;
                  const rate =
                    qty > 0 ? Number(l.rawMaterialCost || 0) / qty + Number(l.serviceRate || 0) : 0;
                  return (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1 pl-2">
                        <select
                          aria-label={`صنف ${i + 1}`}
                          className={input}
                          value={l.itemId}
                          onChange={(e) => updateLine(i, 'itemId', e.target.value)}
                        >
                          <option value="">— اختر —</option>
                          {items.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 pl-2">
                        <select
                          aria-label={`مخزن العهدة ${i + 1}`}
                          className={input}
                          value={l.warehouseId}
                          onChange={(e) => updateLine(i, 'warehouseId', e.target.value)}
                        >
                          <option value="">— اختر —</option>
                          {warehouses.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 pl-2 w-24">
                        <input
                          aria-label={`كمية ${i + 1}`}
                          className={input}
                          value={l.quantity}
                          onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                        />
                      </td>
                      <td className="py-1 pl-2 w-40">
                        <input
                          aria-label={`تكلفة الخامة ${i + 1}`}
                          className={input}
                          value={l.rawMaterialCost}
                          onChange={(e) => updateLine(i, 'rawMaterialCost', e.target.value)}
                        />
                      </td>
                      <td className="py-1 pl-2 w-32">
                        <input
                          aria-label={`مصنعية ${i + 1}`}
                          className={input}
                          value={l.serviceRate}
                          onChange={(e) => updateLine(i, 'serviceRate', e.target.value)}
                        />
                      </td>
                      <td className="py-1 font-bold">{money(rate)}</td>
                      <td className="py-1">
                        {lines.length > 1 && (
                          <button
                            className="text-rose-600 text-xs underline cursor-pointer"
                            onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                          >
                            حذف
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col md:flex-row gap-3 md:items-end justify-between">
            <button
              className={`${button} border border-slate-300 hover:bg-slate-100`}
              onClick={() => setLines([...lines, emptyLine()])}
            >
              + صنف
            </button>
            <label className={`${label} flex-1`}>
              ملاحظات
              <input className={input} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <div className="text-sm">
              إجمالي المصنعية: <b>{money(totalService)} ج.م</b>
            </div>
            <button
              className={`${button} bg-teal-600 hover:bg-teal-700 text-white`}
              disabled={busy || !canCreate}
              onClick={() => void create()}
            >
              حفظ كمسودة
            </button>
          </div>
        </div>
      )}

      {receiving && (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-sky-300 space-y-4">
          <h2 className="text-lg font-bold">استلام من المقاول — {receiving.voucherNumber}</h2>
          <label className={`${label} md:w-96`}>
            مخزن الاستلام
            <select
              className={input}
              value={receiptWarehouseId}
              onChange={(e) => setReceiptWarehouseId(e.target.value)}
            >
              <option value="">— اختر —</option>
              {warehouses.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-200">
                <th className="text-right py-2">الصنف</th>
                <th className="text-right py-2">المطلوب</th>
                <th className="text-right py-2">اتسلّم</th>
                <th className="text-right py-2">الكمية المستلمة دلوقتي</th>
                <th className="text-right py-2">سعر الاستلام</th>
              </tr>
            </thead>
            <tbody>
              {receiving.items.map((i) => (
                <tr key={i.id} className="border-b border-slate-100">
                  <td className="py-2">{nameOf(i.itemId)}</td>
                  <td className="py-2">{Number(i.quantity)}</td>
                  <td className="py-2">{Number(i.receivedQty)}</td>
                  <td className="py-2 w-40">
                    <input
                      aria-label={`استلام ${nameOf(i.itemId)}`}
                      className={input}
                      value={receiptQty[i.id] ?? '0'}
                      onChange={(e) => setReceiptQty({ ...receiptQty, [i.id]: e.target.value })}
                    />
                  </td>
                  <td className="py-2">{money(i.newValuationRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2">
            <button
              className={`${button} bg-sky-600 hover:bg-sky-700 text-white`}
              disabled={busy || !receiptWarehouseId}
              onClick={() => void receive()}
            >
              تأكيد الاستلام
            </button>
            <button
              className={`${button} border border-slate-300 hover:bg-slate-100`}
              onClick={() => setReceiving(null)}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {invoicing && (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-violet-300 space-y-4">
          <h2 className="text-lg font-bold">ربط فاتورة المقاول — {invoicing.voucherNumber}</h2>
          {invoices.length === 0 ? (
            <p className="text-sm text-slate-500">
              مفيش فواتير مشتريات للمقاول ده. سجّل فاتورته في المشتريات الأول.
            </p>
          ) : (
            <label className={`${label} md:w-96`}>
              فاتورة المشتريات
              <select
                className={input}
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
              >
                <option value="">— اختر —</option>
                {invoices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.invoiceNumber} — {money(p.grandTotal)} ج.م
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex gap-2">
            <button
              className={`${button} bg-violet-600 hover:bg-violet-700 text-white`}
              disabled={busy || !invoiceId}
              onClick={() => void linkInvoice()}
            >
              ربط
            </button>
            <button
              className={`${button} border border-slate-300 hover:bg-slate-100`}
              onClick={() => setInvoicing(null)}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold mb-3">الأوامر ({orders.length})</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-slate-400">مفيش أوامر لسه</p>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const ordered = o.items.reduce((s, i) => s + Number(i.quantity), 0);
              const received = o.items.reduce((s, i) => s + Number(i.receivedQty), 0);
              return (
                <div
                  key={o.id}
                  className="border border-slate-200 rounded-xl p-4 text-sm space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <b>{o.voucherNumber}</b>
                      <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS[o.status].tone}`}>
                        {STATUS[o.status].label}
                      </span>
                      {o.purchaseInvoiceId && (
                        <span className="text-xs rounded-full px-2 py-0.5 bg-violet-100 text-violet-800">
                          فاتورة مربوطة
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {o.status === 'draft' && (
                        <>
                          <button
                            className={`${button} bg-slate-800 hover:bg-slate-900 text-white`}
                            disabled={busy}
                            onClick={() => void post(o)}
                          >
                            ترحيل
                          </button>
                          <button
                            className={`${button} border border-rose-300 text-rose-700 hover:bg-rose-50`}
                            disabled={busy}
                            onClick={() => void cancel(o)}
                          >
                            إلغاء
                          </button>
                        </>
                      )}
                      {(o.status === 'posted' || o.status === 'partially_received') && (
                        <button
                          className={`${button} bg-sky-600 hover:bg-sky-700 text-white`}
                          disabled={busy}
                          onClick={() => openReceive(o)}
                        >
                          استلام
                        </button>
                      )}
                      {o.status !== 'draft' && o.status !== 'cancelled' && !o.purchaseInvoiceId && (
                        <button
                          className={`${button} border border-violet-300 text-violet-700 hover:bg-violet-50`}
                          disabled={busy}
                          onClick={() => void openInvoice(o)}
                        >
                          ربط الفاتورة
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-slate-500">
                    {nameOf(o.supplierId)} · مصنعية {money(o.totalServiceCost)} ج.م · اتسلّم{' '}
                    {received} من {ordered}
                  </div>
                  <div className="text-xs text-slate-500">
                    {o.items
                      .map(
                        (i) =>
                          `${nameOf(i.itemId)}: ${Number(i.quantity)} × ${money(i.newValuationRate)}`,
                      )
                      .join(' · ')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SubcontractingPage;
