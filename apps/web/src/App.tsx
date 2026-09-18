import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, directionOf, type SupportedLanguage } from './app/i18n/config';
import { InventoryPage } from './app/pages/InventoryPage';
import { SalesPage } from './app/pages/SalesPage';
import { MaterialPage } from './app/pages/MaterialPage';
import { ProductionOpsPage } from './app/pages/ProductionOpsPage';
import { DeliveryPage } from './app/pages/DeliveryPage';
import { AccountingPage } from './app/pages/AccountingPage';
import { HrPage } from './app/pages/HrPage';
import { AuthPage } from './app/pages/AuthPage';
import { OrganizationPage } from './app/pages/OrganizationPage';
import { ManufacturingPage } from './app/pages/ManufacturingPage';
import { BomPage } from './app/pages/BomPage';
import { SalesForecastPage } from './app/pages/SalesForecastPage';
import { MaterialRequestPage } from './app/pages/MaterialRequestPage';
import { ItemLeadTimePage } from './app/pages/ItemLeadTimePage';
import { DowntimeEntryPage } from './app/pages/DowntimeEntryPage';
import { MpsPage } from './app/pages/MpsPage';
import { BomUpdateToolPage } from './app/pages/BomUpdateToolPage';
import { BomCreatorPage } from './app/pages/BomCreatorPage';
import { ReportBomSearchPage } from './app/pages/ReportBomSearchPage';
import { ReportWorkOrderSummaryPage } from './app/pages/ReportWorkOrderSummaryPage';
import { ReportDowntimeAnalysisPage } from './app/pages/ReportDowntimeAnalysisPage';
import { ReportJobCardSummaryPage } from './app/pages/ReportJobCardSummaryPage';
import { ReportProductionAnalyticsPage } from './app/pages/ReportProductionAnalyticsPage';
import { ReportBomOperationsTimePage } from './app/pages/ReportBomOperationsTimePage';
import { ReportConsumedMaterialsPage } from './app/pages/ReportConsumedMaterialsPage';
import { ReportProductionPlanningPage } from './app/pages/ReportProductionPlanningPage';
import { ReportForecastingPage } from './app/pages/ReportForecastingPage';
import { WorkOrderPage } from './app/pages/WorkOrderPage';
import { SetupPage } from './app/pages/SetupPage';
import { ProductionPlanPage } from './app/pages/ProductionPlanPage';
import { ItemPricePage } from './app/pages/ItemPricePage';
import { StockEntryPage } from './app/pages/StockEntryPage';
import { StockLedgerPage } from './app/pages/StockLedgerPage';
import { QuotationPage } from './app/pages/QuotationPage';
type PageKey =
  | 'dashboard' | 'organization'
  | 'manufacturing' | 'planning' | 'sales_forecast' | 'material_request_mp' | 'item_lead_time' | 'downtime_entry' | 'mps' | 'bom_update_tool' | 'bom_creator' | 'report_bom_search' | 'report_work_order_summary' | 'report_downtime_analysis' | 'report_job_card_summary' | 'report_production_analytics' | 'report_bom_operations_time' | 'report_consumed_materials' | 'report_production_planning' | 'report_forecasting' | 'production_ops' | 'bom' | 'work_order' | 'workstation' | 'operation' | 'sub_contracting'
  | 'selling' | 'customer' | 'quotation' | 'sales_order' | 'delivery' | 'sales_invoice' | 'sales_partner' | 'sales_person'
  | 'buying' | 'supplier' | 'material' | 'request_for_quotation' | 'supplier_quotation' | 'purchase_order' | 'purchase_receipt' | 'purchase_invoice'
  | 'stock' | 'stock_entry' | 'stock_ledger' | 'stock_reconciliation' | 'serial_no' | 'batch' | 'item_price' | 'price_list'
  | 'accounts' | 'payment_entry' | 'balance_sheet' | 'profit_and_loss'
  | 'hr' | 'attendance' | 'leave_application'
  | 'auth'
  | 'reports' | 'settings';
type IconName =
  | 'grid' | 'building' | 'factory' | 'box' | 'cart' | 'selling' | 'chart' | 'settings'
  | 'menu' | 'chevron' | 'bell' | 'arrow' | 'more' | 'check' | 'clock' | 'alert' | 'layers' | 'close';
