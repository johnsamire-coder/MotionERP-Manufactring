import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface JobOrderRecord { id: string; jobOrderNumber: string; }

interface ExpenseRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: 'transport' | 'samples' | 'electricity' | 'packaging' | 'paint' | 'wages' | 'gratuity' | 'other';
  jobOrderReference: string;
}

export function ExpensesPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [jobOrders, setJobOrders] = useState<JobOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Form State
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('500');
  const [expCategory, setExpCategory] = useState<'transport' | 'samples' | 'electricity' | 'packaging' | 'paint' | 'wages' | 'gratuity' | 'other'>('transport');
  const [selectedJO, setSelectedJO] = useState('');

  // Initial Expenses Data Matching Excel Screenshot
  const [expenses, setExpenses] = useState<ExpenseRow[]>([
    { id: '1', date: '2026-07-01', description: 'استريتش لزوم التغليف', amount: 408, category: 'packaging', jobOrderReference: 'JO-2026-000001' },
    { id: '2', date: '2026-07-01', description: 'النقلات لنصحي - شراء خامات', amount: 25, category: 'transport', jobOrderReference: 'JO-2026-000001' },
    { id: '3', date: '2026-07-01', description: 'عمار تروسيكل - نقلة إلى فرن الدهان', amount: 100, category: 'transport', jobOrderReference: 'JO-2026-000001' },
    { id: '4', date: '2026-07-01', description: 'شعبان - باقي حساب النقل', amount: 1200, category: 'transport', jobOrderReference: 'JO-2026-000001' },
    { id: '5', date: '2026-07-04', description: 'الطحان - بلاستيك', amount: 1200, category: 'packaging', jobOrderReference: 'JO-2026-000001' },
    { id: '6', date: '2026-07-05', description: 'عيد خليفة - مصنع الدهان', amount: 30000, category: 'paint', jobOrderReference: 'JO-2026-000001' },
    { id: '7', date: '2026-07-08', description: 'سلك لحام وسلك سويدي للكهرباء', amount: 380, category: 'electricity', jobOrderReference: 'JO-2026-000001' },
    { id: '8', date: '2026-07-13', description: 'أولاد يونس - نقل حديد', amount: 2350, category: 'transport', jobOrderReference: 'JO-2026-000001' },
    { id: '9', date: '2026-07-15', description: 'عيد خليفة - دفعة دهان أفرُن', amount: 40000, category: 'paint', jobOrderReference: 'JO-2026-000001' },
  ]);

  useEffect(() => {
    async function fetchJOs(): Promise<void> {
      try {
        const res = await api.get<{ jobOrders: JobOrderRecord[] }>('/sales/job-orders');
        setJobOrders(res.jobOrders ?? []);
        if (res.jobOrders?.[0]) setSelectedJO(res.jobOrders[0].jobOrderNumber);
      } catch {
        // quiet
      } finally {
        setLoading(false);
      }
    }
    void fetchJOs();
  }, []);

  async function handleCreateExpense(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      const amtNum = Number(expAmount);

      // 1. Post to Costing Module to update JO Actual Costs
      try {
        await api.post(`/cost/jobs/${selectedJO}/material`, {
          amount: String(amtNum),
          description: `${expDesc} (${expCategory})`,
        });
      } catch {
        // quiet fallback
      }

      // 2. Add Row to Local Analysis Matrix
      const newRow: ExpenseRow = {
        id: String(Date.now()),
        date: expDate || new Date().toISOString().slice(0, 10),
        description: expDesc,
        amount: amtNum,
        category: expCategory,
        jobOrderReference: selectedJO,
      };

      setExpenses([newRow, ...expenses]);
      setExpDesc('');
      setShowForm(false);
      setFormSuccess(t('pages.expenses.form.success'));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to record expense');
    } finally {
      setSubmitting(false);
    }
  }

  // Export Table Matrix directly to Excel CSV
  function handleExportExcel(): void {
    const headers = ['التاريخ', 'البيان والتفاصيل', 'إجمالي المبلغ', 'أمر التشغيل المرتبط', 'نقل وانتقالات', 'عينات', 'كهرباء', 'تغليف', 'دهان', 'أخرى'];
    const csvRows = [headers.join(',')];

    for (const exp of expenses) {
      const row = [
        exp.date,
        `"${exp.description}"`,
        exp.amount,
        exp.jobOrderReference,
        exp.category === 'transport' ? exp.amount : 0,
        exp.category === 'samples' ? exp.amount : 0,
        exp.category === 'electricity' ? exp.amount : 0,
        exp.category === 'packaging' ? exp.amount : 0,
        exp.category === 'paint' ? exp.amount : 0,
        exp.category === 'other' || exp.category === 'gratuity' || exp.category === 'wages' ? exp.amount : 0,
      ];
      csvRows.push(row.join(','));
    }

    const blob = new Blob(["\uFEFF" + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `تحليل_المصروفات_الإنتاجية_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Matrix Category Totals
  const sumTotal = expenses.reduce((s, x) => s + x.amount, 0);
  const sumTransport = expenses.filter((x) => x.category === 'transport').reduce((s, x) => s + x.amount, 0);
  const sumSamples = expenses.filter((x) => x.category === 'samples').reduce((s, x) => s + x.amount, 0);
  const sumElectricity = expenses.filter((x) => x.category === 'electricity').reduce((s, x) => s + x.amount, 0);
  const sumPackaging = expenses.filter((x) => x.category === 'packaging').reduce((s, x) => s + x.amount, 0);
  const sumPaint = expenses.filter((x) => x.category === 'paint').reduce((s, x) => s + x.amount, 0);
  const sumWages = expenses.filter((x) => x.category === 'wages').reduce((s, x) => s + x.amount, 0);
  const sumOther = expenses.filter((x) => x.category === 'other' || x.category === 'gratuity').reduce((s, x) => s + x.amount, 0);

  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };
  const thStyle = { background: '#1e293b', color: '#fff', padding: '8px 10px', fontSize: 12, textAlign: 'start' as const };
  const tdStyle = { padding: '8px 10px', borderBottom: '1px solid #e2e8f0', fontSize: 13 };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.expenses.eyebrow')}</span>
          <h1>{t('pages.expenses.title')}</h1>
          <p>{t('pages.expenses.description')}</p>
        </div>
      </div>

      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <button className="primary-button" onClick={() => setShowForm((v) => !v)}>
          <b>+</b> {t('pages.expenses.form.title')}
        </button>

        <button className="filter-button" style={{ background: '#166534', color: '#fff', fontWeight: 'bold' }} onClick={handleExportExcel}>
          📥 {t('pages.expenses.table.export')}
        </button>
      </div>

      {/* New Expense Form */}
      {showForm && (
        <article className="panel module-panel" style={{ marginBottom: 20 }}>
          <form onSubmit={(e) => { void handleCreateExpense(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3>{t('pages.expenses.form.title')}</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.expenses.table.date')}</label>
                <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} required style={{ ...inputStyle, width: 140 }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.expenses.table.description')}</label>
                <input value={expDesc} onChange={(e) => setExpDesc(e.target.value)} required placeholder="بيان المصروف والجهة..." style={{ ...inputStyle, minWidth: 220 }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.expenses.form.amount')}</label>
                <input type="number" min="0.01" step="any" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} required style={{ ...inputStyle, width: 120 }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.expenses.form.category')}</label>
                <select value={expCategory} onChange={(e) => setExpCategory(e.target.value as any)} style={{ ...inputStyle, minWidth: 160 }}>
                  <option value="transport">{t('pages.expenses.table.transport')}</option>
                  <option value="paint">{t('pages.expenses.table.paint')}</option>
                  <option value="packaging">{t('pages.expenses.table.packaging')}</option>
                  <option value="electricity">{t('pages.expenses.table.electricity')}</option>
                  <option value="samples">{t('pages.expenses.table.samples')}</option>
                  <option value="wages">{t('pages.expenses.table.wages')}</option>
                  <option value="gratuity">{t('pages.expenses.table.gratuity')}</option>
                  <option value="other">أخرى</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.expenses.table.jobOrder')}</label>
                <select value={selectedJO} onChange={(e) => setSelectedJO(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
                  {jobOrders.map((j) => <option key={j.id} value={j.jobOrderNumber}>{j.jobOrderNumber}</option>)}
                </select>
              </div>

              <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>
                {t('pages.expenses.form.save')}
              </button>
            </div>
          </form>
        </article>
      )}

      {/* Production Expenses Matrix Sheet Table */}
      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Cost Matrix</span>
            <h2>{t('pages.expenses.table.title')}</h2>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>{t('pages.expenses.table.date')}</th>
                <th style={thStyle}>{t('pages.expenses.table.description')}</th>
                <th style={thStyle}>{t('pages.expenses.table.totalAmount')}</th>
                <th style={thStyle}>{t('pages.expenses.table.jobOrder')}</th>
                <th style={thStyle}>{t('pages.expenses.table.transport')}</th>
                <th style={thStyle}>{t('pages.expenses.table.samples')}</th>
                <th style={thStyle}>{t('pages.expenses.table.electricity')}</th>
                <th style={thStyle}>{t('pages.expenses.table.packaging')}</th>
                <th style={thStyle}>{t('pages.expenses.table.paint')}</th>
                <th style={thStyle}>{t('pages.expenses.table.other')}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => (
                <tr key={exp.id}>
                  <td style={tdStyle}><small>{exp.date}</small></td>
                  <td style={tdStyle}><b>{exp.description}</b></td>
                  <td style={{ ...tdStyle, fontWeight: 'bold', color: '#0f172a' }}>{exp.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td style={tdStyle}><code>{exp.jobOrderReference}</code></td>
                  <td style={tdStyle}>{exp.category === 'transport' ? <b>{exp.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</b> : '—'}</td>
                  <td style={tdStyle}>{exp.category === 'samples' ? <b>{exp.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</b> : '—'}</td>
                  <td style={tdStyle}>{exp.category === 'electricity' ? <b>{exp.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</b> : '—'}</td>
                  <td style={tdStyle}>{exp.category === 'packaging' ? <b>{exp.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</b> : '—'}</td>
                  <td style={tdStyle}>{exp.category === 'paint' ? <b>{exp.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</b> : '—'}</td>
                  <td style={tdStyle}>{exp.category === 'other' || exp.category === 'gratuity' || exp.category === 'wages' ? <b>{exp.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</b> : '—'}</td>
                </tr>
              ))}

              {/* Monthly Matrix Totals Row */}
              <tr style={{ background: '#f1f5f9', fontWeight: 'bold', borderTop: '2px solid #cbd5e1' }}>
                <td style={tdStyle} colSpan={2}><b>{t('pages.expenses.table.totals')}</b></td>
                <td style={{ ...tdStyle, color: '#0f172a', fontSize: 14 }}>{sumTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</td>
                <td style={tdStyle}>—</td>
                <td style={{ ...tdStyle, color: '#0369a1' }}>{sumTransport.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td style={{ ...tdStyle, color: '#0369a1' }}>{sumSamples.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td style={{ ...tdStyle, color: '#0369a1' }}>{sumElectricity.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td style={{ ...tdStyle, color: '#0369a1' }}>{sumPackaging.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td style={{ ...tdStyle, color: '#0369a1' }}>{sumPaint.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td style={{ ...tdStyle, color: '#0369a1' }}>{sumOther.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
