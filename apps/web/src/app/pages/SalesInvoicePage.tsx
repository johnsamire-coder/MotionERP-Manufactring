import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, financeApi, ApiError } from '../api/client';

interface CustomerRecord { id: string; name: string; }
interface ItemRecord { id: string; code: string; name: string; }
interface InvoiceLineInput { itemId: string; quantity: string; unitPrice: string; taxRate: string; }

export function SalesInvoicePage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [orgNodeId, setOrgNodeId] = useState('00000000-0000-0000-0000-000000000001');
  const [customerId, setCustomerId] = useState('');
  const [jobOrderReference, setJobOrderReference] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<InvoiceLineInput[]>([
    { itemId: '', quantity: '1', unitPrice: '0', taxRate: '14.00' },
  ]);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [invRes, custRes, itemRes] = await Promise.all([
        financeApi.getSalesInvoices().catch(() => ({ salesInvoices: [] })),
        api.get<{ customers: CustomerRecord[] }>('/crm/customers').catch(() => ({ customers: [] })),
        api.get<{ items: ItemRecord[] }>('/catalog/items?lang=' + lang).catch(() => ({ items: [] })),
      ]);

      setInvoices(invRes.salesInvoices ?? []);
      setCustomers(custRes.customers ?? []);
      const itms = itemRes.items ?? [];
      setItems(itms);

      if (custRes.customers && custRes.customers[0] && !customerId) {
        setCustomerId(custRes.customers[0].id);
      }
      if (itms[0] && !lines[0]?.itemId) {
        setLines([{ itemId: itms[0].id, quantity: '1', unitPrice: '0', taxRate: '14.00' }]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ظپط´ظ„ طھط­ظ…ظٹظ„ ط¨ظٹط§ظ†ط§طھ ظپظˆط§طھظٹط± ط§ظ„ظ…ط¨ظٹط¹ط§طھ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  const updateLine = (idx: number, field: keyof InvoiceLineInput, value: string) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx]!, [field]: value };
    setLines(updated);
  };

  const addLine = () => {
    setLines([...lines, { itemId: items[0]?.id || '', quantity: '1', unitPrice: '0', taxRate: '14.00' }]);
  };

  const removeLine = (idx: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== idx));
    }
  };

  // Calculations
  const netTotal = lines.reduce((sum, l) => sum + (Number(l.quantity || 0) * Number(l.unitPrice || 0)), 0);
  const taxTotal = lines.reduce((sum, l) => sum + ((Number(l.quantity || 0) * Number(l.unitPrice || 0) * Number(l.taxRate || 14)) / 100), 0);
  const grandTotal = netTotal + taxTotal;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);

      await financeApi.createSalesInvoice({
        orgNodeId,
        customerId,
        jobOrderReference: jobOrderReference.trim() || undefined,
        invoiceDate: invoiceDate ? new Date(invoiceDate).toISOString() : new Date().toISOString(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : nextMonth.toISOString(),
        notes: notes.trim() || undefined,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
        })),
      });

      setSuccess('طھظ… ط¥ظ†ط´ط§ط، ظپط§طھظˆط±ط© ط§ظ„ظ…ط¨ظٹط¹ط§طھ ط¨ظ†ط¬ط§ط­ (ظ…ط³ظˆط¯ط© ط¬ط§ظ‡ط²ط© ظ„ظ„ظ…ط±ط§ط¬ط¹ط© ظˆط§ظ„طھط±ط­ظٹظ„)');
      setShowForm(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ظپط´ظ„ ط¥ظ†ط´ط§ط، ط§ظ„ظپط§طھظˆط±ط©');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePost(id: string): Promise<void> {
    try {
      await financeApi.postSalesInvoice(id);
      setSuccess('طھظ… طھط±ط­ظٹظ„ ط§ظ„ظپط§طھظˆط±ط© ظˆطھظˆظ„ظٹط¯ ظ‚ظٹظˆط¯ ط§ظ„ط¥ظٹط±ط§ط¯ ظˆط¶ط±ظٹط¨ط© ط§ظ„ظ…ط®ط±ط¬ط§طھ ظˆظ…ط¯ظٹظˆظ†ظٹط© ط§ظ„ط¹ظ…ظٹظ„ ط¨ظ†ط¬ط§ط­!');
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ظپط´ظ„ طھط±ط­ظٹظ„ ط§ظ„ظپط§طھظˆط±ط©');
    }
  }

  const custName = (id: string) => customers.find((c) => c.id === id)?.name ?? id;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">ط§ظ„ظ…ط¨ظٹط¹ط§طھ ظˆط§ظ„ط¹ظ…ظ„ط§ط،</span>
          <h1>ظپظˆط§طھظٹط± ط§ظ„ظ…ط¨ظٹط¹ط§طھ (Sales Invoices)</h1>
          <p>ط¥طµط¯ط§ط± ط§ظ„ظپظˆط§طھظٹط± ط§ظ„ط¶ط±ظٹط¨ظٹط© ظ„ظ„ط¹ظ…ظ„ط§ط، ظˆطھط±ط­ظٹظ„ ط§ظ„ط¥ظٹط±ط§ط¯ط§طھ ظˆط¶ط±ظٹط¨ط© ط§ظ„ظ‚ظٹظ…ط© ط§ظ„ظ…ط¶ط§ظپط© 14% طھظ„ظ‚ط§ط¦ظٹط§ظ‹</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'ط¥ظ„ط؛ط§ط،' : '+ ظپط§طھظˆط±ط© ظ…ط¨ظٹط¹ط§طھ ط¬ط¯ظٹط¯ط©'}
        </button>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert alert--success" style={{ marginBottom: 16 }}>{success}</div>}

      {showForm && (
        <form className="form-card" onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <h3>طھط³ط¬ظٹظ„ ظپط§طھظˆط±ط© ظ…ط¨ظٹط¹ط§طھ ط¶ط±ظٹط¨ظٹط© ط¬ط¯ظٹط¯ط©</h3>
          <div className="form-grid">
            <label>ط§ظ„ط¹ظ…ظٹظ„
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>ط£ظ…ط± ط§ظ„ط´ط؛ظ„ ط§ظ„ظ…ط±طھط¨ط· (Job Order)
              <input value={jobOrderReference} onChange={(e) => setJobOrderReference(e.target.value)} placeholder="ظ…ط«ط§ظ„: JO-2026-000001" />
            </label>
            <label>طھط§ط±ظٹط® ط§ظ„ظپط§طھظˆط±ط©
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
            </label>
            <label>طھط§ط±ظٹط® ط§ظ„ط§ط³طھط­ظ‚ط§ظ‚
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
          </div>

          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginTop: 16, border: '1px solid #e2e8f0' }}>
            <h4>ط¨ظ†ظˆط¯ ظˆط£طµظ†ط§ظپ ط§ظ„ظپط§طھظˆط±ط©</h4>
            {lines.map((line, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1.5fr 1fr 1.5fr auto', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                <select value={line.itemId} onChange={(e) => updateLine(idx, 'itemId', e.target.value)} required>
                  {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
                </select>
                <input type="number" step="any" min="0.001" value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} placeholder="ط§ظ„ظƒظ…ظٹط©" required />
                <input type="number" step="any" min="0" value={line.unitPrice} onChange={(e) => updateLine(idx, 'unitPrice', e.target.value)} placeholder="ط³ط¹ط± ط§ظ„ط¨ظٹط¹" required />
                <input type="number" step="any" value={line.taxRate} onChange={(e) => updateLine(idx, 'taxRate', e.target.value)} placeholder="ط§ظ„ط¶ط±ظٹط¨ط© %" />
                <b style={{ color: '#166534' }}>
                  {(Number(line.quantity || 0) * Number(line.unitPrice || 0) * (1 + (Number(line.taxRate || 14) / 100))).toFixed(2)} ط¬.ظ…
                </b>
                <button type="button" className="btn btn--sm btn--danger" onClick={() => removeLine(idx)}>x</button>
              </div>
            ))}
            <button type="button" className="btn btn--sm" onClick={addLine}>+ ط¥ط¶ط§ظپط© طµظ†ظپ</button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '12px 16px', background: '#ecfdf5', borderRadius: 8 }}>
            <div>
              <span>ط§ظ„طµط§ظپظٹ: <b>{netTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ط¬.ظ…</b></span> | 
              <span style={{ margin: '0 12px' }}>ط§ظ„ط¶ط±ظٹط¨ط© (14%): <b>{taxTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ط¬.ظ…</b></span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#166534' }}>
              ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ ط´ط§ظ…ظ„ ط§ظ„ط¶ط±ظٹط¨ط©: {grandTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ط¬.ظ…
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: 16 }}>
            <button type="submit" disabled={submitting} className="btn btn--primary">
              {submitting ? 'ط¬ط§ط±ظٹ ط§ظ„ط­ظپط¸...' : 'ط­ظپط¸ ط§ظ„ظپط§طھظˆط±ط© ظƒظ…ط³ظˆط¯ط©'}
            </button>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>ط¥ظ„ط؛ط§ط،</button>
          </div>
        </form>
      )}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>ط±ظ‚ظ… ط§ظ„ظپط§طھظˆط±ط©</th>
              <th>ط§ظ„ط¹ظ…ظٹظ„</th>
              <th>ط§ظ„طھط§ط±ظٹط®</th>
              <th>ط§ظ„طµط§ظپظٹ</th>
              <th>ط§ظ„ط¶ط±ظٹط¨ط© 14%</th>
              <th>ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ</th>
              <th>ط§ظ„ط­ط§ظ„ط©</th>
              <th>ط§ظ„ط¥ط¬ط±ط§ط،ط§طھ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}>ط¬ط§ط±ظٹ ط§ظ„طھط­ظ…ظٹظ„...</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={8}>ظ„ط§ طھظˆط¬ط¯ ظپظˆط§طھظٹط± ظ…ط¨ظٹط¹ط§طھ ظ…ط³ط¬ظ„ط©</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id}>
                  <td><b>{inv.invoiceNumber}</b></td>
                  <td>{custName(inv.customerId)}</td>
                  <td>{new Date(inv.invoiceDate).toLocaleDateString('ar-EG')}</td>
                  <td>{Number(inv.netAmount).toLocaleString('ar-EG')} ط¬.ظ…</td>
                  <td>{Number(inv.taxAmount).toLocaleString('ar-EG')} ط¬.ظ…</td>
                  <td><b>{Number(inv.grandTotal).toLocaleString('ar-EG')} ط¬.ظ…</b></td>
                  <td>
                    <span className={`status-badge status-badge--${inv.status === 'posted' ? 'active' : 'draft'}`}>
                      {inv.status === 'posted' ? 'ظ…ط±ط­ظ„ ظˆظ…ظ‚ظٹط¯' : 'ظ…ط³ظˆط¯ط©'}
                    </span>
                  </td>
                  <td>
                    {inv.status === 'draft' && (
                      <button className="btn btn--sm btn--success" onClick={() => handlePost(inv.id)}>
                        طھط±ط­ظٹظ„ ط¨ط§ظ„ط¯ظپط§طھط±
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}