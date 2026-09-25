import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { accountingApi, ApiError, type ProfitAndLossReport } from '../api/client';

export function ProfitAndLossPage(): JSX.Element {
  const { t: _t } = useTranslation();
  const [report, setReport] = useState<ProfitAndLossReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgNodeId, setOrgNodeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadReport = async () => {
    if (!orgNodeId) {
      setError('يرجى إدخال كود الشركة');
      return;
    }
    try {
      setLoading(true);
      const data = await accountingApi.getProfitAndLoss(
        orgNodeId,
        startDate || undefined,
        endDate || undefined,
      );
      setReport(data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'فشل تحميل تقرير الأرباح والخسائر');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">التقارير المالية</span>
          <h1>قائمة الدخل (الأرباح والخسائر)</h1>
          <p>تحليل الإيرادات والمصروفات وصافي الربح الفعلي للمصنع</p>
        </div>
      </div>

      <div className="filter-bar">
        <label>
          كود الشركة
          <input
            value={orgNodeId}
            onChange={(e) => setOrgNodeId(e.target.value)}
            placeholder="org-node-id"
          />
        </label>
        <label>
          من تاريخ
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          إلى تاريخ
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <button className="btn btn--primary" onClick={loadReport} disabled={loading}>
          {loading ? 'جاري التحميل...' : 'عرض التقرير'}
        </button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {report && (
        <div className="report-card">
          <h3>ملخص قائمة الدخل</h3>
          <div className="kpi-grid kpi-grid--4">
            <div className="kpi kpi--blue">
              <p>إجمالي الإيرادات</p>
              <strong>{Number(report.totalRevenue).toLocaleString('ar-EG')} ج.م</strong>
            </div>
            <div className="kpi kpi--red">
              <p>تكلفة البضاعة المباعة (COGS)</p>
              <strong>{Number(report.totalCogs).toLocaleString('ar-EG')} ج.م</strong>
            </div>
            <div className="kpi kpi--green">
              <p>مجمل الربح</p>
              <strong>{Number(report.grossProfit).toLocaleString('ar-EG')} ج.م</strong>
            </div>
            <div className="kpi kpi--purple">
              <p>صافي الربح</p>
              <strong>{Number(report.netProfit).toLocaleString('ar-EG')} ج.م</strong>
            </div>
          </div>

          <div className="report-sections">
            <div className="report-section">
              <h4>تفاصيل الإيرادات</h4>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الحساب</th>
                    <th>الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.revenueDetails ?? []).map((r, i) => (
                    <tr key={i}>
                      <td>{r.accountName}</td>
                      <td>{Number(r.balance).toLocaleString('ar-EG')} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="report-section">
              <h4>تفاصيل المصروفات</h4>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الحساب</th>
                    <th>الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.expenseDetails ?? []).map((r, i) => (
                    <tr key={i}>
                      <td>{r.accountName}</td>
                      <td>{Number(r.balance).toLocaleString('ar-EG')} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
