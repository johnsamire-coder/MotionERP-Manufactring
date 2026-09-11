import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface JobOrderRecord { id: string; jobOrderNumber: string; quotationReference?: string; customerId?: string; status: string; }
interface WorkCenterRecord { id: string; code: string; name: string; status: string; }
interface MaterialRequestRecord { id: string; jobOrderReference: string; requestedQuantity: string; status: string; }

export function ManufacturingPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [jobOrders, setJobOrders] = useState<JobOrderRecord[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenterRecord[]>([]);
  const [requests, setRequests] = useState<MaterialRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [joRes, wcRes, reqRes] = await Promise.all([
        api.get<{ jobOrders: JobOrderRecord[] }>('/sales/job-orders'),
        api.get<{ workCenters: WorkCenterRecord[] }>('/production-ops/work-centers'),
        api.get<{ requests: MaterialRequestRecord[] }>('/production/material-requests'),
      ]);
      setJobOrders(joRes.jobOrders ?? []);
      setWorkCenters(wcRes.workCenters ?? []);
      setRequests(reqRes.requests ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load manufacturing hub data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  const activeJOList = jobOrders.filter((j) => j.status === 'approved' || j.status === 'in_progress');

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.manufacturing.eyebrow')}</span>
          <h1>{t('pages.manufacturing.title')}</h1>
          <p>{t('pages.manufacturing.description')}</p>
        </div>
      </div>

      {/* Manufacturing Executive Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <article className="panel" style={{ padding: 16 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>{t('pages.manufacturing.stats.activeOrders')}</span>
          <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 'bold', color: '#0f172a' }}>{activeJOList.length}</p>
        </article>

        <article className="panel" style={{ padding: 16 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>{t('pages.manufacturing.stats.workCenters')}</span>
          <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 'bold', color: '#0369a1' }}>{workCenters.length}</p>
        </article>

        <article className="panel" style={{ padding: 16 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>{t('pages.manufacturing.stats.materialRequests')}</span>
          <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 'bold', color: '#166534' }}>{requests.length}</p>
        </article>
      </div>

      {/* Active Manufacturing Orders Table */}
      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Shop Floor Hub</span>
            <h2>{t('pages.manufacturing.table.title')}</h2>
          </div>
        </div>

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.manufacturing.table.orderNo')}</span>
            <span>مرجع العرض</span>
            <span>{t('pages.manufacturing.table.status')}</span>
            <span>حالة التشغيل</span>
          </div>

          {jobOrders.length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.manufacturing.form.empty')}</p>
          )}

          {jobOrders.map((jo) => (
            <div className="placeholder-table__row" key={jo.id}>
              <span><b>{jo.jobOrderNumber}</b></span>
              <span><code>{jo.quotationReference ?? 'داخلي'}</code></span>
              <span>
                <span className={`status status--${jo.status === 'approved' ? 'success' : 'neutral'}`}>
                  <i />{jo.status}
                </span>
              </span>
              <span>
                <span className="status status--success">جاهز للإنتاج والتخطيط ✓</span>
              </span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
