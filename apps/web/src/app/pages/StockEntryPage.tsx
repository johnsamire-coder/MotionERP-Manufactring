import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface ItemRecord { id: string; code: string; name: string; }
interface WarehouseRecord { id: string; code: string; name: string; }
interface StockMovementRecord {
  id: string; itemId: string; warehouseId: string;
  movementType: string; quantity: string; movementDate: string; note: string | null;
}

export function StockEntryPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [movements, setMovements] = useState<StockMovementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [purpose, setPurpose] = useState<'receipt' | 'issue' | 'transfer'>('receipt');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [sourceWId, setSourceWId] = useState('');
  const [targetWId, setTargetWId] = useState('');
  const [qty, setQty] = useState('1');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemsRes, whRes, movRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ warehouses: WarehouseRecord[] }>('/inventory/warehouses'),
        api.get<{ movements: StockMovementRecord[] }>('/inventory/movements'),
      ]);
      setItems(itemsRes.items);
      setWarehouses(whRes.warehouses);
      setMovements(movRes.movements || []);
      if (itemsRes.items[0]) setSelectedItemId(itemsRes.items[0].id);
      if (whRes.warehouses[0]) {
        setSourceWId(whRes.warehouses[0].id);
        setTargetWId(whRes.warehouses[0].id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load stock data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [i18n.language]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      if (purpose === 'receipt') {
        await api.post('/inventory/movements', {
          itemId: selectedItemId,
          warehouseId: targetWId,
          movementType: 'receipt',
          quantity: qty,
          movementDate: new Date().toISOString(),
          note: note || undefined,
        });
      } else if (purpose === 'issue') {
        await api.post('/inventory/movements', {
          itemId: selectedItemId,
          warehouseId: sourceWId,
          movementType: 'issue',
          quantity: qty,
          movementDate: new Date().toISOString(),
          note: note || undefined,
        });
      } else if (purpose === 'transfer') {
        if (sourceWId === targetWId) {
          throw new Error('Source and target warehouses must be different for a transfer.');
        }
        // Material Transfer = Issue from Source + Receipt in Target
        await api.post('/inventory/movements', {
          itemId: selectedItemId,
          warehouseId: sourceWId,
          movementType: 'issue', // transfer_out under the hood
          quantity: qty,
          movementDate: new Date().toISOString(),
          note: `Transfer Out to ${whLabel(targetWId)}: ${note}`,
        });
        await api.post('/inventory/movements', {
          itemId: selectedItemId,
          warehouseId: targetWId,
          movementType: 'receipt', // transfer_in under the hood
          quantity: qty,
          movementDate: new Date().toISOString(),
          note: `Transfer In from ${whLabel(sourceWId)}: ${note}`,
        });
      }
      setFormSuccess('Stock Entry posted successfully');
      setQty('1'); setNote('');
      setShowForm(false);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to post Stock Entry');
    } finally {
      setSubmitting(false);
    }
  }

  const whLabel = (id: string | null): string => (id ? (warehouses.find((w) => w.id === id)?.name ?? id) : '—');
  const itemLabel = (id: string): string => items.find((it) => it.id === id)?.name ?? id;
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b', fontWeight: 'bold' as const };

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>Loading Stock Entry Data...</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">Stock Ledger Controls</span>
          <h1>Stock Entry (حركة مخزنية)</h1>
          <p>Register Material Receipts, Issues, and Warehouse-to-Warehouse Transfers.</p>
        </div>
        <button className="primary-button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ Create Stock Entry'}
        </button>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}
      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0', fontWeight: 'bold' }}>{formSuccess}</p>}

      {showForm && (
        <article className="panel module-panel" style={{ background: '#fff', padding: 24, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>New Stock Entry</h2>
          <form onSubmit={(e) => { void handleSubmit(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Purpose</label>
                <select value={purpose} onChange={(e) => setPurpose(e.target.value as any)} style={{ ...inputStyle, width: '100%' }}>
                  <option value="receipt">Material Receipt (إدخال مخزني / بضاعة واردة)</option>
                  <option value="issue">Material Issue (صرف مخزني / بضاعة منصرفة)</option>
                  <option value="transfer">Material Transfer (تحويل بين المخازن / نقل بضاعة)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Select Item</label>
                <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>{it.name} ({it.code})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Quantity</label>
                <input type="number" step="any" min="0.00001" value={qty} onChange={(e) => setQty(e.target.value)} style={{ ...inputStyle, width: '100%' }} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {(purpose === 'issue' || purpose === 'transfer') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={labelStyle}>Source Warehouse (مخزن الصرف)</label>
                  <select value={sourceWId} onChange={(e) => setSourceWId(e.target.value)} style={{ ...inputStyle, width: '100%' }} required>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>{wh.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {(purpose === 'receipt' || purpose === 'transfer') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={labelStyle}>Target Warehouse (مخزن الاستلام)</label>
                  <select value={targetWId} onChange={(e) => setTargetWId(e.target.value)} style={{ ...inputStyle, width: '100%' }} required>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>{wh.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>Remarks / Note</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Scrap replacement, monthly stock count adjustment..." style={{ ...inputStyle, minHeight: 60 }} />
            </div>

            <button type="submit" disabled={submitting} className="primary-button" style={{ alignSelf: 'flex-start' }}>Post Stock Entry</button>
          </form>
        </article>
      )}

      {/* Historical Stock Entry List */}
      <article className="panel module-panel" style={{ background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: 16, margin: '0 0 16px' }}>Stock Ledger Journal Transactions</h2>
        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>Item</span>
            <span>Warehouse</span>
            <span>Type</span>
            <span>Quantity</span>
            <span>Date</span>
            <span>Remarks</span>
          </div>

          {movements.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>No stock movements registered yet.</p>}

          {movements.slice(0, 50).map((mov) => (
            <div className="placeholder-table__row" key={mov.id}>
              <span><b>{itemLabel(mov.itemId)}</b></span>
              <span>{whLabel(mov.warehouseId)}</span>
              <span>
                <b style={{ color: mov.movementType === 'receipt' ? '#166534' : '#b91c1c' }}>
                  {mov.movementType.toUpperCase()}
                </b>
              </span>
              <span><b>{parseFloat(mov.quantity).toFixed(2)}</b></span>
              <span>{new Date(mov.movementDate).toLocaleString()}</span>
              <span>{mov.note || '—'}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
