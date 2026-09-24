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
  quantity: string;
  lineNumber: number;
  operationId: string | null;
  standardTimeMinutes: string | null;
}
interface OperationRecord {
  id: string;
  code: string;
  name: string;
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

export function ReportBomOperationsTimePage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [boms, setBoms] = useState<BomRecord[]>([]);
  const [operations, setOperations] = useState<OperationRecord[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterBomId, setFilterBomId] = useState('');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemsRes, bomsRes, orgRes, opsRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ boms: BomRecord[] }>('/technical/boms'),
        api.get<{ tree: OrgNodeTreeItem[] }>('/organization/tree'),
        api.get<{ operations: OperationRecord[] }>('/production-ops/operations'),
      ]);
      setItems(itemsRes.items);
      setBoms(bomsRes.boms);
      setOperations(opsRes.operations);
      if (!filterBomId && bomsRes.boms[0]) setFilterBomId(bomsRes.boms[0].id);
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
      setError(err instanceof ApiError ? err.message : 'Failed to load BOM operations time data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [i18n.language]);

  const itemLabel = (id: string): string => items.find((it) => it.id === id)?.name ?? id;
  const operationLabel = (id: string | null): string =>
    id ? (operations.find((op) => op.id === id)?.name ?? id) : '—';
  const selectedBom = useMemo(
    () => boms.find((b) => b.id === filterBomId) ?? null,
    [boms, filterBomId],
  );
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
          <h1>{t('pages.reports.bomOperationsTimeTitle')}</h1>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}
      <p
        style={{
          fontSize: 12,
          color: '#b45309',
          background: '#fffbeb',
          padding: 10,
          borderRadius: 6,
        }}
      >
        {t('pages.reports.note')}
      </p>

      <ReportLayout
        title={t('pages.reports.bomOperationsTimeTitle')}
        companyName={companyName}
        logoUrl={logoUrl}
        filename="bom-operations-time"
        exportHeaders={[
          t('pages.reports.componentItem'),
          t('pages.reports.qty'),
          t('pages.reports.operation'),
          t('pages.reports.standardTime'),
        ]}
        exportRows={(selectedBom?.lines ?? []).map((l) => [
          itemLabel(l.componentItemId),
          l.quantity,
          operationLabel(l.operationId),
          l.standardTimeMinutes ?? '—',
        ])}
      >
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('pages.reports.filterBom')}</label>
            <select
              value={filterBomId}
              onChange={(e) => setFilterBomId(e.target.value)}
              style={{ ...inputStyle, minWidth: 220 }}
            >
              {boms.map((b) => (
                <option key={b.id} value={b.id}>
                  {itemLabel(b.productItemId)} — v{b.version}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.reports.componentItem')}</span>
            <span>{t('pages.reports.qty')}</span>
            <span>{t('pages.reports.operation')}</span>
            <span>{t('pages.reports.standardTime')}</span>
          </div>
          {(!selectedBom || selectedBom.lines.length === 0) && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>
              {t('pages.reports.noResults')}
            </p>
          )}
          {selectedBom?.lines.map((l) => (
            <div className="placeholder-table__row" key={l.lineNumber}>
              <span>
                <b>{itemLabel(l.componentItemId)}</b>
              </span>
              <span>{l.quantity}</span>
              <span>{operationLabel(l.operationId)}</span>
              <span>{l.standardTimeMinutes ?? '—'}</span>
            </div>
          ))}
        </div>
      </ReportLayout>
    </section>
  );
}
