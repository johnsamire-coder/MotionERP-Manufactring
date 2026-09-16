import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';
import { ReportLayout } from '../components/ReportLayout';

interface WorkCenterRecord { id: string; code: string; name: string; }
interface DowntimeEntryRecord { id: string; workCenterId: string; stopReason: string; stoppageMinutes: string | null; }
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

export function ReportDowntimeAnalysisPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [workCenters, setWorkCenters] = useState<WorkCenterRecord[]>([]);
  const [entries, setEntries] = useState<DowntimeEntryRecord[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterWc, setFilterWc] = useState('');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [wcRes, dteRes, orgRes] = await Promise.all([
        api.get<{ workCenters: WorkCenterRecord[] }>('/production-ops/work-centers'),
        api.get<{ downtimeEntries: DowntimeEntryRecord[] }>('/production-ops/downtime-entries'),
        api.get<{ tree: OrgNodeTreeItem[] }>('/organization/tree'),
      ]);
      setWorkCenters(wcRes.workCenters);
      setEntries(dteRes.downtimeEntries);
      const company = findFirstLegalCompany(orgRes.tree);
      if (company) {
        try {
          const profileRes = await api.get<{ companyProfile: CompanyProfileRecord }>(`/settings/company-profile/${company.id}`);
          setCompanyName(profileRes.companyProfile.displayName);
          setLogoUrl(profileRes.companyProfile.logoUrl);
        } catch { setCompanyName(null); }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load downtime analysis data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  const wcLabel = (id: string): string => workCenters.find((w) => w.id === id)?.name ?? id;
  const filtered = useMemo(() => entries.filter((e) => !filterWc || e.workCenterId === filterWc), [entries, filterWc]);
  const totalDuration = filtered.reduce((sum, e) => sum + Number(e.stoppageMinutes ?? '0'), 0);
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>{t('pages.production_ops.form.loading')}</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.reports.eyebrow')}</span>
          <h1>{t('pages.reports.downtimeAnalysisTitle')}</h1>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}

      <ReportLayout
        title={t('pages.reports.downtimeAnalysisTitle')}
        companyName={companyName}
        logoUrl={logoUrl}
        filename="downtime-analysis"
        exportHeaders={[t('pages.reports.workCenter'), t('pages.reports.stopReason'), t('pages.reports.duration')]}
        exportRows={filtered.map((e) => [wcLabel(e.workCenterId), e.stopReason, e.stoppageMinutes ?? '0'])}
      >
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('pages.reports.filterWorkCenter')}</label>
            <select value={filterWc} onChange={(e) => setFilterWc(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
              <option value="">{t('pages.reports.all')}</option>
              {workCenters.map((wc) => <option key={wc.id} value={wc.id}>{wc.name}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 13, color: '#b45309', fontWeight: 'bold' }}>{t('pages.reports.totalDuration')}: {totalDuration.toFixed(1)}</div>
        </div>

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.reports.workCenter')}</span>
            <span>{t('pages.reports.stopReason')}</span>
            <span>{t('pages.reports.duration')}</span>
          </div>
          {filtered.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.reports.noResults')}</p>}
          {filtered.map((e) => (
            <div className="placeholder-table__row" key={e.id}>
              <span><b>{wcLabel(e.workCenterId)}</b></span>
              <span>{e.stopReason}</span>
              <span>{e.stoppageMinutes ? Number(e.stoppageMinutes).toFixed(1) : '—'}</span>
            </div>
          ))}
        </div>
      </ReportLayout>
    </section>
  );
}
