import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface CustomerRecord { id: string; code: string; name: string; status: string; phone?: string; }
interface ItemRecord { id: string; code: string; name: string; }
interface QuotationLineInput { itemId: string; quantity: string; unitPrice: string; }
interface QuotationRecord {
  id: string;
  quotationNumber: string;
  direction: 'outgoing' | 'incoming';
  customerId?: string;
  supplierId?: string;
  status: string;
  totalAmount: string;
  currency: string;
  customerPoReference?: string;
}
interface JobOrderRecord {
  id: string;
  jobOrderNumber: string;
  source: string;
  quotationReference?: string;
  customerId?: string;
  financialReviewPassed: boolean;
  status: string;
}

function nextCode(prefix: string, existingCodes: string[]): string {
  const matching = existingCodes.filter((c) => c.toUpperCase().startsWith(prefix.toUpperCase()));
  return `${prefix}-${String(matching.length + 1).padStart(4, '0')}`;
}

export function SalesPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [jobOrders, setJobOrders] = useState<JobOrderRecord[]>([]);
  const [orgNodeId, setOrgNodeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Forms UI toggles
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showQuotationForm, setShowQuotationForm] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Customer Form state
  const [custCode, setCustCode] = useState('');
  const [custNameAr, setCustNameAr] = useState('');
  const [custNameEn, setCustNameEn] = useState('');
  const [custPhone, setCustPhone] = useState('');

  // Quotation Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [quoteLines, setQuoteLines] = useState<QuotationLineInput[]>([{ itemId: '', quantity: '1', unitPrice: '0' }]);
  const [poRefInput, setPoRefInput] = useState('');

  async function getActiveOrgId(): Promise<string> {
    if (orgNodeId) return orgNodeId;
    try {
      const nodesRes = await api.get<{ nodes?: Array<{ id: string }> }>('/organization/nodes');
      if (nodesRes.nodes && nodesRes.nodes[0]) {
        setOrgNodeId(nodesRes.nodes[0].id);
        return nodesRes.nodes[0].id;
      }
    } catch {
      // fallback to tree
    }
    const treeRes = await api.get<{ tree: Array<{ id: string }> }>('/organization/tree');
    const fallbackId = treeRes.tree[0]?.id ?? '';
    setOrgNodeId(fallbackId);
    return fallbackId;
  }

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [custRes, itemsRes, quoteRes, joRes] = await Promise.all([
        api.get<{ customers: CustomerRecord[] }>('/crm/customers'),
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ quotations: QuotationRecord[] }>('/sales/quotations'),
        api.get<{ jobOrders: JobOrderRecord[] }>('/sales/job-orders'),
      ]);
      await getActiveOrgId();
      setCustomers(custRes.customers);
      setItems(itemsRes.items);
      setQuotations(quoteRes.quotations);
      setJobOrders(joRes.jobOrders);
      if (!selectedCustomerId && custRes.customers[0]) setSelectedCustomerId(custRes.customers[0].id);
      if (itemsRes.items[0] && quoteLines[0] && !quoteLines[0].itemId) {
        setQuoteLines([{ itemId: itemsRes.items[0].id, quantity: '1', unitPrice: '0' }]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load sales data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  function openCustomerForm(): void {
    setCustCode(nextCode('CUST', customers.map((c) => c.code)));
    setShowCustomerForm((v) => !v);
  }

  async function handleCreateCustomer(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      const activeOrg = await getActiveOrgId();
      await api.post('/crm/customers', {
        orgNodeId: activeOrg,
        code: custCode,
        name: custNameAr || custNameEn,
        nameAr: custNameAr || undefined,
        nameEn: custNameEn || undefined,
        phone: custPhone || undefined,
      });
      setCustCode(''); setCustNameAr(''); setCustNameEn(''); setCustPhone('');
      setShowCustomerForm(false);
      setFormSuccess(t('pages.sales.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  function addQuoteLine(): void {
    const defaultItem = items[0]?.id ?? '';
    setQuoteLines([...quoteLines, { itemId: defaultItem, quantity: '1', unitPrice: '0' }]);
  }

  function updateQuoteLine(index: number, field: keyof QuotationLineInput, value: string): void {
    const updated = [...quoteLines];
    const current = updated[index];
    if (current) {
      updated[index] = { ...current, [field]: value };
      setQuoteLines(updated);
    }
  }

  async function handleCreateQuotation(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      const activeOrg = await getActiveOrgId();
      await api.post('/sales/quotations', {
        orgNodeId: activeOrg,
        direction: 'outgoing',
        customerId: selectedCustomerId,
        currency: 'EGP',
        lines: quoteLines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      });
      setShowQuotationForm(false);
      setFormSuccess(t('pages.sales.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleApproveQuotation(quotationId: string): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post(`/sales/quotations/${quotationId}/approve`, {
        customerPoReference: poRefInput || undefined,
      });
      setShowApproveModal(null);
      setPoRefInput('');
      setFormSuccess(t('pages.sales.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handlePassFinancialReview(jobOrderId: string): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post(`/sales/job-orders/${jobOrderId}/financial-review/pass`, {});
      setFormSuccess(t('pages.sales.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleApproveJobOrder(jobOrderId: string): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post(`/sales/job-orders/${jobOrderId}/approve`, {});
      setFormSuccess(t('pages.sales.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  const customerLabel = (id?: string): string => customers.find((c) => c.id === id)?.name ?? '—';
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  const grandTotal = quoteLines.reduce((sum, l) => sum + (Number(l.quantity || 0) * Number(l.unitPrice || 0)), 0);

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.sales.eyebrow')}</span>
          <h1>{t('pages.sales.title')}</h1>
          <p>{t('pages.sales.description')}</p>
        </div>
      </div>

      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      {/* 1. Customers Section */}
      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">CRM</span>
            <h2>{t('pages.sales.customers.title')}</h2>
          </div>
          <button className="primary-button" onClick={openCustomerForm}><b>+</b>{t('pages.sales.customers.addCustomer')}</button>
        </div>

        {showCustomerForm && (
          <form onSubmit={(e) => { void handleCreateCustomer(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.sales.customers.code')}</label>
              <input value={custCode} onChange={(e) => setCustCode(e.target.value)} required style={{ ...inputStyle, minWidth: 140 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.sales.customers.nameAr')}</label>
              <input value={custNameAr} onChange={(e) => setCustNameAr(e.target.value)} style={{ ...inputStyle, minWidth: 140 }} dir="rtl" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.sales.customers.nameEn')}</label>
              <input value={custNameEn} onChange={(e) => setCustNameEn(e.target.value)} style={{ ...inputStyle, minWidth: 140 }} dir="ltr" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.sales.customers.phone')}</label>
              <input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} style={{ ...inputStyle, minWidth: 140 }} />
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.sales.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.sales.customers.code')}</span>
            <span>{t('pages.sales.customers.name')}</span>
            <span>{t('pages.sales.customers.phone')}</span>
            <span>{t('pages.sales.customers.status')}</span>
          </div>
          {customers.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.sales.form.empty')}</p>}
          {customers.map((c) => (
            <div className="placeholder-table__row" key={c.id}>
              <span><b>{c.code}</b></span>
              <span>{c.name}</span>
              <span>{c.phone ?? '—'}</span>
              <span className={`status status--${c.status === 'active' ? 'success' : 'neutral'}`}><i />{c.status}</span>
            </div>
          ))}
        </div>
      </article>

      {/* 2. Quotations Section */}
      <article className="panel module-panel" style={{ marginTop: 20 }}>
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Quotes</span>
            <h2>{t('pages.sales.quotations.title')}</h2>
          </div>
          <button className="primary-button" onClick={() => setShowQuotationForm((v) => !v)}><b>+</b>{t('pages.sales.quotations.addQuotation')}</button>
        </div>

        {showQuotationForm && (
          <form onSubmit={(e) => { void handleCreateQuotation(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 0 20px' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.sales.quotations.customer')}</label>
                <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} style={{ ...inputStyle, minWidth: 200 }}>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <label style={{ ...labelStyle, fontWeight: 'bold', marginBottom: 10, display: 'block' }}>{t('pages.sales.quotations.lines')}</label>
              
              {/* Header Titles for Quote Lines */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 12, color: '#64748b', fontWeight: 'bold' }}>
                <span style={{ flex: 2 }}>{t('pages.sales.quotations.item')}</span>
                <span style={{ width: 100 }}>{t('pages.sales.quotations.qty')}</span>
                <span style={{ width: 120 }}>{t('pages.sales.quotations.price')}</span>
                <span style={{ width: 90, textAlign: 'end' }}>{t('pages.sales.quotations.total')}</span>
              </div>

              {quoteLines.map((line, idx) => {
                const lineTotal = (Number(line.quantity || 0) * Number(line.unitPrice || 0)).toFixed(2);
                return (
                  <div key={idx} style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
                    <select value={line.itemId} onChange={(e) => updateQuoteLine(idx, 'itemId', e.target.value)} style={{ ...inputStyle, flex: 2, minWidth: 160 }}>
                      {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
                    </select>
                    <input type="number" min="1" step="any" value={line.quantity} onChange={(e) => updateQuoteLine(idx, 'quantity', e.target.value)} required style={{ ...inputStyle, width: 100 }} />
                    <input type="number" min="0" step="any" value={line.unitPrice} onChange={(e) => updateQuoteLine(idx, 'unitPrice', e.target.value)} required style={{ ...inputStyle, width: 120 }} />
                    <span style={{ width: 90, textAlign: 'end', fontWeight: 'bold', fontSize: 13, color: '#0f172a' }}>{lineTotal}</span>
                  </div>
                );
              })}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTop: '1px solid #cbd5e1' }}>
                <button type="button" onClick={addQuoteLine} className="filter-button">+ {t('pages.sales.quotations.addItem')}</button>
                <div style={{ fontSize: 15, fontWeight: 'bold', color: '#0f172a' }}>
                  {t('pages.sales.quotations.total')}: {grandTotal.toFixed(2)} EGP
                </div>
              </div>
            </div>

            <button type="submit" disabled={submitting} className="primary-button" style={{ alignSelf: 'flex-start' }}>{t('pages.sales.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.sales.quotations.number')}</span>
            <span>{t('pages.sales.quotations.customer')}</span>
            <span>{t('pages.sales.quotations.total')}</span>
            <span>{t('pages.sales.quotations.status')}</span>
          </div>
          {quotations.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.sales.form.empty')}</p>}
          {quotations.map((q) => (
            <div className="placeholder-table__row" key={q.id}>
              <span><b>{q.quotationNumber}</b><small>{q.customerPoReference ? `PO: ${q.customerPoReference}` : ''}</small></span>
              <span>{customerLabel(q.customerId)}</span>
              <span>{q.totalAmount} {q.currency}</span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`status status--${q.status === 'approved' ? 'success' : 'neutral'}`}><i />{q.status}</span>
                {q.status === 'draft' && (
                  <button className="filter-button" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => setShowApproveModal(q.id)}>
                    {t('pages.sales.quotations.approve')}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </article>

      {/* Approve Modal for PO Reference */}
      {showApproveModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, width: 380, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3>{t('pages.sales.quotations.approve')}</h3>
            <label style={labelStyle}>{t('pages.sales.quotations.poReference')}</label>
            <input value={poRefInput} onChange={(e) => setPoRefInput(e.target.value)} placeholder="e.g. PO-CUST-2026-99" style={{ ...inputStyle, width: '100%' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="filter-button" onClick={() => setShowApproveModal(null)}>{t('pages.sales.form.cancel')}</button>
              <button className="primary-button" disabled={submitting} onClick={() => { void handleApproveQuotation(showApproveModal); }}>{t('pages.sales.form.save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Job Orders Section (Central Core) */}
      <article className="panel module-panel" style={{ marginTop: 20 }}>
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Production Hub</span>
            <h2>{t('pages.sales.jobOrders.title')}</h2>
          </div>
        </div>

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.sales.jobOrders.number')}</span>
            <span>{t('pages.sales.jobOrders.quotationRef')}</span>
            <span>{t('pages.sales.jobOrders.financialReview')}</span>
            <span>{t('pages.sales.jobOrders.status')}</span>
          </div>
          {jobOrders.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.sales.form.empty')}</p>}
          {jobOrders.map((jo) => (
            <div className="placeholder-table__row" key={jo.id}>
              <span><b>{jo.jobOrderNumber}</b><small>{customerLabel(jo.customerId)}</small></span>
              <span>{jo.quotationReference ?? 'Internal'}</span>
              <span>
                {jo.financialReviewPassed ? (
                  <span className="status status--success"><i />{t('pages.sales.jobOrders.passed')}</span>
                ) : (
                  <button className="filter-button" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => { void handlePassFinancialReview(jo.id); }}>
                    {t('pages.sales.jobOrders.passReview')}
                  </button>
                )}
              </span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`status status--${jo.status === 'approved' ? 'success' : 'neutral'}`}><i />{jo.status}</span>
                {jo.status === 'draft' && jo.financialReviewPassed && (
                  <button className="primary-button" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => { void handleApproveJobOrder(jo.id); }}>
                    {t('pages.sales.jobOrders.approve')}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
