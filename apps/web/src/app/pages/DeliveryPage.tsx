import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface JobOrderRecord { id: string; jobOrderNumber: string; customerId?: string; }
interface DeliveryOrderRecord {
  id: string;
  jobOrderReference: string;
  deliveryOrderNumber: string;
  deliveryAddress: string;
  driverInfo?: string;
  status: string;
  createdAt: string;
}

interface DeliveryReceiptRecord {
  id: string;
  deliveryOrderNumber: string;
  receiptNumber: string;
  receivedBy: string;
  status: string;
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
  const [addressInput, setAddressInput] = useState('الموقع الرئيسي للعميل - القاهرة');
  const [driverInput, setDriverInput] = useState('السائق: أحمد علي - شاحنة رقم أ ب ج 123');

  // Receipt Form
  const [selectedOrderNo, setSelectedOrderNo] = useState('');
  const [receivedByInput, setReceivedByInput] = useState('م. سامح حسن (مهندس الموقع)');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [joRes, ordersRes] = await Promise.all([
        api.get<{ jobOrders: JobOrderRecord[] }>('/sales/job-orders'),
        api.get<{ orders: DeliveryOrderRecord[] }>('/delivery/orders'),
      ]);
      setJobOrders(joRes.jobOrders);
      setOrders(ordersRes.orders);
      if (!selectedJO && joRes.jobOrders[0]) setSelectedJO(joRes.jobOrders[0].jobOrderNumber);
      if (!selectedOrderNo && ordersRes.orders[0]) setSelectedOrderNo(ordersRes.orders[0].deliveryOrderNumber);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load delivery data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  async function handleCreateOrder(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/delivery/orders', {
        jobOrderReference: selectedJO,
        deliveryAddress: addressInput,
        driverInfo: driverInput || undefined,
      });
      setShowOrderForm(false);
      setFormSuccess(t('pages.delivery.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleCreateReceipt(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/delivery/receipts', {
        deliveryOrderNumber: selectedOrderNo,
        receivedBy: receivedByInput,
      });
      setShowReceiptForm(false);
      setFormSuccess(t('pages.delivery.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

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
        <select value={selectedJO} onChange={(e) => setSelectedJO(e.target.value)} style={{ ...inputStyle, minWidth: 220, fontSize: 14, fontWeight: 'bold' }}>
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
              <label style={labelStyle}>{t('pages.delivery.orders.address')}</label>
              <input value={addressInput} onChange={(e) => setAddressInput(e.target.value)} required style={{ ...inputStyle, minWidth: 240 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.delivery.orders.driver')}</label>
              <input value={driverInput} onChange={(e) => setDriverInput(e.target.value)} style={{ ...inputStyle, minWidth: 240 }} />
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.delivery.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.delivery.orders.orderNo')}</span>
            <span>{t('pages.delivery.orders.address')}</span>
            <span>{t('pages.delivery.orders.driver')}</span>
            <span>{t('pages.delivery.orders.status')}</span>
          </div>

          {orders.filter((o) => o.jobOrderReference === selectedJO).length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.delivery.form.empty')}</p>
          )}

          {orders.filter((o) => o.jobOrderReference === selectedJO).map((ord) => (
            <div className="placeholder-table__row" key={ord.id}>
              <span><b>{ord.deliveryOrderNumber}</b></span>
              <span>{ord.deliveryAddress}</span>
              <span>{ord.driverInfo ?? '—'}</span>
              <span><span className="status status--success"><i />{ord.status}</span></span>
            </div>
          ))}
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
              <label style={labelStyle}>{t('pages.delivery.orders.orderNo')}</label>
              <select value={selectedOrderNo} onChange={(e) => setSelectedOrderNo(e.target.value)} style={{ ...inputStyle, minWidth: 200 }}>
                {orders.map((o) => <option key={o.id} value={o.deliveryOrderNumber}>{o.deliveryOrderNumber}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>المستلم في الموقع</label>
              <input value={receivedByInput} onChange={(e) => setReceivedByInput(e.target.value)} required style={{ ...inputStyle, minWidth: 240 }} />
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.delivery.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.delivery.handover.receiptNo')}</span>
            <span>رقم إذن التسليم</span>
            <span>اسم المستلم التابع للعميل</span>
            <span>تاريخ الاستلام</span>
          </div>
          <div className="placeholder-table__row">
            <span><b>REC-2026-0001</b></span>
            <span><code>DO-20260911-0001</code></span>
            <span>م. سامح حسن (مهندس الموقع)</span>
            <span><span className="status status--success"><i />مكتمل ومستلم ✓</span></span>
          </div>
        </div>
      </article>
    </section>
  );
}
