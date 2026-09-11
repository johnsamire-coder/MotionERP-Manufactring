import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface CustomerRecord { id: string; name: string; }
interface JobOrderRecord {
  id: string;
  jobOrderNumber: string;
  source: string;
  quotationReference?: string;
  customerId?: string;
  financialReviewPassed: boolean;
  status: string;
}

interface ProductionPlanRecord {
  id: string;
  jobOrderReference: string;
  priority: number;
  executionType: 'internal' | 'external' | 'mixed';
  internalQuantity?: string;
  externalQuantity?: string;
  createdAt: string;
}

export function PlanningPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [jobOrders, setJobOrders] = useState<JobOrderRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [plans, setPlans] = useState<ProductionPlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Form state
  const [activeJobOrder, setActiveJobOrder] = useState<JobOrderRecord | null>(null);
  const [priorityInput, setPriorityInput] = useState('1');
  const [executionType, setExecutionType] = useState<'internal' | 'external' | 'mixed'>('internal');
  const [internalQty, setInternalQty] = useState('100');
  const [externalQty, setExternalQty] = useState('0');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [joRes, custRes, plansRes] = await Promise.all([
        api.get<{ jobOrders: JobOrderRecord[] }>('/sales/job-orders'),
        api.get<{ customers: CustomerRecord[] }>('/crm/customers'),
        api.get<{ plans: ProductionPlanRecord[] }>('/planning/plans'),
      ]);
      setJobOrders(joRes.jobOrders);
      setCustomers(custRes.customers);
      setPlans(plansRes.plans);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load planning data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  function openPlanModal(jo: JobOrderRecord): void {
    setActiveJobOrder(jo);
    const existing = plans.find((p) => p.jobOrderReference === jo.jobOrderNumber);
    if (existing) {
      setPriorityInput(String(existing.priority));
      setExecutionType(existing.executionType);
      setInternalQty(existing.internalQuantity ?? '0');
      setExternalQty(existing.externalQuantity ?? '0');
    } else {
      setPriorityInput(String(plans.length + 1));
      setExecutionType('internal');
      setInternalQty('100');
      setExternalQty('0');
    }
  }

  async function handleSavePlan(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!activeJobOrder) return;
    setFormError(null); setFormSuccess(null); setSubmitting(true);

    try {
      await api.post('/planning/plans', {
        jobOrderReference: activeJobOrder.jobOrderNumber,
        priority: Number(priorityInput),
        executionType,
        internalQuantity: executionType === 'external' ? undefined : internalQty,
        externalQuantity: executionType === 'internal' ? undefined : externalQty,
      });
      setActiveJobOrder(null);
      setFormSuccess(t('pages.planning.form.success'));
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save production plan');
    } finally {
      setSubmitting(false);
    }
  }

  const customerLabel = (id?: string): string => customers.find((c) => c.id === id)?.name ?? '—';
  const getPlanForJO = (joNumber: string): ProductionPlanRecord | undefined =>
    plans.find((p) => p.jobOrderReference === joNumber);

  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.planning.eyebrow')}</span>
          <h1>{t('pages.planning.title')}</h1>
          <p>{t('pages.planning.description')}</p>
        </div>
      </div>

      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Capacity & Prioritization</span>
            <h2>{t('pages.planning.table.title')}</h2>
          </div>
        </div>

        {loading && <p style={{ padding: '20px 0' }}>{t('pages.planning.form.loading')}</p>}
        {error && <p style={{ padding: '20px 0', color: '#b91c1c' }}>{error}</p>}

        {!loading && !error && (
          <div className="placeholder-table">
            <div className="placeholder-table__head">
              <span>{t('pages.planning.table.jobOrder')}</span>
              <span>{t('pages.planning.table.customer')}</span>
              <span>{t('pages.planning.table.priority')}</span>
              <span>{t('pages.planning.table.executionType')}</span>
              <span>{t('pages.planning.table.action')}</span>
            </div>
            {jobOrders.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.planning.form.empty')}</p>}
            {jobOrders.map((jo) => {
              const plan = getPlanForJO(jo.jobOrderNumber);
              return (
                <div className="placeholder-table__row" key={jo.id}>
                  <span>
                    <b>{jo.jobOrderNumber}</b>
                    <small>{jo.quotationReference ? `Quote: ${jo.quotationReference}` : 'Internal'}</small>
                  </span>
                  <span>{customerLabel(jo.customerId)}</span>
                  <span>
                    {plan ? (
                      <span className="status status--neutral" style={{ fontWeight: 'bold' }}>#{plan.priority}</span>
                    ) : (
                      '—'
                    )}
                  </span>
                  <span>
                    {plan ? (
                      <div>
                        <b>{t(`pages.planning.execution.${plan.executionType}`)}</b>
                        {plan.executionType === 'mixed' && (
                          <small style={{ display: 'block', color: '#64748b' }}>
                            Int: {plan.internalQuantity} | Ext: {plan.externalQuantity}
                          </small>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>Not Planned</span>
                    )}
                  </span>
                  <span>
                    <button className="primary-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => openPlanModal(jo)}>
                      {plan ? 'Edit Plan' : t('pages.planning.table.action')}
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </article>

      {/* Plan Configuration Modal */}
      {activeJobOrder && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={(e) => { void handleSavePlan(e); }} style={{ background: '#fff', padding: 24, borderRadius: 8, width: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3>{t('pages.planning.form.title')} — {activeJobOrder.jobOrderNumber}</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.planning.form.priority')}</label>
              <input type="number" min="1" value={priorityInput} onChange={(e) => setPriorityInput(e.target.value)} required style={inputStyle} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.planning.form.executionType')}</label>
              <select value={executionType} onChange={(e) => setExecutionType(e.target.value as any)} style={inputStyle}>
                <option value="internal">{t('pages.planning.execution.internal')}</option>
                <option value="external">{t('pages.planning.execution.external')}</option>
                <option value="mixed">{t('pages.planning.execution.mixed')}</option>
              </select>
            </div>

            {executionType !== 'external' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.planning.form.internalQty')}</label>
                <input type="number" min="1" step="any" value={internalQty} onChange={(e) => setInternalQty(e.target.value)} required style={inputStyle} />
              </div>
            )}

            {executionType !== 'internal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.planning.form.externalQty')}</label>
                <input type="number" min="1" step="any" value={externalQty} onChange={(e) => setExternalQty(e.target.value)} required style={inputStyle} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" className="filter-button" onClick={() => setActiveJobOrder(null)}>{t('pages.planning.form.cancel')}</button>
              <button type="submit" className="primary-button" disabled={submitting}>{t('pages.planning.form.save')}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
