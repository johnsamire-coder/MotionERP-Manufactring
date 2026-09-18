import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface ItemRecord { id: string; code: string; name: string; }
interface WarehouseRecord { id: string; code: string; name: string; }
interface StockBalanceRecord { itemId: string; warehouseId: string; onHand: string; reserved: string; }

export function StockReconciliationPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [balances, setBalances] = useState<StockBalanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [itemId, setItemId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [newQty, setNewQty] = useState('0');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  async function loadAll(): Promise<void> {
    setLoading(true);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemRes, whRes, balRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>('/catalog/items?lang=' + lang),
        api.get<{ warehouses: WarehouseRecord[] }>('/inventory/warehouses'),
        api.get<{ balances: StockBalanceRecord[] }>('/inventory/stock-balances').catch(() => ({ balances: [] })),
      ]);
      setItems(itemRes.items);
      setWarehouses(whRes.warehouses);
      setBalances(balRes.balances || []);
      if (itemRes.items[0]) setItemId(itemRes.items[0].id);
      if (whRes.warehouses[0]) setWarehouseId(whRes.warehouses[0].id);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Failed'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  const currentBalance = balances.find(b => b.itemId === itemId && b.warehouseId === warehouseId);
  const currentQty = currentBalance ? parseFloat(currentBalance.onHand) : 0;
  const diff = parseFloat(newQty) - currentQty;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault(); setSubmitting(true); setFormError(null);
    if (diff === 0) { setFormError('No difference to reconcile.'); setSubmitting(false); return; }
    try {
      await api.post('/inventory/movements', {
        itemId, warehouseId,
        movementType: 'adjustment',
        quantity: Math.abs(diff).toString(),
        movementDate: new Date().toISOString(),
        note: 'Stock Reconciliation: ' + currentQty + ' -> ' + newQty + '. ' + (note || ''),
      });
      setFormSuccess('Stock reconciled! Balance adjusted from ' + currentQty + ' to ' + newQty);
      setShowForm(false); await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  }

  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b', fontWeight: 'bold' as const };
  const itemLabel = (id: string): string => items.find(it => it.id === id)?.name ?? id;
  const whLabel = (id: string): string => warehouses.find(w => w.id === id)?.name ?? id;

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>Loading...</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">Stock Controls</span>
          <h1>Stock Reconciliation (تسوية المخزون)</h1>
          <p>Adjust stock balances after physical counting. Differences are posted as adjustment entries.</p>
        </div>
        <button className="primary-button" onClick={() => setShowForm(v => !v)}>{showForm ? 'Cancel' : '+ New Reconciliation'}</button>
      </div>
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {formError && <p style={{ color: '#b91c1c' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', fontWeight: 'bold' }}>{formSuccess}</p>}

      {showForm && (
        <article className="panel module-panel" style={{ background: '#fff', padding: 24, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>New Stock Reconciliation</h2>
          <form onSubmit={(e) => { void handleSubmit(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Item</label>
                <select value={itemId} onChange={e => setItemId(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                  {items.map(it => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Warehouse</label>
                <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                  {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, background: '#f8fafc', padding: 16, borderRadius: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Current System Qty</div>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#0f172a' }}>{currentQty.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Physical Count (Actual)</div>
                <input type="number" step="any" value={newQty} onChange={e => setNewQty(e.target.value)} style={{ ...inputStyle, width: '100%', textAlign: 'center', fontSize: 20, fontWeight: 'bold' }} required />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Difference</div>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: diff > 0 ? '#166534' : diff < 0 ? '#b91c1c' : '#64748b' }}>
                  {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                </div>
              </div>
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Reason for adjustment..." style={{ ...inputStyle, minHeight: 50 }} />
            <button type="submit" disabled={submitting} className="primary-button" style={{ alignSelf: 'flex-start' }}>Reconcile & Adjust Stock</button>
          </form>
        </article>
      )}

      {/* Current Balances Overview */}
      <article className="panel module-panel" style={{ background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: 16, margin: '0 0 16px' }}>Current Stock Balances</h2>
        <div className="placeholder-table">
          <div className="placeholder-table__head"><span>Item</span><span>Warehouse</span><span>On Hand</span><span>Reserved</span><span>Available</span></div>
          {balances.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>No balances yet.</p>}
          {balances.map((b, idx) => (
            <div className="placeholder-table__row" key={idx}>
              <span><b>{itemLabel(b.itemId)}</b></span>
              <span>{whLabel(b.warehouseId)}</span>
              <span><b>{parseFloat(b.onHand).toFixed(2)}</b></span>
              <span>{parseFloat(b.reserved).toFixed(2)}</span>
              <span style={{ color: (parseFloat(b.onHand) - parseFloat(b.reserved)) > 0 ? '#166534' : '#b91c1c', fontWeight: 'bold' }}>
                {(parseFloat(b.onHand) - parseFloat(b.reserved)).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
