import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface ItemRecord { id: string; code: string; name: string; }
interface ItemCategoryRecord { id: string; code: string; name: string; }
interface OrgNodeTreeItem { id: string; name: string; nodeType: string; children: OrgNodeTreeItem[]; }
interface SfLineInput { itemId: string; forecastQuantity: string; }
interface SfLineRecord { id: string; itemId: string; forecastQuantity: string; }
interface SalesForecastRecord {
  id: string; forecastNumber: string; orgNodeId: string; itemCategoryId: string;
  fromDate: string; toDate: string; forecastPeriodicity: string; status: string; lines: SfLineRecord[];
}

function flattenOrgNodes(nodes: OrgNodeTreeItem[]): OrgNodeTreeItem[] {
  const result: OrgNodeTreeItem[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) result.push(...flattenOrgNodes(node.children));
  }
  return result;
}

export function SalesForecastPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [categories, setCategories] = useState<ItemCategoryRecord[]>([]);
  const [orgNodes, setOrgNodes] = useState<OrgNodeTreeItem[]>([]);
  const [forecasts, setForecasts] = useState<SalesForecastRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [itemCategoryId, setItemCategoryId] = useState('');
  const [orgNodeId, setOrgNodeId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [periodicity, setPeriodicity] = useState('quarterly');
  const [lines, setLines] = useState<SfLineInput[]>([{ itemId: '', forecastQuantity: '1' }]);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemsRes, catRes, orgRes, sfRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ tree: Array<{ id: string; code: string; name: string; children: unknown[] }> }>(`/catalog/categories/tree?lang=${lang}`),
        api.get<{ tree: OrgNodeTreeItem[] }>('/organization/tree'),
        api.get<{ salesForecasts: SalesForecastRecord[] }>('/planning/sales-forecasts'),
      ]);
      setItems(itemsRes.items);
      setCategories(catRes.tree.map((c) => ({ id: c.id, code: c.code, name: c.name })));
      const flatOrgNodes = flattenOrgNodes(orgRes.tree);
      setOrgNodes(flatOrgNodes);
      setForecasts(sfRes.salesForecasts);
      if (!itemCategoryId && catRes.tree[0]) setItemCategoryId(catRes.tree[0].id);
      const lastOrgNode = flatOrgNodes[flatOrgNodes.length - 1];
      if (!orgNodeId && lastOrgNode) setOrgNodeId(lastOrgNode.id);
      if (lines[0] && !lines[0].itemId && itemsRes.items[0]) {
        setLines([{ itemId: itemsRes.items[0].id, forecastQuantity: '1' }]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load sales forecast data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  function addLine(): void {
    const defaultItem = items[0]?.id ?? '';
    setLines([...lines, { itemId: defaultItem, forecastQuantity: '1' }]);
  }

  function updateLine(index: number, field: keyof SfLineInput, value: string): void {
    const updated = [...lines];
    const current = updated[index];
    if (current) {
      updated[index] = { ...current, [field]: value };
      setLines(updated);
    }
  }

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/planning/sales-forecasts', {
        orgNodeId, itemCategoryId, fromDate, toDate, forecastPeriodicity: periodicity,
        lines: lines.map((l) => ({ itemId: l.itemId, forecastQuantity: l.forecastQuantity })),
      });
      setShowForm(false);
      setFormSuccess(t('pages.sales_forecast.createForecast'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleSubmitForecast(id: string): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post(`/planning/sales-forecasts/${id}/submit`, {});
      setFormSuccess(t('pages.sales_forecast.submit'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  const itemLabel = (id: string): string => items.find((it) => it.id === id)?.name ?? id;
  const catLabel = (id: string): string => categories.find((c) => c.id === id)?.name ?? id;
  const orgLabel = (id: string): string => orgNodes.find((o) => o.id === id)?.name ?? id;
  const periodLabel = (p: string): string => t(`pages.sales_forecast.${p === 'half_yearly' ? 'halfYearly' : p}`);
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>{t('pages.production_ops.form.loading')}</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.sales_forecast.eyebrow')}</span>
          <h1>{t('pages.sales_forecast.title')}</h1>
          <p>{t('pages.sales_forecast.description')}</p>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}
      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Material Planning</span>
            <h2>{t('pages.sales_forecast.listTitle')}</h2>
          </div>
          <button className="primary-button" onClick={() => setShowForm((v) => !v)}><b>+</b>{t('pages.sales_forecast.createForecast')}</button>
        </div>

        {showForm && (
          <form onSubmit={(e) => { void handleCreate(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 0 20px' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.sales_forecast.itemCategory')}</label>
                <select value={itemCategoryId} onChange={(e) => setItemCategoryId(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.sales_forecast.activity')}</label>
                <select value={orgNodeId} onChange={(e) => setOrgNodeId(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
                  {orgNodes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.sales_forecast.fromDate')}</label>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.sales_forecast.toDate')}</label>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.sales_forecast.periodicity')}</label>
                <select value={periodicity} onChange={(e) => setPeriodicity(e.target.value)} style={{ ...inputStyle, minWidth: 130 }}>
                  <option value="monthly">{t('pages.sales_forecast.monthly')}</option>
                  <option value="quarterly">{t('pages.sales_forecast.quarterly')}</option>
                  <option value="half_yearly">{t('pages.sales_forecast.halfYearly')}</option>
                  <option value="yearly">{t('pages.sales_forecast.yearly')}</option>
                </select>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <label style={{ ...labelStyle, fontWeight: 'bold', marginBottom: 10, display: 'block' }}>{t('pages.sales_forecast.addLine')}</label>
              <div style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 12, color: '#64748b', fontWeight: 'bold' }}>
                <span style={{ flex: 2 }}>{t('pages.sales_forecast.item')}</span>
                <span style={{ width: 140 }}>{t('pages.sales_forecast.forecastQty')}</span>
              </div>
              {lines.map((line, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
                  <select value={line.itemId} onChange={(e) => updateLine(idx, 'itemId', e.target.value)} style={{ ...inputStyle, flex: 2, minWidth: 200 }}>
                    {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
                  </select>
                  <input type="number" min="0.01" step="any" value={line.forecastQuantity} onChange={(e) => updateLine(idx, 'forecastQuantity', e.target.value)} required style={{ ...inputStyle, width: 140 }} />
                </div>
              ))}
              <button type="button" onClick={addLine} className="filter-button" style={{ marginTop: 12 }}>+ {t('pages.sales_forecast.addLine')}</button>
            </div>

            <button type="submit" disabled={submitting} className="primary-button" style={{ alignSelf: 'flex-start' }}>{t('pages.technical.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.sales_forecast.forecastNumber')}</span>
            <span>{t('pages.sales_forecast.itemCategory')}</span>
            <span>{t('pages.sales_forecast.periodicity')}</span>
            <span>{t('pages.sales_forecast.activity')}</span>
            <span>{t('pages.sales_forecast.status')}</span>
            <span>{t('common.filter')}</span>
          </div>
          {forecasts.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.sales_forecast.noForecasts')}</p>}
          {forecasts.map((sf) => (
            <div className="placeholder-table__row" key={sf.id}>
              <span><b>{sf.forecastNumber}</b></span>
              <span>{catLabel(sf.itemCategoryId)}</span>
              <span>{periodLabel(sf.forecastPeriodicity)}</span>
              <span>{orgLabel(sf.orgNodeId)}</span>
              <span><span className={`status status--${sf.status === 'submitted' ? 'success' : 'neutral'}`}><i />{sf.status}</span></span>
              <span>
                {sf.status === 'draft' && (
                  <button className="primary-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { void handleSubmitForecast(sf.id); }}>
                    {t('pages.sales_forecast.submit')}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
