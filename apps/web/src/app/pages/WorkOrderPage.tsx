import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface ItemRecord { id: string; code: string; name: string; }
interface OrgNodeTreeItem { id: string; name: string; nodeType: string; children: OrgNodeTreeItem[]; }
interface WarehouseRecord { id: string; code: string; name: string; }
interface BomRecord { id: string; productItemId: string; version: number; status: string; isDefault: boolean; }
interface WorkOrderRecord {
  id: string; workOrderNumber: string; productItemId: string; bomId: string; orgNodeId: string;
  jobOrderReference: string | null; qtyToManufacture: string;
  sourceWarehouseId: string | null; wipWarehouseId: string | null; finishedGoodsWarehouseId: string;
  plannedStartDate: string | null; actualStartDate: string | null; actualEndDate: string | null;
  status: 'not_started' | 'in_progress' | 'completed' | 'stopped' | 'closed';
}

function flattenOrgNodes(nodes: OrgNodeTreeItem[]): OrgNodeTreeItem[] {
  const result: OrgNodeTreeItem[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) result.push(...flattenOrgNodes(node.children));
  }
  return result;
}

export function WorkOrderPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [orgNodes, setOrgNodes] = useState<OrgNodeTreeItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [boms, setBoms] = useState<BomRecord[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [productItemId, setProductItemId] = useState('');
  const [bomId, setBomId] = useState('');
  const [orgNodeId, setOrgNodeId] = useState('');
  const [qty, setQty] = useState('1');
  const [finishedGoodsWarehouseId, setFinishedGoodsWarehouseId] = useState('');
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [wipWarehouseId, setWipWarehouseId] = useState('');
  const [jobOrderReference, setJobOrderReference] = useState('');
  const [useMultiLevelBom, setUseMultiLevelBom] = useState(false);
  const [considerScrapItems, setConsiderScrapItems] = useState(false);
  const [materialConsumptionPercentage, setMaterialConsumptionPercentage] = useState('100');
  const [materialTransferMode, setMaterialTransferMode] = useState('transfer');

  const approvedBomsForItem = boms.filter((b) => b.productItemId === productItemId && b.status === 'approved');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemsRes, orgRes, whRes, bomsRes, woRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ tree: OrgNodeTreeItem[] }>('/organization/tree'),
        api.get<{ warehouses: WarehouseRecord[] }>('/inventory/warehouses'),
        api.get<{ boms: BomRecord[] }>('/technical/boms'),
        api.get<{ workOrders: WorkOrderRecord[] }>('/production-ops/work-orders'),
      ]);
      setItems(itemsRes.items);
      const flatOrgNodes = flattenOrgNodes(orgRes.tree);
      setOrgNodes(flatOrgNodes);
      setWarehouses(whRes.warehouses);
      setBoms(bomsRes.boms);
      setWorkOrders(woRes.workOrders);
      if (!productItemId && itemsRes.items[0]) setProductItemId(itemsRes.items[0].id);
      const lastOrgNode = flatOrgNodes[flatOrgNodes.length - 1];
      if (!orgNodeId && lastOrgNode) setOrgNodeId(lastOrgNode.id);
      if (!finishedGoodsWarehouseId && whRes.warehouses[0]) setFinishedGoodsWarehouseId(whRes.warehouses[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load work order data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  useEffect(() => {
    const stillValid = approvedBomsForItem.some((b) => b.id === bomId);
    if (!stillValid) setBomId(approvedBomsForItem[0]?.id ?? '');
  }, [productItemId, boms]);

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/production-ops/work-orders', {
        productItemId, bomId, orgNodeId, qtyToManufacture: qty,
        finishedGoodsWarehouseId,
        sourceWarehouseId: sourceWarehouseId || undefined,
        wipWarehouseId: wipWarehouseId || undefined,
        jobOrderReference: jobOrderReference || undefined,
        useMultiLevelBom, considerScrapItems, materialConsumptionPercentage, materialTransferMode,
      });
      setShowForm(false);
      setFormSuccess(t('pages.work_order.createWorkOrder'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleTransition(id: string, action: 'start' | 'complete' | 'stop' | 'close'): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post(`/production-ops/work-orders/${id}/${action}`, {});
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  const itemLabel = (id: string): string => items.find((it) => it.id === id)?.name ?? id;
  const orgLabel = (id: string): string => orgNodes.find((o) => o.id === id)?.name ?? id;
  const whLabel = (id: string | null): string => (id ? (warehouses.find((w) => w.id === id)?.name ?? id) : '—');
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };
  const statusTone = (s: string): string => s === 'completed' || s === 'closed' ? 'success' : s === 'stopped' ? 'warning' : s === 'in_progress' ? 'warning' : 'neutral';

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>{t('pages.technical.form.loading')}</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.work_order.eyebrow')}</span>
          <h1>{t('pages.work_order.title')}</h1>
          <p>{t('pages.work_order.description')}</p>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}
      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Work Orders</span>
            <h2>{t('pages.work_order.listTitle')}</h2>
          </div>
          <button className="primary-button" onClick={() => setShowForm((v) => !v)}><b>+</b>{t('pages.work_order.createWorkOrder')}</button>
        </div>

        {showForm && (
          <form onSubmit={(e) => { void handleCreate(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 0 20px' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.work_order.productItem')}</label>
                <select value={productItemId} onChange={(e) => setProductItemId(e.target.value)} style={{ ...inputStyle, minWidth: 200 }}>
                  {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.work_order.bom')}</label>
                <select value={bomId} onChange={(e) => setBomId(e.target.value)} style={{ ...inputStyle, minWidth: 140 }}>
                  {approvedBomsForItem.length === 0 && <option value="">—</option>}
                  {approvedBomsForItem.map((b) => <option key={b.id} value={b.id}>v{b.version}{b.isDefault ? ' ★' : ''}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.work_order.activity')}</label>
                <select value={orgNodeId} onChange={(e) => setOrgNodeId(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
                  {orgNodes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.work_order.qty')}</label>
                <input type="number" min="0.01" step="any" value={qty} onChange={(e) => setQty(e.target.value)} required style={{ ...inputStyle, width: 100 }} />
              </div>
            </div>

            {approvedBomsForItem.length === 0 && (
              <p style={{ color: '#b45309', fontSize: 13, background: '#fffbeb', padding: 10, borderRadius: 6 }}>{t('pages.work_order.noBomWarning')}</p>
            )}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.work_order.finishedGoodsWarehouse')}</label>
                <select value={finishedGoodsWarehouseId} onChange={(e) => setFinishedGoodsWarehouseId(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.work_order.sourceWarehouse')}</label>
                <select value={sourceWarehouseId} onChange={(e) => setSourceWarehouseId(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
                  <option value="">—</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.work_order.wipWarehouse')}</label>
                <select value={wipWarehouseId} onChange={(e) => setWipWarehouseId(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
                  <option value="">—</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.work_order.jobOrderReference')}</label>
                <input value={jobOrderReference} onChange={(e) => setJobOrderReference(e.target.value)} placeholder="JO-2026-000001" style={{ ...inputStyle, width: 160 }} />
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 6, border: '1px solid #e2e8f0', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={useMultiLevelBom} onChange={(e) => setUseMultiLevelBom(e.target.checked)} />
                {t('pages.work_order.useMultiLevelBom')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={considerScrapItems} onChange={(e) => setConsiderScrapItems(e.target.checked)} />
                {t('pages.work_order.considerScrapItems')}
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.work_order.materialConsumptionPercentage')}</label>
                <input type="number" min="0" max="200" step="any" value={materialConsumptionPercentage} onChange={(e) => setMaterialConsumptionPercentage(e.target.value)} style={{ ...inputStyle, width: 100 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.work_order.materialTransferMode')}</label>
                <select value={materialTransferMode} onChange={(e) => setMaterialTransferMode(e.target.value)} style={{ ...inputStyle, width: 120 }}>
                  <option value="transfer">{t('pages.work_order.transferMode')}</option>
                  <option value="move">{t('pages.work_order.moveMode')}</option>
                </select>
              </div>
            </div>

            <button type="submit" disabled={submitting || approvedBomsForItem.length === 0} className="primary-button" style={{ alignSelf: 'flex-start' }}>{t('pages.technical.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.work_order.workOrderNumber')}</span>
            <span>{t('pages.work_order.productItem')}</span>
            <span>{t('pages.work_order.qty')}</span>
            <span>{t('pages.work_order.finishedGoodsWarehouse')}</span>
            <span>{t('pages.work_order.status')}</span>
            <span>{t('common.filter')}</span>
          </div>
          {workOrders.length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.work_order.noWorkOrder')}</p>
          )}
          {workOrders.map((wo) => (
            <div className="placeholder-table__row" key={wo.id}>
              <span><b>{wo.workOrderNumber}</b></span>
              <span>{itemLabel(wo.productItemId)}</span>
              <span>{wo.qtyToManufacture}</span>
              <span>{whLabel(wo.finishedGoodsWarehouseId)}</span>
              <span><span className={`status status--${statusTone(wo.status)}`}><i />{wo.status}</span></span>
              <span style={{ display: 'flex', gap: 6 }}>
                {wo.status === 'not_started' && (
                  <button className="primary-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { void handleTransition(wo.id, 'start'); }}>{t('pages.work_order.start')}</button>
                )}
                {wo.status === 'in_progress' && (
                  <>
                    <button className="primary-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { void handleTransition(wo.id, 'complete'); }}>{t('pages.work_order.complete')}</button>
                    <button className="filter-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { void handleTransition(wo.id, 'stop'); }}>{t('pages.work_order.stop')}</button>
                  </>
                )}
                {(wo.status === 'completed' || wo.status === 'stopped') && (
                  <button className="primary-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { void handleTransition(wo.id, 'close'); }}>{t('pages.work_order.close')}</button>
                )}
              </span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
