import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface ItemRecord { id: string; code: string; name: string; }
interface OrgNodeTreeItem { id: string; name: string; nodeType: string; children: OrgNodeTreeItem[]; }
interface MrLineInput { itemId: string; quantity: string; }
interface MrLineRecord { id: string; itemId: string; quantity: string; }
interface MaterialRequestRecord {
  id: string; requestNumber: string; orgNodeId: string; purpose: string;
  jobOrderReference: string | null; status: string; lines: MrLineRecord[];
}

function flattenOrgNodes(nodes: OrgNodeTreeItem[]): OrgNodeTreeItem[] {
  const result: OrgNodeTreeItem[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) result.push(...flattenOrgNodes(node.children));
  }
  return result;
}

export function MaterialRequestPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [orgNodes, setOrgNodes] = useState<OrgNodeTreeItem[]>([]);
  const [requests, setRequests] = useState<MaterialRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [orgNodeId, setOrgNodeId] = useState('');
  const [purpose, setPurpose] = useState('manufacture');
  const [jobOrderReference, setJobOrderReference] = useState('');
  const [lines, setLines] = useState<MrLineInput[]>([{ itemId: '', quantity: '1' }]);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemsRes, orgRes, mrRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ tree: OrgNodeTreeItem[] }>('/organization/tree'),
        api.get<{ materialRequests: MaterialRequestRecord[] }>('/planning/material-requests'),
      ]);
      setItems(itemsRes.items);
      const flatOrgNodes = flattenOrgNodes(orgRes.tree);
      setOrgNodes(flatOrgNodes);
      setRequests(mrRes.materialRequests);
      const lastOrgNode = flatOrgNodes[flatOrgNodes.length - 1];
      if (!orgNodeId && lastOrgNode) setOrgNodeId(lastOrgNode.id);
      if (lines[0] && !lines[0].itemId && itemsRes.items[0]) {
        setLines([{ itemId: itemsRes.items[0].id, quantity: '1' }]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load material request data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  function addLine(): void {
    const defaultItem = items[0]?.id ?? '';
    setLines([...lines, { itemId: defaultItem, quantity: '1' }]);
  }

  function updateLine(index: number, field: keyof MrLineInput, value: string): void {
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
      await api.post('/planning/material-requests', {
        orgNodeId, purpose, jobOrderReference: jobOrderReference || undefined,
        lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
      });
      setShowForm(false);
      setFormSuccess(t('pages.material_request.createRequest'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleSubmitRequest(id: string): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post(`/planning/material-requests/${id}/submit`, {});
      setFormSuccess(t('pages.material_request.submit'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  const itemLabel = (id: string): string => items.find((it) => it.id === id)?.name ?? id;
  const orgLabel = (id: string): string => orgNodes.find((o) => o.id === id)?.name ?? id;
  const purposeLabel = (p: string): string => {
    const key = p === 'material_transfer' ? 'materialTransfer' : p === 'material_issue' ? 'materialIssue' : p;
    return t(`pages.material_request.${key}`);
  };
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>{t('pages.production_ops.form.loading')}</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.material_request.eyebrow')}</span>
          <h1>{t('pages.material_request.title')}</h1>
          <p>{t('pages.material_request.description')}</p>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}
      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Material Planning</span>
            <h2>{t('pages.material_request.listTitle')}</h2>
          </div>
          <button className="primary-button" onClick={() => setShowForm((v) => !v)}><b>+</b>{t('pages.material_request.createRequest')}</button>
        </div>

        {showForm && (
          <form onSubmit={(e) => { void handleCreate(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 0 20px' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.material_request.activity')}</label>
                <select value={orgNodeId} onChange={(e) => setOrgNodeId(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
                  {orgNodes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.material_request.purpose')}</label>
                <select value={purpose} onChange={(e) => setPurpose(e.target.value)} style={{ ...inputStyle, minWidth: 150 }}>
                  <option value="manufacture">{t('pages.material_request.manufacture')}</option>
                  <option value="purchase">{t('pages.material_request.purchase')}</option>
                  <option value="material_transfer">{t('pages.material_request.materialTransfer')}</option>
                  <option value="material_issue">{t('pages.material_request.materialIssue')}</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.material_request.jobOrderReference')}</label>
                <input value={jobOrderReference} onChange={(e) => setJobOrderReference(e.target.value)} placeholder="JO-2026-000001" style={{ ...inputStyle, width: 160 }} />
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <label style={{ ...labelStyle, fontWeight: 'bold', marginBottom: 10, display: 'block' }}>{t('pages.material_request.addLine')}</label>
              <div style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 12, color: '#64748b', fontWeight: 'bold' }}>
                <span style={{ flex: 2 }}>{t('pages.material_request.item')}</span>
                <span style={{ width: 140 }}>{t('pages.material_request.quantity')}</span>
              </div>
              {lines.map((line, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
                  <select value={line.itemId} onChange={(e) => updateLine(idx, 'itemId', e.target.value)} style={{ ...inputStyle, flex: 2, minWidth: 200 }}>
                    {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
                  </select>
                  <input type="number" min="0.01" step="any" value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} required style={{ ...inputStyle, width: 140 }} />
                </div>
              ))}
              <button type="button" onClick={addLine} className="filter-button" style={{ marginTop: 12 }}>+ {t('pages.material_request.addLine')}</button>
            </div>

            <button type="submit" disabled={submitting} className="primary-button" style={{ alignSelf: 'flex-start' }}>{t('pages.technical.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.material_request.requestNumber')}</span>
            <span>{t('pages.material_request.purpose')}</span>
            <span>{t('pages.material_request.activity')}</span>
            <span>{t('pages.material_request.status')}</span>
            <span>{t('common.filter')}</span>
          </div>
          {requests.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.material_request.noRequests')}</p>}
          {requests.map((mr) => (
            <div className="placeholder-table__row" key={mr.id}>
              <span><b>{mr.requestNumber}</b></span>
              <span>{purposeLabel(mr.purpose)}</span>
              <span>{orgLabel(mr.orgNodeId)}</span>
              <span><span className={`status status--${mr.status === 'submitted' ? 'success' : 'neutral'}`}><i />{mr.status}</span></span>
              <span>
                {mr.status === 'draft' && (
                  <button className="primary-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { void handleSubmitRequest(mr.id); }}>
                    {t('pages.material_request.submit')}
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
