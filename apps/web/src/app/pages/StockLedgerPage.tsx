import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface ItemRecord { id: string; code: string; name: string; }
interface WarehouseRecord { id: string; code: string; name: string; }
interface StockMovementRecord {
  id: string; itemId: string; warehouseId: string;
  movementType: string; quantity: string; movementDate: string; note: string | null;
}
interface StockBalanceRecord {
  itemId: string; warehouseId: string; onHand: string; reserved: string;
}

export function StockLedgerPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [movements, setMovements] = useState<StockMovementRecord[]>([]);
  const [balances, setBalances] = useState<StockBalanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State - ERPNext Style
  const [filterItemId, setFilterItemId] = useState('');
  const [filterWarehouseId, setFilterWId] = useState('');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemsRes, whRes, movRes, balRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ warehouses: WarehouseRecord[] }>('/inventory/warehouses'),
        api.get<{ movements: StockMovementRecord[] }>('/inventory/movements'),
        api.get<{ balances: StockBalanceRecord[] }>('/inventory/stock-balances').catch(() => ({ balances: [] })),
      ]);
      setItems(itemsRes.items);
      setWarehouses(whRes.warehouses);
      setMovements(movRes.movements || []);
      setBalances(balRes.balances || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load stock ledger data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [i18n.language]);

  const whLabel = (id: string): string => warehouses.find((w) => w.id === id)?.name ?? id;
  const itemLabel = (id: string): string => items.find((it) => it.id === id)?.name ?? id;
  const itemCode = (id: string): string => items.find((it) => it.id === id)?.code ?? '';

  // فلترة الحركات بناءً على اختيارات المستخدم
  const filteredMovements = movements.filter((m) => {
    const matchItem = filterItemId ? m.itemId === filterItemId : true;
    const matchWarehouse = filterWarehouseId ? m.warehouseId === filterWarehouseId : true;
    return matchItem && matchWarehouse;
  });

  const inputStyle = { padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 };
  const labelStyle = { fontSize: 12, color: '#64748b', fontWeight: 'bold' as const };

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>Loading Stock Ledger...</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">Stock Reports & Analysis</span>
          <h1>Stock Ledger (دفتر أستاذ المخزون)</h1>
          <p>Detailed historical log of all inventory ins, outs, and cumulative balances per item per warehouse.</p>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}

      {/* Filters Toolbar - ERPNext Style */}
      <article className="panel module-panel" style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
            <label style={labelStyle}>Filter by Item (الصنف)</label>
            <select value={filterItemId} onChange={(e) => setFilterItemId(e.target.value)} style={inputStyle}>
              <option value="">— All Items (كل الأصناف) —</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>{it.name} ({it.code})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
            <label style={labelStyle}>Filter by Warehouse (المستودع)</label>
            <select value={filterWarehouseId} onChange={(e) => setFilterWId(e.target.value)} style={inputStyle}>
              <option value="">— All Warehouses (كل المستودعات) —</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>{wh.name}</option>
              ))}
            </select>
          </div>

          <button className="filter-button" style={{ height: 34, padding: '0 16px' }} onClick={() => { setFilterItemId(''); setFilterWId(''); }}>
            Clear Filters
          </button>
        </div>
      </article>

      {/* Stock Ledger Ledger View */}
      <article className="panel module-panel" style={{ background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <div className="placeholder-table">
          <div className="placeholder-table__head" style={{ gridTemplateColumns: '1.2fr 2fr 1.5fr 1fr 1fr 2fr' }}>
            <span>Posting Date</span>
            <span>Item (الصنف)</span>
            <span>Warehouse</span>
            <span>Voucher Type</span>
            <span>Qty Change</span>
            <span>Remarks / Voucher Note</span>
          </div>

          {filteredMovements.length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>
              No ledger entries match the selected filters.
            </p>
          )}

          {filteredMovements.map((mov) => {
            const isReceipt = mov.movementType === 'receipt' || mov.movementType === 'transfer_in';
            const qtyChange = parseFloat(mov.quantity);

            return (
              <div className="placeholder-table__row" key={mov.id} style={{ gridTemplateColumns: '1.2fr 2fr 1.5fr 1fr 1fr 2fr', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>{new Date(mov.movementDate).toLocaleString()}</span>
                <span>
                  <b>{itemLabel(mov.itemId)}</b>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{itemCode(mov.itemId)}</div>
                </span>
                <span>{whLabel(mov.warehouseId)}</span>
                <span>
                  <span className={`status status--${isReceipt ? 'success' : 'neutral'}`} style={{ fontSize: 11, padding: '2px 6px' }}>
                    {mov.movementType.toUpperCase()}
                  </span>
                </span>
                <span>
                  <b style={{ color: isReceipt ? '#166534' : '#b91c1c' }}>
                    {isReceipt ? '+' : '-'}{qtyChange.toFixed(2)}
                  </b>
                </span>
                <span style={{ fontSize: 12, color: '#475569' }}>{mov.note || '—'}</span>
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
}
