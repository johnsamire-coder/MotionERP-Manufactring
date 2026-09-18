import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface JobOrderRecord { id: string; jobOrderNumber: string; }
interface WorkOrderRecord { id: string; workOrderNumber: string; }
interface EmployeeRecord { id: string; code: string; name: string; }
interface WorkCenterRecord { id: string; code: string; name: string; ratePerMinute?: string; status: string; }
interface ItemRecord { id: string; code: string; name: string; }
interface WarehouseRecord { id: string; code: string; name: string; }
interface StepMaterialRecord {
  id: string; productionStepId: string; itemId: string;
  requiredQuantity: string; consumedQuantity: string; warehouseId: string | null; lineNumber: number;
}
interface TimeLogRecord {
  id: string; productionStepId: string; fromTime: string; toTime: string | null;
  timeInMinutes: string | null; completedQuantity: string | null; processLossQuantity: string | null;
}
interface ProductionStepRecord {
  id: string; jobOrderReference: string; workOrderId: string | null; workCenterId: string;
  operationName: string; standardTimeMinutes: string; actualTimeMinutes: string | null;
  forQuantity: string | null; completedQuantity: string; operatorEmployeeId: string | null;
  sequence: number; status: 'pending' | 'in_progress' | 'done';
}

interface LaborCostSummary {
  jobOrderReference: string; totalStandardMinutes: number; totalActualMinutes: number;
  totalStandardCost: number; totalActualCost: number; stepsCount: number; stepsDone: number;
}

function nextCode(prefix: string, existingCodes: string[]): string {
  const matching = existingCodes.filter((c) => c.toUpperCase().startsWith(prefix.toUpperCase()));
  return `${prefix}-${String(matching.length + 1).padStart(4, '0')}`;
}

