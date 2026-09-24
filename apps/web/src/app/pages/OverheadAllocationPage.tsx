import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface PoolRow {
  id: string;
  code: string;
  name: string;
  totalAmount: string;
  status: string;
}
interface PolicyRow {
  id: string;
  code: string;
  name: string;
  allocationBase: string;
  percentage: string;
}

export function OverheadAllocationPage(): JSX.Element {
  const { t: _t } = useTranslation();
  const [pools, setPools] = useState<PoolRow[]>([]);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [poolsData, policiesData] = await Promise.all([
        api.get<{ pools: PoolRow[] }>('/cost/pools').catch(() => ({ pools: [] })),
        api.get<{ policies: PolicyRow[] }>('/cost/policies').catch(() => ({ policies: [] })),
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

  useEffect(() => {
    void loadData();
  }, []);

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
          {loading ? (
            <p>جاري التحميل...</p>
          ) : pools.length === 0 ? (
            <p>لا توجد مجمعات تكاليف مسجلة</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>الكود</th>
                  <th>الاسم</th>
                  <th>المبلغ</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {pools.map((p) => (
                  <tr key={p.id}>
                    <td>{p.code}</td>
                    <td>{p.name}</td>
                    <td>{Number(p.totalAmount).toLocaleString('ar-EG')} ج.م</td>
                    <td>
                      <span className={`status-badge status-badge--${p.status}`}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h3>سياسات التوزيع</h3>
          {loading ? (
            <p>جاري التحميل...</p>
          ) : policies.length === 0 ? (
            <p>لا توجد سياسات توزيع مسجلة</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>الكود</th>
                  <th>الاسم</th>
                  <th>أساس التوزيع</th>
                  <th>النسبة</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
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
