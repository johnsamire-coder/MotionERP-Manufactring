import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface JobOrderRecord { id: string; jobOrderNumber: string; }
interface DeliveryOrderRecord {
  id: string;
  jobOrderReference: string;
  deliveryNumber?: string;
  deliveryOrderNumber?: string;
  deliveryAddress?: string;
  driverName?: string;
  vehiclePlate?: string;
  status: string;
  createdAt: string;
}

interface DeliveryReceiptRecord {
  id: string;
  deliveryOrderId: string;
  receiptNumber: string;
  signedBy: string;
  createdAt: string;
}

export function DeliveryPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [jobOrders, setJobOrders] = useState<JobOrderRecord[]>([]);
  const [orders, setOrders] = useState<DeliveryOrderRecord[]>([]);
  const [receipts, setReceipts] = useState<DeliveryReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedJO, setSelectedJO] = useState('');
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Delivery Order Form
  const [driverNameInput, setDriverNameInput] = useState('السائق: محمد سعيد');
  const [vehiclePlateInput, setVehiclePlateInput] = useState('أ ب ج 456');

  // Receipt Form
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [signedByInput, setSignedByInput] = useState('م. سامح حسن (مهندس الموقع)');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const joRes = await api.get<{ jobOrders: JobOrderRecord[] }>('/sales/job-orders');
      setJobOrders(joRes.jobOrders ?? []);

      const activeJO = selectedJO || (joRes.jobOrders?.[0]?.jobOrderNumber ?? '');
      if (activeJO) {
        setSelectedJO(activeJO);
        await loadJoOrders(activeJO);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load delivery data');
    } finally {
      setLoading(false);
    }
  }

  async function loadJoOrders(joNumber: string): Promise<void> {
    try {
      const [ordersRes, recRes] = await Promise.all([
        api.get<any>(`/delivery/orders/job/${joNumber}`),
        api.get<any>('/delivery/receipts'),
      ]);
      const listOrders = Array.isArray(ordersRes) ? ordersRes : (ordersRes?.deliveryOrders ?? []);
      const listRecs = Array.isArray(recRes) ? recRes : (recRes?.deliveryReceipts ?? []);
      setOrders(listOrders);
      setReceipts(listRecs);
      if (!selectedOrderId && listOrders[0]) setSelectedOrderId(listOrders[0].id);
    } catch {
      setOrders([]);
      setReceipts([]);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  async function handleJoChange(joNumber: string): Promise<void> {
    setSelectedJO(joNumber);
    await loadJoOrders(joNumber);
  }

  async function handleCreateOrder(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/delivery/orders', {
        jobOrderReference: selectedJO,
        scheduledDate: new Date().toISOString(),
        driverName: driverNameInput,
        vehiclePlate: vehiclePlateInput,
      });
      setShowOrderForm(false);
      setFormSuccess(t('pages.delivery.form.success'));
      await loadJoOrders(selectedJO);
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleCreateReceipt(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/delivery/receipts', {
        deliveryOrderId: selectedOrderId,
        signedBy: signedByInput,
      });
      setShowReceiptForm(false);
      setFormSuccess(t('pages.delivery.form.success'));
      await loadJoOrders(selectedJO);
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  const getOrderNoById = (orderId: string): string => {
    const matched = orders.find((o) => o.id === orderId);
    return matched?.deliveryNumber ?? matched?.deliveryOrderNumber ?? 'DO-2026-0001';
  };

  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.delivery.eyebrow')}</span>
          <h1>{t('pages.delivery.title')}</h1>
          <p>{t('pages.delivery.description')}</p>
        </div>
      </div>

      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      {/* JO Selector */}
      <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <label style={{ ...labelStyle, fontSize: 14, fontWeight: 'bold' }}>أمر التشغيل (Job Order):</label>
        <select value={selectedJO} onChange={(e) => { void handleJoChange(e.target.value); }} style={{ ...inputStyle, minWidth: 220, fontSize: 14, fontWeight: 'bold' }}>
          {jobOrders.map((jo) => <option key={jo.id} value={jo.jobOrderNumber}>{jo.jobOrderNumber}</option>)}
        </select>
      </div>

      {/* 1. Delivery Orders Section */}
      <article className="panel module-panel" style={{ marginBottom: 20 }}>
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Logistics Dispatch</span>
            <h2>{t('pages.delivery.orders.title')}</h2>
          </div>
          <button className="primary-button" onClick={() => setShowOrderForm((v) => !v)}><b>+</b> {t('pages.delivery.orders.createOrder')}</button>
        </div>

        {showOrderForm && (
          <form onSubmit={(e) => { void handleCreateOrder(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>اسم السائق</label>
              <input value={driverNameInput} onChange={(e) => setDriverNameInput(e.target.value)} required style={{ ...inputStyle, minWidth: 200 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>رقم الشاحنة / اللوحة</label>
              <input value={vehiclePlateInput} onChange={(e) => setVehiclePlateInput(e.target.value)} required style={{ ...inputStyle, minWidth: 160 }} />
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.delivery.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.delivery.orders.orderNo')}</span>
            <span>اسم السائق</span>
            <span>رقم الشاحنة</span>
            <span>{t('pages.delivery.orders.status')}</span>
          </div>

          {orders.length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.delivery.form.empty')}</p>
          )}

          {orders.map((ord) => {
            const doNum = ord.deliveryNumber ?? ord.deliveryOrderNumber ?? 'DO-2026-0001';
            return (
              <div className="placeholder-table__row" key={ord.id}>
                <span><b>{doNum}</b></span>
                <span>{ord.driverName ?? 'السائق: محمد سعيد'}</span>
                <span><code>{ord.vehiclePlate ?? 'أ ب ج 456'}</code></span>
                <span><span className="status status--success"><i />{ord.status}</span></span>
              </div>
            );
          })}
        </div>
      </article>

      {/* 2. Site Receipts & Installation Protocols */}
      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Client Protocols</span>
            <h2>{t('pages.delivery.handover.title')}</h2>
          </div>
          <button className="filter-button" onClick={() => setShowReceiptForm((v) => !v)}><b>+</b> {t('pages.delivery.handover.addReceipt')}</button>
        </div>

        {showReceiptForm && (
          <form onSubmit={(e) => { void handleCreateReceipt(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>إذن التسليم الشاحن</label>
              <select value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)} style={{ ...inputStyle, minWidth: 220 }}>
                {orders.map((o) => <option key={o.id} value={o.id}>{o.deliveryNumber ?? o.deliveryOrderNumber}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>المستلم في الموقع (توقيع العميل)</label>
              <input value={signedByInput} onChange={(e) => setSignedByInput(e.target.value)} required style={{ ...inputStyle, minWidth: 240 }} />
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.delivery.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.delivery.handover.receiptNo')}</span>
            <span>إذن التسليم المرتبط</span>
            <span>توقيع ومستلم العميل</span>
            <span>تاريخ الاستلام</span>
          </div>

          {receipts.length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>لا توجد محاضر استلام مسجلة بعد</p>
          )}

          {receipts.map((rec) => (
            <div className="placeholder-table__row" key={rec.id}>
              <span><b>{rec.receiptNumber}</b></span>
              <span><code>{getOrderNoById(rec.deliveryOrderId)}</code></span>
              <span>{rec.signedBy}</span>
              <span><span className="status status--success"><i />{new Date(rec.createdAt).toLocaleDateString()} ✓</span></span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
