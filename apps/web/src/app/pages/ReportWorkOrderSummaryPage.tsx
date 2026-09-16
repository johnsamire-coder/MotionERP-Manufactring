import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';
import { ReportLayout } from '../components/ReportLayout';

interface ItemRecord { id: string; code: string; name: string; }
interface WorkOrderRecord { id: string; workOrderNumber: string; productItemId: string; qtyToManufacture: string; status: string; }
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

export function ReportWorkOrderSummaryPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemsRes, woRes, orgRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ workOrders: WorkOrderRecord[] }>('/production-ops/work-orders'),
        api.get<{ tree: OrgNodeTreeItem[] }>('/organization/tree'),
      ]);
      setItems(itemsRes.items);
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
      setError(err instanceof ApiError ? err.message : 'Failed to load work order summary data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  const itemLabel = (id: string): string => items.find((it) => it.id === id)?.name ?? id;
  const filtered = useMemo(() => workOrders.filter((w) => !filterStatus || w.status === filterStatus), [workOrders, filterStatus]);
  const totalQty = filtered.reduce((sum, w) => sum + Number(w.qtyToManufacture), 0);
  const statuses = ['not_started', 'in_progress', 'completed', 'stopped', 'closed'];
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>{t('pages.production_ops.form.loading')}</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.reports.eyebrow')}</span>
          <h1>{t('pages.reports.workOrderSummaryTitle')}</h1>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}

      <ReportLayout
        title={t('pages.reports.workOrderSummaryTitle')}
        companyName={companyName}
        logoUrl={logoUrl}
        filename="work-order-summary"
        exportHeaders={[t('pages.reports.workOrderNumber'), t('pages.reports.productItem'), t('pages.reports.qty'), t('pages.reports.status')]}
        exportRows={filtered.map((w) => [w.workOrderNumber, itemLabel(w.productItemId), w.qtyToManufacture, w.status])}
      >
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('pages.reports.filterStatus')}</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
              <option value="">{t('pages.reports.all')}</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 13, color: '#166534', fontWeight: 'bold' }}>{t('pages.reports.totalQty')}: {totalQty}</div>
        </div>

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.reports.workOrderNumber')}</span>
            <span>{t('pages.reports.productItem')}</span>
            <span>{t('pages.reports.qty')}</span>
            <span>{t('pages.reports.status')}</span>
          </div>
          {filtered.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.reports.noResults')}</p>}
          {filtered.map((w) => (
            <div className="placeholder-table__row" key={w.id}>
              <span><b>{w.workOrderNumber}</b></span>
              <span>{itemLabel(w.productItemId)}</span>
              <span>{w.qtyToManufacture}</span>
              <span>{w.status}</span>
            </div>
          ))}
        </div>
      </ReportLayout>
    </section>
  );
}
