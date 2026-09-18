import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface CustomerRecord { id: string; name: string; }
interface ItemRecord { id: string; code: string; name: string; }
interface InvoiceLineInput { itemId: string; quantity: string; rate: string; }
interface InvoiceLineRecord { id: string; itemId: string; quantity: string; rate: string; amount: string; }
interface SalesInvoiceRecord {
  id: string; invoiceNumber: string; customerId: string;
  postingDate: string; dueDate: string | null;
  totalAmount: string; paidAmount: string; outstandingAmount: string;
  status: string; currency: string; note: string | null;
  lines: InvoiceLineRecord[];
}

export function SalesInvoicePage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [invoices, setInvoices] = useState<SalesInvoiceRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('EGP');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<InvoiceLineInput[]>([{ itemId: '', quantity: '1', rate: '0' }]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  async function loadAll(): Promise<void> {
    setLoading(true);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [custRes, itemRes] = await Promise.all([
        api.get<{ customers: CustomerRecord[] }>('/crm/customers').catch(() => ({ customers: [] })),
        api.get<{ items: ItemRecord[] }>('/catalog/items?lang=' + lang),
      ]);
      setCustomers(custRes.customers || []);
      setItems(itemRes.items);
      if (custRes.customers && custRes.customers[0]) setCustomerId(custRes.customers[0].id);
      if (itemRes.items[0] && !lines[0]?.itemId) {
        const firstItem = itemRes.items[0];
        try {
          const pRes = await api.get<{ itemPrice: { price: string } | null }>('/catalog/items/' + firstItem.id + '/prices/latest?type=selling');
          setLines([{ itemId: firstItem.id, quantity: '1', rate: pRes.itemPrice?.price || '0' }]);
        } catch { setLines([{ itemId: firstItem.id, quantity: '1', rate: '0' }]); }
      }
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Failed'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  async function handleItemChange(idx: number, itemId: string): Promise<void> {
    const updated = [...lines];
    updated[idx]!.itemId = itemId;
    try {
      const pRes = await api.get<{ itemPrice: { price: string } | null }>('/catalog/items/' + itemId + '/prices/latest?type=selling');
      if (pRes.itemPrice) updated[idx]!.rate = pRes.itemPrice.price;
    } catch {}
    setLines(updated);
  }

  function updateLine(idx: number, field: keyof InvoiceLineInput, value: string): void {
    const updated = [...lines];
    updated[idx] = { ...updated[idx]!, [field]: value };
    setLines(updated);
  }

  const grandTotal = lines.reduce((s, l) => s + parseFloat(l.quantity || '0') * parseFloat(l.rate || '0'), 0);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true); setFormError(null);
    try {
      // Create as Journal Entry (debit Accounts Receivable, credit Sales Revenue)
      const total = grandTotal.toFixed(2);
      await api.post('/accounting/journal-entries', {
        entryDate: new Date().toISOString(),
        note: 'Sales Invoice for ' + (customers.find(c => c.id === customerId)?.name || customerId) + ': ' + (note || ''),
        lines: [
          { accountCode: '1100', debit: total, credit: '0', note: 'Accounts Receivable' },
          { accountCode: '4100', debit: '0', credit: total, note: 'Sales Revenue' },
        ],
      });
      setFormSuccess('Sales Invoice created and posted to ledger!');
      setShowForm(false);
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  }

  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b', fontWeight: 'bold' as const };
  const itemLabel = (id: string): string => items.find(it => it.id === id)?.name ?? id;
  const custLabel = (id: string): string => customers.find(c => c.id === id)?.name ?? id;

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>Loading...</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">Selling Module</span>
          <h1>Sales Invoice (فاتورة المبيعات)</h1>
          <p>Issue invoices to customers and post revenue to the general ledger automatically.</p>
        </div>
        <button className="primary-button" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New Sales Invoice'}
        </button>
      </div>

      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {formError && <p style={{ color: '#b91c1c' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', fontWeight: 'bold' }}>{formSuccess}</p>}

      {showForm && (
        <article className="panel module-panel" style={{ background: '#fff', padding: 24, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>New Sales Invoice</h2>
          <form onSubmit={(e) => { void handleSubmit(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Customer</label>
                <select value={customerId} onChange={e => setCustomerId(e.target.value)} style={{ ...inputStyle, width: '100%' }} required>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Due Date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                  <option value="EGP">EGP</option><option value="USD">USD</option><option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 12, color: '#64748b', fontWeight: 'bold' }}>
                <span style={{ flex: 3 }}>Item</span><span style={{ flex: 1 }}>Qty</span>
                <span style={{ flex: 1.5 }}>Rate</span><span style={{ flex: 1.5 }}>Amount</span><span style={{ width: 36 }}></span>
              </div>
              {lines.map((line, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'center' }}>
                  <div style={{ flex: 3 }}>
                    <select value={line.itemId} onChange={e => void handleItemChange(idx, e.target.value)} style={{ ...inputStyle, width: '100%' }} required>
                      {items.map(it => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <input type="number" min="0.001" step="any" value={line.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} style={{ ...inputStyle, width: '100%' }} required />
                  </div>
                  <div style={{ flex: 1.5 }}>
                    <input type="number" min="0" step="any" value={line.rate} onChange={e => updateLine(idx, 'rate', e.target.value)} style={{ ...inputStyle, width: '100%' }} required />
                  </div>
                  <div style={{ flex: 1.5, fontWeight: 'bold', color: '#0369a1' }}>
                    {(parseFloat(line.quantity || '0') * parseFloat(line.rate || '0')).toFixed(2)}
                  </div>
                  <button type="button" onClick={() => lines.length > 1 && setLines(lines.filter((_, i) => i !== idx))} style={{ width: 36, height: 36, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>x</button>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                <button type="button" onClick={() => setLines([...lines, { itemId: items[0]?.id || '', quantity: '1', rate: '0' }])} className="filter-button">+ Add Line</button>
                <div style={{ fontSize: 18, fontWeight: 'bold', color: '#166534' }}>Total: {grandTotal.toFixed(2)} {currency}</div>
              </div>
            </div>

            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Invoice notes..." style={{ ...inputStyle, minHeight: 50 }} />
            <button type="submit" disabled={submitting} className="primary-button" style={{ alignSelf: 'flex-start' }}>Save & Post Invoice</button>
          </form>
        </article>
      )}
    </section>
  );
}
