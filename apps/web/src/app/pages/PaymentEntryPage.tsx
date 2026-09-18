import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface CustomerRecord { id: string; name: string; }
interface SupplierRecord { id: string; name: string; }

export function PaymentEntryPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [paymentType, setPaymentType] = useState<'receive' | 'pay'>('receive');
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState('0');
  const [currency, setCurrency] = useState('EGP');
  const [mode, setMode] = useState('cash');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  async function loadAll(): Promise<void> {
    setLoading(true);
    try {
      const [custRes, supRes] = await Promise.all([
        api.get<{ customers: CustomerRecord[] }>('/crm/customers').catch(() => ({ customers: [] })),
        api.get<{ suppliers: SupplierRecord[] }>('/crm/suppliers').catch(() => ({ suppliers: [] })),
      ]);
      setCustomers(custRes.customers || []);
      setSuppliers(supRes.suppliers || []);
      if (custRes.customers?.[0]) setPartyId(custRes.customers[0].id);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Failed'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  const parties = paymentType === 'receive' ? customers : suppliers;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault(); setSubmitting(true); setFormError(null);
    try {
      const amt = parseFloat(amount).toFixed(2);
      if (paymentType === 'receive') {
        await api.post('/accounting/journal-entries', {
          entryDate: new Date().toISOString(),
          note: 'Payment Received from ' + (customers.find(c => c.id === partyId)?.name || '') + ' via ' + mode + ': ' + (note || ''),
          lines: [
            { accountCode: '1000', debit: amt, credit: '0', note: 'Cash/Bank' },
            { accountCode: '1100', debit: '0', credit: amt, note: 'Accounts Receivable' },
          ],
        });
      } else {
        await api.post('/accounting/journal-entries', {
          entryDate: new Date().toISOString(),
          note: 'Payment Made to ' + (suppliers.find(s => s.id === partyId)?.name || '') + ' via ' + mode + ': ' + (note || ''),
          lines: [
            { accountCode: '2100', debit: amt, credit: '0', note: 'Accounts Payable' },
            { accountCode: '1000', debit: '0', credit: amt, note: 'Cash/Bank' },
          ],
        });
      }
      setFormSuccess('Payment Entry posted to ledger!');
      setShowForm(false); setAmount('0'); setNote(''); await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  }

  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b', fontWeight: 'bold' as const };

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>Loading...</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">Accounts Module</span>
          <h1>Payment Entry (قيد الدفع والتحصيل)</h1>
          <p>Record customer receipts and supplier payments. Automatically posts to the general ledger.</p>
        </div>
        <button className="primary-button" onClick={() => setShowForm(v => !v)}>{showForm ? 'Cancel' : '+ New Payment Entry'}</button>
      </div>
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {formError && <p style={{ color: '#b91c1c' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', fontWeight: 'bold' }}>{formSuccess}</p>}

      {showForm && (
        <article className="panel module-panel" style={{ background: '#fff', padding: 24, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>New Payment Entry</h2>
          <form onSubmit={(e) => { void handleSubmit(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Payment Type</label>
                <select value={paymentType} onChange={e => { setPaymentType(e.target.value as any); setPartyId(''); }} style={{ ...inputStyle, width: '100%' }}>
                  <option value="receive">Receive (تحصيل من عميل)</option>
                  <option value="pay">Pay (دفع لمورد)</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{paymentType === 'receive' ? 'Customer' : 'Supplier'}</label>
                <select value={partyId} onChange={e => setPartyId(e.target.value)} style={{ ...inputStyle, width: '100%' }} required>
                  {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Amount</label>
                <input type="number" min="0.01" step="any" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inputStyle, width: '100%' }} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Payment Mode</label>
                <select value={mode} onChange={e => setMode(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                  <option value="cash">Cash (نقدي)</option>
                  <option value="bank">Bank Transfer (تحويل بنكي)</option>
                  <option value="cheque">Cheque (شيك)</option>
                </select>
              </div>
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Payment reference..." style={{ ...inputStyle, minHeight: 50 }} />
            <button type="submit" disabled={submitting} className="primary-button" style={{ alignSelf: 'flex-start' }}>Post Payment Entry</button>
          </form>
        </article>
      )}
    </section>
  );
}
