import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';
import { ReportLayout } from '../components/ReportLayout';

interface WorkCenterRecord {
  id: string;
  code: string;
  name: string;
}
interface ProductionStepRecord {
  id: string;
  operationName: string;
  workCenterId: string;
  standardTimeMinutes: string;
  actualTimeMinutes: string | null;
  status: string;
}
interface OrgNodeTreeItem {
  id: string;
  nodeType: string;
  children: OrgNodeTreeItem[];
}
interface CompanyProfileRecord {
  displayName: string | null;
  logoUrl: string | null;
}

function findFirstLegalCompany(nodes: OrgNodeTreeItem[]): OrgNodeTreeItem | null {
  for (const node of nodes) {
    if (node.nodeType === 'legal_company') return node;
    const found = findFirstLegalCompany(node.children ?? []);
    if (found) return found;
  }
  return null;
}

export function ReportJobCardSummaryPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [workCenters, setWorkCenters] = useState<WorkCenterRecord[]>([]);
  const [steps, setSteps] = useState<ProductionStepRecord[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterWc, setFilterWc] = useState('');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [wcRes, stepsRes, orgRes] = await Promise.all([
        api.get<{ workCenters: WorkCenterRecord[] }>('/production-ops/work-centers'),
        api.get<{ steps: ProductionStepRecord[] }>('/production-ops/steps'),
        api.get<{ tree: OrgNodeTreeItem[] }>('/organization/tree'),
      ]);
      setWorkCenters(wcRes.workCenters);
      setSteps(stepsRes.steps);
      const company = findFirstLegalCompany(orgRes.tree);
      if (company) {
        try {
          const profileRes = await api.get<{ companyProfile: CompanyProfileRecord }>(
            `/settings/company-profile/${company.id}`,
          );
          setCompanyName(profileRes.companyProfile.displayName);
          setLogoUrl(profileRes.companyProfile.logoUrl);
        } catch {
          setCompanyName(null);
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load job card summary data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [i18n.language]);

  const wcLabel = (id: string): string => workCenters.find((w) => w.id === id)?.name ?? id;
  const filtered = useMemo(
    () =>
      steps.filter(
        (s) =>
          (!filterStatus || s.status === filterStatus) &&
          (!filterWc || s.workCenterId === filterWc),
      ),
    [steps, filterStatus, filterWc],
  );
  const statuses = ['pending', 'in_progress', 'done'];
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  if (loading)
    return (
      <p style={{ padding: 40, textAlign: 'center' }}>{t('pages.production_ops.form.loading')}</p>
    );

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.reports.eyebrow')}</span>
          <h1>{t('pages.reports.jobCardSummaryTitle')}</h1>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}

      <ReportLayout
        title={t('pages.reports.jobCardSummaryTitle')}
        companyName={companyName}
        logoUrl={logoUrl}
        filename="job-card-summary"
        exportHeaders={[
          t('pages.reports.operation'),
          t('pages.reports.workCenter'),
          t('pages.reports.standardTime'),
          t('pages.reports.actualTime'),
          t('pages.reports.status'),
        ]}
        exportRows={filtered.map((s) => [
          s.operationName,
          wcLabel(s.workCenterId),
          s.standardTimeMinutes,
          s.actualTimeMinutes ?? '—',
          s.status,
        ])}
      >
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('pages.reports.filterStatus')}</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ ...inputStyle, minWidth: 150 }}
            >
              <option value="">{t('pages.reports.all')}</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('pages.reports.filterWorkCenter')}</label>
            <select
              value={filterWc}
              onChange={(e) => setFilterWc(e.target.value)}
              style={{ ...inputStyle, minWidth: 180 }}
            >
              <option value="">{t('pages.reports.all')}</option>
              {workCenters.map((wc) => (
                <option key={wc.id} value={wc.id}>
                  {wc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.reports.operation')}</span>
            <span>{t('pages.reports.workCenter')}</span>
            <span>{t('pages.reports.standardTime')}</span>
            <span>{t('pages.reports.actualTime')}</span>
            <span>{t('pages.reports.status')}</span>
          </div>
          {filtered.length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>
              {t('pages.reports.noResults')}
            </p>
          )}
          {filtered.map((s) => (
            <div className="placeholder-table__row" key={s.id}>
              <span>
                <b>{s.operationName}</b>
              </span>
              <span>{wcLabel(s.workCenterId)}</span>
              <span>{s.standardTimeMinutes}</span>
              <span>{s.actualTimeMinutes ?? '—'}</span>
              <span>{s.status}</span>
            </div>
          ))}
        </div>
      </ReportLayout>
    </section>
  );
}
