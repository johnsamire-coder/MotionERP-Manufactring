import { useEffect, useState, type FormEvent } from 'react';
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
interface WarehouseRecord {
  id: string;
  code: string;
  name: string;
}
interface BomRecord {
  id: string;
  productItemId: string;
  version: number;
  status: string;
  isDefault: boolean;
}
interface MaterialRequestLineRecord {
  id: string;
  itemId: string;
  quantity: string;
  warehouseId: string | null;
}
interface MaterialRequestRecord {
  id: string;
  requestNumber: string;
  purpose: string;
  status: string;
  lines?: MaterialRequestLineRecord[];
}
interface StockBalanceRecord {
  itemId: string;
  warehouseId: string;
  quantityOnHand: string;
}
interface BomLineRecord {
  componentItemId: string;
  quantity: string;
}
interface MaterialRequirement {
  itemId: string;
  requiredQty: number;
  availableStock: number;
  shortage: number;
}
interface ProductionPlanItemInput {
  productItemId: string;
  bomId: string;
  qtyToPlan: string;
  warehouseId: string;
}
interface ProductionPlanItemRecord {
  id: string;
  productionPlanId: string;
  productItemId: string;
  bomId: string;
  qtyToPlan: string;
  warehouseId: string | null;
  workOrderId: string | null;
  lineNumber: number;
}
interface ProductionPlanRecord {
  id: string;
  planNumber: string;
  orgNodeId: string;
  planBy: string;
  fromDate: string;
  toDate: string;
  status: string;
  items: ProductionPlanItemRecord[];
}

function flattenOrgNodes(nodes: OrgNodeTreeItem[]): OrgNodeTreeItem[] {
  const result: OrgNodeTreeItem[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) result.push(...flattenOrgNodes(node.children));
  }
  return result;
}

