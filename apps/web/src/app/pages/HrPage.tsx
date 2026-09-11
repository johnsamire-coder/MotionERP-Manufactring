import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface EmployeeRecord { id: string; code: string; name: string; role: string; baseSalary: string; status: string; }
interface CommissionRuleRecord { id: string; employeeId: string; basis: 'sale_value' | 'collected_amount'; ratePercentage: string; }
interface CommissionEntryRecord { id: string; employeeId: string; sourceReference: string; earnedAmount: string; status: 'pending' | 'paid'; }

function nextCode(prefix: string, existingCodes: string[]): string {
  const matching = existingCodes.filter((c) => c.toUpperCase().startsWith(prefix.toUpperCase()));
  return `${prefix}-${String(matching.length + 1).padStart(4, '0')}`;
}

export function HrPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [rules, setRules] = useState<CommissionRuleRecord[]>([]);
  const [commissions, setCommissions] = useState<CommissionEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Forms UI toggles
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Employee Form
  const [empCode, setEmpCode] = useState('');
  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState('مسؤول مبيعات');
  const [empBaseSalary, setEmpBaseSalary] = useState('6000');

  // Rule Form
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [ruleBasis, setRuleBasis] = useState<'sale_value' | 'collected_amount'>('collected_amount');
  const [ratePct, setRatePct] = useState('5.0');

  // Payroll Form
  const [payYear, setPayYear] = useState('2026');
  const [payMonth, setPayMonth] = useState('9');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [empRes, rulesRes, commRes] = await Promise.all([
        api.get<{ employees: EmployeeRecord[] }>('/hr/employees'),
        api.get<{ rules: CommissionRuleRecord[] }>('/hr/commission-rules'),
        api.get<{ entries: CommissionEntryRecord[] }>('/hr/commissions'),
      ]);
      setEmployees(empRes.employees);
      setRules(rulesRes.rules);
      setCommissions(commRes.entries);
      if (!selectedEmpId && empRes.employees[0]) setSelectedEmpId(empRes.employees[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load HR & payroll data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  function openEmpForm(): void {
    setEmpCode(nextCode('EMP', employees.map((e) => e.code)));
    setShowEmpForm((v) => !v);
  }

  async function handleCreateEmployee(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/hr/employees', {
        code: empCode,
        name: empName,
        role: empRole,
        baseSalary: empBaseSalary,
      });
      setEmpName(''); setShowEmpForm(false);
      setFormSuccess(t('pages.hr.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleCreateRule(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/hr/commission-rules', {
        employeeId: selectedEmpId,
        basis: ruleBasis,
        ratePercentage: ratePct,
      });
      setShowRuleForm(false);
      setFormSuccess(t('pages.hr.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleGeneratePayroll(employeeId: string): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/hr/payroll/generate', {
        employeeId,
        year: Number(payYear),
        month: Number(payMonth),
      });
      setShowPayrollModal(null);
      setFormSuccess(t('pages.hr.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  const empLabel = (id: string): string => employees.find((e) => e.id === id)?.name ?? id;
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.hr.eyebrow')}</span>
          <h1>{t('pages.hr.title')}</h1>
          <p>{t('pages.hr.description')}</p>
        </div>
      </div>

      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      {/* 1. Employees Directory */}
      <article className="panel module-panel" style={{ marginBottom: 20 }}>
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Staff Roster</span>
            <h2>{t('pages.hr.employees.title')}</h2>
          </div>
          <button className="primary-button" onClick={openEmpForm}><b>+</b> {t('pages.hr.employees.addEmployee')}</button>
        </div>

        {showEmpForm && (
          <form onSubmit={(e) => { void handleCreateEmployee(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.hr.employees.code')}</label>
              <input value={empCode} onChange={(e) => setEmpCode(e.target.value)} required style={{ ...inputStyle, width: 110 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.hr.employees.name')}</label>
              <input value={empName} onChange={(e) => setEmpName(e.target.value)} required placeholder="اسم الموظف الثلاثي" style={{ ...inputStyle, minWidth: 200 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.hr.employees.role')}</label>
              <input value={empRole} onChange={(e) => setEmpRole(e.target.value)} required style={{ ...inputStyle, minWidth: 160 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.hr.employees.baseSalary')}</label>
              <input type="number" min="0" step="any" value={empBaseSalary} onChange={(e) => setEmpBaseSalary(e.target.value)} required style={{ ...inputStyle, width: 130 }} />
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.hr.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.hr.employees.code')}</span>
            <span>{t('pages.hr.employees.name')}</span>
            <span>{t('pages.hr.employees.role')}</span>
            <span>{t('pages.hr.employees.baseSalary')}</span>
            <span>الإجراء</span>
          </div>

          {employees.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.hr.form.empty')}</p>}

          {employees.map((emp) => (
            <div className="placeholder-table__row" key={emp.id}>
              <span><b>{emp.code}</b></span>
              <span>{emp.name}</span>
              <span>{emp.role}</span>
              <span><b>{Number(emp.baseSalary).toLocaleString()} EGP</b></span>
              <span>
                <button className="primary-button" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => setShowPayrollModal(emp.id)}>
                  {t('pages.hr.payroll.generatePayroll')}
                </button>
              </span>
            </div>
          ))}
        </div>
      </article>

      {/* 2. Commission Rules Section */}
      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Sales Incentives</span>
            <h2>{t('pages.hr.commissions.title')}</h2>
          </div>
          <button className="filter-button" onClick={() => setShowRuleForm((v) => !v)}><b>+</b> {t('pages.hr.commissions.addRule')}</button>
        </div>

        {showRuleForm && (
          <form onSubmit={(e) => { void handleCreateRule(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>الموظف</label>
              <select value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)} style={{ ...inputStyle, minWidth: 200 }}>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.hr.commissions.ruleBasis')}</label>
              <select value={ruleBasis} onChange={(e) => setRuleBasis(e.target.value as any)} style={{ ...inputStyle, minWidth: 240 }}>
                <option value="collected_amount">{t('pages.hr.commissions.collectedAmt')}</option>
                <option value="sale_value">{t('pages.hr.commissions.saleValue')}</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.hr.commissions.ratePct')}</label>
              <input type="number" min="0.1" max="100" step="any" value={ratePct} onChange={(e) => setRatePct(e.target.value)} required style={{ ...inputStyle, width: 90 }} />
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.hr.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>الموظف</span>
            <span>أساس الحساب</span>
            <span>نسبة العمولة %</span>
          </div>

          {rules.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>لا توجد قواعد عمولة محددة بعد</p>}

          {rules.map((rule) => (
            <div className="placeholder-table__row" key={rule.id}>
              <span><b>{empLabel(rule.employeeId)}</b></span>
              <span>
                <span className="status status--success">
                  <i />{rule.basis === 'collected_amount' ? 'مرتبطة بالتحصيل الفعلي' : 'مرتبطة بقيمة المبيعات'}
                </span>
              </span>
              <span><b>{rule.ratePercentage}%</b></span>
            </div>
          ))}
        </div>
      </article>

      {/* Modal for Payroll Generation */}
      {showPayrollModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, width: 380, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3>{t('pages.hr.payroll.generatePayroll')}</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <label style={labelStyle}>السنة</label>
                <input type="number" value={payYear} onChange={(e) => setPayYear(e.target.value)} required style={{ ...inputStyle, width: '100%' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <label style={labelStyle}>الشهر (1 - 12)</label>
                <input type="number" min="1" max="12" value={payMonth} onChange={(e) => setPayMonth(e.target.value)} required style={{ ...inputStyle, width: '100%' }} />
              </div>
            </div>

            <button className="primary-button" style={{ marginTop: 10 }} disabled={submitting} onClick={() => { void handleGeneratePayroll(showPayrollModal); }}>
              اصدار وتسوية كشف الراتب
            </button>
            <button className="filter-button" onClick={() => setShowPayrollModal(null)}>{t('pages.hr.form.cancel')}</button>
          </div>
        </div>
      )}
    </section>
  );
}
