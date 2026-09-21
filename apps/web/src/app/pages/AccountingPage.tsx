import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError, accountingApi } from '../api/client';

type ActiveTab = 'coa' | 'fiscal' | 'cost_centers' | 'journals' | 'config' | 'treasury';

export function AccountingPage(): JSX.Element {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ActiveTab>('coa');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data States
  const [accounts, setAccounts] = useState<any[]>([]);
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [selectedFyId, setSelectedFyId] = useState<string>('');
  const [periods, setPeriods] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [retentions, setRetentions] = useState<any[]>([]);

  // Forms State
  const [showFyModal, setShowFyModal] = useState(false);
  const [newFyName, setNewFyName] = useState('العام المالي 2026');
  const [newFyStart, setNewFyStart] = useState('2026-01-01');
  const [newFyEnd, setNewFyEnd] = useState('2026-12-31');
  const [defaultOrgNodeId, setDefaultOrgNodeId] = useState('00000000-0000-0000-0000-000000000001');

  const [showCcModal, setShowCcModal] = useState(false);
  const [newCcCode, setNewCcCode] = useState('');
  const [newCcName, setNewCcName] = useState('');

  // Load All Data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [accRes, fyRes, ccRes, jeRes, collRes, retRes] = await Promise.all([
        api.get<{ accounts: any[] }>('/accounting/accounts').catch(() => ({ accounts: [] })),
        api.get<{ fiscalYears: any[] }>('/accounting/fiscal-years').catch(() => ({ fiscalYears: [] })),
        api.get<{ costCenters: any[] }>('/accounting/cost-centers').catch(() => ({ costCenters: [] })),
        accountingApi.getJournalEntries().catch(() => ({ entries: [] })),
        api.get<any>('/finance/collections').catch(() => ({ collections: [] })),
        api.get<any>('/finance/retentions').catch(() => ({ retentions: [] })),
      ]);

      setAccounts(accRes.accounts ?? []);
      const fys = fyRes.fiscalYears ?? [];
      setFiscalYears(fys);
      if (fys.length > 0 && !selectedFyId) {
        setSelectedFyId(fys[0].id);
        void loadPeriods(fys[0].id);
      }
      setCostCenters(ccRes.costCenters ?? []);
      setJournalEntries(jeRes.entries ?? []);
      setCollections(Array.isArray(collRes) ? collRes : (collRes?.collections ?? []));
      setRetentions(Array.isArray(retRes) ? retRes : (retRes?.retentions ?? []));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تحميل البيانات المحاسبية');
    } finally {
      setLoading(false);
    }
  };

  const loadPeriods = async (fyId: string) => {
    try {
      const res = await api.get<{ periods: any[] }>(`/accounting/fiscal-years/${fyId}/periods`);
      setPeriods(res.periods ?? []);
    } catch {
      setPeriods([]);
    }
  };

  useEffect(() => { void loadData(); }, []);

  // Actions
  const handleCreateFiscalYear = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/accounting/fiscal-years', {
        orgNodeId: defaultOrgNodeId,
        name: newFyName,
        startDate: newFyStart,
        endDate: newFyEnd,
      });
      setShowFyModal(false);
      setSuccess('تم تأسيس السنة المالية وتوليد الـ 12 شهراً بنجاح!');
      void loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل إنشاء السنة المالية');
    }
  };

  const handleTogglePeriodStatus = async (periodId: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === 'open' ? 'closed' : 'open';
      await api.post(`/accounting/periods/${periodId}/status`, { status: nextStatus });
      setSuccess(`تم تغيير حالة الفترة بنجاح إلى: ${nextStatus === 'open' ? 'مفتوحة' : 'مغلقة'}`);
      if (selectedFyId) void loadPeriods(selectedFyId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تحديث حالة الفترة');
    }
  };

  const handleCreateCostCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/accounting/cost-centers', {
        orgNodeId: defaultOrgNodeId,
        code: newCcCode,
        name: newCcName,
      });
      setShowCcModal(false);
      setSuccess('تم إضافة مركز التكلفة بنجاح');
      setNewCcCode('');
      setNewCcName('');
      void loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل إنشاء مركز التكلفة');
    }
  };

  const handlePostJournal = async (id: string) => {
    try {
      await accountingApi.postJournalEntry(id);
      setSuccess('تم ترحيل قيد اليومية بنجاح إلى الأستاذ العام');
      void loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل ترحيل قيد اليومية');
    }
  };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">النظام المالي والمحاسبي</span>
          <h1>لوحة تحكم الإدارة المالية العامة</h1>
          <p>إدارة دليل الحسابات، السنوات والفترات المالية، مراكز التكلفة، وقيود اليومية العامة</p>
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert alert--success" style={{ marginBottom: 16 }}>{success}</div>}

      {/* Tabs Header */}
      <div className="tab-nav" style={{ display: 'flex', gap: 8, borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
        <button className={`btn ${activeTab === 'coa' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setActiveTab('coa')}>
          📊 دليل الحسابات ({accounts.length})
        </button>
        <button className={`btn ${activeTab === 'fiscal' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setActiveTab('fiscal')}>
          📅 السنوات والفترات المالية
        </button>
        <button className={`btn ${activeTab === 'cost_centers' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setActiveTab('cost_centers')}>
          🏭 مراكز التكلفة ({costCenters.length})
        </button>
        <button className={`btn ${activeTab === 'journals' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setActiveTab('journals')}>
          📝 قيود اليومية ({journalEntries.length})
        </button>
        <button className={`btn ${activeTab === 'treasury' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setActiveTab('treasury')}>
          💰 الخزينة والتحصيلات
        </button>
      </div>

      {/* 1. Chart of Accounts Tab */}
      {activeTab === 'coa' && (
        <article className="panel module-panel">
          <div className="panel__head">
            <div>
              <span className="panel__eyebrow">دليل الحسابات المعتمد</span>
              <h2>شجرة الحسابات (Chart of Accounts)</h2>
            </div>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>كود الحساب</th>
                  <th>اسم الحساب</th>
                  <th>طبيعة الحساب</th>
                  <th>نوع الحساب</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5}>جاري التحميل...</td></tr>
                ) : accounts.length === 0 ? (
                  <tr><td colSpan={5}>لا توجد حسابات مسجلة</td></tr>
                ) : (
                  accounts.map((acc) => (
                    <tr key={acc.id}>
                      <td><b>{acc.code}</b></td>
                      <td>{acc.name}</td>
                      <td><code>{acc.accountType}</code></td>
                      <td>
                        <span className={`status-badge status-badge--${acc.isLeaf ? 'active' : 'draft'}`}>
                          {acc.isLeaf ? 'حساب فرعي (يقبل الترحيل)' : 'حساب رئيسي / تجميعي'}
                        </span>
                      </td>
                      <td><span className="status-badge status-badge--active">نشط</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {/* 2. Fiscal Years & Periods Tab */}
      {activeTab === 'fiscal' && (
        <article className="panel module-panel">
          <div className="panel__head">
            <div>
              <span className="panel__eyebrow">التقويم المحاسبي والرقابة</span>
              <h2>السنوات المالية والفترات الشهرية (12 شهراً)</h2>
            </div>
            <button className="btn btn--primary" onClick={() => setShowFyModal(true)}>
              + تأسيس سنة مالية جديدة
            </button>
          </div>

          {showFyModal && (
            <form className="form-card" onSubmit={handleCreateFiscalYear} style={{ marginBottom: 20 }}>
              <h3>تأسيس سنة مالية جديدة وتوليد 12 شهراً تلقائياً</h3>
              <div className="form-grid">
                <label>اسم السنة المالية
                  <input value={newFyName} onChange={(e) => setNewFyName(e.target.value)} required />
                </label>
                <label>تاريخ البداية
                  <input type="date" value={newFyStart} onChange={(e) => setNewFyStart(e.target.value)} required />
                </label>
                <label>تاريخ النهاية
                  <input type="date" value={newFyEnd} onChange={(e) => setNewFyEnd(e.target.value)} required />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn--primary">تأسيس وتوليد الشهور</button>
                <button type="button" className="btn" onClick={() => setShowFyModal(false)}>إلغاء</button>
              </div>
            </form>
          )}

          {fiscalYears.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontWeight: 'bold', marginLeft: 8 }}>اختر السنة المالية:</label>
              <select value={selectedFyId} onChange={(e) => { setSelectedFyId(e.target.value); void loadPeriods(e.target.value); }} style={{ padding: '8px 12px', borderRadius: 6 }}>
                {fiscalYears.map((fy) => <option key={fy.id} value={fy.id}>{fy.name} ({new Date(fy.startDate).getFullYear()})</option>)}
              </select>
            </div>
          )}

          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>رقم الشهر</th>
                  <th>اسم الفترة</th>
                  <th>تاريخ البداية</th>
                  <th>تاريخ النهاية</th>
                  <th>الحالة الرقابية</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {periods.length === 0 ? (
                  <tr><td colSpan={6}>يرجى اختيار سنة مالية لعرض شهورها</td></tr>
                ) : (
                  periods.map((p) => (
                    <tr key={p.id}>
                      <td><b>M{p.periodNumber}</b></td>
                      <td>{p.name}</td>
                      <td>{new Date(p.startDate).toLocaleDateString('ar-EG')}</td>
                      <td>{new Date(p.endDate).toLocaleDateString('ar-EG')}</td>
                      <td>
                        <span className={`status-badge status-badge--${p.status === 'open' ? 'active' : 'cancelled'}`}>
                          {p.status === 'open' ? 'مفتوحة للترحيل ✅' : 'مغلقة 🔒'}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn--sm" onClick={() => handleTogglePeriodStatus(p.id, p.status)}>
                          {p.status === 'open' ? 'إغلاق الفترة 🔒' : 'فتح الفترة 🔓'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {/* 3. Cost Centers Tab */}
      {activeTab === 'cost_centers' && (
        <article className="panel module-panel">
          <div className="panel__head">
            <div>
              <span className="panel__eyebrow">إدارات وأقسام المصنع</span>
              <h2>شجرة مراكز التكلفة (Cost Centers)</h2>
            </div>
            <button className="btn btn--primary" onClick={() => setShowCcModal(true)}>
              + إضافة مركز تكلفة
            </button>
          </div>

          {showCcModal && (
            <form className="form-card" onSubmit={handleCreateCostCenter} style={{ marginBottom: 20 }}>
              <h3>إضافة مركز تكلفة / قسم إنتاجي جديد</h3>
              <div className="form-grid">
                <label>كود المركز (مثال: CC-LASER)
                  <input value={newCcCode} onChange={(e) => setNewCcCode(e.target.value)} required />
                </label>
                <label>اسم المركز (مثال: قسم قص الليزر)
                  <input value={newCcName} onChange={(e) => setNewCcName(e.target.value)} required />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn--primary">حفظ المركز</button>
                <button type="button" className="btn" onClick={() => setShowCcModal(false)}>إلغاء</button>
              </div>
            </form>
          )}

          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>كود المركز</th>
                  <th>اسم القسم / المركز</th>
                  <th>طبيعة الحساب</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {costCenters.length === 0 ? (
                  <tr><td colSpan={4}>لا توجد مراكز تكلفة مسجلة</td></tr>
                ) : (
                  costCenters.map((cc) => (
                    <tr key={cc.id}>
                      <td><b>{cc.code}</b></td>
                      <td>{cc.name}</td>
                      <td>{cc.isGroup ? 'مركز رئيسي / تجميعي' : 'مركز فرعي (مباشر)'}</td>
                      <td><span className="status-badge status-badge--active">نشط</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {/* 4. Journal Entries Tab */}
      {activeTab === 'journals' && (
        <article className="panel module-panel">
          <div className="panel__head">
            <div>
              <span className="panel__eyebrow">سجل القيود العامة</span>
              <h2>دفتر الأستاذ وقيود اليومية العامة (General Ledger Entries)</h2>
            </div>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>رقم القيد</th>
                  <th>التاريخ</th>
                  <th>البيان / الوصف</th>
                  <th>النوع</th>
                  <th>الحالة</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {journalEntries.length === 0 ? (
                  <tr><td colSpan={6}>لا توجد قيود يومية مسجلة</td></tr>
                ) : (
                  journalEntries.map((je) => (
                    <tr key={je.id}>
                      <td><b>{je.entryNumber}</b></td>
                      <td>{new Date(je.entryDate).toLocaleDateString('ar-EG')}</td>
                      <td>{je.description}</td>
                      <td>{je.isAutoGenerated ? '⚡ آلي من التشغيل' : 'يدوي'}</td>
                      <td>
                        <span className={`status-badge status-badge--${je.status === 'posted' ? 'active' : 'draft'}`}>
                          {je.status === 'posted' ? 'مرحل ومقيد' : 'مسودة'}
                        </span>
                      </td>
                      <td>
                        {je.status === 'draft' && (
                          <button className="btn btn--sm btn--success" onClick={() => handlePostJournal(je.id)}>
                            ترحيل
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {/* 5. Treasury & Retentions Tab */}
      {activeTab === 'treasury' && (
        <article className="panel module-panel">
          <div className="panel__head">
            <div>
              <span className="panel__eyebrow">المقبوضات والتحصيلات</span>
              <h2>حركات الخزينة والتحصيلات والتأمينات المحتجزة</h2>
            </div>
          </div>
          <div className="dashboard-grid dashboard-grid--equal">
            <div className="panel">
              <h3>تحصيلات العملاء</h3>
              <table className="data-table">
                <thead><tr><th>رقم السند</th><th>المبلغ</th><th>طريقة الدفع</th></tr></thead>
                <tbody>
                  {collections.map((c: any) => (
                    <tr key={c.id}>
                      <td><b>{c.collectionNumber}</b></td>
                      <td>{Number(c.amount).toLocaleString('ar-EG')} ج.م</td>
                      <td>{c.paymentMethod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel">
              <h3>التأمينات المحتجزة (Retentions)</h3>
              <table className="data-table">
                <thead><tr><th>رقم التأمين</th><th>المبلغ المحتجز</th><th>الحالة</th></tr></thead>
                <tbody>
                  {retentions.map((r: any) => (
                    <tr key={r.id}>
                      <td><b>{r.retentionNumber}</b></td>
                      <td>{Number(r.originalAmount).toLocaleString('ar-EG')} ج.م</td>
                      <td><span className="status-badge status-badge--active">{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </article>
      )}
    </section>
  );
}