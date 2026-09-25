import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface JobOrderRecord {
  id: string;
  jobOrderNumber: string;
  customerId?: string;
  status: string;
}
interface ItemRecord {
  id: string;
  code: string;
  name: string;
}
interface TechDocRecord {
  id: string;
  jobOrderReference: string;
  docType: string;
  fileRef: string;
  version: string;
  createdAt: string;
}
interface OrgNodeTreeItem {
  id: string;
  name: string;
  nodeType: string;
  children: OrgNodeTreeItem[];
}
interface BomLineInput {
  itemId: string;
  quantity: string;
  operationId: string;
  standardTimeMinutes: string;
}
interface OperationRecord {
  id: string;
  code: string;
  name: string;
}
interface BomLineRecord {
  id: string;
  componentItemId: string;
  quantity: string;
  lineNumber: number;
}
interface BomRecord {
  id: string;
  productItemId: string;
  orgNodeId: string;
  version: number;
  outputQuantity: string;
  isDefault: boolean;
  status: string;
  lines: BomLineRecord[];
}

function flattenOrgNodes(nodes: OrgNodeTreeItem[]): OrgNodeTreeItem[] {
  const result: OrgNodeTreeItem[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) result.push(...flattenOrgNodes(node.children));
  }
  return result;
}

export function BomPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [_jobOrders, setJobOrders] = useState<JobOrderRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [_techDocs, setTechDocs] = useState<TechDocRecord[]>([]);
  const [boms, setBoms] = useState<BomRecord[]>([]);
  const [operations, setOperations] = useState<OperationRecord[]>([]);
  const [orgNodes, setOrgNodes] = useState<OrgNodeTreeItem[]>([]);
  const [_loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  const [selectedJO, setSelectedJO] = useState('');
  const [_showDocForm, setShowDocForm] = useState(false);
  const [showBomForm, setShowBomForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [docType, _setDocType] = useState('shop_drawing');
  const [fileRef, setFileRef] = useState('');
  const [docVersion, _setDocVersion] = useState('v1.0');

  const [bomProductItemId, setBomProductItemId] = useState('');
  const [bomOrgNodeId, setBomOrgNodeId] = useState('');
  const [bomOutputQty, setBomOutputQty] = useState('1');
  const [bomIsDefault, setBomIsDefault] = useState(true);
  const [bomLines, setBomLines] = useState<BomLineInput[]>([
    { itemId: '', quantity: '1', operationId: '', standardTimeMinutes: '' },
  ]);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [joRes, itemsRes, docsRes, bomsRes, orgRes, opsRes] = await Promise.all([
        api.get<{ jobOrders: JobOrderRecord[] }>('/sales/job-orders'),
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ documents: TechDocRecord[] }>('/technical/documents'),
        api.get<{ boms: BomRecord[] }>('/technical/boms'),
        api.get<{ tree: OrgNodeTreeItem[] }>('/organization/tree'),
        api.get<{ operations: OperationRecord[] }>('/production-ops/operations'),
      ]);
      setJobOrders(joRes.jobOrders);
      setItems(itemsRes.items);
      setTechDocs(docsRes.documents);
      setBoms(bomsRes.boms);
      const flatOrgNodes = flattenOrgNodes(orgRes.tree);
      setOrgNodes(flatOrgNodes);
      setOperations(opsRes.operations);
      if (!selectedJO && joRes.jobOrders[0]) setSelectedJO(joRes.jobOrders[0].jobOrderNumber);
      if (!bomProductItemId && itemsRes.items[0]) setBomProductItemId(itemsRes.items[0].id);
      const lastOrgNode = flatOrgNodes[flatOrgNodes.length - 1];
      if (!bomOrgNodeId && lastOrgNode) setBomOrgNodeId(lastOrgNode.id);
      if (bomLines[0] && !bomLines[0].itemId && itemsRes.items[0]) {
        setBomLines([
          { itemId: itemsRes.items[0].id, quantity: '1', operationId: '', standardTimeMinutes: '' },
        ]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load technical data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [i18n.language]);

  async function _handleCreateDoc(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);
    try {
      await api.post('/technical/documents', {
        jobOrderReference: selectedJO,
        documentType: docType,
        fileReference: fileRef,
        note: docVersion,
      });
      setFileRef('');
      setShowDocForm(false);
      setFormSuccess(t('pages.technical.form.success'));
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  function addBomLine(): void {
    const defaultItem = items[0]?.id ?? '';
    setBomLines([
      ...bomLines,
      { itemId: defaultItem, quantity: '1', operationId: '', standardTimeMinutes: '' },
    ]);
  }

  function updateBomLine(index: number, field: keyof BomLineInput, value: string): void {
    const updated = [...bomLines];
    const current = updated[index];
    if (current) {
      updated[index] = { ...current, [field]: value };
      setBomLines(updated);
    }
  }

  async function handleCreateBom(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);
    try {
      await api.post('/technical/boms', {
        productItemId: bomProductItemId,
        orgNodeId: bomOrgNodeId,
        outputQuantity: bomOutputQty,
        isDefault: bomIsDefault,
        lines: bomLines.map((l) => ({
          componentItemId: l.itemId,
          quantity: l.quantity,
          operationId: l.operationId || undefined,
          standardTimeMinutes: l.standardTimeMinutes || undefined,
        })),
      });
      setShowBomForm(false);
      setFormSuccess(t('pages.technical.form.success'));
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApproveBom(bomId: string): Promise<void> {
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);
    try {
      await api.post(`/technical/boms/${bomId}/approve`, {});
      setFormSuccess(t('pages.technical.form.success'));
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  const itemLabel = (id: string): string => items.find((it) => it.id === id)?.name ?? id;
  const orgLabel = (id: string): string => orgNodes.find((o) => o.id === id)?.name ?? id;
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.bom.eyebrow')}</span>
          <h1>{t('pages.bom.title')}</h1>
          <p>{t('pages.bom.description')}</p>
        </div>
      </div>

      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Bill of Materials</span>
            <h2>{t('pages.bom.listTitle')}</h2>
          </div>
          <button className="primary-button" onClick={() => setShowBomForm((v) => !v)}>
            <b>+</b>
            {t('pages.bom.createBom')}
          </button>
        </div>

        {showBomForm && (
          <form
            onSubmit={(e) => {
              void handleCreateBom(e);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 0 20px' }}
          >
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.technical.bom.productItem')}</label>
                <select
                  value={bomProductItemId}
                  onChange={(e) => setBomProductItemId(e.target.value)}
                  style={{ ...inputStyle, minWidth: 220 }}
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.code})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.technical.bom.activity')}</label>
                <select
                  value={bomOrgNodeId}
                  onChange={(e) => setBomOrgNodeId(e.target.value)}
                  style={{ ...inputStyle, minWidth: 200 }}
                >
                  {orgNodes.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.technical.bom.outputQty')}</label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={bomOutputQty}
                  onChange={(e) => setBomOutputQty(e.target.value)}
                  required
                  style={{ ...inputStyle, width: 100 }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={bomIsDefault}
                  onChange={(e) => setBomIsDefault(e.target.checked)}
                />
                {t('pages.technical.bom.isDefault')}
              </label>
            </div>

            <div
              style={{
                background: '#f8fafc',
                padding: 16,
                borderRadius: 6,
                border: '1px solid #e2e8f0',
              }}
            >
              <label
                style={{ ...labelStyle, fontWeight: 'bold', marginBottom: 10, display: 'block' }}
              >
                {t('pages.technical.bom.addItem')}
              </label>

              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  marginBottom: 6,
                  fontSize: 12,
                  color: '#64748b',
                  fontWeight: 'bold',
                }}
              >
                <span style={{ flex: 2 }}>{t('pages.technical.bom.item')}</span>
                <span style={{ width: 140 }}>{t('pages.technical.bom.plannedQty')}</span>
              </div>

              {bomLines.map((line, idx) => (
                <div
                  key={idx}
                  style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}
                >
                  <select
                    value={line.itemId}
                    onChange={(e) => updateBomLine(idx, 'itemId', e.target.value)}
                    style={{ ...inputStyle, flex: 2, minWidth: 200 }}
                  >
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it.code})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={line.quantity}
                    onChange={(e) => updateBomLine(idx, 'quantity', e.target.value)}
                    required
                    style={{ ...inputStyle, width: 140 }}
                  />
                  <select
                    value={line.operationId}
                    onChange={(e) => updateBomLine(idx, 'operationId', e.target.value)}
                    style={{ ...inputStyle, width: 150 }}
                  >
                    <option value="">{t('pages.technical.bom.noOperation')}</option>
                    {operations.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder={t('pages.technical.bom.standardTime')}
                    value={line.standardTimeMinutes}
                    onChange={(e) => updateBomLine(idx, 'standardTimeMinutes', e.target.value)}
                    style={{ ...inputStyle, width: 110 }}
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={addBomLine}
                className="filter-button"
                style={{ marginTop: 12 }}
              >
                + {t('pages.technical.bom.addItem')}
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="primary-button"
              style={{ alignSelf: 'flex-start' }}
            >
              {t('pages.technical.form.save')}
            </button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.technical.bom.productItem')}</span>
            <span>{t('pages.technical.bom.version')}</span>
            <span>{t('pages.technical.bom.activity')}</span>
            <span>{t('pages.technical.bom.status')}</span>
            <span>{t('pages.technical.bom.isDefault')}</span>
            <span>{t('common.filter')}</span>
          </div>
          {boms.length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>
              {t('pages.technical.bom.noBom')}
            </p>
          )}
          {boms.map((bomItem) => (
            <div className="placeholder-table__row" key={bomItem.id}>
              <span>
                <b>{itemLabel(bomItem.productItemId)}</b>
              </span>
              <span>v{bomItem.version}</span>
              <span>{orgLabel(bomItem.orgNodeId)}</span>
              <span>
                <span
                  className={`status status--${bomItem.status === 'approved' ? 'success' : 'neutral'}`}
                >
                  <i />
                  {bomItem.status}
                </span>
              </span>
              <span>{bomItem.isDefault ? '✓' : '—'}</span>
              <span>
                {bomItem.status === 'draft' && (
                  <button
                    className="primary-button"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => {
                      void handleApproveBom(bomItem.id);
                    }}
                  >
                    {t('pages.technical.bom.approve')}
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
