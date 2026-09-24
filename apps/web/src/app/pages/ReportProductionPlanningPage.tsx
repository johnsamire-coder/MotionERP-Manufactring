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
}
interface BomRecord {
  id: string;
  productItemId: string;
  isDefault: boolean;
  status: string;
  lines: BomLineRecord[];
}
interface ProductionPlanItemRecord {
  productItemId: string;
  bomId: string;
  qtyToPlan: string;
}
interface ProductionPlanRecord {
  id: string;
  planNumber: string;
  items: ProductionPlanItemRecord[];
}
interface StockBalanceRecord {
  itemId: string;
  available: string;
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

export function ReportProductionPlanningPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [boms, setBoms] = useState<BomRecord[]>([]);
  const [plans, setPlans] = useState<ProductionPlanRecord[]>([]);
  const [balances, setBalances] = useState<StockBalanceRecord[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterPlanId, setFilterPlanId] = useState('');
  const [includeSubAssembly, setIncludeSubAssembly] = useState(false);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemsRes, bomsRes, plansRes, balRes, orgRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ boms: BomRecord[] }>('/technical/boms'),
        api.get<{ productionPlans: ProductionPlanRecord[] }>('/planning/production-plans'),
        api.get<{ balances: StockBalanceRecord[] }>('/inventory/balances'),
        api.get<{ tree: OrgNodeTreeItem[] }>('/organization/tree'),
      ]);
      setItems(itemsRes.items);
      setBoms(bomsRes.boms);
      setPlans(plansRes.productionPlans);
      setBalances(balRes.balances);
      if (!filterPlanId && plansRes.productionPlans[0])
        setFilterPlanId(plansRes.productionPlans[0].id);
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
      setError(
        err instanceof ApiError ? err.message : 'Failed to load production planning report data',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [i18n.language]);

  const itemLabel = (id: string): string => items.find((it) => it.id === id)?.name ?? id;
  const availableFor = (id: string): number =>
    balances.filter((b) => b.itemId === id).reduce((s, b) => s + Number(b.available), 0);

  function explode(
    componentItemId: string,
    qty: number,
    depth: number,
    acc: Map<string, number>,
  ): void {
    acc.set(componentItemId, (acc.get(componentItemId) ?? 0) + qty);
    if (!includeSubAssembly || depth > 5) return;
    const subBom = boms.find(
      (b) => b.productItemId === componentItemId && b.isDefault && b.status === 'approved',
    );
    if (!subBom) return;
    for (const line of subBom.lines) {
      explode(line.componentItemId, qty * Number(line.quantity), depth + 1, acc);
    }
  }

  const requiredMap = useMemo(() => {
    const plan = plans.find((p) => p.id === filterPlanId);
    const acc = new Map<string, number>();
    if (!plan) return acc;
    for (const planItem of plan.items) {
      const bom = boms.find((b) => b.id === planItem.bomId);
      if (!bom) continue;
      for (const line of bom.lines) {
        explode(line.componentItemId, Number(line.quantity) * Number(planItem.qtyToPlan), 0, acc);
      }
    }
    return acc;
  }, [plans, filterPlanId, boms, includeSubAssembly]);

  const rows = useMemo(
    () =>
      Array.from(requiredMap.entries()).map(([itemId, required]) => {
        const available = availableFor(itemId);
        return { itemId, required, available, shortfall: Math.max(0, required - available) };
      }),
    [requiredMap, balances],
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
          <h1>{t('pages.reports.productionPlanningReportTitle')}</h1>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}

      <ReportLayout
        title={t('pages.reports.productionPlanningReportTitle')}
        companyName={companyName}
        logoUrl={logoUrl}
        filename="production-planning-report"
        exportHeaders={[
          t('pages.reports.item'),
          t('pages.reports.requiredQty'),
          t('pages.reports.availableQty'),
          t('pages.reports.shortfall'),
        ]}
        exportRows={rows.map((r) => [
          itemLabel(r.itemId),
          r.required.toFixed(2),
          r.available.toFixed(2),
          r.shortfall.toFixed(2),
        ])}
      >
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('pages.reports.filterPlan')}</label>
            <select
              value={filterPlanId}
              onChange={(e) => setFilterPlanId(e.target.value)}
              style={{ ...inputStyle, minWidth: 200 }}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.planNumber}
                </option>
              ))}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={includeSubAssembly}
              onChange={(e) => setIncludeSubAssembly(e.target.checked)}
            />
            {t('pages.reports.includeSubAssembly')}
          </label>
        </div>

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.reports.item')}</span>
            <span>{t('pages.reports.requiredQty')}</span>
            <span>{t('pages.reports.availableQty')}</span>
            <span>{t('pages.reports.shortfall')}</span>
          </div>
          {rows.length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>
              {t('pages.reports.noResults')}
            </p>
          )}
          {rows.map((r) => (
            <div className="placeholder-table__row" key={r.itemId}>
              <span>
                <b>{itemLabel(r.itemId)}</b>
              </span>
              <span>{r.required.toFixed(2)}</span>
              <span>{r.available.toFixed(2)}</span>
              <span style={{ color: r.shortfall > 0 ? '#b91c1c' : '#166534', fontWeight: 'bold' }}>
                {r.shortfall.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </ReportLayout>
    </section>
  );
}
