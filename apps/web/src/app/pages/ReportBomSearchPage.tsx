import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';
import { ReportLayout } from '../components/ReportLayout';

interface ItemRecord {
  id: string;
  code: string;
  name: string;
}
interface BomLineRecord {
  componentItemId: string;
}
interface BomRecord {
  id: string;
  productItemId: string;
  version: number;
  status: string;
  lines: BomLineRecord[];
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

export function ReportBomSearchPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [boms, setBoms] = useState<BomRecord[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterItemId, setFilterItemId] = useState('');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemsRes, bomsRes, orgRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ boms: BomRecord[] }>('/technical/boms'),
        api.get<{ tree: OrgNodeTreeItem[] }>('/organization/tree'),
      ]);
      setItems(itemsRes.items);
      setBoms(bomsRes.boms);
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
      setError(err instanceof ApiError ? err.message : 'Failed to load BOM search data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [i18n.language]);

  const itemLabel = (id: string): string => items.find((it) => it.id === id)?.name ?? id;

  const rows = useMemo(() => {
    const results: {
      bomNumber: string;
      productItem: string;
      role: string;
      version: number;
      status: string;
    }[] = [];
    for (const bom of boms) {
      if (!filterItemId) continue;
      if (bom.productItemId === filterItemId) {
        results.push({
          bomNumber: `BOM-${bom.version}`,
          productItem: itemLabel(bom.productItemId),
          role: t('pages.reports.asProduct'),
          version: bom.version,
          status: bom.status,
        });
      }
      if (bom.lines.some((l) => l.componentItemId === filterItemId)) {
        results.push({
          bomNumber: `BOM-${bom.version}`,
          productItem: itemLabel(bom.productItemId),
          role: t('pages.reports.asComponent'),
          version: bom.version,
          status: bom.status,
        });
      }
    }
    return results;
  }, [boms, filterItemId, items]);

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
          <h1>{t('pages.reports.bomSearchTitle')}</h1>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}

      <ReportLayout
        title={t('pages.reports.bomSearchTitle')}
        companyName={companyName}
        logoUrl={logoUrl}
        filename="bom-search"
        exportHeaders={[
          t('pages.reports.bomNumber'),
          t('pages.reports.productItem'),
          t('pages.reports.role'),
          t('pages.reports.version'),
          t('pages.reports.status'),
        ]}
        exportRows={rows.map((r) => [r.bomNumber, r.productItem, r.role, r.version, r.status])}
      >
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('pages.reports.filterByItem')}</label>
            <select
              value={filterItemId}
              onChange={(e) => setFilterItemId(e.target.value)}
              style={{ ...inputStyle, minWidth: 220 }}
            >
              <option value="">—</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} ({it.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.reports.bomNumber')}</span>
            <span>{t('pages.reports.productItem')}</span>
            <span>{t('pages.reports.role')}</span>
            <span>{t('pages.reports.version')}</span>
            <span>{t('pages.reports.status')}</span>
          </div>
          {rows.length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>
              {t('pages.reports.noResults')}
            </p>
          )}
          {rows.map((r, idx) => (
            <div className="placeholder-table__row" key={idx}>
              <span>
                <b>{r.bomNumber}</b>
              </span>
              <span>{r.productItem}</span>
              <span>{r.role}</span>
              <span>v{r.version}</span>
              <span>{r.status}</span>
            </div>
          ))}
        </div>
      </ReportLayout>
    </section>
  );
}
