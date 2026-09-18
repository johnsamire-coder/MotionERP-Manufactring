import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface CustomerRecord { id: string; name: string; email?: string; phone?: string; }
interface ItemRecord { id: string; code: string; name: string; }
interface OrgNodeTreeItem { id: string; name: string; nodeType: string; children?: OrgNodeTreeItem[]; }
interface QuotationLineInput { itemId: string; quantity: string; unitPrice: string; }
interface QuotationLineRecord {
  id: string; itemId: string; quantity: string; unitPrice: string; lineNumber: number;
}
interface QuotationRecord {
  id: string; quotationNumber: string; direction: 'outgoing' | 'incoming';
  customerId: string | null; orgNodeId: string | null;
  quotationDate: string; validUntil: string | null; status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';
  currency: string; customerPoReference: string | null; note: string | null;
  createdAt: string; lines: QuotationLineRecord[];
}

function flattenOrgNodes(nodes: OrgNodeTreeItem[]): OrgNodeTreeItem[] {
  const result: OrgNodeTreeItem[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) result.push(...flattenOrgNodes(node.children));
  }
  return result;
}

export function QuotationPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [orgNodes, setOrgNodes] = useState<OrgNodeTreeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Form state
  const [showForm, setShowForm] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [orgNodeId, setOrgNodeId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [currency, setCurrency] = useState('EGP');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<QuotationLineInput[]>([
    { itemId: '', quantity: '1', unitPrice: '0' }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Approval Modal state
  const [approveModalId, setApproveModalId] = useState<string | null>(null);
  const [poRefInput, setPoRefInput] = useState('');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [quoteRes, custRes, itemRes, orgRes] = await Promise.all([
        api.get<{ quotations: QuotationRecord[] }>('/sales/quotations?direction=outgoing'),
        api.get<{ customers: CustomerRecord[] }>('/crm/customers').catch(() => ({ customers: [] })),
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ tree: OrgNodeTreeItem[] }>('/organization/tree'),
      ]);
      setQuotations(quoteRes.quotations);
      setCustomers(custRes.customers || []);
      setItems(itemRes.items);
      const flatNodes = flattenOrgNodes(orgRes.tree);
      setOrgNodes(flatNodes);
      if (!orgNodeId && flatNodes.length > 0) setOrgNodeId(flatNodes[flatNodes.length - 1]!.id);
      if (!customerId && custRes.customers && custRes.customers[0]) setCustomerId(custRes.customers[0].id);
      if (!lines[0]?.itemId && itemRes.items[0]) {
        await handleItemChange(0, itemRes.items[0].id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load quotation data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [i18n.language]);

  async function handleItemChange(index: number, itemId: string): Promise<void> {
    const updated = [...lines];
    updated[index]!.itemId = itemId;
    try {
      // Auto-fetch selling price from backend
      const priceRes = await api.get<{ itemPrice: { price: string } | null }>(`/catalog/items/${itemId}/prices/latest?type=selling`);
      if (priceRes.itemPrice) {
        updated[index]!.unitPrice = priceRes.itemPrice.price;
      }
    } catch {
      // Keep existing price if none
    }
    setLines(updated);
  }

  function updateLine(index: number, field: keyof QuotationLineInput, value: string): void {
    const updated = [...lines];
    updated[index] = { ...updated[index]!, [field]: value };
    setLines(updated);
  }

  async function addLine(): Promise<void> {
    const defaultItem = items[0]?.id || '';
    let defaultPrice = '0';
    if (defaultItem) {
      try {
        const pRes = await api.get<{ itemPrice: { price: string } | null }>(`/catalog/items/${defaultItem}/prices/latest?type=selling`);
        if (pRes.itemPrice) defaultPrice = pRes.itemPrice.price;
      } catch {}
    }
    setLines([...lines, { itemId: defaultItem, quantity: '1', unitPrice: defaultPrice }]);
  }

  function removeLine(index: number): void {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  }

  const grandTotal = lines.reduce((sum, l) => sum + (parseFloat(l.quantity || '0') * parseFloat(l.unitPrice || '0')), 0);

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!customerId || lines.some((l) => !l.itemId || parseFloat(l.quantity) <= 0)) {
      setFormError('Please select a customer and specify valid quantities for all items.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post('/sales/quotations', {
        direction: 'outgoing',
        customerId,
        orgNodeId: orgNodeId || undefined,
        validUntil: validUntil || undefined,
        currency,
        note: note || undefined,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      });
      setShowForm(false);
      setFormSuccess('Quotation created successfully');
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create quotation');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(id: string, action: 'send' | 'reject'): Promise<void> {
    setSubmitting(true);
    try {
      await api.post(`/sales/quotations/${id}/${action}`, {});
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(id: string): Promise<void> {
    setSubmitting(true);
    try {
      const res = await api.post<{ quotation: QuotationRecord; jobOrder?: any }>(`/sales/quotations/${id}/approve`, {
        customerPoReference: poRefInput || undefined,
      });
      setApproveModalId(null);
      setPoRefInput('');
      setFormSuccess(`Quotation approved! Sales Order (Job Order ${res.jobOrder?.jobOrderNumber || ''}) generated automatically!`);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Approval failed');
    } finally {
      setSubmitting(false);
    }
  }

  const itemLabel = (id: string): string => items.find((it) => it.id === id)?.name ?? id;
  const custLabel = (id: string | null): string => (id ? (customers.find((c) => c.id === id)?.name ?? id) : '—');
  const orgLabel = (id: string | null): string => (id ? (orgNodes.find((o) => o.id === id)?.name ?? id) : '—');
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b', fontWeight: 'bold' };

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>Loading Quotations...</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">Selling Module (ERPNext Parity)</span>
          <h1>Quotation (عروض الأسعار)</h1>
          <p>Create commercial quotations, calculate margins from BOM prices, and convert to Sales Orders.</p>
        </div>
        <button className="primary-button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ New Quotation'}
        </button>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}
      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0', fontWeight: 'bold' }}>{formSuccess}</p>}

      {showForm && (
        <article className="panel module-panel" style={{ background: '#fff', padding: 24, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>New Sales Quotation</h2>
          <form onSubmit={(e) => { void handleCreate(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Customer</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={{ ...inputStyle, width: '100%' }} required>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Company / Activity</label>
                <select value={orgNodeId} onChange={(e) => setOrgNodeId(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                  {orgNodes.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Valid Until</label>
                <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Currency</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                  <option value="EGP">EGP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            {/* Quotation Item Lines */}
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 12, color: '#64748b', fontWeight: 'bold' }}>
                <span style={{ flex: 3 }}>Item</span>
                <span style={{ flex: 1 }}>Quantity</span>
                <span style={{ flex: 1.5 }}>Unit Price (Auto-Filled)</span>
                <span style={{ flex: 1.5 }}>Total</span>
                <span style={{ width: 36 }}></span>
              </div>

              {lines.map((line, idx) => {
                const lineTotal = parseFloat(line.quantity || '0') * parseFloat(line.unitPrice || '0');
                return (
                  <div key={idx} style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'center' }}>
                    <div style={{ flex: 3 }}>
                      <select value={line.itemId} onChange={(e) => void handleItemChange(idx, e.target.value)} style={{ ...inputStyle, width: '100%' }} required>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>{it.name} ({it.code})</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <input type="number" min="0.0001" step="any" value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} style={{ ...inputStyle, width: '100%' }} required />
                    </div>
                    <div style={{ flex: 1.5 }}>
                      <input type="number" min="0" step="any" value={line.unitPrice} onChange={(e) => updateLine(idx, 'unitPrice', e.target.value)} style={{ ...inputStyle, width: '100%' }} required />
                    </div>
                    <div style={{ flex: 1.5, fontWeight: 'bold', color: '#0369a1', paddingLeft: 8 }}>
                      {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
                    </div>
                    <button type="button" onClick={() => removeLine(idx)} disabled={lines.length === 1} style={{ width: 36, height: 36, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                  </div>
                );
              })}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                <button type="button" onClick={() => { void addLine(); }} className="filter-button">+ Add Item Line</button>
                <div style={{ fontSize: 16, fontWeight: 'bold', color: '#0f172a' }}>
                  Grand Total: <span style={{ color: '#166534', fontSize: 20 }}>{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>Commercial Notes & Terms</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Delivery in 15 days, 50% advance..." style={{ ...inputStyle, minHeight: 60 }} />
            </div>

            <button type="submit" disabled={submitting} className="primary-button" style={{ alignSelf: 'flex-start' }}>Save Quotation</button>
          </form>
        </article>
      )}

      {/* Quotations List */}
      <article className="panel module-panel" style={{ background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>Quotation #</span>
            <span>Customer</span>
            <span>Date</span>
            <span>Total Value</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {quotations.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>No sales quotations created yet.</p>}

          {quotations.map((q) => {
            const qTotal = q.lines?.reduce((sum, l) => sum + (parseFloat(l.quantity) * parseFloat(l.unitPrice)), 0) || 0;
            return (
              <div className="placeholder-table__row" key={q.id}>
                <span><b>{q.quotationNumber}</b></span>
                <span>{custLabel(q.customerId)}</span>
                <span>{new Date(q.quotationDate).toLocaleDateString()}</span>
                <span><b>{qTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {q.currency}</b></span>
                <span>
                  <span className={`status status--${q.status === 'approved' ? 'success' : q.status === 'sent' ? 'warning' : 'neutral'}`}>
                    <i />{q.status.toUpperCase()}
                  </span>
                </span>
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {q.status === 'draft' && (
                    <button className="filter-button" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => { void handleAction(q.id, 'send'); }}>
                      🚀 Send
                    </button>
                  )}
                  {q.status === 'sent' && (
                    <>
                      <button className="primary-button" style={{ fontSize: 12, padding: '4px 8px', background: '#166534' }} onClick={() => setApproveModalId(q.id)}>
                        ✓ Approve & Order
                      </button>
                      <button className="filter-button" style={{ fontSize: 12, padding: '4px 8px', color: '#b91c1c' }} onClick={() => { void handleAction(q.id, 'reject'); }}>
                        ✕ Reject
                      </button>
                    </>
                  )}
                  {q.status === 'approved' && (
                    <span style={{ fontSize: 12, color: '#166534', fontWeight: 'bold' }}>✓ Order Generated</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </article>

      {/* Approve Modal */}
      {approveModalId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, width: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ margin: 0 }}>Approve Quotation</h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              Approving this quotation will automatically generate a <b>Sales Order (Job Order)</b> to initiate production planning.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>Customer PO Reference (Optional)</label>
              <input type="text" placeholder="e.g. PO-HOSP-2026-99" value={poRefInput} onChange={(e) => setPoRefInput(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="filter-button" onClick={() => setApproveModalId(null)}>Cancel</button>
              <button className="primary-button" disabled={submitting} onClick={() => { void handleApprove(approveModalId); }}>
                Confirm & Generate Order
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
