import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface AccountRecord { id: string; code: string; name: string; accountType: string; isLeaf: boolean; balance?: string; }
interface CustomerRecord { id: string; id_key?: string; name: string; }
interface JobOrderRecord { id: string; jobOrderNumber: string; customerId?: string; }

interface CollectionRecord {
  id: string;
  collectionNumber: string;
  jobOrderReference: string;
  amount: string;
  paymentMethod: string;
  createdAt: string;
}

interface RetentionRecord {
  id: string;
  retentionNumber: string;
  jobOrderReference: string;
  originalAmount: string;
  releasedAmount: string;
  status: 'active' | 'released';
  createdAt: string;
}

export function AccountingPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [jobOrders, setJobOrders] = useState<JobOrderRecord[]>([]);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [retentions, setRetentions] = useState<RetentionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedJO, setSelectedJO] = useState('');
  const [showCollForm, setShowCollForm] = useState(false);
  const [showRetForm, setShowRetForm] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Collection Form state
  const [collAmount, setCollAmount] = useState('5000');
  const [payMethod, setPayMethod] = useState<'cash' | 'bank_transfer' | 'check' | 'credit_card'>('bank_transfer');

  // Retention Form state
  const [retAmount, setRetAmount] = useState('2500');

  // Release Modal state
  const [releaseAmountInput, setReleaseAmountInput] = useState('1000');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [accRes, joRes, collRes, retRes] = await Promise.all([
        api.get<{ accounts: AccountRecord[] }>('/accounting/accounts'),
        api.get<{ jobOrders: JobOrderRecord[] }>('/sales/job-orders'),
        api.get<any>('/finance/collections'),
        api.get<any>('/finance/retentions'),
      ]);
      setAccounts(accRes.accounts ?? []);
      setJobOrders(joRes.jobOrders ?? []);

      const activeJO = selectedJO || (joRes.jobOrders?.[0]?.jobOrderNumber ?? '');
      if (activeJO) setSelectedJO(activeJO);

      const listColl = Array.isArray(collRes) ? collRes : (collRes?.collections ?? []);
      const listRet = Array.isArray(retRes) ? retRes : (retRes?.retentions ?? []);
      setCollections(listColl);
      setRetentions(listRet);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load accounting data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  async function handleCreateCollection(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/finance/collections', {
        jobOrderReference: selectedJO,
        amount: collAmount,
        paymentMethod: payMethod,
      });
      setShowCollForm(false);
      setFormSuccess(t('pages.accounting.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleCreateRetention(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);

      await api.post('/finance/retentions', {
        jobOrderReference: selectedJO,
        originalAmount: retAmount,
        dueDate: nextYear.toISOString(),
      });
      setShowRetForm(false);
      setFormSuccess(t('pages.accounting.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleReleaseRetention(retentionId: string): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post(`/finance/retentions/${retentionId}/release`, {
        amount: releaseAmountInput,
      });
      setShowReleaseModal(null);
      setFormSuccess(t('pages.accounting.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.accounting.eyebrow')}</span>
          <h1>{t('pages.accounting.title')}</h1>
          <p>{t('pages.accounting.description')}</p>
        </div>
      </div>

      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      {/* JO Selector */}
      <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <label style={{ ...labelStyle, fontSize: 14, fontWeight: 'bold' }}>أمر التشغيل (Job Order):</label>
        <select value={selectedJO} onChange={(e) => setSelectedJO(e.target.value)} style={{ ...inputStyle, minWidth: 220, fontSize: 14, fontWeight: 'bold' }}>
          {jobOrders.map((jo) => <option key={jo.id} value={jo.jobOrderNumber}>{jo.jobOrderNumber}</option>)}
        </select>
      </div>

      {/* 1. Chart of Accounts Section */}
      <article className="panel module-panel" style={{ marginBottom: 20 }}>
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">General Ledger Structure</span>
            <h2>{t('pages.accounting.coa.title')}</h2>
          </div>
        </div>

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.accounting.coa.code')}</span>
            <span>{t('pages.accounting.coa.name')}</span>
            <span>{t('pages.accounting.coa.type')}</span>
            <span>{t('pages.accounting.coa.isLeaf')}</span>
          </div>

          {accounts.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.accounting.form.empty')}</p>}

          {accounts.map((acc) => (
            <div className="placeholder-table__row" key={acc.id}>
              <span><b>{acc.code}</b></span>
              <span>{acc.name}</span>
              <span><code>{acc.accountType}</code></span>
              <span>
                <span className={`status status--${acc.isLeaf ? 'success' : 'neutral'}`}>
                  {acc.isLeaf ? 'حساب فرعي (قابل للترحيل)' : 'حساب أصول/أب'}
                </span>
              </span>
            </div>
          ))}
        </div>
      </article>

      {/* 2. Customer Collections Section */}
      <article className="panel module-panel" style={{ marginBottom: 20 }}>
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Treasury Inflows</span>
            <h2>{t('pages.accounting.treasury.title')}</h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="filter-button" onClick={() => setShowRetForm((v) => !v)}><b>+</b> {t('pages.accounting.treasury.addRetention')}</button>
            <button className="primary-button" onClick={() => setShowCollForm((v) => !v)}><b>+</b> {t('pages.accounting.treasury.addCollection')}</button>
          </div>
        </div>

        {showCollForm && (
          <form onSubmit={(e) => { void handleCreateCollection(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.accounting.treasury.amount')}</label>
              <input type="number" min="1" step="any" value={collAmount} onChange={(e) => setCollAmount(e.target.value)} required style={{ ...inputStyle, width: 140 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>طريقة التحصيل</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as any)} style={{ ...inputStyle, minWidth: 160 }}>
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="cash">نقداً / خزينة</option>
                <option value="check">شيك مقبول الدفع</option>
                <option value="credit_card">بطاقة ائتمان</option>
              </select>
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.accounting.form.save')}</button>
          </form>
        )}

        {showRetForm && (
          <form onSubmit={(e) => { void handleCreateRetention(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>مبلغ التأمين المحتجز الأصل</label>
              <input type="number" min="1" step="any" value={retAmount} onChange={(e) => setRetAmount(e.target.value)} required style={{ ...inputStyle, width: 160 }} />
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.accounting.form.save')}</button>
          </form>
        )}

        {/* Collections Table */}
        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.accounting.treasury.collNo')}</span>
            <span>أمر التشغيل المرتبط</span>
            <span>المبلغ المحصَّل</span>
            <span>طريقة الدفع</span>
          </div>
          {collections.filter((c) => c.jobOrderReference === selectedJO).length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>لا توجد تحصيلات مسجلة لأمر التشغيل هذا بعد</p>
          )}
          {collections.filter((c) => c.jobOrderReference === selectedJO).map((col) => (
            <div className="placeholder-table__row" key={col.id}>
              <span><b>{col.collectionNumber}</b></span>
              <span><code>{col.jobOrderReference}</code></span>
              <span><b>{Number(col.amount).toLocaleString()} EGP</b></span>
              <span><code>{col.paymentMethod}</code></span>
            </div>
          ))}
        </div>
      </article>

      {/* 3. Retention Management Section */}
      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Holdback Guarantees</span>
            <h2>دورة التأمينات والمبالغ المحتجزة (Retention)</h2>
          </div>
        </div>

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.accounting.treasury.retNo')}</span>
            <span>أمر التشغيل المرتبط</span>
            <span>التأمين الأصلي</span>
            <span>المُفرَج عنه</span>
            <span>الحالة</span>
            <span>الإجراء</span>
          </div>

          {retentions.filter((r) => r.jobOrderReference === selectedJO).length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>لا توجد تأمينات محتجزة لهذا الأمر بعد</p>
          )}

          {retentions.filter((r) => r.jobOrderReference === selectedJO).map((ret) => (
            <div className="placeholder-table__row" key={ret.id}>
              <span><b>{ret.retentionNumber}</b></span>
              <span><code>{ret.jobOrderReference}</code></span>
              <span>{Number(ret.originalAmount).toLocaleString()} EGP</span>
              <span><b>{Number(ret.releasedAmount ?? 0).toLocaleString()} EGP</b></span>
              <span>
                <span className={`status status--${ret.status === 'released' ? 'success' : 'warning'}`}>
                  <i />{ret.status === 'released' ? 'تم الإفراج بالكامل ✓' : 'محتجز (نشط)'}
                </span>
              </span>
              <span>
                {ret.status === 'active' && (
                  <button className="primary-button" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => setShowReleaseModal(ret.id)}>
                    {t('pages.accounting.treasury.release')}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </article>

      {/* Release Retention Modal */}
      {showReleaseModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, width: 380, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3>الإفراج عن مبلغ التأمين</h3>
            <label style={labelStyle}>المبلغ المراد الإفراج عنه (EGP)</label>
            <input
              type="number"
              min="1"
              step="any"
              value={releaseAmountInput}
              onChange={(e) => setReleaseAmountInput(e.target.value)}
              required
              style={{ ...inputStyle, width: '100%' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="filter-button" onClick={() => setShowReleaseModal(null)}>{t('pages.accounting.form.cancel')}</button>
              <button className="primary-button" disabled={submitting} onClick={() => { void handleReleaseRetention(showReleaseModal); }}>
                تأكيد الإفراج
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