export function ProductionPlanPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [orgNodes, setOrgNodes] = useState<OrgNodeTreeItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [boms, setBoms] = useState<BomRecord[]>([]);
  const [plans, setPlans] = useState<ProductionPlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [orgNodeId, setOrgNodeId] = useState('');
  const [planBy, setPlanBy] = useState('job_order');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [_matRequests, _setMatRequests] = useState<MaterialRequestRecord[]>([]);
  const [_showMatReqModal, setShowMatReqModal] = useState<ProductionPlanRecord | null>(null);
  const [_calculatedReqs, setCalculatedReqs] = useState<MaterialRequirement[]>([]);
  const [_loadingReqs, setLoadingReqs] = useState(false);
  const [lines, setLines] = useState<ProductionPlanItemInput[]>([
    { productItemId: '', bomId: '', qtyToPlan: '1', warehouseId: '' },
  ]);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemsRes, orgRes, warehouseRes, bomRes, planRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>('/catalog/items?lang=' + lang),
        api.get<{ tree: OrgNodeTreeItem[] }>('/organization/tree'),
        api.get<{ warehouses: WarehouseRecord[] }>('/inventory/warehouses'),
        api.get<{ boms: BomRecord[] }>('/technical/boms'),
        api.get<{ productionPlans: ProductionPlanRecord[] }>('/planning/production-plans'),
      ]);
      const flatOrgNodes = flattenOrgNodes(orgRes.tree);
      setItems(itemsRes.items);
      setOrgNodes(flatOrgNodes);
      setWarehouses(warehouseRes.warehouses);
      setBoms(bomRes.boms);
      setPlans(planRes.productionPlans);
      if (!orgNodeId && flatOrgNodes.length > 0)
        setOrgNodeId(flatOrgNodes[flatOrgNodes.length - 1]!.id);
      if (!lines[0]?.productItemId && itemsRes.items[0]) {
        const firstItem = itemsRes.items[0];
        const firstBom = bomRes.boms.find(
          (bom) => bom.productItemId === firstItem.id && bom.status === 'approved',
        );
        setLines([
          {
            productItemId: firstItem.id,
            bomId: firstBom?.id ?? '',
            qtyToPlan: '1',
            warehouseId: warehouseRes.warehouses[0]?.id ?? '',
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load production plan data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [i18n.language]);

  function approvedBomsForItem(productItemId: string): BomRecord[] {
    return boms.filter((bom) => bom.productItemId === productItemId && bom.status === 'approved');
  }

  async function _pullFromMaterialRequest(mrId: string): Promise<void> {
    if (!mrId) return;
    try {
      const res = await api.get<{ materialRequest: MaterialRequestRecord }>(
        '/planning/material-requests/' + mrId,
      );
      const mr = res.materialRequest;
      if (mr && mr.lines && mr.lines.length > 0) {
        const newLines: ProductionPlanItemInput[] = mr.lines.map((l) => {
          const approvedBom = approvedBomsForItem(l.itemId)[0];
          return {
            productItemId: l.itemId,
            bomId: approvedBom?.id ?? '',
            qtyToPlan: l.quantity,
            warehouseId: l.warehouseId || warehouses[0]?.id || '',
          };
        });
        setLines(newLines.length > 0 ? newLines : lines);
        setFormSuccess(t('pages.technical.form.success'));
      }
    } catch {
      setFormError('Failed to pull items from Material Request');
    }
  }

  function _pullAllApprovedBomItems(): void {
    const uniqueItemIds = Array.from(
      new Set(boms.filter((b) => b.status === 'approved').map((b) => b.productItemId)),
    );
    if (uniqueItemIds.length === 0) return;
    const newLines: ProductionPlanItemInput[] = uniqueItemIds.map((itemId) => {
      const defaultBom =
        boms.find((b) => b.productItemId === itemId && b.status === 'approved' && b.isDefault) ||
        approvedBomsForItem(itemId)[0];
      return {
        productItemId: itemId,
        bomId: defaultBom?.id ?? '',
        qtyToPlan: '10',
        warehouseId: warehouses[0]?.id || '',
      };
    });
    setLines(newLines);
  }

  async function openMaterialRequirements(plan: ProductionPlanRecord): Promise<void> {
    setShowMatReqModal(plan);
    setLoadingReqs(true);
    setCalculatedReqs([]);
    try {
      // 1. جلب بنود الـ BOMs والأرصدة
      const [bomsDetailsRes, stockRes] = await Promise.all([
        Promise.all(
          plan.items.map((item) =>
            api
              .get<{ bom: { lines: BomLineRecord[] } }>('/technical/boms/' + item.bomId)
              .catch(() => ({ bom: { lines: [] } })),
          ),
        ),
        api
          .get<{ balances: StockBalanceRecord[] }>('/inventory/stock-balances')
          .catch(() => ({ balances: [] })),
      ]);

      // 2. تجميع الاحتياجات الإجمالية لكل مادة خام
      const reqMap = new Map<string, number>();
      plan.items.forEach((planItem, idx) => {
        const bomDetail = bomsDetailsRes[idx];
        const planQty = parseFloat(planItem.qtyToPlan || '0');
        if (bomDetail?.bom?.lines) {
          bomDetail.bom.lines.forEach((line) => {
            const lineQty = parseFloat(line.quantity || '0');
            const totalRequired = planQty * lineQty;
            reqMap.set(
              line.componentItemId,
              (reqMap.get(line.componentItemId) || 0) + totalRequired,
            );
          });
        }
      });

      // 3. مطابقة الاحتياجات مع الأرصدة المتوفرة بالمخازن
      const results: MaterialRequirement[] = [];
      const stockBalances = stockRes.balances || [];
      reqMap.forEach((requiredQty, itemId) => {
        const availableStock = stockBalances
          .filter((sb) => sb.itemId === itemId)
          .reduce((sum, sb) => sum + parseFloat(sb.quantityOnHand || '0'), 0);
        const shortage = Math.max(0, requiredQty - availableStock);
        results.push({ itemId, requiredQty, availableStock, shortage });
      });

      setCalculatedReqs(results);
    } catch {
      setCalculatedReqs([]);
    } finally {
      setLoadingReqs(false);
    }
  }

  function addLine(): void {
    const productItemId = items[0]?.id ?? '';
    const firstBom = approvedBomsForItem(productItemId)[0];
    setLines([
      ...lines,
      {
        productItemId,
        bomId: firstBom?.id ?? '',
        qtyToPlan: '1',
        warehouseId: warehouses[0]?.id ?? '',
      },
    ]);
  }

  function updateLine(index: number, field: keyof ProductionPlanItemInput, value: string): void {
    const updated = [...lines];
    const current = updated[index];
    if (!current) return;
    if (field === 'productItemId') {
      const firstBom = approvedBomsForItem(value)[0];
      updated[index] = { ...current, productItemId: value, bomId: firstBom?.id ?? '' };
    } else {
      updated[index] = { ...current, [field]: value };
    }
    setLines(updated);
  }

  function removeLine(index: number): void {
    if (lines.length === 1) return;
    setLines(lines.filter((_, lineIndex) => lineIndex !== index));
  }

  function resetForm(): void {
    const productItemId = items[0]?.id ?? '';
    const firstBom = approvedBomsForItem(productItemId)[0];
    setOrgNodeId(orgNodes[orgNodes.length - 1]?.id ?? '');
    setPlanBy('job_order');
    setFromDate('');
    setToDate('');
    setLines([
      {
        productItemId,
        bomId: firstBom?.id ?? '',
        qtyToPlan: '1',
        warehouseId: warehouses[0]?.id ?? '',
      },
    ]);
    setFormError(null);
  }

  async function handleCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    if (!orgNodeId || !fromDate || !toDate || lines.length === 0) {
      setFormError('Complete the plan dates, activity, and at least one item.');
      return;
    }
    if (
      lines.some(
        (line) =>
          !line.productItemId || !line.bomId || !line.qtyToPlan || Number(line.qtyToPlan) <= 0,
      )
    ) {
      setFormError('Every item needs an approved BOM and a positive planned quantity.');
      return;
    }
    if (lines.some((line) => !line.warehouseId)) {
      setFormError(t('pages.production_plan.noWarehouseWarning'));
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/planning/production-plans', {
        orgNodeId,
        planBy,
        fromDate,
        toDate,
        items: lines,
      });
      setShowForm(false);
      setFormSuccess(t('pages.technical.form.success'));
      resetForm();
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create production plan');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(id: string, action: 'submit' | 'create-work-orders'): Promise<void> {
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);
    try {
      await api.post('/planning/production-plans/' + id + '/' + action, {});
      setFormSuccess(t('pages.technical.form.success'));
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to update production plan');
    } finally {
      setSubmitting(false);
    }
  }

  const itemLabel = (id: string): string => items.find((item) => item.id === id)?.name ?? id;
  const itemCode = (id: string): string => items.find((item) => item.id === id)?.code ?? '';
  const orgLabel = (id: string): string => orgNodes.find((node) => node.id === id)?.name ?? id;
  const warehouseLabel = (id: string | null): string =>
    warehouses.find((warehouse) => warehouse.id === id)?.name ?? id ?? '-';
  const bomLabel = (id: string): string => {
    const bom = boms.find((candidate) => candidate.id === id);
    return bom ? 'v' + bom.version + (bom.isDefault ? ' • default' : '') : id;
  };
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <div className="page-intro__eyebrow">{t('pages.production_plan.eyebrow')}</div>
          <h1>{t('pages.production_plan.title')}</h1>
          <p>{t('pages.production_plan.description')}</p>
        </div>
        <button
          className="primary-button"
          onClick={() => {
            setFormError(null);
            setFormSuccess(null);
            setShowForm(!showForm);
          }}
        >
          {showForm
            ? t('common.cancel', { defaultValue: 'Cancel' })
            : t('pages.production_plan.createPlan')}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {formError && <div className="form-error">{formError}</div>}
      {formSuccess && <div className="form-success">{formSuccess}</div>}

      {showForm && (
        <article className="content-card" style={{ marginBottom: 20 }}>
          <form
            onSubmit={(event) => {
              void handleCreate(event);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.production_plan.activity')}</label>
                <select
                  value={orgNodeId}
                  onChange={(event) => setOrgNodeId(event.target.value)}
                  style={{ ...inputStyle, minWidth: 220 }}
                  required
                >
                  {orgNodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name} ({node.nodeType})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.production_plan.planBy')}</label>
                <select
                  value={planBy}
                  onChange={(event) => setPlanBy(event.target.value)}
                  style={{ ...inputStyle, minWidth: 180 }}
                >
                  <option value="job_order">{t('pages.production_plan.jobOrder')}</option>
                  <option value="material_request">
                    {t('pages.production_plan.materialRequest')}
                  </option>
                  <option value="sales_forecast">{t('pages.production_plan.salesForecast')}</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.production_plan.fromDate')}</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.production_plan.toDate')}</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  style={inputStyle}
                  required
                />
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
                <span style={{ flex: 2 }}>{t('pages.production_plan.productItem')}</span>
                <span style={{ flex: 1.4 }}>{t('pages.production_plan.bom')}</span>
                <span style={{ width: 130 }}>{t('pages.production_plan.plannedQty')}</span>
                <span style={{ flex: 1.4 }}>
                  {t('pages.production_plan.finishedGoodsWarehouse')}
                </span>
                <span style={{ width: 32 }} />
              </div>
              {lines.map((line, index) => {
                const approvedBoms = approvedBomsForItem(line.productItemId);
                return (
                  <div
                    key={index}
                    style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}
                  >
                    <select
                      value={line.productItemId}
                      onChange={(event) => updateLine(index, 'productItemId', event.target.value)}
                      style={{ ...inputStyle, flex: 2, minWidth: 180 }}
                      required
                    >
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.code})
                        </option>
                      ))}
                    </select>
                    <select
                      value={line.bomId}
                      onChange={(event) => updateLine(index, 'bomId', event.target.value)}
                      style={{ ...inputStyle, flex: 1.4, minWidth: 130 }}
                      required
                    >
                      <option value="">
                        {approvedBoms.length
                          ? t('pages.production_plan.bom')
                          : t('pages.production_plan.noBomWarning')}
                      </option>
                      {approvedBoms.map((bom) => (
                        <option key={bom.id} value={bom.id}>
                          {bomLabel(bom.id)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={line.qtyToPlan}
                      onChange={(event) => updateLine(index, 'qtyToPlan', event.target.value)}
                      style={{ ...inputStyle, width: 130 }}
                      required
                    />
                    <select
                      value={line.warehouseId}
                      onChange={(event) => updateLine(index, 'warehouseId', event.target.value)}
                      style={{ ...inputStyle, flex: 1.4, minWidth: 150 }}
                      required
                    >
                      <option value="">{t('pages.production_plan.finishedGoodsWarehouse')}</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name} ({warehouse.code})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="filter-button"
                      onClick={() => removeLine(index)}
                      disabled={lines.length === 1}
                      aria-label="Remove item"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addLine}
                className="filter-button"
                style={{ marginTop: 12 }}
              >
                + {t('pages.production_plan.addLine')}
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
        </article>
      )}

      <article className="content-card">
        <div className="section-heading">
          <h2>{t('pages.production_plan.listTitle')}</h2>
        </div>
        {loading ? (
          <p>{t('common.loading', { defaultValue: 'Loading...' })}</p>
        ) : plans.length === 0 ? (
          <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>
            {t('pages.production_plan.noPlans')}
          </p>
        ) : (
          <div className="placeholder-table">
            <div className="placeholder-table__head">
              <span>{t('pages.production_plan.planNumber')}</span>
              <span>{t('pages.production_plan.activity')}</span>
              <span>{t('pages.production_plan.planBy')}</span>
              <span>{t('pages.production_plan.status')}</span>
              <span>{t('common.filter', { defaultValue: 'Actions' })}</span>
            </div>
            {plans.map((plan) => (
              <div className="placeholder-table__row" key={plan.id} style={{ display: 'block' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1.5fr 1fr 1fr auto',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <span>
                    <b>{plan.planNumber}</b>
                  </span>
                  <span>{orgLabel(plan.orgNodeId)}</span>
                  <span>
                    {plan.planBy === 'job_order'
                      ? t('pages.production_plan.jobOrder')
                      : plan.planBy === 'material_request'
                        ? t('pages.production_plan.materialRequest')
                        : t('pages.production_plan.salesForecast')}
                  </span>
                  <span>
                    <span
                      className={
                        'status status--' + (plan.status === 'completed' ? 'success' : 'neutral')
                      }
                    >
                      <i />
                      {plan.status}
                    </span>
                  </span>
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="filter-button"
                      style={{ fontSize: 12, padding: '4px 8px', background: '#f1f5f9' }}
                      onClick={() => {
                        void openMaterialRequirements(plan);
                      }}
                    >
                      📊 {t('pages.production_plan.materialRequirements')}
                    </button>
                    {plan.status === 'draft' && (
                      <button
                        className="primary-button"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        disabled={submitting}
                        onClick={() => {
                          void handleAction(plan.id, 'submit');
                        }}
                      >
                        {t('pages.production_plan.submit')}
                      </button>
                    )}
                    {plan.status === 'submitted' && (
                      <button
                        className="primary-button"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        disabled={submitting}
                        onClick={() => {
                          void handleAction(plan.id, 'create-work-orders');
                        }}
                      >
                        {t('pages.production_plan.createWorkOrders')}
                      </button>
                    )}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 12,
                    marginTop: 10,
                    color: '#64748b',
                    fontSize: 12,
                  }}
                >
                  <span>
                    {plan.fromDate.slice(0, 10)} → {plan.toDate.slice(0, 10)}
                  </span>
                  {plan.items.map((line) => (
                    <span key={line.id}>
                      {itemLabel(line.productItemId)} ({itemCode(line.productItemId)}) ×{' '}
                      {line.qtyToPlan} · {bomLabel(line.bomId)} · {warehouseLabel(line.warehouseId)}
                      {line.workOrderId ? ' · WO created' : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
