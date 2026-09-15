import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface ItemRecord { id: string; code: string; name: string; }
interface OrgNodeTreeItem { id: string; name: string; nodeType: string; children: OrgNodeTreeItem[]; }
interface BcTreeRow { tempId: number; parentTempId: number | null; componentItemId: string; quantity: string; isSubAssembly: boolean; }
interface BcItemRecord { id: string; parentId: string | null; componentItemId: string; quantity: string; isSubAssembly: boolean; generatedBomId: string | null; }
interface BomCreatorRecord {
  id: string; creatorNumber: string; productItemId: string; orgNodeId: string;
  quantityToProduce: string; status: string; items: BcItemRecord[];
}

function flattenOrgNodes(nodes: OrgNodeTreeItem[]): OrgNodeTreeItem[] {
  const result: OrgNodeTreeItem[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) result.push(...flattenOrgNodes(node.children));
  }
  return result;
}

export function BomCreatorPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [orgNodes, setOrgNodes] = useState<OrgNodeTreeItem[]>([]);
  const [records, setRecords] = useState<BomCreatorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [productItemId, setProductItemId] = useState('');
  const [orgNodeId, setOrgNodeId] = useState('');
  const [qtyToProduce, setQtyToProduce] = useState('1');
  const [rows, setRows] = useState<BcTreeRow[]>([{ tempId: 1, parentTempId: null, componentItemId: '', quantity: '1', isSubAssembly: false }]);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemsRes, orgRes, bcRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ tree: OrgNodeTreeItem[] }>('/organization/tree'),
        api.get<{ bomCreators: BomCreatorRecord[] }>('/technical/bom-creators'),
      ]);
      setItems(itemsRes.items);
      const flatOrgNodes = flattenOrgNodes(orgRes.tree);
      setOrgNodes(flatOrgNodes);
      setRecords(bcRes.bomCreators);
      if (!productItemId && itemsRes.items[0]) setProductItemId(itemsRes.items[0].id);
      const lastOrgNode = flatOrgNodes[flatOrgNodes.length - 1];
      if (!orgNodeId && lastOrgNode) setOrgNodeId(lastOrgNode.id);
      if (rows[0] && !rows[0].componentItemId && itemsRes.items[0]) {
        setRows([{ tempId: 1, parentTempId: null, componentItemId: itemsRes.items[0].id, quantity: '1', isSubAssembly: false }]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load BOM creator data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  function addRow(): void {
    const nextTempId = Math.max(...rows.map((r) => r.tempId), 0) + 1;
    setRows([...rows, { tempId: nextTempId, parentTempId: null, componentItemId: items[0]?.id ?? '', quantity: '1', isSubAssembly: false }]);
  }

  function updateRow(tempId: number, field: keyof BcTreeRow, value: string | boolean | number | null): void {
    setRows(rows.map((r) => (r.tempId === tempId ? { ...r, [field]: value } : r)));
  }

  function removeRow(tempId: number): void {
    setRows(rows.filter((r) => r.tempId !== tempId).map((r) => (r.parentTempId === tempId ? { ...r, parentTempId: null } : r)));
  }

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/technical/bom-creators', {
        productItemId, orgNodeId, quantityToProduce: qtyToProduce,
        items: rows.map((r) => ({
          tempId: r.tempId,
          parentTempId: r.parentTempId ?? undefined,
          componentItemId: r.componentItemId,
          quantity: r.quantity,
          isSubAssembly: r.isSubAssembly,
        })),
      });
      setShowForm(false);
      setFormSuccess(t('pages.bom_creator.createNew'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleCreateBoms(id: string): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post(`/technical/bom-creators/${id}/create-boms`, {});
      setFormSuccess(t('pages.bom_creator.createBoms'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  const itemLabel = (id: string): string => items.find((it) => it.id === id)?.name ?? id;
  const orgLabel = (id: string): string => orgNodes.find((o) => o.id === id)?.name ?? id;
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>{t('pages.production_ops.form.loading')}</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.bom_creator.eyebrow')}</span>
          <h1>{t('pages.bom_creator.title')}</h1>
          <p>{t('pages.bom_creator.description')}</p>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}
      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Manufacturing Tools</span>
            <h2>{t('pages.bom_creator.listTitle')}</h2>
          </div>
          <button className="primary-button" onClick={() => setShowForm((v) => !v)}><b>+</b>{t('pages.bom_creator.createNew')}</button>
        </div>

        {showForm && (
          <form onSubmit={(e) => { void handleCreate(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 0 20px' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.bom_creator.productItem')}</label>
                <select value={productItemId} onChange={(e) => setProductItemId(e.target.value)} style={{ ...inputStyle, minWidth: 200 }}>
                  {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.bom_creator.activity')}</label>
                <select value={orgNodeId} onChange={(e) => setOrgNodeId(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
                  {orgNodes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.bom_creator.qtyToProduce')}</label>
                <input type="number" min="0.01" step="any" value={qtyToProduce} onChange={(e) => setQtyToProduce(e.target.value)} required style={{ ...inputStyle, width: 120 }} />
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <label style={{ ...labelStyle, fontWeight: 'bold', marginBottom: 10, display: 'block' }}>{t('pages.bom_creator.treeItems')}</label>
              <div style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 12, color: '#64748b', fontWeight: 'bold' }}>
                <span style={{ flex: 2 }}>{t('pages.bom_creator.component')}</span>
                <span style={{ flex: 2 }}>{t('pages.bom_creator.parent')}</span>
                <span style={{ width: 100 }}>{t('pages.bom_creator.quantity')}</span>
                <span style={{ width: 160 }}>{t('pages.bom_creator.isSubAssembly')}</span>
              </div>
              {rows.map((row) => (
                <div key={row.tempId} style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
                  <select value={row.componentItemId} onChange={(e) => updateRow(row.tempId, 'componentItemId', e.target.value)} style={{ ...inputStyle, flex: 2, minWidth: 160 }}>
                    {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
                  </select>
                  <select
                    value={row.parentTempId ?? ''}
                    onChange={(e) => updateRow(row.tempId, 'parentTempId', e.target.value ? Number(e.target.value) : null)}
                    style={{ ...inputStyle, flex: 2, minWidth: 160 }}
                  >
                    <option value="">{t('pages.bom_creator.topLevel')}</option>
                    {rows.filter((r) => r.tempId !== row.tempId).map((r) => (
                      <option key={r.tempId} value={r.tempId}>{itemLabel(r.componentItemId)} (#{r.tempId})</option>
                    ))}
                  </select>
                  <input type="number" min="0.01" step="any" value={row.quantity} onChange={(e) => updateRow(row.tempId, 'quantity', e.target.value)} required style={{ ...inputStyle, width: 100 }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, width: 160, fontSize: 12 }}>
                    <input type="checkbox" checked={row.isSubAssembly} onChange={(e) => updateRow(row.tempId, 'isSubAssembly', e.target.checked)} />
                    {t('pages.bom_creator.isSubAssembly')}
                  </label>
                  <button type="button" className="filter-button" onClick={() => removeRow(row.tempId)}>×</button>
                </div>
              ))}
              <button type="button" onClick={addRow} className="filter-button" style={{ marginTop: 12 }}>+ {t('pages.bom_creator.addItem')}</button>
            </div>

            <button type="submit" disabled={submitting} className="primary-button" style={{ alignSelf: 'flex-start' }}>{t('pages.technical.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>BC No.</span>
            <span>{t('pages.bom_creator.productItem')}</span>
            <span>{t('pages.bom_creator.activity')}</span>
            <span>{t('pages.bom_creator.status')}</span>
            <span>{t('common.filter')}</span>
          </div>
          {records.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.bom_creator.noRecords')}</p>}
          {records.map((bc) => (
            <div className="placeholder-table__row" key={bc.id}>
              <span><b>{bc.creatorNumber}</b></span>
              <span>{itemLabel(bc.productItemId)}</span>
              <span>{orgLabel(bc.orgNodeId)}</span>
              <span><span className={`status status--${bc.status === 'completed' ? 'success' : 'neutral'}`}><i />{bc.status}</span></span>
              <span>
                {bc.status === 'draft' && (
                  <button className="primary-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { void handleCreateBoms(bc.id); }}>
                    {t('pages.bom_creator.createBoms')}
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