interface NavDoc { key: PageKey; icon: IconName; }
interface NavModule { key: PageKey; icon: IconName; docs: NavDoc[]; }
const TOP_LEVEL_ITEMS: ReadonlyArray<{ key: PageKey; icon: IconName }> = [
  { key: 'dashboard', icon: 'grid' },
  { key: 'organization', icon: 'building' },
];
const NAV_MODULES: ReadonlyArray<NavModule> = [
  {
    key: 'manufacturing', icon: 'factory',
    docs: [
      { key: 'planning', icon: 'clock' },
      { key: 'sales_forecast', icon: 'clock' },
      { key: 'material_request_mp', icon: 'clock' },
      { key: 'item_lead_time', icon: 'clock' },
      { key: 'downtime_entry', icon: 'clock' },
      { key: 'mps', icon: 'clock' },
      { key: 'bom_update_tool', icon: 'clock' },
      { key: 'bom_creator', icon: 'clock' },
      { key: 'bom', icon: 'layers' },
      { key: 'work_order', icon: 'factory' },
      { key: 'production_ops', icon: 'check' },
      { key: 'workstation', icon: 'factory' },
      { key: 'operation', icon: 'layers' },
      { key: 'sub_contracting', icon: 'cart' },
    ],
  },
  {
    key: 'selling', icon: 'selling',
    docs: [
      { key: 'quotation', icon: 'chart' },
      { key: 'customer', icon: 'building' },
      { key: 'sales_order', icon: 'selling' },
      { key: 'delivery', icon: 'cart' },
      { key: 'sales_invoice', icon: 'chart' },
      { key: 'sales_partner', icon: 'building' },
      { key: 'sales_person', icon: 'building' },
    ],
  },
  {
    key: 'buying', icon: 'cart',
    docs: [
      { key: 'supplier', icon: 'building' },
      { key: 'material', icon: 'box' },
      { key: 'request_for_quotation', icon: 'selling' },
      { key: 'supplier_quotation', icon: 'selling' },
      { key: 'purchase_order', icon: 'cart' },
      { key: 'purchase_receipt', icon: 'box' },
      { key: 'purchase_invoice', icon: 'chart' },
    ],
  },
  {
    key: 'stock', icon: 'box',
    docs: [
      { key: 'item_price', icon: 'chart' },
      { key: 'stock_entry', icon: 'box' },
      { key: 'stock_ledger', icon: 'layers' },
      { key: 'stock_entry', icon: 'box' },
      { key: 'stock_reconciliation', icon: 'check' },
      { key: 'serial_no', icon: 'layers' },
      { key: 'batch', icon: 'layers' },
      { key: 'price_list', icon: 'chart' },
    ],
  },
  {
    key: 'accounts', icon: 'building',
    docs: [
      { key: 'payment_entry', icon: 'chart' },
      { key: 'balance_sheet', icon: 'chart' },
      { key: 'profit_and_loss', icon: 'chart' },
    ],
  },
  {
    key: 'hr', icon: 'building',
    docs: [
      { key: 'attendance', icon: 'clock' },
      { key: 'leave_application', icon: 'clock' },
    ],
  },
  { key: 'auth', icon: 'building', docs: [] },
  { key: 'reports', icon: 'chart', docs: [
    { key: 'report_bom_search', icon: 'clock' },
    { key: 'report_work_order_summary', icon: 'clock' },
    { key: 'report_downtime_analysis', icon: 'clock' },
    { key: 'report_job_card_summary', icon: 'clock' },
    { key: 'report_production_analytics', icon: 'clock' },
    { key: 'report_bom_operations_time', icon: 'clock' },
    { key: 'report_consumed_materials', icon: 'clock' },
    { key: 'report_production_planning', icon: 'clock' },
    { key: 'report_forecasting', icon: 'clock' },
  ] },
];
const BOTTOM_ITEMS: ReadonlyArray<{ key: PageKey; icon: IconName }> = [
  { key: 'settings', icon: 'settings' },
];
const ALL_KEYS: PageKey[] = [
  ...TOP_LEVEL_ITEMS.map((i) => i.key),
  ...NAV_MODULES.flatMap((m) => [m.key, ...m.docs.map((d) => d.key)]),
  ...BOTTOM_ITEMS.map((i) => i.key),
];
const DEDICATED_PAGES: Partial<Record<PageKey, () => JSX.Element>> = {
  organization: OrganizationPage,
  manufacturing: ManufacturingPage,
  planning: ProductionPlanPage,
  production_ops: ProductionOpsPage,
  bom: BomPage,
  sales_forecast: SalesForecastPage,
  material_request_mp: MaterialRequestPage,
  item_lead_time: ItemLeadTimePage,
  downtime_entry: DowntimeEntryPage,
  mps: MpsPage,
  bom_update_tool: BomUpdateToolPage,
  bom_creator: BomCreatorPage,
  report_bom_search: ReportBomSearchPage,
  report_work_order_summary: ReportWorkOrderSummaryPage,
  report_downtime_analysis: ReportDowntimeAnalysisPage,
  report_job_card_summary: ReportJobCardSummaryPage,
  report_production_analytics: ReportProductionAnalyticsPage,
  report_bom_operations_time: ReportBomOperationsTimePage,
  report_consumed_materials: ReportConsumedMaterialsPage,
  report_production_planning: ReportProductionPlanningPage,
  report_forecasting: ReportForecastingPage,
  work_order: WorkOrderPage,
  workstation: SetupPage,
  operation: SetupPage,
  quotation: QuotationPage,
  item_price: ItemPricePage,
  stock_entry: StockEntryPage,
  stock_ledger: StockLedgerPage,
  selling: SalesPage,
  delivery: DeliveryPage,
  material: MaterialPage,
  stock: InventoryPage,
  accounts: AccountingPage,
  hr: HrPage,
  auth: AuthPage,
};
function Icon({ name, size = 18 }: { name: IconName; size?: number }): JSX.Element {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
  };
  switch (name) {
    case 'grid':
      return <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
    case 'building':
      return <svg {...props}><path d="M4 21V4.5L14 2v19M14 8h6v13M8 7h2M8 11h2M8 15h2M17 12h1M17 16h1M2 21h20" /></svg>;
    case 'factory':
      return <svg {...props}><path d="M3 21V9l6 3V8l6 3V6l6 3v12M3 21h18M7 17h2M12 17h2M17 17h2" /></svg>;
    case 'box':
      return <svg {...props}><path d="m3.5 7.5 8.5-4 8.5 4v9l-8.5 4-8.5-4v-9Z" /><path d="m3.5 7.5 8.5 4 8.5-4M12 11.5v9" /></svg>;
    case 'cart':
      return <svg {...props}><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 1.9-1.4L20.5 8H6" /><circle cx="9" cy="19" r="1.2" /><circle cx="17" cy="19" r="1.2" /></svg>;
    case 'selling':
      return <svg {...props}><path d="M4 19V5M4 19h17M8 15l3-4 3 2 5-6M16 7h3v3" /></svg>;
    case 'chart':
      return <svg {...props}><path d="M4 20V10M10 20V4M16 20v-7M22 20V7" /></svg>;
    case 'settings':
      return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.6V20a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.6-1H6v-2.6h.4A1.7 1.7 0 0 0 8 10a1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2H15V5a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v2.6H21a1.7 1.7 0 0 0-1.6 1Z" /></svg>;
    case 'menu':
      return <svg {...props}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
    case 'chevron':
      return <svg {...props}><path d="m9 18 6-6-6-6" /></svg>;
    case 'bell':
      return <svg {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>;
    case 'arrow':
      return <svg {...props}><path d="M5 12h13M13 6l6 6-6 6" /></svg>;
    case 'more':
      return <svg {...props}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></svg>;
    case 'check':
      return <svg {...props}><path d="m5 12 4 4L19 6" /></svg>;
    case 'clock':
      return <svg {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>;
    case 'alert':
      return <svg {...props}><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5M12 17.5v.2" /></svg>;
    case 'layers':
      return <svg {...props}><path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" /></svg>;
    case 'close':
      return <svg {...props}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  }
}
function pageFromPath(pathname: string): PageKey {
  const value = pathname.replace(/^\//, '').split('/')[0] as PageKey;
  return ALL_KEYS.includes(value) ? value : 'dashboard';
}
function Status({ tone, children }: { tone: 'success' | 'warning' | 'neutral'; children: string }): JSX.Element {
  return <span className={`status status--${tone}`}><i />{children}</span>;
}
function PanelTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: JSX.Element }): JSX.Element {
  return <div className="panel__head"><div><span className="panel__eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action}</div>;
}
function Dashboard({ onNavigate }: { onNavigate: (page: PageKey) => void }): JSX.Element {
  const { t } = useTranslation();
  const orderKeys = ['mo1048', 'mo1047', 'mo1046', 'mo1045'];
  const progress = [72, 48, 91, 34];
  const statusTones: ReadonlyArray<'success' | 'warning' | 'neutral'> = ['success', 'warning', 'success', 'neutral'];
  const kpiKeys = ['output', 'onTime', 'oee', 'quality'];
  const kpiIcons: ReadonlyArray<IconName> = ['factory', 'clock', 'chart', 'check'];
  const kpiTones = ['blue', 'green', 'purple', 'orange'];
  const kpiValues = ['1,248', '94.6%', '87.4%', '99.2%'];
  const trendValues = ['+12.8%', '+3.2%', '+5.1%', '+0.8%'];
  return <>
    <section className="page-intro"><div><span className="eyebrow">{t('dashboard.eyebrow')}</span><h1>{t('dashboard.title')}</h1><p>{t('dashboard.description')}</p></div><span className="demo-badge"><i />{t('dashboard.demoData')}</span></section>
    <section className="kpi-grid">{kpiKeys.map((key, index) => <article className="kpi" key={key}><span className={`kpi__icon kpi__icon--${kpiTones[index]}`}><Icon name={kpiIcons[index] ?? 'grid'} size={18} /></span><div><p>{t(`dashboard.kpis.${key}.label`)}</p><strong>{kpiValues[index]}</strong><small><b>{trendValues[index]}</b> {t(index === 0 ? 'dashboard.kpis.vsLastMonth' : 'dashboard.kpis.target')}</small></div></article>)}</section>
    <section className="dashboard-grid dashboard-grid--wide"><article className="panel"><PanelTitle eyebrow={t('dashboard.orders.eyebrow')} title={t('dashboard.orders.title')} action={<button className="link-button" onClick={() => onNavigate('manufacturing')}>{t('common.viewAll')}<Icon name="arrow" size={14} /></button>} /><div className="orders"><div className="orders__row orders__row--head"><span>{t('dashboard.orders.order')}</span><span>{t('dashboard.orders.product')}</span><span>{t('dashboard.orders.progress')}</span><span>{t('dashboard.orders.status')}</span></div>{orderKeys.map((key, index) => <div className="orders__row" key={key}><b className="order-id">{t(`dashboard.orders.rows.${key}.id`)}</b><span><b>{t(`dashboard.orders.rows.${key}.product`)}</b><small>{t(`dashboard.orders.rows.${key}.line`)}</small></span><span><i className="progress"><em style={{ inlineSize: `${progress[index]}%` }} /></i><small>{progress[index]}%</small></span><Status tone={statusTones[index] ?? 'neutral'}>{t(`dashboard.orders.rows.${key}.status`)}</Status></div>)}</div></article><article className="panel"><PanelTitle eyebrow={t('dashboard.inventory.eyebrow')} title={t('dashboard.inventory.title')} action={<button className="icon-button" aria-label={t('common.more')}><Icon name="more" /></button>} /><div className="inventory-list">{(['critical', 'low', 'healthy'] as const).map((key) => <div className="inventory-item" key={key}><span className={`inventory-icon inventory-icon--${key}`}><Icon name={key === 'healthy' ? 'check' : 'alert'} size={15} /></span><span><b>{t(`dashboard.inventory.${key}.name`)}</b><small>{t(`dashboard.inventory.${key}.meta`)}</small></span><strong>{t(`dashboard.inventory.${key}.count`)}</strong></div>)}</div><button className="panel-link" onClick={() => onNavigate('stock')}>{t('dashboard.inventory.manage')}<Icon name="arrow" size={14} /></button></article></section>
    <section className="dashboard-grid dashboard-grid--equal"><article className="panel"><PanelTitle eyebrow={t('dashboard.pipeline.eyebrow')} title={t('dashboard.pipeline.title')} /><div className="pipeline">{(['planned', 'inProgress', 'quality', 'completed'] as const).map((key, index) => <div className="pipeline__stage" key={key}><span className={`pipeline__node pipeline__node--${key}`}><Icon name={(['clock', 'factory', 'layers', 'check'] as ReadonlyArray<IconName>)[index] ?? 'clock'} size={14} /></span><b>{['18', '12', '8', '24'][index]}</b><small>{t(`dashboard.pipeline.${key}`)}</small></div>)}</div></article><article className="panel"><PanelTitle eyebrow={t('dashboard.workCenters.eyebrow')} title={t('dashboard.workCenters.title')} /><div className="work-centers">{(['assembly', 'machining', 'sterilization'] as const).map((key, index) => <div className="work-center" key={key}><span><i className={index === 2 ? 'dot dot--warning' : 'dot'} /><b>{t(`dashboard.workCenters.${key}`)}</b></span><i className="work-center__bar"><em style={{ inlineSize: `${[82, 68, 91][index]}%` }} /></i><small>{[82, 68, 91][index]}%</small></div>)}</div></article></section>
    <section className="dashboard-grid dashboard-grid--equal"><article className="panel"><PanelTitle eyebrow={t('dashboard.approvals.eyebrow')} title={t('dashboard.approvals.title')} action={<span className="count">3</span>} /><div className="approval-list">{(['purchase', 'change', 'quality'] as const).map((key) => <div className="approval" key={key}><span className="approval__avatar">{t(`dashboard.approvals.${key}.initials`)}</span><span><b>{t(`dashboard.approvals.${key}.title`)}</b><small>{t(`dashboard.approvals.${key}.meta`)}</small></span><button className="icon-button" aria-label={t('common.more')}><Icon name="more" /></button></div>)}</div></article><article className="panel"><PanelTitle eyebrow={t('dashboard.activity.eyebrow')} title={t('dashboard.activity.title')} action={<button className="link-button" onClick={() => onNavigate('reports')}>{t('common.viewAll')}<Icon name="arrow" size={14} /></button>} /><div className="activity-list">{(['completed', 'updated', 'alert'] as const).map((key) => <div className="activity" key={key}><span className={`activity__icon activity__icon--${key}`}><Icon name={key === 'completed' ? 'check' : key === 'alert' ? 'alert' : 'layers'} size={14} /></span><span><b>{t(`dashboard.activity.${key}.title`)}</b><small>{t(`dashboard.activity.${key}.meta`)}</small></span></div>)}</div></article></section>
  </>;
}
function ComingSoonPage({ page }: { page: PageKey }): JSX.Element {
  const { t } = useTranslation();
  return <section className="module-page"><div className="page-intro"><div><h1>{t(`navigation.${page}`)}</h1><p>{t('common.comingSoon')}</p></div></div></section>;
}
export function App(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState<PageKey>(() => pageFromPath(window.location.pathname));
  const [menuOpen, setMenuOpen] = useState(false);
  const [openModules, setOpenModules] = useState<Record<string, boolean>>(() => {
    const current = pageFromPath(window.location.pathname);
    const initial: Record<string, boolean> = {};
    for (const mod of NAV_MODULES) {
      if (mod.key === current || mod.docs.some((d) => d.key === current)) initial[mod.key] = true;
    }
    return initial;
  });
  const navigate = (next: PageKey): void => {
    window.history.pushState({}, '', next === 'dashboard' ? '/' : `/${next}`);
    setPage(next);
    setMenuOpen(false);
  };
  const Dedicated = DEDICATED_PAGES[page];
  return <div className="erp-app">
    <h1 className="visually-hidden">{t('app.name')}</h1><span className="visually-hidden" data-testid="direction">{directionOf(i18n.language)}</span>
    <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
      <div className="sidebar__brand"><span className="brand-mark"><i /><i /><i /></span><span className="brand-name"><b>Motion</b><small>ERP</small></span><button className="sidebar__close icon-button" onClick={() => setMenuOpen(false)} aria-label={t('common.close')}><Icon name="close" /></button></div>
      <p className="sidebar__label">{t('navigation.workspace')}</p>
      <nav className="sidebar__nav" aria-label={t('navigation.label')}>
        {TOP_LEVEL_ITEMS.map((item) => <button key={item.key} className={`nav-item ${page === item.key ? 'nav-item--active' : ''}`} onClick={() => navigate(item.key)}><Icon name={item.icon} /><span>{t(`navigation.${item.key}`)}</span>{page === item.key && <Icon name="chevron" size={14} />}</button>)}
        {NAV_MODULES.map((mod) => {
          const isActiveGroup = page === mod.key || mod.docs.some((d) => d.key === page);
          return <div key={mod.key}>
            <button className={`nav-item ${isActiveGroup ? 'nav-item--active' : ''}`} onClick={() => setOpenModules((o) => ({ ...o, [mod.key]: !o[mod.key] }))} aria-expanded={!!openModules[mod.key]}>
              <Icon name={mod.icon} /><span>{t(`navigation.${mod.key}`)}</span><Icon name="chevron" size={14} />
            </button>
            {openModules[mod.key] && <div className="nav-subgroup">
              <button className={`nav-item nav-item--sub ${page === mod.key ? 'nav-item--active' : ''}`} onClick={() => navigate(mod.key)}><Icon name={mod.icon} /><span>{t('common.overview')}</span></button>
              {mod.docs.map((d) => <button key={d.key} className={`nav-item nav-item--sub ${page === d.key ? 'nav-item--active' : ''}`} onClick={() => navigate(d.key)}><Icon name={d.icon} /><span>{t(`navigation.${d.key}`)}</span>{page === d.key && <Icon name="chevron" size={14} />}</button>)}
            </div>}
          </div>;
        })}
        {BOTTOM_ITEMS.map((item) => <button key={item.key} className={`nav-item ${page === item.key ? 'nav-item--active' : ''}`} onClick={() => navigate(item.key)}><Icon name={item.icon} /><span>{t(`navigation.${item.key}`)}</span>{page === item.key && <Icon name="chevron" size={14} />}</button>)}
      </nav>
      <div className="sidebar__bottom"><div className="help-card"><span className="help-card__icon"><Icon name="layers" size={16} /></span><b>{t('navigation.helpTitle')}</b><p>{t('navigation.helpText')}</p><button onClick={() => navigate('settings')}>{t('navigation.helpAction')}<Icon name="arrow" size={14} /></button></div><div className="system-status"><i />{t('navigation.systemOperational')}</div></div>
    </aside>
    <div className={`mobile-overlay ${menuOpen ? 'mobile-overlay--visible' : ''}`} onClick={() => setMenuOpen(false)} />
    <section className="app-main">
      <header className="topbar">
        <button className="mobile-menu icon-button" onClick={() => setMenuOpen(true)} aria-label={t('common.openMenu')}><Icon name="menu" /></button>
        <div className="breadcrumbs"><span>{t('app.name')}</span><Icon name="chevron" size={13} /><b>{t(`navigation.${page}`)}</b></div>
        <div className="topbar__actions">
          <button className="company-switcher"><span className="company-logo">M</span><span><b>{t('header.company')}</b><small>{t('header.companyMeta')}</small></span><Icon name="chevron" size={14} /></button>
          <span className="topbar-divider" />
          <label className="language-select"><span>ًںŒگ</span><select aria-label={t('app.language')} value={i18n.language} onChange={(event) => { void i18n.changeLanguage(event.target.value as SupportedLanguage); }}>{SUPPORTED_LANGUAGES.map((language) => <option key={language} value={language}>{t(`app.languageName.${language}`)}</option>)}</select></label>
          <button className="notification icon-button" aria-label={t('header.notifications')}><Icon name="bell" size={18} /><i /></button>
          <button className="profile"><span className="avatar">AS</span><span className="profile__copy"><b>{t('header.user')}</b><small>{t('header.role')}</small></span><Icon name="chevron" size={14} /></button>
        </div>
      </header>
      <main className="content">{page === 'dashboard' ? <Dashboard onNavigate={navigate} /> : Dedicated ? <Dedicated /> : <ComingSoonPage page={page} />}</main>
      <footer className="app-footer"><span>{t('footer.demo')} آ· <b>{t('footer.version')}</b></span><span>{t('footer.updated')}</span></footer>
    </section>
  </div>;
}





