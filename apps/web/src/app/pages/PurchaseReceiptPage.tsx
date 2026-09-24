import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface SupplierRecord {
  id: string;
  name: string;
}
interface ItemRecord {
  id: string;
  code: string;
  name: string;
}
interface WarehouseRecord {
  id: string;
  code: string;
  name: string;
}

export function PurchaseReceiptPage(): JSX.Element {
  const { t: _t, i18n } = useTranslation();
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [itemId, setItemId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [qty, setQty] = useState('1');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  async function loadAll(): Promise<void> {
    setLoading(true);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [supRes, itemRes, whRes] = await Promise.all([
        api.get<{ suppliers: SupplierRecord[] }>('/crm/suppliers').catch(() => ({ suppliers: [] })),
        api.get<{ items: ItemRecord[] }>('/catalog/items?lang=' + lang),
        api.get<{ warehouses: WarehouseRecord[] }>('/inventory/warehouses'),
      ]);
      setSuppliers(supRes.suppliers || []);
      setItems(itemRes.items);
      setWarehouses(whRes.warehouses);
      if (supRes.suppliers?.[0]) setSupplierId(supRes.suppliers[0].id);
      if (itemRes.items[0]) setItemId(itemRes.items[0].id);
      if (whRes.warehouses[0]) setWarehouseId(whRes.warehouses[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [i18n.language]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post('/inventory/movements', {
        itemId,
        warehouseId,
        movementType: 'receipt',
        quantity: qty,
        movementDate: new Date().toISOString(),
        note:
          'Purchase Receipt from ' +
          (suppliers.find((s) => s.id === supplierId)?.name || '') +
          ': ' +
          (note || ''),
      });
      setFormSuccess('Purchase Receipt posted! Stock updated automatically.');
      setShowForm(false);
      setQty('1');
      setNote('');
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b', fontWeight: 'bold' as const };

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>Loading...</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">Buying Module</span>
          <h1>Purchase Receipt (إذن استلام المشتريات)</h1>
          <p>
            Record incoming goods from suppliers. Stock balance is updated automatically on
            submission.
          </p>
        </div>
        <button className="primary-button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ New Purchase Receipt'}
        </button>
      </div>
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {formError && <p style={{ color: '#b91c1c' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', fontWeight: 'bold' }}>{formSuccess}</p>}

      {showForm && (
        <article
          className="panel module-panel"
          style={{
            background: '#fff',
            padding: 24,
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            marginBottom: 24,
          }}
        >
          <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>New Purchase Receipt</h2>
          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Supplier</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  style={{ ...inputStyle, width: '100%' }}
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Item Received</label>
                <select
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  style={{ ...inputStyle, width: '100%' }}
                  required
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.code})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Target Warehouse</label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  style={{ ...inputStyle, width: '100%' }}
                  required
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Quantity Received</label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  style={{ ...inputStyle, width: '100%' }}
                  required
                />
              </div>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Receipt notes..."
              style={{ ...inputStyle, minHeight: 50 }}
            />
            <button
              type="submit"
              disabled={submitting}
              className="primary-button"
              style={{ alignSelf: 'flex-start' }}
            >
              Submit Receipt & Update Stock
            </button>
          </form>
        </article>
      )}
    </section>
  );
}