export function ProductionOpsPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [jobOrders, setJobOrders] = useState<JobOrderRecord[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenterRecord[]>([]);
  const [steps, setSteps] = useState<ProductionStepRecord[]>([]);
  const [costSummary, setCostSummary] = useState<LaborCostSummary | null>(null);
  const [orgNodeId, setOrgNodeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedJO, setSelectedJO] = useState('');
  const [showWcForm, setShowWcForm] = useState(false);
  const [showStepForm, setShowStepForm] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState<string | null>(null);
  const [showLogsForStep, setShowLogsForStep] = useState<string | null>(null);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [showMaterialsForStep, setShowMaterialsForStep] = useState<string | null>(null);
  const [stepMaterials, setStepMaterials] = useState<StepMaterialRecord[]>([]);
  const [showMatForm, setShowMatForm] = useState(false);
  const [matItemId, setMatItemId] = useState('');
  const [matReqQty, setMatReqQty] = useState('');
  const [matConsQty, setMatConsQty] = useState('0');
  const [matWhId, setMatWhId] = useState('');
  const [timeLogs, setTimeLogs] = useState<TimeLogRecord[]>([]);
  const [showLogForm, setShowLogForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [wcCode, setWcCode] = useState('');
  const [wcName, setWcName] = useState('');
  const [wcCostPerMin, setWcCostPerMin] = useState('2.5');

  const [selectedWcId, setSelectedWcId] = useState('');
  const [stepName, setStepName] = useState('');
  const [stdMins, setStdMins] = useState('30');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState('');
  const [forQty, setForQty] = useState('');
  const [operatorId, setOperatorId] = useState('');

  const [actualMinsInput, setActualMinsInput] = useState('30');

  const [logFromTime, setLogFromTime] = useState('');
  const [logToTime, setLogToTime] = useState('');
  const [logMinutes, setLogMinutes] = useState('');
  const [logQty, setLogQty] = useState('');

  async function getActiveOrgId(): Promise<string> {
    if (orgNodeId) return orgNodeId;
    try {
      const nodesRes = await api.get<{ nodes?: Array<{ id: string }> }>('/organization/nodes');
      if (nodesRes.nodes && nodesRes.nodes[0]) {
        setOrgNodeId(nodesRes.nodes[0].id);
        return nodesRes.nodes[0].id;
      }
    } catch {
      // fallback
    }
    const treeRes = await api.get<{ tree: Array<{ id: string }> }>('/organization/tree');
    const fallbackId = treeRes.tree[0]?.id ?? '';
    setOrgNodeId(fallbackId);
    return fallbackId;
  }

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [joRes, woRes, empRes, wcRes] = await Promise.all([
        api.get<{ jobOrders: JobOrderRecord[] }>('/sales/job-orders'),
        api.get<{ workOrders: WorkOrderRecord[] }>('/production-ops/work-orders'),
        api.get<{ employees: EmployeeRecord[] }>('/hr/employees'),
        api.get<{ workCenters: WorkCenterRecord[] }>('/production-ops/work-centers'),
      ]);
      await getActiveOrgId();
      setJobOrders(joRes.jobOrders);
      setWorkOrders(woRes.workOrders);
      setEmployees(empRes.employees);
      setWorkCenters(wcRes.workCenters);

      const activeJO = selectedJO || (joRes.jobOrders[0]?.jobOrderNumber ?? '');
      if (activeJO) {
        setSelectedJO(activeJO);
        await loadJoData(activeJO);
      }
      if (!selectedWcId && wcRes.workCenters[0]) setSelectedWcId(wcRes.workCenters[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load production operations data');
    } finally {
      setLoading(false);
    }
  }

  async function loadJoData(joNumber: string): Promise<void> {
    try {
      const [stepsRes, costRes] = await Promise.all([
        api.get<{ steps: ProductionStepRecord[] }>(`/production-ops/steps?jobOrderReference=${joNumber}`),
        api.get<{ cost: LaborCostSummary }>(`/production-ops/job-orders/${joNumber}/labor-cost`),
      ]);
      setSteps(stepsRes.steps ?? []);
      setCostSummary(costRes.cost ?? null);
    } catch {
      setSteps([]);
      setCostSummary(null);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  async function handleJoChange(joNumber: string): Promise<void> {
    setSelectedJO(joNumber);
    await loadJoData(joNumber);
  }

  function openWcForm(): void {
    setWcCode(nextCode('WC', workCenters.map((w) => w.code)));
    setShowWcForm((v) => !v);
  }

  async function handleCreateWc(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      const activeOrg = await getActiveOrgId();
      await api.post('/production-ops/work-centers', {
        orgNodeId: activeOrg,
        code: wcCode,
        name: wcName,
        ratePerMinute: wcCostPerMin,
      });
      setWcName(''); setShowWcForm(false);
      setFormSuccess(t('pages.production_ops.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleCreateStep(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/production-ops/steps', {
        jobOrderReference: selectedJO,
        workOrderId: selectedWorkOrderId || undefined,
        workCenterId: selectedWcId,
        operationName: stepName,
        standardTimeMinutes: String(stdMins),
        forQuantity: forQty || undefined,
        operatorEmployeeId: operatorId || undefined,
      });
      setStepName(''); setShowStepForm(false);
      setFormSuccess(t('pages.production_ops.form.success'));
      await loadJoData(selectedJO);
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleStartStep(stepId: string): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post(`/production-ops/steps/${stepId}/start`, {});
      setFormSuccess(t('pages.production_ops.form.success'));
      await loadJoData(selectedJO);
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleCompleteStep(stepId: string): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post(`/production-ops/steps/${stepId}/close`, {
        actualTimeMinutes: String(actualMinsInput),
      });
      setShowCompleteModal(null);
      setFormSuccess(t('pages.production_ops.form.success'));
      await loadJoData(selectedJO);
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function openMaterialsForStep(stepId: string): Promise<void> {
    setShowMaterialsForStep(stepId);
    setShowMatForm(false);
    try {
      const res = await api.get<{ materials: StepMaterialRecord[] }>(`/production-ops/steps/${stepId}/materials`);
      setStepMaterials(res.materials);
    } catch {
      setStepMaterials([]);
    }
  }

  async function handleAddMaterial(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!showMaterialsForStep || !matItemId || !matReqQty) return;
    setSubmitting(true);
    try {
      const payload = {
        materials: [
          {
            itemId: matItemId,
            requiredQuantity: matReqQty,
            consumedQuantity: matConsQty || '0',
            warehouseId: matWhId || undefined,
          },
        ],
      };
      await api.post(`/production-ops/steps/${showMaterialsForStep}/materials`, payload);
      const res = await api.get<{ materials: StepMaterialRecord[] }>(`/production-ops/steps/${showMaterialsForStep}/materials`);
      setStepMaterials(res.materials);
      setShowMatForm(false);
      setMatReqQty('');
      setMatConsQty('0');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to add material');
    } finally {
      setSubmitting(false);
    }
  }

  const itemLabel = (id: string): string => items.find((it) => it.id === id)?.name ?? id;
  const whLabel = (id: string | null): string => (id ? (warehouses.find((w) => w.id === id)?.name ?? id) : '—');

  async function openLogsForStep(stepId: string): Promise<void> {
    setShowLogsForStep(stepId);
    setShowLogForm(false);
    try {
      const res = await api.get<{ timeLogs: TimeLogRecord[] }>(`/production-ops/steps/${stepId}/time-logs`);
      setTimeLogs(res.timeLogs ?? []);
    } catch {
      setTimeLogs([]);
    }
  }

  async function handleAddTimeLog(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!showLogsForStep) return;
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/production-ops/time-logs', {
        productionStepId: showLogsForStep,
        fromTime: new Date(logFromTime).toISOString(),
        toTime: logToTime ? new Date(logToTime).toISOString() : undefined,
        timeInMinutes: logMinutes || undefined,
        completedQuantity: logQty || undefined,
      });
      setLogFromTime(''); setLogToTime(''); setLogMinutes(''); setLogQty('');
      setShowLogForm(false);
      setFormSuccess(t('pages.production_ops.form.success'));
      await openLogsForStep(showLogsForStep);
      await loadJoData(selectedJO);
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  const wcLabel = (id: string): string => workCenters.find((w) => w.id === id)?.name ?? id;
  const woLabel = (id: string | null): string => (id ? (workOrders.find((w) => w.id === id)?.workOrderNumber ?? id) : '—');
  const empLabel = (id: string | null): string => (id ? (employees.find((e) => e.id === id)?.name ?? id) : '—');
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>{t('pages.production_ops.form.loading')}</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.production_ops.eyebrow')}</span>
          <h1>{t('pages.production_ops.title')}</h1>
          <p>{t('pages.production_ops.description')}</p>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}
      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <label style={{ ...labelStyle, fontSize: 14, fontWeight: 'bold' }}>Job Order:</label>
          <select value={selectedJO} onChange={(e) => { void handleJoChange(e.target.value); }} style={{ ...inputStyle, minWidth: 220, fontSize: 14, fontWeight: 'bold' }}>
            {jobOrders.map((jo) => <option key={jo.id} value={jo.jobOrderNumber}>{jo.jobOrderNumber}</option>)}
          </select>
        </div>

        {costSummary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}>
            <div>
              <span style={labelStyle}>{t('pages.production_ops.cost.stdTotalMins')}</span>
              <p style={{ margin: '2px 0 0', fontWeight: 'bold', fontSize: 16 }}>{costSummary.totalStandardMinutes} min</p>
            </div>
            <div>
              <span style={labelStyle}>{t('pages.production_ops.cost.actTotalMins')}</span>
              <p style={{ margin: '2px 0 0', fontWeight: 'bold', fontSize: 16, color: '#0369a1' }}>{costSummary.totalActualMinutes} min</p>
            </div>
            <div>
              <span style={labelStyle}>{t('pages.production_ops.cost.stdTotalCost')}</span>
              <p style={{ margin: '2px 0 0', fontWeight: 'bold', fontSize: 16 }}>{Number(costSummary.totalStandardCost ?? 0).toFixed(2)} EGP</p>
            </div>
            <div>
              <span style={labelStyle}>{t('pages.production_ops.cost.actTotalCost')}</span>
              <p style={{ margin: '2px 0 0', fontWeight: 'bold', fontSize: 18, color: '#166534' }}>{Number(costSummary.totalActualCost ?? 0).toFixed(2)} EGP</p>
            </div>
          </div>
        )}
      </div>

      <article className="panel module-panel" style={{ marginBottom: 20 }}>
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Factory Capacity</span>
            <h2>{t('pages.production_ops.workCenters.title')}</h2>
          </div>
          <button className="filter-button" onClick={openWcForm}><b>+</b> {t('pages.production_ops.workCenters.addCenter')}</button>
        </div>

        {showWcForm && (
          <form onSubmit={(e) => { void handleCreateWc(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.production_ops.workCenters.code')}</label>
              <input value={wcCode} onChange={(e) => setWcCode(e.target.value)} required style={{ ...inputStyle, width: 110 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.production_ops.workCenters.name')}</label>
              <input value={wcName} onChange={(e) => setWcName(e.target.value)} required placeholder="e.g. Cutting Station" style={{ ...inputStyle, minWidth: 200 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.production_ops.workCenters.ratePerMinute')}</label>
              <input type="number" min="0" step="any" value={wcCostPerMin} onChange={(e) => setWcCostPerMin(e.target.value)} required style={{ ...inputStyle, width: 120 }} />
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.production_ops.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.production_ops.workCenters.code')}</span>
            <span>{t('pages.production_ops.workCenters.name')}</span>
            <span>{t('pages.production_ops.workCenters.ratePerMinute')}</span>
          </div>
          {workCenters.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.production_ops.form.empty')}</p>}
          {workCenters.map((wc) => (
            <div className="placeholder-table__row" key={wc.id}>
              <span><b>{wc.code}</b></span>
              <span>{wc.name}</span>
              <span><b>{wc.ratePerMinute ?? '0'} EGP / min</b></span>
            </div>
          ))}
        </div>
      </article>

      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Routing Sequence</span>
            <h2>{t('pages.production_ops.steps.title')}</h2>
          </div>
          <button className="primary-button" onClick={() => setShowStepForm((v) => !v)}><b>+</b> {t('pages.production_ops.steps.addStep')}</button>
        </div>

        {showStepForm && (
          <form onSubmit={(e) => { void handleCreateStep(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.production_ops.steps.stepName')}</label>
              <input value={stepName} onChange={(e) => setStepName(e.target.value)} required placeholder="e.g. Laser Cutting" style={{ ...inputStyle, minWidth: 200 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.production_ops.steps.workCenter')}</label>
              <select value={selectedWcId} onChange={(e) => setSelectedWcId(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
                {workCenters.map((wc) => <option key={wc.id} value={wc.id}>{wc.name} ({wc.code})</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.production_ops.steps.stdMins')}</label>
              <input type="number" min="1" step="any" value={stdMins} onChange={(e) => setStdMins(e.target.value)} required style={{ ...inputStyle, width: 120 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.production_ops.steps.forQty')}</label>
              <input type="number" min="0" step="any" value={forQty} onChange={(e) => setForQty(e.target.value)} style={{ ...inputStyle, width: 120 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.production_ops.steps.workOrder')}</label>
              <select value={selectedWorkOrderId} onChange={(e) => setSelectedWorkOrderId(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
                <option value="">—</option>
                {workOrders.map((wo) => <option key={wo.id} value={wo.id}>{wo.workOrderNumber}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.production_ops.steps.operator')}</label>
              <select value={operatorId} onChange={(e) => setOperatorId(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
                <option value="">—</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.production_ops.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.production_ops.steps.sequence')}</span>
            <span>{t('pages.production_ops.steps.stepName')}</span>
            <span>{t('pages.production_ops.steps.workCenter')}</span>
            <span>{t('pages.production_ops.steps.workOrder')}</span>
            <span>{t('pages.production_ops.steps.operator')}</span>
            <span>{t('pages.production_ops.steps.completedQty')}</span>
            <span>{t('pages.production_ops.steps.status')}</span>
            <span>{t('pages.production_ops.steps.action')}</span>
          </div>

          {steps.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.production_ops.form.empty')}</p>}

          {steps.map((st) => (
            <div className="placeholder-table__row" key={st.id}>
              <span><b>#{st.sequence}</b></span>
              <span><b>{st.operationName}</b></span>
              <span>{wcLabel(st.workCenterId)}</span>
              <span>{woLabel(st.workOrderId)}</span>
              <span>{empLabel(st.operatorEmployeeId)}</span>
              <span>{st.completedQuantity}{st.forQuantity ? ` / ${st.forQuantity}` : ''}</span>
              <span>
                <span className={`status status--${st.status === 'done' ? 'success' : st.status === 'in_progress' ? 'warning' : 'neutral'}`}>
                  <i />{st.status}
                </span>
              </span>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {st.status === 'pending' && (
                  <button className="filter-button" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => { void handleStartStep(st.id); }}>
                    {t('pages.production_ops.steps.start')}
                  </button>
                )}
                {st.status === 'in_progress' && (
                  <>
                    <button className="primary-button" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => { setActualMinsInput(st.standardTimeMinutes); setShowCompleteModal(st.id); }}>
                      {t('pages.production_ops.steps.complete')}
                    </button>
                    <button className="filter-button" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => { void openLogsForStep(st.id); }}>
                      {t('pages.production_ops.steps.viewLogs')}
                    </button>
                  </>
                )}
                {st.status === 'done' && (
                  <button className="filter-button" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => { void openLogsForStep(st.id); }}>
                    {t('pages.production_ops.steps.viewLogs')}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </article>

      {showCompleteModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, width: 380, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3>{t('pages.production_ops.steps.complete')}</h3>
            <label style={labelStyle}>{t('pages.production_ops.form.enterActualMins')}</label>
            <input
              type="number"
              min="0.1"
              step="any"
              value={actualMinsInput}
              onChange={(e) => setActualMinsInput(e.target.value)}
              required
              style={{ ...inputStyle, width: '100%' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="filter-button" onClick={() => setShowCompleteModal(null)}>{t('pages.production_ops.form.cancel')}</button>
              <button className="primary-button" disabled={submitting} onClick={() => { void handleCompleteStep(showCompleteModal); }}>
                {t('pages.production_ops.steps.complete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogsForStep && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, width: 480, maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{t('pages.production_ops.steps.timeLogs')}</h3>
              <button className="filter-button" onClick={() => { setShowLogsForStep(null); setShowLogForm(false); }}>{t('pages.production_ops.form.cancel')}</button>
            </div>

            {timeLogs.length === 0 && <p style={{ color: '#94a3b8', textAlign: 'center', padding: '10px 0' }}>{t('pages.production_ops.steps.noTimeLogs')}</p>}
            {timeLogs.map((log) => (
              <div key={log.id} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 10, fontSize: 13 }}>
                <div><b>{t('pages.production_ops.steps.fromTime')}:</b> {new Date(log.fromTime).toLocaleString()}</div>
                {log.toTime && <div><b>{t('pages.production_ops.steps.toTime')}:</b> {new Date(log.toTime).toLocaleString()}</div>}
                {log.timeInMinutes && <div><b>{t('pages.production_ops.steps.stdMins')}:</b> {log.timeInMinutes} min</div>}
                {log.completedQuantity && <div><b>{t('pages.production_ops.steps.completedQtyLog')}:</b> {log.completedQuantity}</div>}
              </div>
            ))}

            {!showLogForm && (
              <button className="primary-button" onClick={() => setShowLogForm(true)}>+ {t('pages.production_ops.steps.addTimeLog')}</button>
            )}

            {showLogForm && (
              <form onSubmit={(e) => { void handleAddTimeLog(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={labelStyle}>{t('pages.production_ops.steps.fromTime')}</label>
                  <input type="datetime-local" value={logFromTime} onChange={(e) => setLogFromTime(e.target.value)} required style={{ ...inputStyle, width: '100%' }} />
                </div>
                <div>
                  <label style={labelStyle}>{t('pages.production_ops.steps.toTime')}</label>
                  <input type="datetime-local" value={logToTime} onChange={(e) => setLogToTime(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                </div>
                <div>
                  <label style={labelStyle}>{t('pages.production_ops.steps.stdMins')}</label>
                  <input type="number" min="0" step="any" value={logMinutes} onChange={(e) => setLogMinutes(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                </div>
                <div>
                  <label style={labelStyle}>{t('pages.production_ops.steps.completedQtyLog')}</label>
                  <input type="number" min="0" step="any" value={logQty} onChange={(e) => setLogQty(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                </div>
                <button type="submit" disabled={submitting} className="primary-button">{t('pages.production_ops.form.save')}</button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}



