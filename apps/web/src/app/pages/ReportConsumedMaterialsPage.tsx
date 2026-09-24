import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';
import { ReportLayout } from '../components/ReportLayout';

interface ItemRecord {
  id: string;
  code: string;
  name: string;
}
interface MaterialRequestRecord {
  id: string;
  jobOrderReference: string;
  itemId: string;
  plannedQuantity: string;
  actualUsedQuantity: string | null;
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

export function ReportConsumedMaterialsPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [requests, setRequests] = useState<MaterialRequestRecord[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [excessOnly, setExcessOnly] = useState(false);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemsRes, reqRes, orgRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ requests: MaterialRequestRecord[] }>('/production/material-requests'),
        api.get<{ tree: OrgNodeTreeItem[] }>('/organization/tree'),
      ]);
      setItems(itemsRes.items);
      setRequests(reqRes.requests);
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
      setError(err instanceof ApiError ? err.message : 'Failed to load consumed materials data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [i18n.language]);

  const itemLabel = (id: string): string => items.find((it) => it.id === id)?.name ?? id;
  const withDeviation = useMemo(
    () =>
      requests.map((r) => ({
        ...r,
        deviation: Number(r.actualUsedQuantity ?? '0') - Number(r.plannedQuantity),
      })),
    [requests],
  );
  const filtered = useMemo(
    () => (excessOnly ? withDeviation.filter((r) => r.deviation > 0) : withDeviation),
    [withDeviation, excessOnly],
  );
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
          <h1>{t('pages.reports.consumedMaterialsTitle')}</h1>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}

      <ReportLayout
        title={t('pages.reports.consumedMaterialsTitle')}
        companyName={companyName}
        logoUrl={logoUrl}
        filename="work-order-consumed-materials"
        exportHeaders={[
          t('pages.reports.jobOrder'),
          t('pages.reports.item'),
          t('pages.reports.plannedQty'),
          t('pages.reports.actualUsedQty'),
          t('pages.reports.deviation'),
        ]}
        exportRows={filtered.map((r) => [
          r.jobOrderReference,
          itemLabel(r.itemId),
          r.plannedQuantity,
          r.actualUsedQuantity ?? '—',
          r.deviation.toFixed(2),
        ])}
      >
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, ...labelStyle }}
        >
          <input
            type="checkbox"
            checked={excessOnly}
            onChange={(e) => setExcessOnly(e.target.checked)}
          />
          {t('pages.reports.excessOnly')}
        </label>

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.reports.jobOrder')}</span>
            <span>{t('pages.reports.item')}</span>
            <span>{t('pages.reports.plannedQty')}</span>
            <span>{t('pages.reports.actualUsedQty')}</span>
            <span>{t('pages.reports.deviation')}</span>
          </div>
          {filtered.length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>
              {t('pages.reports.noResults')}
            </p>
          )}
          {filtered.map((r) => (
            <div className="placeholder-table__row" key={r.id}>
              <span>
                <b>{r.jobOrderReference}</b>
              </span>
              <span>{itemLabel(r.itemId)}</span>
              <span>{r.plannedQuantity}</span>
              <span>{r.actualUsedQuantity ?? '—'}</span>
              <span style={{ color: r.deviation > 0 ? '#b91c1c' : '#166534', fontWeight: 'bold' }}>
                {r.deviation.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </ReportLayout>
    </section>
  );
}
