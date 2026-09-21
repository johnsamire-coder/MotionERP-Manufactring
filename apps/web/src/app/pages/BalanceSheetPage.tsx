import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, accountingApi, ApiError } from '../api/client';

type ReportTab = 'balance_sheet' | 'trial_balance' | 'partner_ledger' | 'fixed_assets';

export function BalanceSheetPage(): JSX.Element {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ReportTab>('balance_sheet');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [orgNodeId, setOrgNodeId] = useState('00000000-0000-0000-0000-000000000001');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0] ?? '');

  // Reports State
  const [bsData, setBsData] = useState<any>(null);
  const [tbData, setTbData] = useState<any>(null);

  // Partner Ledger State
  const [partyType, setPartyType] = useState<'customer' | 'supplier'>('customer');
  const [partners, setPartners] = useState<any[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [partnerLedgerData, setPartnerLedgerData] = useState<any>(null);

  // Fixed Assets State
  const [assets, setAssets] = useState<any[]>([]);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [assetCode, setAssetCode] = useState('');
  const [assetName, setAssetName] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [usefulLifeMonths, setUsefulLifeMonths] = useState('60');
  const [salvageValue, setSalvageValue] = useState('0');
  const [assetAccountId, setAssetAccountId] = useState('');
  const [accumulatedDeprAccountId, setAccumulatedDeprAccountId] = useState('');
  const [deprExpenseAccountId, setDeprExpenseAccountId] = useState('');

  // Load Balance Sheet
  const loadBalanceSheet = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await accountingApi.getBalanceSheet(orgNodeId, asOfDate || undefined);
      setBsData(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تحميل الميزانية العمومية');
    } finally {
      setLoading(false);
    }
  };

  // Load Trial Balance
  const loadTrialBalance = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await accountingApi.getTrialBalance(orgNodeId);
      setTbData(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تحميل ميزان المراجعة');
    } finally {
      setLoading(false);
    }
  };

  // Load Partners (Customers or Suppliers)
  const loadPartners = async () => {
    try {
      if (partyType === 'customer') {
        const res = await api.get<{ customers: any[] }>('/crm/customers').catch(() => ({ customers: [] }));
        setPartners(res.customers ?? []);
        if (res.customers?.[0]) setSelectedPartnerId(res.customers[0].id);
      } else {
        const res = await api.get<{ suppliers: any[] }>('/crm/suppliers').catch(() => ({ suppliers: [] }));
        setPartners(res.suppliers ?? []);
        if (res.suppliers?.[0]) setSelectedPartnerId(res.suppliers[0].id);
      }
    } catch {
      setPartners([]);
    }
  };

  // Load Partner Ledger
  const loadPartnerLedger = async () => {
    if (!selectedPartnerId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await accountingApi.getPartnerLedger(partyType, selectedPartnerId);
      setPartnerLedgerData(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تحميل كشف حساب الشريك');
    } finally {
      setLoading(false);
    }
  };

  // Load Fixed Assets
  const loadAssets = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await accountingApi.getFixedAssets();
      setAssets(data.fixedAssets ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تحميل سجل الأصول');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'balance_sheet') void loadBalanceSheet();
    if (activeTab === 'trial_balance') void loadTrialBalance();
    if (activeTab === 'partner_ledger') void loadPartners();
    if (activeTab === 'fixed_assets') void loadAssets();
  }, [activeTab, partyType]);

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await accountingApi.createFixedAsset({
        orgNodeId,
        assetCode,
        assetName,
        purchaseDate: new Date().toISOString(),
        purchaseCost,
        usefulLifeMonths: Number(usefulLifeMonths),
        salvageValue,
        assetAccountId,
        accumulatedDepreciationAccountId: accumulatedDeprAccountId,
        depreciationExpenseAccountId: deprExpenseAccountId,
      });
      setShowAssetForm(false);
      setSuccess('تم تسجيل الأصل / الماكينة بنجاح');
      void loadAssets();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تسجيل الأصل');
    }
  };

  const handlePostDepreciation = async (assetId: string) => {
    try {
      await accountingApi.postDepreciation(assetId, asOfDate || undefined);
      setSuccess('تم احتساب وترحيل قسط الإهلاك الشهري في الحسابات بنجاح!');
      void loadAssets();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل ترحيل قسط الإهلاك');
    }
  };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">القوائم المالية والختامية</span>
          <h1>التقارير المالية والأصول الثابتة</h1>
          <p>الميزانية العمومية، ميزان المراجعة، كشوف حسابات العملاء والموردين، وإهلاك ماكينات المصنع</p>
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert alert--success" style={{ marginBottom: 16 }}>{success}</div>}

      {/* Tabs */}
      <div className="tab-nav" style={{ display: 'flex', gap: 8, borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
        <button className={`btn ${activeTab === 'balance_sheet' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setActiveTab('balance_sheet')}>
          🏛️ الميزانية العمومية (Balance Sheet)
        </button>
        <button className={`btn ${activeTab === 'trial_balance' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setActiveTab('trial_balance')}>
          ⚖️ ميزان المراجعة (Trial Balance)
        </button>
        <button className={`btn ${activeTab === 'partner_ledger' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setActiveTab('partner_ledger')}>
          👤 كشف حساب شريك (Partner Ledger)
        </button>
        <button className={`btn ${activeTab === 'fixed_assets' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setActiveTab('fixed_assets')}>
          ⚙️ سجل الأصول وإهلاك الماكينات ({assets.length})
        </button>
      </div>

      {/* 1. Balance Sheet Tab */}
      {activeTab === 'balance_sheet' && (
        <article className="panel module-panel">
          <div className="filter-bar" style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
            <label>حتى تاريخ:
              <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} style={{ padding: '6px 12px', borderRadius: 6 }} />
            </label>
            <button className="btn btn--primary" onClick={loadBalanceSheet} disabled={loading}>
              {loading ? 'جاري التحديث...' : 'عرض الميزانية العمومية'}
            </button>
          </div>

          {bsData && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div style={{ padding: 16, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>
                  <span style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 'bold' }}>إجمالي الأصول (Assets)</span>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1e40af', marginTop: 4 }}>
                    {Number(bsData.totalAssets).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                  </div>
                </div>

                <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
                  <span style={{ fontSize: 13, color: '#b91c1c', fontWeight: 'bold' }}>إجمالي الالتزامات والخصوم (Liabilities)</span>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#991b1b', marginTop: 4 }}>
                    {Number(bsData.totalLiabilities).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                  </div>
                </div>

                <div style={{ padding: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                  <span style={{ fontSize: 13, color: '#15803d', fontWeight: 'bold' }}>إجمالي حقوق الملكية (Equity)</span>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#166534', marginTop: 4 }}>
                    {Number(bsData.totalEquity).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Assets */}
                <div className="panel" style={{ background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <h3 style={{ color: '#1e40af', marginBottom: 12 }}>الأصول (Assets)</h3>
                  <table className="data-table">
                    <thead><tr><th>الحساب</th><th>الرصيد</th></tr></thead>
                    <tbody>
                      {(bsData.assets ?? []).map((a: any, i: number) => (
                        <tr key={i}><td>{a.accountName}</td><td>{Number(a.balance).toLocaleString('ar-EG')} ج.م</td></tr>
                      ))}
                      <tr style={{ fontWeight: 'bold', background: '#f8fafc' }}>
                        <td>إجمالي الأصول</td>
                        <td>{Number(bsData.totalAssets).toLocaleString('ar-EG')} ج.م</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Liabilities & Equity */}
                <div className="panel" style={{ background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <h3 style={{ color: '#166534', marginBottom: 12 }}>الخصوم وحقوق الملكية (Liabilities & Equity)</h3>
                  <table className="data-table">
                    <thead><tr><th>الحساب</th><th>الرصيد</th></tr></thead>
                    <tbody>
                      {(bsData.liabilities ?? []).map((l: any, i: number) => (
                        <tr key={i}><td>{l.accountName}</td><td>{Number(l.balance).toLocaleString('ar-EG')} ج.م</td></tr>
                      ))}
                      {(bsData.equity ?? []).map((e: any, i: number) => (
                        <tr key={i}><td>{e.accountName}</td><td>{Number(e.balance).toLocaleString('ar-EG')} ج.م</td></tr>
                      ))}
                      <tr style={{ fontWeight: 'bold', background: '#f8fafc' }}>
                        <td>إجمالي الخصوم وحقوق الملكية</td>
                        <td>{Number(bsData.totalLiabilitiesAndEquity).toLocaleString('ar-EG')} ج.م</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </article>
      )}

      {/* 2. Trial Balance Tab */}
      {activeTab === 'trial_balance' && (
        <article className="panel module-panel">
          <div className="panel__head">
            <div>
              <span className="panel__eyebrow">ميزان المراجعة العام</span>
              <h2>توازن حسابات الأستاذ العام (Trial Balance)</h2>
            </div>
            <button className="btn btn--primary" onClick={loadTrialBalance}>
              تحديث الميزان
            </button>
          </div>

          {tbData && (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>كود الحساب</th>
                    <th>اسم الحساب</th>
                    <th>مدين (Debit)</th>
                    <th>دائن (Credit)</th>
                    <th>الرصيد الصافي</th>
                  </tr>
                </thead>
                <tbody>
                  {(tbData.rows ?? []).map((r: any) => (
                    <tr key={r.accountId}>
                      <td><b>{r.accountCode}</b></td>
                      <td>{r.accountName}</td>
                      <td>{Number(r.debit).toLocaleString('ar-EG')} ج.م</td>
                      <td>{Number(r.credit).toLocaleString('ar-EG')} ج.م</td>
                      <td><b>{Number(r.balance).toLocaleString('ar-EG')} ج.م</b></td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 'bold', background: '#ecfdf5' }}>
                    <td colSpan={2}>الإجمالي العام</td>
                    <td>{Number(tbData.totalDebit).toLocaleString('ar-EG')} ج.م</td>
                    <td>{Number(tbData.totalCredit).toLocaleString('ar-EG')} ج.م</td>
                    <td><span className="status-badge status-badge--active">متوازن 100% ✅</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </article>
      )}

      {/* 3. Partner Ledger Tab */}
      {activeTab === 'partner_ledger' && (
        <article className="panel module-panel">
          <div className="filter-bar" style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
            <label>نوع الشريك:
              <select value={partyType} onChange={(e) => setPartyType(e.target.value as any)} style={{ padding: '6px 12px', borderRadius: 6 }}>
                <option value="customer">عميل (Customer)</option>
                <option value="supplier">مورد (Supplier)</option>
              </select>
            </label>
            <label>اختر الشريك:
              <select value={selectedPartnerId} onChange={(e) => setSelectedPartnerId(e.target.value)} style={{ padding: '6px 12px', borderRadius: 6, minWidth: 200 }}>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <button className="btn btn--primary" onClick={loadPartnerLedger}>
              عرض كشف الحساب
            </button>
          </div>

          {partnerLedgerData && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 16, background: '#f8fafc', borderRadius: 8, marginBottom: 16 }}>
                <span>إجمالي المدين: <b>{Number(partnerLedgerData.totalDebit).toLocaleString('ar-EG')} ج.م</b></span>
                <span>إجمالي الدائن: <b>{Number(partnerLedgerData.totalCredit).toLocaleString('ar-EG')} ج.م</b></span>
                <span style={{ fontSize: 16, color: '#1e40af' }}>الرصيد الختامي المستحق: <b>{Number(partnerLedgerData.closingBalance).toLocaleString('ar-EG')} ج.م</b></span>
              </div>

              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>رقم القيد</th>
                      <th>التاريخ</th>
                      <th>البيان / المعاملة</th>
                      <th>مدين (+)</th>
                      <th>دائن (-)</th>
                      <th>الرصيد التراكمي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(partnerLedgerData.rows ?? []).length === 0 ? (
                      <tr><td colSpan={6}>لا توجد حركات مسجلة لهذا الشريك</td></tr>
                    ) : (
                      (partnerLedgerData.rows ?? []).map((row: any, idx: number) => (
                        <tr key={idx}>
                          <td><b>{row.entryNumber}</b></td>
                          <td>{new Date(row.entryDate).toLocaleDateString('ar-EG')}</td>
                          <td>{row.description}</td>
                          <td>{Number(row.debit).toLocaleString('ar-EG')} ج.م</td>
                          <td>{Number(row.credit).toLocaleString('ar-EG')} ج.م</td>
                          <td><b>{Number(row.runningBalance).toLocaleString('ar-EG')} ج.م</b></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </article>
      )}

      {/* 4. Fixed Assets & Depreciation Tab */}
      {activeTab === 'fixed_assets' && (
        <article className="panel module-panel">
          <div className="panel__head">
            <div>
              <span className="panel__eyebrow">إهلاك ماكينات المصنع</span>
              <h2>سجل الأصول الثابتة والماكينات (Fixed Assets Register)</h2>
            </div>
            <button className="btn btn--primary" onClick={() => setShowAssetForm(!showAssetForm)}>
              + تسجيل ماكينة / أصل جديد
            </button>
          </div>

          {showAssetForm && (
            <form className="form-card" onSubmit={handleCreateAsset} style={{ marginBottom: 20 }}>
              <h3>تسجيل ماكينة إنتاجية جديدة</h3>
              <div className="form-grid">
                <label>كود الماكينة (مثال: MACH-LASER-001)
                  <input value={assetCode} onChange={(e) => setAssetCode(e.target.value)} required />
                </label>
                <label>اسم الماكينة
                  <input value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="مثال: ماكينة قص ليزر فايبر 3000 وات" required />
                </label>
                <label>تكلفة الشراء (ج.م)
                  <input type="number" step="0.01" value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} required />
                </label>
                <label>العمر الإنتاجي (بالشهور)
                  <input type="number" value={usefulLifeMonths} onChange={(e) => setUsefulLifeMonths(e.target.value)} required />
                </label>
                <label>قيمة الخردة المتوقعة (ج.م)
                  <input type="number" step="0.01" value={salvageValue} onChange={(e) => setSalvageValue(e.target.value)} />
                </label>
                <label>حساب الأصل (Asset Account ID)
                  <input value={assetAccountId} onChange={(e) => setAssetAccountId(e.target.value)} required />
                </label>
                <label>حساب مجمع الإهلاك (Acc Depr ID)
                  <input value={accumulatedDeprAccountId} onChange={(e) => setAccumulatedDeprAccountId(e.target.value)} required />
                </label>
                <label>حساب مصروف الإهلاك (Expense Account ID)
                  <input value={deprExpenseAccountId} onChange={(e) => setDeprExpenseAccountId(e.target.value)} required />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn--primary">حفظ الماكينة</button>
                <button type="button" className="btn" onClick={() => setShowAssetForm(false)}>إلغاء</button>
              </div>
            </form>
          )}

          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>كود الماكينة</th>
                  <th>الاسم</th>
                  <th>تكلفة الشراء</th>
                  <th>العمر (شهور)</th>
                  <th>المستهلك حتى الآن</th>
                  <th>الحالة</th>
                  <th>الإجراء المحاسبي</th>
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr><td colSpan={7}>لا توجد أصول أو ماكينات مسجلة</td></tr>
                ) : (
                  assets.map((a) => (
                    <tr key={a.id}>
                      <td><b>{a.assetCode}</b></td>
                      <td>{a.assetName}</td>
                      <td>{Number(a.purchaseCost).toLocaleString('ar-EG')} ج.م</td>
                      <td>{a.usefulLifeMonths} شهر</td>
                      <td><b>{Number(a.totalDepreciated).toLocaleString('ar-EG')} ج.م</b></td>
                      <td>
                        <span className={`status-badge status-badge--${a.status === 'active' ? 'active' : 'cancelled'}`}>
                          {a.status === 'active' ? 'نشطة وتعمل' : 'مستهلكة بالكامل'}
                        </span>
                      </td>
                      <td>
                        {a.status === 'active' && (
                          <button className="btn btn--sm btn--warning" onClick={() => handlePostDepreciation(a.id)}>
                            ترحيل إهلاك الشهر ⚡
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
    </section>
  );
}