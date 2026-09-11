import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface JobOrderRecord { id: string; jobOrderNumber: string; }
interface WorkCenterRecord { id: string; code: string; name: string; ratePerMinute?: string; costPerMinute?: string; status: string; }
interface ProductionStepRecord {
  id: string;
  jobOrderReference: string;
  workCenterId: string;
  sequence: number;
  operationName?: string;
  name?: string;
  standardTimeMinutes?: string;
  standardMinutes?: string;
  actualMinutes?: string;
  actualTimeMinutes?: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface LaborCostSummary {
  jobOrderReference: string;
  totalStandardMinutes: number;
  totalActualMinutes: number;
  totalStandardCost: number;
  totalActualCost: number;
  completedSteps: number;
  totalSteps: number;
}

function nextCode(prefix: string, existingCodes: string[]): string {
  const matching = existingCodes.filter((c) => c.toUpperCase().startsWith(prefix.toUpperCase()));
  return `${prefix}-${String(matching.length + 1).padStart(4, '0')}`;
}

export function ProductionOpsPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [jobOrders, setJobOrders] = useState<JobOrderRecord[]>([]);
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
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Work Center Form
  const [wcCode, setWcCode] = useState('');
  const [wcName, setWcName] = useState('');
  const [wcCostPerMin, setWcCostPerMin] = useState('2.5');

  // Production Step Form
  const [selectedWcId, setSelectedWcId] = useState('');
  const [stepName, setStepName] = useState('');
  const [stdMins, setStdMins] = useState('30');

  // Complete Step Modal
  const [actualMinsInput, setActualMinsInput] = useState('30');

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
      const [joRes, wcRes] = await Promise.all([
        api.get<{ jobOrders: JobOrderRecord[] }>('/sales/job-orders'),
        api.get<{ workCenters: WorkCenterRecord[] }>('/production-ops/work-centers'),
      ]);
      await getActiveOrgId();
      setJobOrders(joRes.jobOrders);
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
        workCenterId: selectedWcId,
        sequence: steps.length + 1,
        operationName: stepName,
        standardTimeMinutes: String(stdMins),
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

  const wcLabel = (id: string): string => workCenters.find((w) => w.id === id)?.name ?? id;
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.production_ops.eyebrow')}</span>
          <h1>{t('pages.production_ops.title')}</h1>
          <p>{t('pages.production_ops.description')}</p>
        </div>
      </div>

      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      {/* JO Selector & Live Labor Cost Summary Card */}
      <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <label style={{ ...labelStyle, fontSize: 14, fontWeight: 'bold' }}>رقم أمر التشغيل (Job Order):</label>
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

      {/* 1. Work Centers Section */}
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
            <span>الحالة</span>
          </div>
          {workCenters.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.production_ops.form.empty')}</p>}
          {workCenters.map((wc) => (
            <div className="placeholder-table__row" key={wc.id}>
              <span><b>{wc.code}</b></span>
              <span>{wc.name}</span>
              <span><b>{wc.ratePerMinute ?? wc.costPerMinute ?? '0'} EGP / min</b></span>
              <span><span className="status status--success"><i />{wc.status}</span></span>
            </div>
          ))}
        </div>
      </article>

      {/* 2. Production Steps Section */}
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
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.production_ops.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.production_ops.steps.sequence')}</span>
            <span>{t('pages.production_ops.steps.stepName')}</span>
            <span>{t('pages.production_ops.steps.workCenter')}</span>
            <span>{t('pages.production_ops.steps.stdMins')}</span>
            <span>{t('pages.production_ops.steps.actMins')}</span>
            <span>{t('pages.production_ops.steps.status')}</span>
            <span>{t('pages.production_ops.steps.action')}</span>
          </div>

          {steps.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.production_ops.form.empty')}</p>}

          {steps.map((st) => {
            const displayStepName = st.operationName ?? st.name ?? '—';
            const displayStdMins = st.standardTimeMinutes ?? st.standardMinutes ?? '0';
            const displayActMins = st.actualTimeMinutes ?? st.actualMinutes;
            return (
              <div className="placeholder-table__row" key={st.id}>
                <span><b>#{st.sequence}</b></span>
                <span><b>{displayStepName}</b></span>
                <span>{wcLabel(st.workCenterId)}</span>
                <span>{displayStdMins} min</span>
                <span><b>{displayActMins ? `${displayActMins} min` : '—'}</b></span>
                <span>
                  <span className={`status status--${st.status === 'completed' ? 'success' : st.status === 'in_progress' ? 'warning' : 'neutral'}`}>
                    <i />{st.status}
                  </span>
                </span>
                <span>
                  {st.status === 'pending' && (
                    <button className="filter-button" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => { void handleStartStep(st.id); }}>
                      {t('pages.production_ops.steps.start')}
                    </button>
                  )}
                  {st.status === 'in_progress' && (
                    <button className="primary-button" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => { setActualMinsInput(displayStdMins); setShowCompleteModal(st.id); }}>
                      {t('pages.production_ops.steps.complete')}
                    </button>
                  )}
                  {st.status === 'completed' && <span style={{ fontSize: 12, color: '#166534', fontWeight: 'bold' }}>مُكتمَل ✓</span>}
                </span>
              </div>
            );
          })}
        </div>
      </article>

      {/* Complete Step Modal */}
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
                إغلاق وحساب التكلفة
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
