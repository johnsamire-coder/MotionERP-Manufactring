import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';
import { ReportLayout } from '../components/ReportLayout';

interface ItemRecord {
  id: string;
  code: string;
  name: string;
}
interface SfLineRecord {
  itemId: string;
  forecastQuantity: string;
}
interface SalesForecastRecord {
  id: string;
  lines: SfLineRecord[];
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

function exponentialSmoothing(series: number[], alpha: number): number {
  if (series.length === 0) return 0;
  let forecast = series[0]!;
  for (let i = 1; i < series.length; i++) {
    forecast = alpha * series[i]! + (1 - alpha) * forecast;
  }
  return forecast;
}

export function ReportForecastingPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [forecasts, setForecasts] = useState<SalesForecastRecord[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alpha, setAlpha] = useState('0.3');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemsRes, sfRes, orgRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ salesForecasts: SalesForecastRecord[] }>('/planning/sales-forecasts'),
        api.get<{ tree: OrgNodeTreeItem[] }>('/organization/tree'),
      ]);
      setItems(itemsRes.items);
      setForecasts(sfRes.salesForecasts);
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
      setError(err instanceof ApiError ? err.message : 'Failed to load forecasting data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [i18n.language]);

  const itemLabel = (id: string): string => items.find((it) => it.id === id)?.name ?? id;

  const rows = useMemo(() => {
    const seriesByItem = new Map<string, number[]>();
    for (const sf of forecasts) {
      for (const line of sf.lines) {
        if (!seriesByItem.has(line.itemId)) seriesByItem.set(line.itemId, []);
        seriesByItem.get(line.itemId)!.push(Number(line.forecastQuantity));
      }
    }
    const a = Math.min(1, Math.max(0, Number(alpha) || 0.3));
    return Array.from(seriesByItem.entries()).map(([itemId, series]) => ({
      itemId,
      series,
      forecasted: exponentialSmoothing(series, a),
    }));
  }, [forecasts, alpha]);

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
          <h1>{t('pages.reports.forecastingTitle')}</h1>
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
        {t('pages.reports.note2')}
      </p>

      <ReportLayout
        title={t('pages.reports.forecastingTitle')}
        companyName={companyName}
        logoUrl={logoUrl}
        filename="exponential-smoothing-forecasting"
        exportHeaders={[
          t('pages.reports.item'),
          t('pages.reports.historicalQty'),
          t('pages.reports.forecastedQty'),
        ]}
        exportRows={rows.map((r) => [
          itemLabel(r.itemId),
          r.series.join(', '),
          r.forecasted.toFixed(2),
        ])}
      >
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{t('pages.reports.smoothingConstant')}</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={alpha}
              onChange={(e) => setAlpha(e.target.value)}
              style={{ ...inputStyle, width: 100 }}
            />
          </div>
        </div>

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.reports.item')}</span>
            <span>{t('pages.reports.historicalQty')}</span>
            <span>{t('pages.reports.forecastedQty')}</span>
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
              <span>{r.series.join(', ')}</span>
              <span style={{ fontWeight: 'bold', color: '#166534' }}>
                {r.forecasted.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </ReportLayout>
    </section>
  );
}
