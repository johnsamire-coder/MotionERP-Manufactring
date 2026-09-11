import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface JobOrderRecord { id: string; jobOrderNumber: string; customerId?: string; }
interface CostSummaryRecord {
  jobOrderReference: string;
  totalBudgetCost: number;
  totalActualCost: number;
  variance: number;
  status: 'under_budget' | 'on_budget' | 'over_budget';
}

interface CostEntryRecord {
  id: string;
  jobOrderReference: string;
  componentType: string;
  amount: string;
  description?: string;
  createdAt: string;
}

export function CostingPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [jobOrders, setJobOrders] = useState<JobOrderRecord[]>([]);
  const [summary, setSummary] = useState<CostSummaryRecord | null>(null);
  const [entries, setEntries] = useState<CostEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedJO, setSelectedJO] = useState('');
  const [showCostForm, setShowCostForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // New Cost Entry Form
  const [componentType, setComponentType] = useState('material');
  const [amountInput, setAmountInput] = useState('1000');
  const [descriptionInput, setDescriptionInput] = useState('');

  // Assumed Selling price for margin display simulation
  const sellingPrice = 50000;

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const joRes = await api.get<{ jobOrders: JobOrderRecord[] }>('/sales/job-orders');
      setJobOrders(joRes.jobOrders);

      const activeJO = selectedJO || (joRes.jobOrders[0]?.jobOrderNumber ?? '');
      if (activeJO) {
        setSelectedJO(activeJO);
        await loadJoCostData(activeJO);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load costing data');
    } finally {
      setLoading(false);
    }
  }

  async function loadJoCostData(joNumber: string): Promise<void> {
    try {
      const summaryRes = await api.get<CostSummaryRecord>(`/cost/jobs/${joNumber}/summary`);
      setSummary(summaryRes);
    } catch {
      setSummary(null);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  async function handleJoChange(joNumber: string): Promise<void> {
    setSelectedJO(joNumber);
    await loadJoCostData(joNumber);
  }

  async function handleCreateCostEntry(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      const endpoint = componentType === 'labor' ? `/cost/jobs/${selectedJO}/labor` : `/cost/jobs/${selectedJO}/material`;
      await api.post(endpoint, {
        amount: amountInput,
        description: descriptionInput || undefined,
      });
      setShowCostForm(false);
      setDescriptionInput('');
      setFormSuccess(t('pages.costing.form.success'));
      await loadJoCostData(selectedJO);
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  const actualCost = summary?.totalActualCost ?? 0;
  const budgetCost = summary?.totalBudgetCost ?? 35000;
  const netProfit = sellingPrice - actualCost;
  const marginPct = sellingPrice > 0 ? ((netProfit / sellingPrice) * 100).toFixed(1) : '0';

  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.costing.eyebrow')}</span>
          <h1>{t('pages.costing.title')}</h1>
          <p>{t('pages.costing.description')}</p>
        </div>
      </div>

      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      {/* JO Selector & Live Profitability Dashboard */}
      <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <label style={{ ...labelStyle, fontSize: 14, fontWeight: 'bold' }}>أمر التشغيل (Job Order):</label>
          <select value={selectedJO} onChange={(e) => { void handleJoChange(e.target.value); }} style={{ ...inputStyle, minWidth: 220, fontSize: 14, fontWeight: 'bold' }}>
            {jobOrders.map((jo) => <option key={jo.id} value={jo.jobOrderNumber}>{jo.jobOrderNumber}</option>)}
          </select>
        </div>

        {/* Live Profit & Margin Monitor */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #cbd5e1' }}>
          <div>
            <span style={labelStyle}>{t('pages.costing.summary.sellingPrice')}</span>
            <p style={{ margin: '2px 0 0', fontWeight: 'bold', fontSize: 18, color: '#0f172a' }}>{sellingPrice.toLocaleString()} EGP</p>
          </div>
          <div>
            <span style={labelStyle}>{t('pages.costing.summary.budgetCost')}</span>
            <p style={{ margin: '2px 0 0', fontWeight: 'bold', fontSize: 18, color: '#475569' }}>{budgetCost.toLocaleString()} EGP</p>
          </div>
          <div>
            <span style={labelStyle}>{t('pages.costing.summary.actualCost')}</span>
            <p style={{ margin: '2px 0 0', fontWeight: 'bold', fontSize: 18, color: actualCost > budgetCost ? '#b91c1c' : '#0369a1' }}>
              {actualCost.toLocaleString()} EGP
            </p>
          </div>
          <div>
            <span style={labelStyle}>{t('pages.costing.summary.profitMargin')}</span>
            <p style={{ margin: '2px 0 0', fontWeight: 'bold', fontSize: 18, color: netProfit < 0 ? '#b91c1c' : '#166534' }}>
              {netProfit.toLocaleString()} EGP ({marginPct}%)
            </p>
          </div>
        </div>

        {actualCost > budgetCost && (
          <p style={{ fontSize: 13, color: '#b91c1c', background: '#fef2f2', padding: 10, borderRadius: 6, border: '1px solid #fca5a5', marginTop: 12, marginBottom: 0 }}>
            ⚠️ <b>تجاوز الميزانية التقديرية:</b> التكلفة الفعلية الحالية أصبحت أكبر من التكلفة التقديرية المخططة. هامش الربح يبدأ في التآكل!
          </p>
        )}
      </div>

      {/* Actual Cost Breakdown Section */}
      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Cost Accumulation</span>
            <h2>{t('pages.costing.breakdown.title')}</h2>
          </div>
          <button className="primary-button" onClick={() => setShowCostForm((v) => !v)}><b>+</b> {t('pages.costing.breakdown.addCost')}</button>
        </div>

        {showCostForm && (
          <form onSubmit={(e) => { void handleCreateCostEntry(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.costing.breakdown.componentType')}</label>
              <select value={componentType} onChange={(e) => setComponentType(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
                <option value="material">{t('pages.costing.breakdown.material')}</option>
                <option value="labor">{t('pages.costing.breakdown.labor')}</option>
                <option value="overhead">{t('pages.costing.breakdown.overhead')}</option>
                <option value="external">{t('pages.costing.breakdown.external')}</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.costing.breakdown.amount')}</label>
              <input type="number" min="0.01" step="any" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} required style={{ ...inputStyle, width: 130 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>بيان / ملاحظات</label>
              <input value={descriptionInput} onChange={(e) => setDescriptionInput(e.target.value)} placeholder="تفاصيل المُنفق..." style={{ ...inputStyle, minWidth: 200 }} />
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.costing.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.costing.breakdown.componentType')}</span>
            <span>أمر التشغيل</span>
            <span>{t('pages.costing.breakdown.amount')}</span>
            <span>حالة الميزانية</span>
          </div>

          <div className="placeholder-table__row">
            <span><b>إجمالي التكاليف المجمعة</b></span>
            <span><code>{selectedJO}</code></span>
            <span><b>{actualCost.toLocaleString()} EGP</b></span>
            <span>
              <span className={`status status--${summary?.status === 'under_budget' ? 'success' : summary?.status === 'over_budget' ? 'danger' : 'warning'}`}>
                <i />{summary?.status ?? 'under_budget'}
              </span>
            </span>
          </div>
        </div>
      </article>
    </section>
  );
}
