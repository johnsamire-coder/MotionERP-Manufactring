import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface ItemRecord { id: string; code: string; name: string; }
interface OrgNodeTreeItem { id: string; name: string; nodeType: string; children: OrgNodeTreeItem[]; }
interface WarehouseRecord { id: string; code: string; name: string; }
interface MpsLineInput { period: string; startDate: string; endDate: string; forecastQuantity: string; }
interface MpsLineRecord { id: string; period: string; startDate: string; endDate: string; forecastQuantity: string; }
interface MpsRecord {
  id: string; mpsNumber: string; itemId: string; orgNodeId: string; warehouseId: string | null;
  totalForecastQuantity: string | null; projectedQuantity: string | null; status: string; scheduleLines: MpsLineRecord[];
}

function flattenOrgNodes(nodes: OrgNodeTreeItem[]): OrgNodeTreeItem[] {
  const result: OrgNodeTreeItem[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) result.push(...flattenOrgNodes(node.children));
  }
  return result;
}

export function MpsPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [orgNodes, setOrgNodes] = useState<OrgNodeTreeItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [records, setRecords] = useState<MpsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [itemId, setItemId] = useState('');
  const [orgNodeId, setOrgNodeId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [lines, setLines] = useState<MpsLineInput[]>([{ period: 'month', startDate: '', endDate: '', forecastQuantity: '100' }]);
  const [mpsDistributeTotal, setMpsDistributeTotal] = useState('');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemsRes, orgRes, whRes, mpsRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ tree: OrgNodeTreeItem[] }>('/organization/tree'),
        api.get<{ warehouses: WarehouseRecord[] }>('/inventory/warehouses'),
        api.get<{ masterProductionSchedules: MpsRecord[] }>('/planning/master-production-schedules'),
      ]);
      setItems(itemsRes.items);
      const flatOrgNodes = flattenOrgNodes(orgRes.tree);
      setOrgNodes(flatOrgNodes);
      setWarehouses(whRes.warehouses);
      setRecords(mpsRes.masterProductionSchedules);
      if (!itemId && itemsRes.items[0]) setItemId(itemsRes.items[0].id);
      const lastOrgNode = flatOrgNodes[flatOrgNodes.length - 1];
      if (!orgNodeId && lastOrgNode) setOrgNodeId(lastOrgNode.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load MPS data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  function addLine(): void { setLines([...lines, { period: 'month', startDate: '', endDate: '', forecastQuantity: '100' }]); }

  function distributeMpsEvenly(): void {
    const total = Number(mpsDistributeTotal) || 0;
    if (lines.length === 0) return;
    const share = (total / lines.length).toFixed(4);
    setLines(lines.map((l) => ({ ...l, forecastQuantity: share })));
  }

  function updateLine(index: number, field: keyof MpsLineInput, value: string): void {
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
      await api.post('/planning/master-production-schedules', {
        itemId, orgNodeId, warehouseId: warehouseId || undefined, fromDate, toDate,
        scheduleLines: lines.map((l) => ({ period: l.period, startDate: l.startDate, endDate: l.endDate, forecastQuantity: l.forecastQuantity })),
      });
      setShowForm(false);
      setFormSuccess(t('pages.mps.createMps'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleSubmit(id: string): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post(`/planning/master-production-schedules/${id}/submit`, {});
      setFormSuccess(t('pages.mps.submit'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleGetProjected(id: string): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post(`/planning/master-production-schedules/${id}/get-projected-quantity`, {});
      setFormSuccess(t('pages.mps.getProjected'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  const itemLabel = (id: string): string => items.find((it) => it.id === id)?.name ?? id;
  const orgLabel = (id: string): string => orgNodes.find((o) => o.id === id)?.name ?? id;
  const periodLabel = (p: string): string => t(`pages.mps.${p}`);
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>{t('pages.production_ops.form.loading')}</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.mps.eyebrow')}</span>
          <h1>{t('pages.mps.title')}</h1>
          <p>{t('pages.mps.description')}</p>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}
      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Material Planning</span>
            <h2>{t('pages.mps.listTitle')}</h2>
          </div>
          <button className="primary-button" onClick={() => setShowForm((v) => !v)}><b>+</b>{t('pages.mps.createMps')}</button>
        </div>

        {showForm && (
          <form onSubmit={(e) => { void handleCreate(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 0 20px' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.mps.item')}</label>
                <select value={itemId} onChange={(e) => setItemId(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
                  {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.mps.activity')}</label>
                <select value={orgNodeId} onChange={(e) => setOrgNodeId(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
                  {orgNodes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.mps.warehouse')}</label>
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
                  <option value="">â€”</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.mps.fromDate')}</label>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.mps.toDate')}</label>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required style={inputStyle} />
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <label style={{ ...labelStyle, fontWeight: 'bold', marginBottom: 10, display: 'block' }}>{t('pages.mps.scheduleLines')}</label>
              {lines.map((line, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'center' }}>
                  <select value={line.period} onChange={(e) => updateLine(idx, 'period', e.target.value)} style={{ ...inputStyle, width: 110 }}>
                    <option value="week">{t('pages.mps.week')}</option>
                    <option value="month">{t('pages.mps.month')}</option>
                    <option value="quarter">{t('pages.mps.quarter')}</option>
                    <option value="year">{t('pages.mps.year')}</option>
                  </select>
                  <input type="date" value={line.startDate} onChange={(e) => updateLine(idx, 'startDate', e.target.value)} required style={inputStyle} />
                  <input type="date" value={line.endDate} onChange={(e) => updateLine(idx, 'endDate', e.target.value)} required style={inputStyle} />
                  <input type="number" min="0.01" step="any" value={line.forecastQuantity} onChange={(e) => updateLine(idx, 'forecastQuantity', e.target.value)} required style={{ ...inputStyle, width: 120 }} />
                </div>
              ))}
              <button type="button" onClick={addLine} className="filter-button">+ {t('pages.mps.addLine')}</button>
              <input type="number" min="0" step="any" placeholder={t('pages.mps.totalToDistribute')} value={mpsDistributeTotal} onChange={(e) => setMpsDistributeTotal(e.target.value)} style={{ ...inputStyle, width: 140, marginInlineStart: 8 }} />
              <button type="button" onClick={distributeMpsEvenly} className="filter-button">{t('pages.mps.distributeEvenly')}</button>
            </div>

            <button type="submit" disabled={submitting} className="primary-button" style={{ alignSelf: 'flex-start' }}>{t('pages.technical.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.mps.mpsNumber')}</span>
            <span>{t('pages.mps.item')}</span>
            <span>{t('pages.mps.totalForecastQty')}</span>
            <span>{t('pages.mps.projectedQty')}</span>
            <span>{t('pages.mps.status')}</span>
            <span>{t('common.filter')}</span>
          </div>
          {records.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.mps.noRecords')}</p>}
          {records.map((r) => (
            <div className="placeholder-table__row" key={r.id}>
              <span><b>{r.mpsNumber}</b></span>
              <span>{itemLabel(r.itemId)}</span>
              <span>{r.totalForecastQuantity ?? 'â€”'}</span>
              <span>{r.projectedQuantity ?? 'â€”'}</span>
              <span><span className={`status status--${r.status === 'submitted' ? 'success' : 'neutral'}`}><i />{r.status}</span></span>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="filter-button" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => { void handleGetProjected(r.id); }}>{t('pages.mps.getProjected')}</button>
                {r.status === 'draft' && (
                  <button className="primary-button" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => { void handleSubmit(r.id); }}>{t('pages.mps.submit')}</button>
                )}
              </span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
