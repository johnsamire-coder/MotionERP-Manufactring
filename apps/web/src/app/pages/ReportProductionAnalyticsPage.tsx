import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';
import { ReportLayout } from '../components/ReportLayout';

interface WorkOrderRecord { id: string; status: string; createdAt: string; }
interface OrgNodeTreeItem { id: string; nodeType: string; children: OrgNodeTreeItem[]; }
interface CompanyProfileRecord { displayName: string | null; logoUrl: string | null; }

function findFirstLegalCompany(nodes: OrgNodeTreeItem[]): OrgNodeTreeItem | null {
  for (const node of nodes) {
    if (node.nodeType === 'legal_company') return node;
    const found = findFirstLegalCompany(node.children ?? []);
    if (found) return found;
  }
  return null;
}

const STATUSES = ['not_started', 'in_progress', 'completed', 'closed', 'stopped'];
const STATUS_COLORS: Record<string, string> = {
  not_started: '#94a3b8', in_progress: '#f59e0b', completed: '#22c55e', closed: '#64748b', stopped: '#ef4444',
};

export function ReportProductionAnalyticsPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [woRes, orgRes] = await Promise.all([
        api.get<{ workOrders: WorkOrderRecord[] }>('/production-ops/work-orders'),
        api.get<{ tree: OrgNodeTreeItem[] }>('/organization/tree'),
      ]);
      setWorkOrders(woRes.workOrders);
      const company = findFirstLegalCompany(orgRes.tree);
      if (company) {
        try {
          const profileRes = await api.get<{ companyProfile: CompanyProfileRecord }>(`/settings/company-profile/${company.id}`);
          setCompanyName(profileRes.companyProfile.displayName);
          setLogoUrl(profileRes.companyProfile.logoUrl);
        } catch { setCompanyName(null); }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load production analytics data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  const monthlyData = useMemo(() => {
    const byMonth: Record<string, Record<string, number>> = {};
    for (const wo of workOrders) {
      const month = wo.createdAt.slice(0, 7);
      if (!byMonth[month]) byMonth[month] = {};
      byMonth[month][wo.status] = (byMonth[month][wo.status] ?? 0) + 1;
    }
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, counts]) => ({ month, counts }));
  }, [workOrders]);

  const maxMonthlyTotal = Math.max(...monthlyData.map((m) => Object.values(m.counts).reduce((s, v) => s + v, 0)), 1);
  const exportHeaders = [t('pages.reports.month'), ...STATUSES];
  const exportRows = monthlyData.map((m) => [m.month, ...STATUSES.map((s) => m.counts[s] ?? 0)]);

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>{t('pages.production_ops.form.loading')}</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.reports.eyebrow')}</span>
          <h1>{t('pages.reports.productionAnalyticsTitle')}</h1>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}

      <ReportLayout
        title={t('pages.reports.productionAnalyticsTitle')}
        companyName={companyName}
        logoUrl={logoUrl}
        filename="production-analytics"
        exportHeaders={exportHeaders}
        exportRows={exportRows}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 200, marginBottom: 20 }}>
          {monthlyData.length === 0 && <p style={{ color: '#94a3b8' }}>{t('pages.reports.noResults')}</p>}
          {monthlyData.map((m) => {
            const total = Object.values(m.counts).reduce((s, v) => s + v, 0);
            return (
              <div key={m.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column-reverse', width: '100%', maxWidth: 50, height: `${(total / maxMonthlyTotal) * 160}px` }}>
                  {STATUSES.map((s) => (m.counts[s] ? (
                    <div key={s} style={{ height: `${(m.counts[s] / total) * 100}%`, background: STATUS_COLORS[s], width: '100%' }} title={`${s}: ${m.counts[s]}`} />
                  ) : null))}
                </div>
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{m.month}</span>
              </div>
            );
          })}
        </div>

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.reports.month')}</span>
            {STATUSES.map((s) => <span key={s}>{s}</span>)}
          </div>
          {monthlyData.map((m) => (
            <div className="placeholder-table__row" key={m.month}>
              <span><b>{m.month}</b></span>
              {STATUSES.map((s) => <span key={s}>{m.counts[s] ?? 0}</span>)}
            </div>
          ))}
        </div>
      </ReportLayout>
    </section>
  );
}
