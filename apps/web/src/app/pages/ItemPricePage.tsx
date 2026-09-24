import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface ItemRecord {
  id: string;
  code: string;
  name: string;
  itemType: string;
}
interface ItemPriceRecord {
  id: string;
  itemId: string;
  priceListType: 'buying' | 'selling';
  price: string;
  currency: string;
  validFrom: string;
  validUntil: string | null;
}

export function ItemPricePage(): JSX.Element {
  const { t: _t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [prices, setPrices] = useState<ItemPriceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [priceType, setPriceType] = useState<'buying' | 'selling'>('selling');
  const [priceValue, setPriceValue] = useState('0');
  const [currency, setCurrency] = useState('EGP');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0] || '');
  const [validUntil, setValidUntil] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  async function loadItems(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const res = await api.get<{ items: ItemRecord[] }>('/catalog/items?lang=' + lang);
      setItems(res.items);
      if (res.items[0]) {
        setSelectedItemId(res.items[0].id);
        await loadItemPrices(res.items[0].id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load items');
    } finally {
      setLoading(false);
    }
  }

  async function loadItemPrices(itemId: string): Promise<void> {
    try {
      const res = await api.get<{ itemPrices: ItemPriceRecord[] }>(
        '/catalog/items/' + itemId + '/prices',
      );
      setPrices(res.itemPrices);
    } catch {
      setPrices([]);
    }
  }

  useEffect(() => {
    void loadItems();
  }, [i18n.language]);

  async function handleItemChange(itemId: string): Promise<void> {
    setSelectedItemId(itemId);
    await loadItemPrices(itemId);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);
    try {
      await api.post('/catalog/items/' + selectedItemId + '/prices', {
        priceListType: priceType,
        price: priceValue,
        currency,
        validFrom: validFrom || undefined,
        validUntil: validUntil || undefined,
      });
      setFormSuccess('Price updated successfully');
      setPriceValue('0');
      await loadItemPrices(selectedItemId);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to update price');
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b', fontWeight: 'bold' as const };

  if (loading)
    return <p style={{ padding: 40, textAlign: 'center' }}>Loading Item Price Data...</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">Stock Master Data</span>
          <h1>Item Price (سعر الصنف)</h1>
          <p>Define standard buying and selling prices for raw materials and finished items.</p>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}
      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, marginTop: 20 }}>
        <article
          className="panel module-panel"
          style={{ background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0' }}
        >
          <h2 style={{ fontSize: 16, margin: '0 0 16px' }}>Set Item Price</h2>
          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>Select Item</label>
              <select
                value={selectedItemId}
                onChange={(e) => void handleItemChange(e.target.value)}
                style={{ ...inputStyle, width: '100%' }}
              >
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.code})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>Price List Type</label>
              <select
                value={priceType}
                onChange={(e) => setPriceType(e.target.value as 'buying' | 'selling')}
                style={{ ...inputStyle, width: '100%' }}
              >
                <option value="selling">Selling Price (سعر بيع)</option>
                <option value="buying">Buying Price (سعر شراء)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Price Rate</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={priceValue}
                  onChange={(e) => setPriceValue(e.target.value)}
                  style={{ ...inputStyle, width: '100%' }}
                  required
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  style={{ ...inputStyle, width: '100%' }}
                >
                  <option value="EGP">EGP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Valid From</label>
                <input
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  style={{ ...inputStyle, width: '100%' }}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Valid Until</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  style={{ ...inputStyle, width: '100%' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="primary-button"
              style={{ marginTop: 10 }}
            >
              Save Price
            </button>
          </form>
        </article>

        <article
          className="panel module-panel"
          style={{ background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0' }}
        >
          <h2 style={{ fontSize: 16, margin: '0 0 16px' }}>Price Ledger History</h2>
          <div className="placeholder-table">
            <div className="placeholder-table__head">
              <span>Type</span>
              <span>Rate</span>
              <span>Currency</span>
              <span>Valid From</span>
              <span>Valid Until</span>
            </div>
            {prices.length === 0 && (
              <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>
                No prices defined yet for this item.
              </p>
            )}
            {prices.map((pr) => (
              <div className="placeholder-table__row" key={pr.id}>
                <span>
                  <b style={{ color: pr.priceListType === 'selling' ? '#0369a1' : '#b45309' }}>
                    {pr.priceListType.toUpperCase()}
                  </b>
                </span>
                <span>
                  <b>{parseFloat(pr.price).toFixed(2)}</b>
                </span>
                <span>{pr.currency}</span>
                <span>{new Date(pr.validFrom).toLocaleDateString()}</span>
                <span>{pr.validUntil ? new Date(pr.validUntil).toLocaleDateString() : '—'}</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
