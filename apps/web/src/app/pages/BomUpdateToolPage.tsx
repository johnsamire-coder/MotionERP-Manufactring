import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface BomOption { id: string; version: number; productItemId: string; }
interface ItemRecord { id: string; code: string; name: string; }
interface ReplaceResult { currentBomId: string; newBomId: string; workOrdersUpdated: number; productionPlanItemsUpdated: number; }

export function BomUpdateToolPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [boms, setBoms] = useState<BomOption[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentBomId, setCurrentBomId] = useState('');
  const [newBomId, setNewBomId] = useState('');
  const [result, setResult] = useState<ReplaceResult | null>(null);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [bomsRes, itemsRes] = await Promise.all([
        api.get<{ boms: BomOption[] }>('/technical/boms'),
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
      ]);
      setBoms(bomsRes.boms);
      setItems(itemsRes.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load BOM data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  async function handleReplace(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null); setResult(null); setSubmitting(true);
    try {
      const res = await api.post<{ result: ReplaceResult }>('/manufacturing-tools/bom-update-tool/replace', { currentBomId, newBomId });
      setResult(res.result);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  const itemLabel = (id: string): string => items.find((it) => it.id === id)?.name ?? id;
  const bomLabel = (b: BomOption): string => `${itemLabel(b.productItemId)} — v${b.version}`;
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>{t('pages.production_ops.form.loading')}</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.bom_update_tool.eyebrow')}</span>
          <h1>{t('pages.bom_update_tool.title')}</h1>
          <p>{t('pages.bom_update_tool.description')}</p>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}

      <article className="panel module-panel">
        <form onSubmit={(e) => { void handleReplace(e); }} style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end', padding: '10px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('pages.bom_update_tool.currentBom')}</label>
            <select value={currentBomId} onChange={(e) => setCurrentBomId(e.target.value)} required style={{ ...inputStyle, minWidth: 220 }}>
              <option value="">{t('pages.bom_update_tool.selectBom')}</option>
              {boms.map((b) => <option key={b.id} value={b.id}>{bomLabel(b)}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('pages.bom_update_tool.newBom')}</label>
            <select value={newBomId} onChange={(e) => setNewBomId(e.target.value)} required style={{ ...inputStyle, minWidth: 220 }}>
              <option value="">{t('pages.bom_update_tool.selectBom')}</option>
              {boms.map((b) => <option key={b.id} value={b.id}>{bomLabel(b)}</option>)}
            </select>
          </div>
          <button type="submit" disabled={submitting} className="primary-button">{t('pages.bom_update_tool.replace')}</button>
        </form>

        {result && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: 16, marginTop: 16, display: 'flex', gap: 32 }}>
            <div>
              <span style={labelStyle}>{t('pages.bom_update_tool.workOrdersUpdated')}</span>
              <p style={{ margin: '2px 0 0', fontWeight: 'bold', fontSize: 20 }}>{result.workOrdersUpdated}</p>
            </div>
            <div>
              <span style={labelStyle}>{t('pages.bom_update_tool.planItemsUpdated')}</span>
              <p style={{ margin: '2px 0 0', fontWeight: 'bold', fontSize: 20 }}>{result.productionPlanItemsUpdated}</p>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
