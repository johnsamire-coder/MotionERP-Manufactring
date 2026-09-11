import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface OrgTreeNode {
  id: string;
  code: string;
  name: string;
  nodeType: string;
  status: string;
  children: OrgTreeNode[];
}

interface OrgNodeTypeSummary {
  nodeType: string;
  allowedParentTypes: string[];
}

function flattenTreeNodes(nodes: OrgTreeNode[], depth = 0): Array<{ id: string; code: string; name: string; nodeType: string; depth: number; status: string }> {
  const list: Array<{ id: string; code: string; name: string; nodeType: string; depth: number; status: string }> = [];
  for (const node of nodes) {
    list.push({ id: node.id, code: node.code, name: node.name, nodeType: node.nodeType, depth, status: node.status });
    if (node.children && node.children.length > 0) {
      list.push(...flattenTreeNodes(node.children, depth + 1));
    }
  }
  return list;
}

export function OrganizationPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [tree, setTree] = useState<OrgTreeNode[]>([]);
  const [nodeTypes, setNodeTypes] = useState<OrgNodeTypeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showNodeForm, setShowNodeForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Node Form State
  const [nodeTypeInput, setNodeTypeInput] = useState('company');
  const [nameInput, setNameInput] = useState('');
  const [parentIdInput, setParentIdInput] = useState<string>('');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [treeRes, typesRes] = await Promise.all([
        api.get<{ tree: OrgTreeNode[] }>('/organization/tree'),
        api.get<{ nodeTypes: OrgNodeTypeSummary[] }>('/organization/node-types'),
      ]);
      setTree(treeRes.tree ?? []);
      setNodeTypes(typesRes.nodeTypes ?? []);
      if (typesRes.nodeTypes?.[0]) setNodeTypeInput(typesRes.nodeTypes[0].nodeType);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load organization tree');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  async function handleCreateNode(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/organization/nodes', {
        nodeType: nodeTypeInput,
        name: nameInput,
        parentId: parentIdInput || null,
      });
      setNameInput(''); setShowNodeForm(false);
      setFormSuccess(t('pages.organization.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleArchiveNode(id: string): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post(`/organization/nodes/${id}/archive`, {});
      setFormSuccess(t('pages.organization.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  const flatList = flattenTreeNodes(tree);
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.organization.eyebrow')}</span>
          <h1>{t('pages.organization.title')}</h1>
          <p>{t('pages.organization.description')}</p>
        </div>
      </div>

      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      {/* Organization Tree Section */}
      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Hierarchy</span>
            <h2>{t('pages.organization.tree.title')}</h2>
          </div>
          <button className="primary-button" onClick={() => setShowNodeForm((v) => !v)}><b>+</b> {t('pages.organization.tree.addNode')}</button>
        </div>

        {showNodeForm && (
          <form onSubmit={(e) => { void handleCreateNode(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.organization.tree.nodeType')}</label>
              <select value={nodeTypeInput} onChange={(e) => setNodeTypeInput(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
                {nodeTypes.map((nt) => <option key={nt.nodeType} value={nt.nodeType}>{nt.nodeType}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.organization.tree.name')}</label>
              <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} required placeholder="e.g. LaboSystem Facility #1" style={{ ...inputStyle, minWidth: 220 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.organization.tree.parent')}</label>
              <select value={parentIdInput} onChange={(e) => setParentIdInput(e.target.value)} style={{ ...inputStyle, minWidth: 200 }}>
                <option value="">بدون (شركة أم / جذر)</option>
                {flatList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {'— '.repeat(item.depth) + item.name} ({item.nodeType})
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.organization.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.organization.tree.name')}</span>
            <span>{t('pages.organization.tree.nodeType')}</span>
            <span>{t('pages.organization.tree.code')}</span>
            <span>{t('pages.organization.tree.status')}</span>
            <span>{t('pages.organization.tree.actions')}</span>
          </div>

          {flatList.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.organization.form.empty')}</p>}

          {flatList.map((node) => (
            <div className="placeholder-table__row" key={node.id} style={{ paddingRight: node.depth * 20 }}>
              <span>
                <b style={{ color: node.depth === 0 ? '#0f172a' : '#334155' }}>
                  {node.depth > 0 ? '↳ ' : ''}{node.name}
                </b>
              </span>
              <span><code>{node.nodeType}</code></span>
              <span><small>{node.code}</small></span>
              <span><span className={`status status--${node.status === 'active' ? 'success' : 'neutral'}`}><i />{node.status}</span></span>
              <span>
                {node.status === 'active' && node.depth > 0 && (
                  <button className="filter-button" style={{ fontSize: 12, padding: '4px 8px', color: '#b91c1c' }} onClick={() => { void handleArchiveNode(node.id); }}>
                    {t('pages.organization.tree.archive')}
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
