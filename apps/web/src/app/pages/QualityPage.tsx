import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface JobOrderRecord { id: string; jobOrderNumber: string; }
interface InspectionPointRecord { id: string; code?: string; name: string; targetDurationMinutes?: number; targetMinutes?: number; }
interface QualityWorkflowRecord {
  id: string;
  jobOrderReference?: string;
  checkPointId?: string;
  inspectionPointId?: string;
  assignedRoleOrUser?: string;
  escalationLevel?: number;
  status: 'pending' | 'passed' | 'failed' | 'approved' | 'rejected';
  targetAt?: string;
  createdAt: string;
}

function nextCode(prefix: string, existingCodes: string[]): string {
  const matching = existingCodes.filter((c) => c.toUpperCase().startsWith(prefix.toUpperCase()));
  return `${prefix}-${String(matching.length + 1).padStart(4, '0')}`;
}

export function QualityPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [jobOrders, setJobOrders] = useState<JobOrderRecord[]>([]);
  const [points, setPoints] = useState<InspectionPointRecord[]>([]);
  const [workflows, setWorkflows] = useState<QualityWorkflowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedJO, setSelectedJO] = useState('');
  const [showPointForm, setShowPointForm] = useState(false);
  const [showTriggerForm, setShowTriggerForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Point Form
  const [pointCode, setPointCode] = useState('');
  const [pointName, setPointName] = useState('');
  const [targetMinsInput, setTargetMinsInput] = useState('240');

  // Trigger Workflow Form
  const [selectedPointId, setSelectedPointId] = useState('');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const joRes = await api.get<{ jobOrders: JobOrderRecord[] }>('/sales/job-orders');
      setJobOrders(joRes.jobOrders ?? []);
      if (!selectedJO && joRes.jobOrders && joRes.jobOrders[0]) {
        setSelectedJO(joRes.jobOrders[0].jobOrderNumber);
      }

      try {
        const pointsRes = await api.get<any>('/quality/check-points');
        const list = Array.isArray(pointsRes) ? pointsRes : (pointsRes?.checkPoints ?? pointsRes?.inspectionPoints ?? []);
        setPoints(list);
        if (!selectedPointId && list[0]) setSelectedPointId(list[0].id);
      } catch {
        setPoints([]);
      }

      try {
        const wfRes = await api.get<any>('/quality/workflows');
        const listWf = Array.isArray(wfRes) ? wfRes : (wfRes?.workflows ?? []);
        setWorkflows(listWf);
      } catch {
        setWorkflows([]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load job orders for quality');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  function openPointForm(): void {
    setPointCode(nextCode('QC-PT', points.map((p) => p.code ?? '')));
    setShowPointForm((v) => !v);
  }

  async function handleCreatePoint(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      let stepId = '00000000-0000-0000-0000-000000000000';
      try {
        const stepsRes = await api.get<any>(`/production-ops/steps?jobOrderReference=${selectedJO}`);
        const list = Array.isArray(stepsRes) ? stepsRes : (stepsRes?.steps ?? []);
        if (list[0]?.id) stepId = list[0].id;
      } catch {
        // fallback
      }

      await api.post('/quality/check-points', {
        relatedEntityType: 'production_step',
        relatedEntityId: stepId,
        name: pointName,
        targetDurationMinutes: Math.max(1, Math.floor(Number(targetMinsInput))),
      });
      setPointName(''); setShowPointForm(false);
      setFormSuccess(t('pages.quality.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleTriggerWorkflow(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/quality/workflows/initialize', {
        checkPointId: selectedPointId,
      });
      setShowTriggerForm(false);
      setFormSuccess(t('pages.quality.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleCompleteInspection(wfId: string, actionType: 'approve' | 'reject'): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post(`/quality/workflows/${wfId}/${actionType}`, {
        workflowId: wfId,
      });
      setFormSuccess(t('pages.quality.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleProcessOverdue(): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      const res = await api.post<{ processed: number }>('/quality/process-overdue', {});
      setFormSuccess(`تم فحص المهل الزمنية وبدء تصعيد ${res.processed ?? 0} فحوصات متأخرة بنجاح`);
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  const pointLabel = (id?: string): string => points.find((p) => p.id === id)?.name ?? id ?? '—';
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.quality.eyebrow')}</span>
          <h1>{t('pages.quality.title')}</h1>
          <p>{t('pages.quality.description')}</p>
        </div>
      </div>

      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      {/* JO Selector & Process Overdue Engine Button */}
      <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ ...labelStyle, fontSize: 14, fontWeight: 'bold' }}>أمر التشغيل (Job Order):</label>
          <select value={selectedJO} onChange={(e) => setSelectedJO(e.target.value)} style={{ ...inputStyle, minWidth: 220, fontSize: 14, fontWeight: 'bold' }}>
            {jobOrders.map((jo) => <option key={jo.id} value={jo.jobOrderNumber}>{jo.jobOrderNumber}</option>)}
          </select>
        </div>

        <button className="filter-button" style={{ color: '#b91c1c', borderColor: '#fca5a5', fontWeight: 'bold' }} onClick={() => { void handleProcessOverdue(); }}>
          ⏰ {t('pages.quality.workflows.processOverdue')}
        </button>
      </div>

      {/* 1. Inspection Points Section */}
      <article className="panel module-panel" style={{ marginBottom: 20 }}>
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">QA Setup</span>
            <h2>{t('pages.quality.inspectionPoints.title')}</h2>
          </div>
          <button className="filter-button" onClick={openPointForm}><b>+</b> {t('pages.quality.inspectionPoints.addPoint')}</button>
        </div>

        {showPointForm && (
          <form onSubmit={(e) => { void handleCreatePoint(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.quality.inspectionPoints.name')}</label>
              <input value={pointName} onChange={(e) => setPointName(e.target.value)} required placeholder="e.g. Final Assembly Check" style={{ ...inputStyle, minWidth: 240 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.quality.inspectionPoints.targetMins')}</label>
              <input type="number" min="1" value={targetMinsInput} onChange={(e) => setTargetMinsInput(e.target.value)} required style={{ ...inputStyle, width: 120 }} />
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.quality.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.quality.inspectionPoints.name')}</span>
            <span>{t('pages.quality.inspectionPoints.targetMins')}</span>
          </div>
          {points.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.quality.form.empty')}</p>}
          {points.map((p) => {
            const mins = p.targetDurationMinutes ?? p.targetMinutes ?? 0;
            return (
              <div className="placeholder-table__row" key={p.id}>
                <span><b>{p.name}</b></span>
                <span><b>{mins} min ({(mins / 60).toFixed(1)} hrs)</b></span>
              </div>
            );
          })}
        </div>
      </article>

      {/* 2. Quality Workflows Section */}
      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Active Inspections & SLAs</span>
            <h2>{t('pages.quality.workflows.title')}</h2>
          </div>
          <button className="primary-button" onClick={() => setShowTriggerForm((v) => !v)}><b>+</b> {t('pages.quality.workflows.startWorkflow')}</button>
        </div>

        {showTriggerForm && (
          <form onSubmit={(e) => { void handleTriggerWorkflow(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.quality.workflows.point')}</label>
              <select value={selectedPointId} onChange={(e) => setSelectedPointId(e.target.value)} style={{ ...inputStyle, minWidth: 220 }}>
                {points.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.quality.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.quality.workflows.point')}</span>
            <span>{t('pages.quality.workflows.assignedTo')}</span>
            <span>{t('pages.quality.workflows.escalationLevel')}</span>
            <span>{t('pages.quality.workflows.status')}</span>
            <span>{t('pages.quality.workflows.action')}</span>
          </div>

          {workflows.length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.quality.form.empty')}</p>
          )}

          {workflows.map((wf) => (
            <div className="placeholder-table__row" key={wf.id}>
              <span><b>{pointLabel(wf.checkPointId ?? wf.inspectionPointId)}</b></span>
              <span><code>{wf.assignedRoleOrUser ?? 'Quality Inspector'}</code></span>
              <span>
                <span className={`status status--${(wf.escalationLevel ?? 1) > 1 ? 'warning' : 'neutral'}`}>
                  Level #{wf.escalationLevel ?? 1}
                </span>
              </span>
              <span>
                <span className={`status status--${wf.status === 'passed' || wf.status === 'approved' ? 'success' : wf.status === 'failed' || wf.status === 'rejected' ? 'danger' : 'warning'}`}>
                  <i />{wf.status}
                </span>
              </span>
              <span>
                {wf.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="primary-button" style={{ fontSize: 12, padding: '4px 8px', background: '#166534' }} onClick={() => { void handleCompleteInspection(wf.id, 'approve'); }}>
                      ✓ {t('pages.quality.workflows.pass')}
                    </button>
                    <button className="filter-button" style={{ fontSize: 12, padding: '4px 8px', color: '#b91c1c', borderColor: '#fca5a5' }} onClick={() => { void handleCompleteInspection(wf.id, 'reject'); }}>
                      ✕ {t('pages.quality.workflows.fail')}
                    </button>
                  </div>
                )}
                {(wf.status === 'passed' || wf.status === 'approved') && <span style={{ fontSize: 12, color: '#166534', fontWeight: 'bold' }}>اجتاز الجودة ✓</span>}
                {(wf.status === 'failed' || wf.status === 'rejected') && <span style={{ fontSize: 12, color: '#b91c1c', fontWeight: 'bold' }}>مرفوض ✕</span>}
              </span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
