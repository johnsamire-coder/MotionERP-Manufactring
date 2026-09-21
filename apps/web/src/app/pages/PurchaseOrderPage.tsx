import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, financeApi, ApiError } from '../api/client';

interface SupplierRecord { id: string; name: string; }
interface ItemRecord { id: string; code: string; name: string; }
interface POLineInput { itemId: string; quantity: string; unitCost: string; taxRate: string; }

export function PurchaseOrderPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [orgNodeId, setOrgNodeId] = useState('00000000-0000-0000-0000-000000000001');
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<POLineInput[]>([
    { itemId: '', quantity: '1', unitCost: '0', taxRate: '14.00' },
  ]);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [invRes, supRes, itemRes] = await Promise.all([
        financeApi.getPurchaseInvoices().catch(() => ({ purchaseInvoices: [] })),
        api.get<{ suppliers: SupplierRecord[] }>('/crm/suppliers').catch(() => ({ suppliers: [] })),
        api.get<{ items: ItemRecord[] }>('/catalog/items?lang=' + lang).catch(() => ({ items: [] })),
      ]);

      setInvoices(invRes.purchaseInvoices ?? []);
      setSuppliers(supRes.suppliers ?? []);
      const itms = itemRes.items ?? [];
      setItems(itms);

      if (supRes.suppliers && supRes.suppliers[0] && !supplierId) {
        setSupplierId(supRes.suppliers[0].id);
      }
      if (itms[0] && !lines[0]?.itemId) {
        setLines([{ itemId: itms[0].id, quantity: '1', unitCost: '0', taxRate: '14.00' }]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ظپط´ظ„ طھط­ظ…ظٹظ„ ط¨ظٹط§ظ†ط§طھ ظپظˆط§طھظٹط± ط§ظ„ظ…ط´طھط±ظٹط§طھ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  const updateLine = (idx: number, field: keyof POLineInput, value: string) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx]!, [field]: value };
    setLines(updated);
  };

  const addLine = () => {
    setLines([...lines, { itemId: items[0]?.id || '', quantity: '1', unitCost: '0', taxRate: '14.00' }]);
  };

  const removeLine = (idx: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== idx));
    }
  };

  const netTotal = lines.reduce((sum, l) => sum + (Number(l.quantity || 0) * Number(l.unitCost || 0)), 0);
  const taxTotal = lines.reduce((sum, l) => sum + ((Number(l.quantity || 0) * Number(l.unitCost || 0) * Number(l.taxRate || 14)) / 100), 0);
  const grandTotal = netTotal + taxTotal;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);

      await financeApi.createPurchaseInvoice({
        orgNodeId,
        supplierId,
        invoiceNumber,
        invoiceDate: invoiceDate ? new Date(invoiceDate).toISOString() : new Date().toISOString(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : nextMonth.toISOString(),
        notes: notes.trim() || undefined,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          unitCost: l.unitCost,
          taxRate: l.taxRate,
        })),
      });

      setSuccess('طھظ… طھط³ط¬ظٹظ„ ظپط§طھظˆط±ط© ط§ظ„ظ…ظˆط±ط¯ ط¨ظ†ط¬ط§ط­ (ظ…ط³ظˆط¯ط© ط¬ط§ظ‡ط²ط© ظ„ظ„ظ…ط·ط§ط¨ظ‚ط© ظˆط§ظ„طھط±ط­ظٹظ„)');
      setShowForm(false);
      setInvoiceNumber('');
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ظپط´ظ„ طھط³ط¬ظٹظ„ ط§ظ„ظپط§طھظˆط±ط©');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePost(id: string): Promise<void> {
    try {
      await financeApi.postPurchaseInvoice(id);
      setSuccess('طھظ… طھط±ط­ظٹظ„ ط§ظ„ظپط§طھظˆط±ط© ظˆظ‚ظپظ„ ظˆط³ظٹط· GRNI ظˆط¥ط«ط¨ط§طھ ظ…ط¯ظٹظˆظ†ظٹط© ط§ظ„ظ…ظˆط±ط¯ ظˆط¶ط±ظٹط¨ط© ط§ظ„ظ…ط¯ط®ظ„ط§طھ ط¨ظ†ط¬ط§ط­!');
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ظپط´ظ„ طھط±ط­ظٹظ„ ط§ظ„ظپط§طھظˆط±ط©');
    }
  }

  const supName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? id;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">ط§ظ„ظ…ط´طھط±ظٹط§طھ ظˆط§ظ„ظ…ظˆط±ط¯ظٹظ†</span>
          <h1>ظپظˆط§طھظٹط± ط§ظ„ظ…ط´طھط±ظٹط§طھ ظˆظ…ط·ط§ط¨ظ‚ط© GRNI</h1>
          <p>طھط³ط¬ظٹظ„ ظپظˆط§طھظٹط± ط§ظ„ظ…ظˆط±ط¯ظٹظ† ط§ظ„ط¶ط±ظٹط¨ظٹط© ظˆطھط³ظˆظٹط© ظˆط³ظٹط· ط§ط³طھظ„ط§ظ… ط§ظ„ط¨ط¶ط§ط¹ط© ظˆط¥ط«ط¨ط§طھ ط¶ط±ظٹط¨ط© ط§ظ„ظ‚ظٹظ…ط© ط§ظ„ظ…ط¶ط§ظپط©</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'ط¥ظ„ط؛ط§ط،' : '+ طھط³ط¬ظٹظ„ ظپط§طھظˆط±ط© ظ…ظˆط±ط¯'}
        </button>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert alert--success" style={{ marginBottom: 16 }}>{success}</div>}

      {showForm && (
        <form className="form-card" onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <h3>طھط³ط¬ظٹظ„ ظپط§طھظˆط±ط© ظ…ط´طھط±ظٹط§طھ ظ…ظˆط±ط¯ ط¬ط¯ظٹط¯ط©</h3>
          <div className="form-grid">
            <label>ط§ظ„ظ…ظˆط±ط¯
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label>ط±ظ‚ظ… ظپط§طھظˆط±ط© ط§ظ„ظ…ظˆط±ط¯ ط§ظ„ظˆط±ظ‚ظٹط©
              <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="ظ…ط«ط§ظ„: INV-SUP-8899" required />
            </label>
            <label>طھط§ط±ظٹط® ط§ظ„ظپط§طھظˆط±ط©
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
            </label>
            <label>طھط§ط±ظٹط® ط§ظ„ط§ط³طھط­ظ‚ط§ظ‚
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
          </div>

          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginTop: 16, border: '1px solid #e2e8f0' }}>
            <h4>ط£طµظ†ط§ظپ ظˆط®ط§ظ…ط§طھ ط§ظ„ظپط§طھظˆط±ط©</h4>
            {lines.map((line, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1.5fr 1fr 1.5fr auto', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                <select value={line.itemId} onChange={(e) => updateLine(idx, 'itemId', e.target.value)} required>
                  {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
                </select>
                <input type="number" step="any" min="0.001" value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} placeholder="ط§ظ„ظƒظ…ظٹط©" required />
                <input type="number" step="any" min="0" value={line.unitCost} onChange={(e) => updateLine(idx, 'unitCost', e.target.value)} placeholder="ط³ط¹ط± ط§ظ„ط´ط±ط§ط،" required />
                <input type="number" step="any" value={line.taxRate} onChange={(e) => updateLine(idx, 'taxRate', e.target.value)} placeholder="ط§ظ„ط¶ط±ظٹط¨ط© %" />
                <b style={{ color: '#b45309' }}>
                  {(Number(line.quantity || 0) * Number(line.unitCost || 0) * (1 + (Number(line.taxRate || 14) / 100))).toFixed(2)} ط¬.ظ…
                </b>
                <button type="button" className="btn btn--sm btn--danger" onClick={() => removeLine(idx)}>x</button>
              </div>
            ))}
            <button type="button" className="btn btn--sm" onClick={addLine}>+ ط¥ط¶ط§ظپط© ط®ط§ظ…ط©</button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '12px 16px', background: '#fffbeb', borderRadius: 8 }}>
            <div>
              <span>ط§ظ„طµط§ظپظٹ: <b>{netTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ط¬.ظ…</b></span> | 
              <span style={{ margin: '0 12px' }}>ط§ظ„ط¶ط±ظٹط¨ط© (14%): <b>{taxTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ط¬.ظ…</b></span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b45309' }}>
              ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ظ…ط³طھط­ظ‚ ظ„ظ„ظ…ظˆط±ط¯: {grandTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ط¬.ظ…
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
              <th>ط±ظ‚ظ… ط§ظ„ظپط§طھظˆط±ط© (ط§ظ„ط³ظٹط³طھظ…)</th>
              <th>ط±ظ‚ظ… ظپط§طھظˆط±ط© ط§ظ„ظ…ظˆط±ط¯</th>
              <th>ط§ظ„ظ…ظˆط±ط¯</th>
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
              <tr><td colSpan={9}>ط¬ط§ط±ظٹ ط§ظ„طھط­ظ…ظٹظ„...</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={9}>ظ„ط§ طھظˆط¬ط¯ ظپظˆط§طھظٹط± ظ…ط´طھط±ظٹط§طھ ظ…ط³ط¬ظ„ط©</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id}>
                  <td><b>{inv.systemNumber}</b></td>
                  <td><code>{inv.invoiceNumber}</code></td>
                  <td>{supName(inv.supplierId)}</td>
                  <td>{new Date(inv.invoiceDate).toLocaleDateString('ar-EG')}</td>
                  <td>{Number(inv.netAmount).toLocaleString('ar-EG')} ط¬.ظ…</td>
                  <td>{Number(inv.taxAmount).toLocaleString('ar-EG')} ط¬.ظ…</td>
                  <td><b>{Number(inv.grandTotal).toLocaleString('ar-EG')} ط¬.ظ…</b></td>
                  <td>
                    <span className={`status-badge status-badge--${inv.status === 'posted' ? 'active' : 'draft'}`}>
                      {inv.status === 'posted' ? 'ظ…ط±ط­ظ„ ظˆظ…ط·ط§ط¨ظ‚' : 'ظ…ط³ظˆط¯ط©'}
                    </span>
                  </td>
                  <td>
                    {inv.status === 'draft' && (
                      <button className="btn btn--sm btn--success" onClick={() => handlePost(inv.id)}>
                        ط§ط¹طھظ…ط§ط¯ ظˆطھط±ط­ظٹظ„
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