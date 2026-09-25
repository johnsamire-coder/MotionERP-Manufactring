import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface ItemRecord {
  id: string;
  code: string;
  name: string;
}
interface OrgNodeTreeItem {
  id: string;
  name: string;
  nodeType: string;
  children: OrgNodeTreeItem[];
}
interface SupplierLeadInput {
  supplierName: string;
  leadTimeDays: string;
}
interface WorkCenterRecord {
  id: string;
  code: string;
  name: string;
  ratePerMinute?: string;
}
interface SupplierLeadRecord {
  id: string;
  supplierName: string;
  leadTimeDays: string;
}
interface ItemLeadTimeRecord {
  id: string;
  itemId: string;
  orgNodeId: string;
  manufacturingTimeHours: string | null;
  isManufacturingLeadTime: boolean;
  manufacturingBufferDays: string | null;
  purchaseTimeDays: string | null;
  isPurchaseLeadTime: boolean;
  purchaseBufferDays: string | null;
  supplierLeadTimes: SupplierLeadRecord[];
}

function flattenOrgNodes(nodes: OrgNodeTreeItem[]): OrgNodeTreeItem[] {
  const result: OrgNodeTreeItem[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) result.push(...flattenOrgNodes(node.children));
  }
  return result;
}

export function ItemLeadTimePage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [orgNodes, setOrgNodes] = useState<OrgNodeTreeItem[]>([]);
  const [records, setRecords] = useState<ItemLeadTimeRecord[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenterRecord[]>([]);
  const [calcItemId, setCalcItemId] = useState('');
  const [calcQty, setCalcQty] = useState('100');
  const [calcWcId, setCalcWcId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [itemId, setItemId] = useState('');
  const [orgNodeId, setOrgNodeId] = useState('');
  const [mfgHours, setMfgHours] = useState('');
  const [isMfgLead, setIsMfgLead] = useState(false);
  const [mfgBuffer, setMfgBuffer] = useState('');
  const [purchaseDays, setPurchaseDays] = useState('');
  const [isPurchaseLead, setIsPurchaseLead] = useState(false);
  const [purchaseBuffer, setPurchaseBuffer] = useState('');
  const [suppliers, setSuppliers] = useState<SupplierLeadInput[]>([]);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemsRes, orgRes, iltRes, wcRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ tree: OrgNodeTreeItem[] }>('/organization/tree'),
        api.get<{ itemLeadTimes: ItemLeadTimeRecord[] }>('/planning/item-lead-times'),
        api
          .get<{ workCenters: WorkCenterRecord[] }>('/production-ops/work-centers')
          .catch(() => ({ workCenters: [] })),
      ]);
      setItems(itemsRes.items);
      const flatOrgNodes = flattenOrgNodes(orgRes.tree);
      setOrgNodes(flatOrgNodes);
      setRecords(iltRes.itemLeadTimes);
      setWorkCenters(wcRes.workCenters || []);
      if (!itemId && itemsRes.items[0]) setItemId(itemsRes.items[0].id);
      if (!calcItemId && itemsRes.items[0]) setCalcItemId(itemsRes.items[0].id);
      if (!calcWcId && wcRes.workCenters && wcRes.workCenters[0])
        setCalcWcId(wcRes.workCenters[0].id);
      const lastOrgNode = flatOrgNodes[flatOrgNodes.length - 1];
      if (!orgNodeId && lastOrgNode) setOrgNodeId(lastOrgNode.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load item lead time data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [i18n.language]);

  function addSupplier(): void {
    setSuppliers([...suppliers, { supplierName: '', leadTimeDays: '7' }]);
  }

  function updateSupplier(index: number, field: keyof SupplierLeadInput, value: string): void {
    const updated = [...suppliers];
    const current = updated[index];
    if (current) {
      updated[index] = { ...current, [field]: value };
      setSuppliers(updated);
    }
  }

  function removeSupplier(index: number): void {
    setSuppliers(suppliers.filter((_, i) => i !== index));
  }

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);
    try {
      await api.post('/planning/item-lead-times', {
        itemId,
        orgNodeId,
        manufacturingTimeHours: mfgHours || undefined,
        isManufacturingLeadTime: isMfgLead,
        manufacturingBufferDays: mfgBuffer || undefined,
        purchaseTimeDays: purchaseDays || undefined,
        isPurchaseLeadTime: isPurchaseLead,
        purchaseBufferDays: purchaseBuffer || undefined,
        supplierLeadTimes: suppliers.filter((s) => s.supplierName),
      });
      setShowForm(false);
      setFormSuccess(t('pages.item_lead_time.createRecord'));
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

  if (loading)
    return (
      <p style={{ padding: 40, textAlign: 'center' }}>{t('pages.production_ops.form.loading')}</p>
    );

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.item_lead_time.eyebrow')}</span>
          <h1>{t('pages.item_lead_time.title')}</h1>
          <p>{t('pages.item_lead_time.description')}</p>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}
      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Material Planning</span>
            <h2>{t('pages.item_lead_time.listTitle')}</h2>
          </div>
          <button className="primary-button" onClick={() => setShowForm((v) => !v)}>
            <b>+</b>
            {t('pages.item_lead_time.createRecord')}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={(e) => {
              void handleCreate(e);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 0 20px' }}
          >
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.item_lead_time.item')}</label>
                <select
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  style={{ ...inputStyle, minWidth: 200 }}
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.code})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.item_lead_time.activity')}</label>
                <select
                  value={orgNodeId}
                  onChange={(e) => setOrgNodeId(e.target.value)}
                  style={{ ...inputStyle, minWidth: 160 }}
                >
                  {orgNodes.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              style={{
                background: '#f8fafc',
                padding: 16,
                borderRadius: 6,
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={labelStyle}>{t('pages.item_lead_time.manufacturingTime')}</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={mfgHours}
                    onChange={(e) => setMfgHours(e.target.value)}
                    style={{ ...inputStyle, width: 120 }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={labelStyle}>{t('pages.item_lead_time.manufacturingBuffer')}</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={mfgBuffer}
                    onChange={(e) => setMfgBuffer(e.target.value)}
                    style={{ ...inputStyle, width: 120 }}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={isMfgLead}
                    onChange={(e) => setIsMfgLead(e.target.checked)}
                  />
                  {t('pages.item_lead_time.isManufacturingLeadTime')}
                </label>
              </div>
            </div>

            <div
              style={{
                background: '#f8fafc',
                padding: 16,
                borderRadius: 6,
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={labelStyle}>{t('pages.item_lead_time.purchaseTime')}</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={purchaseDays}
                    onChange={(e) => setPurchaseDays(e.target.value)}
                    style={{ ...inputStyle, width: 120 }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={labelStyle}>{t('pages.item_lead_time.purchaseBuffer')}</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={purchaseBuffer}
                    onChange={(e) => setPurchaseBuffer(e.target.value)}
                    style={{ ...inputStyle, width: 120 }}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={isPurchaseLead}
                    onChange={(e) => setIsPurchaseLead(e.target.checked)}
                  />
                  {t('pages.item_lead_time.isPurchaseLeadTime')}
                </label>
              </div>
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
                {t('pages.item_lead_time.suppliers')}
              </label>
              {suppliers.map((s, idx) => (
                <div
                  key={idx}
                  style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'center' }}
                >
                  <input
                    placeholder={t('pages.item_lead_time.supplierName')}
                    value={s.supplierName}
                    onChange={(e) => updateSupplier(idx, 'supplierName', e.target.value)}
                    style={{ ...inputStyle, flex: 2 }}
                  />
                  <input
                    type="number"
                    min="1"
                    step="any"
                    placeholder={t('pages.item_lead_time.supplierLeadDays')}
                    value={s.leadTimeDays}
                    onChange={(e) => updateSupplier(idx, 'leadTimeDays', e.target.value)}
                    style={{ ...inputStyle, width: 140 }}
                  />
                  <button
                    type="button"
                    className="filter-button"
                    onClick={() => removeSupplier(idx)}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={addSupplier} className="filter-button">
                + {t('pages.item_lead_time.addSupplier')}
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
            <span>{t('pages.item_lead_time.item')}</span>
            <span>{t('pages.item_lead_time.manufacturingTime')}</span>
            <span>{t('pages.item_lead_time.purchaseTime')}</span>
            <span>{t('pages.item_lead_time.suppliers')}</span>
            <span>{t('pages.item_lead_time.activity')}</span>
          </div>
          {records.length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>
              {t('pages.item_lead_time.noRecords')}
            </p>
          )}
          {records.map((r) => (
            <div className="placeholder-table__row" key={r.id}>
              <span>
                <b>{itemLabel(r.itemId)}</b>
              </span>
              <span>{r.manufacturingTimeHours ? `${r.manufacturingTimeHours} h` : '—'}</span>
              <span>{r.purchaseTimeDays ? `${r.purchaseTimeDays} d` : '—'}</span>
              <span>
                {r.supplierLeadTimes
                  .map((s) => `${s.supplierName} (${s.leadTimeDays}d)`)
                  .join(', ') || '—'}
              </span>
              <span>{orgLabel(r.orgNodeId)}</span>
            </div>
          ))}
        </div>
      </article>

      {/* Capacity Planning & Load Analysis Card - ERPNext Parity */}
      <article
        className="panel module-panel"
        style={{
          marginTop: 24,
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          padding: 20,
          background: '#f8fafc',
        }}
      >
        <div className="panel__head" style={{ marginBottom: 16 }}>
          <div>
            <span className="panel__eyebrow" style={{ color: '#0369a1', fontWeight: 'bold' }}>
              ⚡ ERPNext Parity Feature
            </span>
            <h2 style={{ fontSize: 18, margin: '4px 0 0' }}>
              {t('pages.item_lead_time.capacityPlanning')}
            </h2>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('pages.item_lead_time.item')}</label>
            <select
              value={calcItemId}
              onChange={(e) => setCalcItemId(e.target.value)}
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
            <label style={labelStyle}>{t('pages.item_lead_time.targetQty')}</label>
            <input
              type="number"
              min="1"
              step="any"
              value={calcQty}
              onChange={(e) => setCalcQty(e.target.value)}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('pages.item_lead_time.workCenter')}</label>
            <select
              value={calcWcId}
              onChange={(e) => setCalcWcId(e.target.value)}
              style={{ ...inputStyle, width: '100%' }}
            >
              <option value="">— {t('pages.work_order.noWorkCenter')} —</option>
              {workCenters.map((wc) => (
                <option key={wc.id} value={wc.id}>
                  {wc.name} ({wc.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {(() => {
          const selectedRecord = records.find((r) => r.itemId === calcItemId);
          const selectedWc = workCenters.find((w) => w.id === calcWcId);
          const qty = parseFloat(calcQty || '0');
          const mfgHoursPerUnit = parseFloat(selectedRecord?.manufacturingTimeHours || '0.5');
          const bufferDays = parseFloat(selectedRecord?.manufacturingBufferDays || '0');
          const totalHours = qty * mfgHoursPerUnit + bufferDays * 8;
          const totalMinutes = totalHours * 60;
          const ratePerMin = parseFloat(selectedWc?.ratePerMinute || '2.5');
          const totalCost = totalMinutes * ratePerMin;
          const isOverloaded = totalHours > 8;

          return (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
              }}
            >
              <div
                style={{
                  background: '#fff',
                  padding: 16,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                }}
              >
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  {t('pages.item_lead_time.totalTimeRequired')}
                </span>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginTop: 4 }}>
                  {totalHours.toFixed(1)} hrs{' '}
                  <span style={{ fontSize: 13, color: '#64748b' }}>
                    ({totalMinutes.toFixed(0)} mins)
                  </span>
                </div>
              </div>

              <div
                style={{
                  background: '#fff',
                  padding: 16,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                }}
              >
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  {t('pages.item_lead_time.totalLaborCost')}
                </span>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: '#0369a1', marginTop: 4 }}>
                  {totalCost.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  EGP
                </div>
              </div>

              <div
                style={{
                  background: isOverloaded ? '#fef2f2' : '#f0fdf4',
                  padding: 16,
                  borderRadius: 8,
                  border: '1px solid ' + (isOverloaded ? '#fecaca' : '#bbf7d0'),
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: isOverloaded ? '#991b1b' : '#166534',
                    fontWeight: 'bold',
                  }}
                >
                  {t('pages.item_lead_time.loadAnalysis')}
                </span>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: '500',
                    color: isOverloaded ? '#b91c1c' : '#15803d',
                    marginTop: 4,
                  }}
                >
                  {isOverloaded
                    ? t('pages.item_lead_time.overloadWarning')
                    : t('pages.item_lead_time.safeLoad')}
                </div>
              </div>
            </div>
          );
        })()}
      </article>
    </section>
  );
}
