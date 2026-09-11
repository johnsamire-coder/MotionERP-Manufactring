import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface JobOrderRecord { id: string; jobOrderNumber: string; }
interface ItemRecord { id: string; code: string; name: string; }
interface WarehouseRecord { id: string; code: string; name: string; }

interface MaterialRequestRecord {
  id: string;
  jobOrderReference: string;
  itemId: string;
  warehouseId: string;
  plannedQuantity: string;
  requestedQuantity: string;
  issuedQuantity: string;
  status: 'pending_review' | 'approved' | 'issued' | 'rejected';
  deviationReason?: string;
  createdAt: string;
}

export function MaterialPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [jobOrders, setJobOrders] = useState<JobOrderRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [requests, setRequests] = useState<MaterialRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedJO, setSelectedJO] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // New Request Form
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [plannedQty, setPlannedQty] = useState('10');
  const [requestedQty, setRequestedQty] = useState('10');

  // Review Modal Form
  const [deviationReasonInput, setDeviationReasonInput] = useState('');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [joRes, itemsRes, whRes, reqRes] = await Promise.all([
        api.get<{ jobOrders: JobOrderRecord[] }>('/sales/job-orders'),
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ warehouses: WarehouseRecord[] }>('/inventory/warehouses'),
        api.get<{ requests: MaterialRequestRecord[] }>('/production/material-requests'),
      ]);
      setJobOrders(joRes.jobOrders);
      setItems(itemsRes.items);
      setWarehouses(whRes.warehouses);
      setRequests(reqRes.requests);
      if (!selectedJO && joRes.jobOrders[0]) setSelectedJO(joRes.jobOrders[0].jobOrderNumber);
      if (!selectedItemId && itemsRes.items[0]) setSelectedItemId(itemsRes.items[0].id);
      if (!selectedWarehouseId && whRes.warehouses[0]) setSelectedWarehouseId(whRes.warehouses[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load material requests data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  async function handleCreateRequest(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/production/material-requests', {
        jobOrderReference: selectedJO,
        itemId: selectedItemId,
        warehouseId: selectedWarehouseId,
        plannedQuantity: plannedQty,
        requestedQuantity: requestedQty,
      });
      setShowForm(false);
      setFormSuccess(t('pages.material.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleApproveDeviation(requestId: string): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post(`/production/material-requests/${requestId}/approve-deviation`, {
        deviationReason: deviationReasonInput,
      });
      setShowReviewModal(null);
      setDeviationReasonInput('');
      setFormSuccess(t('pages.material.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleIssueStock(requestId: string): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post(`/production/material-requests/${requestId}/issue`, {});
      setFormSuccess(t('pages.material.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  const itemLabel = (id: string): string => items.find((i) => i.id === id)?.name ?? id;
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.material.eyebrow')}</span>
          <h1>{t('pages.material.title')}</h1>
          <p>{t('pages.material.description')}</p>
        </div>
      </div>

      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      {/* JO Selector & Actions */}
      <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ ...labelStyle, fontSize: 14, fontWeight: 'bold' }}>رقم أمر التشغيل (Job Order):</label>
          <select value={selectedJO} onChange={(e) => setSelectedJO(e.target.value)} style={{ ...inputStyle, minWidth: 200, fontSize: 14, fontWeight: 'bold' }}>
            {jobOrders.map((jo) => <option key={jo.id} value={jo.jobOrderNumber}>{jo.jobOrderNumber}</option>)}
          </select>
        </div>
        <button className="primary-button" onClick={() => setShowForm((v) => !v)}><b>+</b> {t('pages.material.form.newRequest')}</button>
      </div>

      {showForm && (
        <article className="panel module-panel" style={{ marginBottom: 20 }}>
          <form onSubmit={(e) => { void handleCreateRequest(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 0 10px' }}>
            <h3>{t('pages.material.form.newRequest')} — {selectedJO}</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.material.table.item')}</label>
                <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} style={{ ...inputStyle, minWidth: 200 }}>
                  {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>المخزن</label>
                <select value={selectedWarehouseId} onChange={(e) => setSelectedWarehouseId(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.material.form.qtyPlanned')}</label>
                <input type="number" min="0.01" step="any" value={plannedQty} onChange={(e) => setPlannedQty(e.target.value)} required style={{ ...inputStyle, width: 110 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.material.form.qtyRequested')}</label>
                <input type="number" min="0.01" step="any" value={requestedQty} onChange={(e) => setRequestedQty(e.target.value)} required style={{ ...inputStyle, width: 110 }} />
              </div>
            </div>

            {Number(requestedQty) > Number(plannedQty) && (
              <p style={{ fontSize: 13, color: '#b91c1c', background: '#fef2f2', padding: 10, borderRadius: 6, border: '1px solid #fca5a5' }}>
                ⚠️ <b>تنبيه انحراف:</b> الكمية المطلوبة ({requestedQty}) أكبر من الكمية المخططة في الـ BOM ({plannedQty}). هذا الطلب سيتوقف ماليًا ولن يُصرف تلقائيًا إلا بعد مراجعة سبب الانحراف واعتماده صراحةً.
              </p>
            )}

            <button type="submit" disabled={submitting} className="primary-button" style={{ alignSelf: 'flex-start' }}>{t('pages.material.form.save')}</button>
          </form>
        </article>
      )}

      {/* Material Requests Table */}
      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Stock Deductions</span>
            <h2>{t('pages.material.table.title')}</h2>
          </div>
        </div>

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.material.table.item')}</span>
            <span>{t('pages.material.table.planned')}</span>
            <span>{t('pages.material.table.requested')}</span>
            <span>{t('pages.material.table.issued')}</span>
            <span>{t('pages.material.table.status')}</span>
            <span>{t('pages.material.table.action')}</span>
          </div>

          {requests.filter((r) => r.jobOrderReference === selectedJO).length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.material.form.empty')}</p>
          )}

          {requests.filter((r) => r.jobOrderReference === selectedJO).map((req) => (
            <div className="placeholder-table__row" key={req.id}>
              <span><b>{itemLabel(req.itemId)}</b><small>{req.deviationReason ? `سبب الانحراف: ${req.deviationReason}` : ''}</small></span>
              <span>{req.plannedQuantity}</span>
              <span><b>{req.requestedQuantity}</b></span>
              <span>{req.issuedQuantity ?? '0'}</span>
              <span>
                <span className={`status status--${req.status === 'issued' ? 'success' : req.status === 'pending_review' ? 'warning' : 'neutral'}`}>
                  <i />{req.status}
                </span>
              </span>
              <span>
                {req.status === 'pending_review' && (
                  <button className="filter-button" style={{ fontSize: 12, padding: '4px 8px', color: '#b91c1c', borderColor: '#fca5a5' }} onClick={() => setShowReviewModal(req.id)}>
                    {t('pages.material.form.approveDeviation')}
                  </button>
                )}
                {req.status === 'approved' && (
                  <button className="primary-button" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => { void handleIssueStock(req.id); }}>
                    {t('pages.material.form.issueStock')}
                  </button>
                )}
                {req.status === 'issued' && <span style={{ fontSize: 12, color: '#166534', fontWeight: 'bold' }}>تم الصرف من المخزن ✓</span>}
              </span>
            </div>
          ))}
        </div>
      </article>

      {/* Modal for Approving Deviation */}
      {showReviewModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, width: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ color: '#b91c1c' }}>{t('pages.material.form.approveDeviation')}</h3>
            <label style={labelStyle}>{t('pages.material.form.reason')}</label>
            <textarea
              rows={3}
              value={deviationReasonInput}
              onChange={(e) => setDeviationReasonInput(e.target.value)}
              required
              placeholder="مثال: وجود فاقد أثناء قص الألواح بسبب عيب خامة..."
              style={{ ...inputStyle, width: '100%', resize: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="filter-button" onClick={() => setShowReviewModal(null)}>{t('pages.material.form.cancel')}</button>
              <button className="primary-button" disabled={submitting || !deviationReasonInput.trim()} onClick={() => { void handleApproveDeviation(showReviewModal); }}>
                اعتماد وتجاوز
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
