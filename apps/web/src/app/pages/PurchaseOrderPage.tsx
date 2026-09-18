import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface SupplierRecord { id: string; name: string; }
interface ItemRecord { id: string; code: string; name: string; }
interface POLineInput { itemId: string; quantity: string; rate: string; }

export function PurchaseOrderPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [currency, setCurrency] = useState('EGP');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<POLineInput[]>([{ itemId: '', quantity: '1', rate: '0' }]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  async function loadAll(): Promise<void> {
    setLoading(true);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [supRes, itemRes] = await Promise.all([
        api.get<{ suppliers: SupplierRecord[] }>('/crm/suppliers').catch(() => ({ suppliers: [] })),
        api.get<{ items: ItemRecord[] }>('/catalog/items?lang=' + lang),
      ]);
      setSuppliers(supRes.suppliers || []);
      setItems(itemRes.items);
      if (supRes.suppliers && supRes.suppliers[0]) setSupplierId(supRes.suppliers[0].id);
      if (itemRes.items[0] && !lines[0]?.itemId) {
        const fi = itemRes.items[0];
        try {
          const pRes = await api.get<{ itemPrice: { price: string } | null }>('/catalog/items/' + fi.id + '/prices/latest?type=buying');
          setLines([{ itemId: fi.id, quantity: '1', rate: pRes.itemPrice?.price || '0' }]);
        } catch { setLines([{ itemId: fi.id, quantity: '1', rate: '0' }]); }
      }
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Failed'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  async function handleItemChange(idx: number, itemId: string): Promise<void> {
    const updated = [...lines]; updated[idx]!.itemId = itemId;
    try {
      const pRes = await api.get<{ itemPrice: { price: string } | null }>('/catalog/items/' + itemId + '/prices/latest?type=buying');
      if (pRes.itemPrice) updated[idx]!.rate = pRes.itemPrice.price;
    } catch {}
    setLines(updated);
  }

  function updateLine(idx: number, field: keyof POLineInput, value: string): void {
    const updated = [...lines]; updated[idx] = { ...updated[idx]!, [field]: value }; setLines(updated);
  }

  const grandTotal = lines.reduce((s, l) => s + parseFloat(l.quantity || '0') * parseFloat(l.rate || '0'), 0);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault(); setSubmitting(true); setFormError(null);
    try {
      await api.post('/accounting/journal-entries', {
        entryDate: new Date().toISOString(),
        note: 'Purchase Order for ' + (suppliers.find(s => s.id === supplierId)?.name || '') + ': ' + (note || ''),
        lines: [
          { accountCode: '1200', debit: grandTotal.toFixed(2), credit: '0', note: 'Inventory Asset' },
          { accountCode: '2100', debit: '0', credit: grandTotal.toFixed(2), note: 'Accounts Payable' },
        ],
      });
      setFormSuccess('Purchase Order created and posted!');
      setShowForm(false); await loadAll();
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
          <span className="eyebrow">Buying Module</span>
          <h1>Purchase Order (أمر الشراء)</h1>
          <p>Create purchase orders for suppliers with auto-filled buying prices from Item Price List.</p>
        </div>
        <button className="primary-button" onClick={() => setShowForm(v => !v)}>{showForm ? 'Cancel' : '+ New Purchase Order'}</button>
      </div>
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {formError && <p style={{ color: '#b91c1c' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', fontWeight: 'bold' }}>{formSuccess}</p>}

      {showForm && (
        <article className="panel module-panel" style={{ background: '#fff', padding: 24, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>New Purchase Order</h2>
          <form onSubmit={(e) => { void handleSubmit(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Supplier</label>
                <select value={supplierId} onChange={e => setSupplierId(e.target.value)} style={{ ...inputStyle, width: '100%' }} required>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                  <option value="EGP">EGP</option><option value="USD">USD</option>
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
                  <div style={{ flex: 1 }}><input type="number" min="0.001" step="any" value={line.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} style={{ ...inputStyle, width: '100%' }} required /></div>
                  <div style={{ flex: 1.5 }}><input type="number" min="0" step="any" value={line.rate} onChange={e => updateLine(idx, 'rate', e.target.value)} style={{ ...inputStyle, width: '100%' }} required /></div>
                  <div style={{ flex: 1.5, fontWeight: 'bold', color: '#b45309' }}>{(parseFloat(line.quantity || '0') * parseFloat(line.rate || '0')).toFixed(2)}</div>
                  <button type="button" onClick={() => lines.length > 1 && setLines(lines.filter((_, i) => i !== idx))} style={{ width: 36, height: 36, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>x</button>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                <button type="button" onClick={() => setLines([...lines, { itemId: items[0]?.id || '', quantity: '1', rate: '0' }])} className="filter-button">+ Add Line</button>
                <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b45309' }}>Total: {grandTotal.toFixed(2)} {currency}</div>
              </div>
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="PO notes..." style={{ ...inputStyle, minHeight: 50 }} />
            <button type="submit" disabled={submitting} className="primary-button" style={{ alignSelf: 'flex-start' }}>Save Purchase Order</button>
          </form>
        </article>
      )}
    </section>
  );
}
