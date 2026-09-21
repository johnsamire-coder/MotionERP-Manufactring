import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface ItemRecord { id: string; code: string; name: string; }
interface WarehouseRecord { id: string; code: string; name: string; }
interface StockBalanceRecord {
  itemId: string;
  warehouseId: string;
  onHand: string;
  reserved: string;
  available?: string;
  averageCost?: string;
  totalValue?: string;
}

export function StockReconciliationPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [balances, setBalances] = useState<StockBalanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [itemId, setItemId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [physicalQty, setPhysicalQty] = useState('0');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemRes, whRes, balRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>('/catalog/items?lang=' + lang).catch(() => ({ items: [] })),
        api.get<{ warehouses: WarehouseRecord[] }>('/inventory/warehouses').catch(() => ({ warehouses: [] })),
        api.get<{ balances: StockBalanceRecord[] }>('/inventory/balances').catch(() => ({ balances: [] })),
      ]);
      setItems(itemRes.items ?? []);
      setWarehouses(whRes.warehouses ?? []);
      setBalances(balRes.balances ?? []);

      if (itemRes.items?.[0] && !itemId) setItemId(itemRes.items[0].id);
      if (whRes.warehouses?.[0] && !warehouseId) setWarehouseId(whRes.warehouses[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تحميل بيانات الجرد والمخازن');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  const currentBalance = balances.find((b) => b.itemId === itemId && b.warehouseId === warehouseId);
  const currentQty = currentBalance ? parseFloat(currentBalance.onHand) : 0;
  const currentAvg = currentBalance?.averageCost ? parseFloat(currentBalance.averageCost) : 0;
  const diff = parseFloat(physicalQty || '0') - currentQty;
  const diffValue = Math.abs(diff) * currentAvg;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    if (Math.abs(diff) < 0.000001) {
      setError('الرصيد الفعلي مطابق تماماً للرصيد الدفتري، لا يوجد فرق للتسوية');
      setSubmitting(false);
      return;
    }

    try {
      const res = await api.post<any>('/inventory/reconcile', {
        itemId,
        warehouseId,
        physicalQty,
        note: note.trim() || undefined,
      });

      const typeLabel = res.adjustmentType === 'surplus' ? 'زيادة مخزنية (+)' : 'عجز مخزني (-)';
      setSuccess(`تم تسوية الجرد بنجاح وتحديث الرصيد إلى ${physicalQty} (${typeLabel}) وترحيل القيد المحاسبي بالدفاتر!`);
      setShowForm(false);
      setNote('');
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تنفيذ التسوية المخزنية');
    } finally {
      setSubmitting(false);
    }
  }

  const itemLabel = (id: string): string => items.find((it) => it.id === id)?.name ?? id;
  const whLabel = (id: string): string => warehouses.find((w) => w.id === id)?.name ?? id;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">الرقابة وضبط المخزون</span>
          <h1>الجرد الفعلي وتسويات المخازن (Stock Reconciliation)</h1>
          <p>مطابقة الرصيد الفعلي في الورش والمستودعات مع الأرصدة الدفترية وترحيل فروق العجز والزيادة محاسبياً تلقائياً</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'إلغاء' : '+ تسوية جرد جديدة'}
        </button>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert alert--success" style={{ marginBottom: 16 }}>{success}</div>}

      {showForm && (
        <form className="form-card" onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <h3>تسجيل تسوية جرد فعلي لمخزن</h3>
          <div className="form-grid">
            <label>الصنف المراد جرده
              <select value={itemId} onChange={(e) => setItemId(e.target.value)} required>
                {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
              </select>
            </label>
            <label>المخزن
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
                {warehouses.map((wh) => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, background: '#f8fafc', padding: 18, borderRadius: 8, marginTop: 16, border: '1px solid #e2e8f0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 'bold' }}>الرصيد الدفتري الحالي</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#0f172a', marginTop: 4 }}>{currentQty.toFixed(2)}</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#1e40af', fontWeight: 'bold' }}>العدد الفعلي بالجرد (Physical)</div>
              <input
                type="number"
                step="any"
                min="0"
                value={physicalQty}
                onChange={(e) => setPhysicalQty(e.target.value)}
                style={{ width: '100%', textAlign: 'center', fontSize: 22, fontWeight: 'bold', marginTop: 4, padding: '4px 8px', borderRadius: 6, border: '2px solid #3b82f6' }}
                required
              />
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 'bold' }}>فرق الجرد (كمية)</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 4, color: diff > 0 ? '#166534' : diff < 0 ? '#b91c1c' : '#64748b' }}>
                {diff > 0 ? `+${diff.toFixed(2)} (زيادة)` : diff < 0 ? `${diff.toFixed(2)} (عجز)` : '0.00 (متطابق)'}
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 'bold' }}>القيمة المالية للتسوية</div>
              <div style={{ fontSize: 22, fontWeight: 'bold', marginTop: 4, color: diff > 0 ? '#166534' : diff < 0 ? '#b91c1c' : '#64748b' }}>
                {diffValue.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label>سبب وتفاصيل تسوية الجرد
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: جرد ربع سنوي معتمد من لجنة الجرد للورشة" />
            </label>
          </div>

          <div className="form-actions" style={{ marginTop: 16 }}>
            <button type="submit" disabled={submitting} className="btn btn--primary">
              {submitting ? 'جاري الترحيل والتسوية...' : 'اعتماد وترحيل تسوية الجرد في الدفاتر ⚡'}
            </button>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>إلغاء</button>
          </div>
        </form>
      )}

      {/* Current Balances Table */}
      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">الأرصدة الحالية بالمخازن</span>
            <h2>أرصدة الأصناف الدفترية والمتاحة</h2>
          </div>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>الصنف</th>
                <th>المخزن</th>
                <th>الرصيد الفعلي بالدفاتر (On Hand)</th>
                <th>المحجوز لأوامر الشغل (Reserved)</th>
                <th>المتاح للصرف (Available)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5}>جاري التحميل...</td></tr>
              ) : balances.length === 0 ? (
                <tr><td colSpan={5}>لا توجد أرصدة مسجلة في المخازن</td></tr>
              ) : (
                balances.map((b, idx) => {
                  const avail = b.available !== undefined ? Number(b.available) : (Number(b.onHand) - Number(b.reserved));
                  return (
                    <tr key={idx}>
                      <td><b>{itemLabel(b.itemId)}</b></td>
                      <td>{whLabel(b.warehouseId)}</td>
                      <td>{Number(b.onHand).toLocaleString('ar-EG')}</td>
                      <td style={{ color: '#b45309' }}>{Number(b.reserved).toLocaleString('ar-EG')}</td>
                      <td><b style={{ color: '#166534' }}>{avail.toLocaleString('ar-EG')}</b></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}