import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

export function OverheadAllocationPage(): JSX.Element {
  const { t } = useTranslation();
  const [pools, setPools] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [poolsData, policiesData] = await Promise.all([
        api.get<{ pools: any[] }>('/cost/pools').catch(() => ({ pools: [] })),
        api.get<{ policies: any[] }>('/cost/policies').catch(() => ({ policies: [] })),
      ]);
      setPools(poolsData.pools ?? []);
      setPolicies(policiesData.policies ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'فشل تحميل بيانات التكاليف غير المباشرة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">محاسبة التكاليف</span>
          <h1>توزيع التكاليف غير المباشرة (Overhead)</h1>
          <p>إدارة مجمعات التكاليف وسياسات التوزيع على أوامر الشغل ومراكز التكلفة</p>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      <div className="dashboard-grid dashboard-grid--equal">
        <div className="panel">
          <h3>مجمعات التكاليف غير المباشرة</h3>
          {loading ? <p>جاري التحميل...</p> : pools.length === 0 ? (
            <p>لا توجد مجمعات تكاليف مسجلة</p>
          ) : (
            <table className="data-table">
              <thead><tr><th>الكود</th><th>الاسم</th><th>المبلغ</th><th>الحالة</th></tr></thead>
              <tbody>
                {pools.map((p: any) => (
                  <tr key={p.id}>
                    <td>{p.code}</td>
                    <td>{p.name}</td>
                    <td>{Number(p.totalAmount).toLocaleString('ar-EG')} ج.م</td>
                    <td><span className={`status-badge status-badge--${p.status}`}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h3>سياسات التوزيع</h3>
          {loading ? <p>جاري التحميل...</p> : policies.length === 0 ? (
            <p>لا توجد سياسات توزيع مسجلة</p>
          ) : (
            <table className="data-table">
              <thead><tr><th>الكود</th><th>الاسم</th><th>أساس التوزيع</th><th>النسبة</th></tr></thead>
              <tbody>
                {policies.map((p: any) => (
                  <tr key={p.id}>
                    <td>{p.code}</td>
                    <td>{p.name}</td>
                    <td>{p.allocationBase}</td>
                    <td>{p.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}