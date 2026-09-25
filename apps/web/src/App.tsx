import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { directionOf } from './app/i18n/config';
import {
  AUTH_REQUIRED_EVENT,
  authApi,
  getAccessToken,
  setAccessToken,
  type SessionUser,
} from './app/api/client';
import { LoginDialog } from './app/components/LoginDialog';
import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  Boxes,
  ClipboardList,
  Factory,
  Cpu,
  ShieldCheck,
  Percent,
  TrendingUp,
  AlertOctagon,
  Landmark,
  Lock,
  ShieldAlert,
  Key,
  BookOpen,
  CreditCard,
  Scale,
  Menu,
  FileSpreadsheet,
  PackageCheck,
  Activity,
  ArrowLeftRight,
  GitBranch,
  Wrench,
  CalendarRange,
  Timer,
  FileBarChart,
  ListChecks,
  PackageSearch,
  ClipboardCheck,
  BarChart3,
  Users,
} from 'lucide-react';

// ── 1. الموديولات الرئيسية للسيستم ──
import { AccountingPage } from './app/pages/AccountingPage';
import { InventoryPage } from './app/pages/InventoryPage';
import { StockLedgerPage } from './app/pages/StockLedgerPage';
import { StockReconciliationPage } from './app/pages/StockReconciliationPage';
import { SalesInvoicePage } from './app/pages/SalesInvoicePage';
import { PurchaseOrderPage } from './app/pages/PurchaseOrderPage';
import { PaymentEntryPage } from './app/pages/PaymentEntryPage';
import { CostingPage } from './app/pages/CostingPage';
import { BalanceSheetPage } from './app/pages/BalanceSheetPage';
import { QualityPage } from './app/pages/QualityPage';
import { StockEntryPage } from './app/pages/StockEntryPage';
import { ProductionOpsPage } from './app/pages/ProductionOpsPage';
import { BomCreatorPage } from './app/pages/BomCreatorPage';
import { BatchTracePage } from './app/pages/BatchTracePage';
import { PlannedVsActualPage } from './app/pages/PlannedVsActualPage';
import TaxCustomsPage from './app/pages/TaxCustomsPage';
import YearEndClosingPage from './app/pages/YearEndClosingPage';
import AuditLogPage from './app/pages/AuditLogPage';
import UserRestrictionsPage from './app/pages/UserRestrictionsPage';
import RfqPage from './app/pages/RfqPage';
import ContactsPage from './app/pages/ContactsPage';
import SubcontractingPage from './app/pages/SubcontractingPage';
import { OverheadAllocationPage } from './app/pages/OverheadAllocationPage';
import { ProfitAndLossPage } from './app/pages/ProfitAndLossPage';
import { ExpensesPage } from './app/pages/ExpensesPage';
import { SalesPage } from './app/pages/SalesPage';
import { QuotationPage } from './app/pages/QuotationPage';
import { DeliveryPage } from './app/pages/DeliveryPage';
import { ItemPricePage } from './app/pages/ItemPricePage';
import { PurchaseReceiptPage } from './app/pages/PurchaseReceiptPage';
import { HrPage } from './app/pages/HrPage';
import { AttendancePage } from './app/pages/AttendancePage';
import { LeaveApplicationPage } from './app/pages/LeaveApplicationPage';
import { OrganizationPage } from './app/pages/OrganizationPage';
import { SetupPage } from './app/pages/SetupPage';
import { TechnicalPage } from './app/pages/TechnicalPage';
import { MaterialPage } from './app/pages/MaterialPage';
import { AuthPage } from './app/pages/AuthPage';
import { PageErrorBoundary } from './app/components/PageErrorBoundary';

// ── 2. شاشات التخطيط والتصنيع (الشغل الأصلي - ERPNext parity) ──
import { ManufacturingPage } from './app/pages/ManufacturingPage';
import { BomPage } from './app/pages/BomPage';
import { BomUpdateToolPage } from './app/pages/BomUpdateToolPage';
import { WorkOrderPage } from './app/pages/WorkOrderPage';
import { SalesForecastPage } from './app/pages/SalesForecastPage';
import { ProductionPlanPage } from './app/pages/ProductionPlanPage';
import { MpsPage } from './app/pages/MpsPage';
import { ItemLeadTimePage } from './app/pages/ItemLeadTimePage';
import { DowntimeEntryPage } from './app/pages/DowntimeEntryPage';
import { MaterialRequestPage } from './app/pages/MaterialRequestPage';

// ── 3. شاشات التقارير (9 تقارير - ERPNext parity) ──
import { ReportBomSearchPage } from './app/pages/ReportBomSearchPage';
import { ReportWorkOrderSummaryPage } from './app/pages/ReportWorkOrderSummaryPage';
import { ReportDowntimeAnalysisPage } from './app/pages/ReportDowntimeAnalysisPage';
import { ReportJobCardSummaryPage } from './app/pages/ReportJobCardSummaryPage';
import { ReportProductionAnalyticsPage } from './app/pages/ReportProductionAnalyticsPage';
import { ReportBomOperationsTimePage } from './app/pages/ReportBomOperationsTimePage';
import { ReportConsumedMaterialsPage } from './app/pages/ReportConsumedMaterialsPage';
import { ReportProductionPlanningPage } from './app/pages/ReportProductionPlanningPage';
import { ReportForecastingPage } from './app/pages/ReportForecastingPage';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  alert?: boolean;
}
interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('mfg-dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Language + direction follow i18n (AppProviders keeps <html dir/lang> in sync).
  const { t, i18n } = useTranslation();
  const direction = directionOf(i18n.language);

  // جلسة الدخول (بند 5.0): استرجاع المستخدم من التذكرة المحفوظة، وفتح نافذة الدخول لما السيرفر يطلبها.
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);

  useEffect(() => {
    if (getAccessToken()) {
      authApi
        .me()
        .then((res) => setSessionUser(res.user))
        .catch(() => setSessionUser(null));
    }
    const onAuthRequired = (): void => {
      setSessionUser(null);
      setLoginRequired(true);
      setLoginOpen(true);
    };
    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
  }, []);

  const logout = (): void => {
    setAccessToken(null);
    setSessionUser(null);
  };

  const menuSections: MenuSection[] = [
    {
      title: '1. المبيعات والعملاء (Sales & CRM)',
      items: [
        { id: 'sales-main', label: 'العملاء وأوامر البيع', icon: ShoppingCart },
        { id: 'quotations', label: 'عروض الأسعار', icon: ClipboardList },
        { id: 'sales-invoices', label: 'فواتير المبيعات', icon: ShoppingCart },
        { id: 'delivery', label: 'التسليم والتركيب', icon: PackageCheck },
        { id: 'item-prices', label: 'أسعار الأصناف', icon: Percent },
        { id: 'contacts', label: 'جهات الاتصال والعناوين', icon: ClipboardList },
      ],
    },
    {
      title: '2. المشتريات والموردين (Purchases)',
      items: [
        { id: 'purchase-orders', label: 'فواتير المشتريات والـ GRNI', icon: ShoppingBag },
        { id: 'rfq', label: 'طلبات عروض الأسعار (RFQ)', icon: ClipboardList },
        { id: 'purchase-receipts', label: 'أذون استلام المشتريات', icon: PackageCheck },
      ],
    },
    {
      title: '3. المخازن والتتبع الطبي (Inventory & Batches)',
      items: [
        { id: 'inventory-main', label: 'أرصدة ودليل المخازن', icon: Boxes },
        { id: 'stock-entries', label: 'أذون وحركات التحويل', icon: PackageCheck },
        { id: 'stock-ledger', label: 'السجل المالي للمخزون', icon: FileSpreadsheet },
        { id: 'stock-reconcile', label: 'الجرد الفعلي والتسويات', icon: Scale },
        { id: 'medical-trace', label: 'تتبع اللوطات والسيريال', icon: Activity },
        {
          id: 'medical-recall',
          label: 'غرفة الاستدعاء الطبي',
          icon: AlertOctagon,
        },
        { id: 'material-issues', label: 'صرف الخامات للإنتاج', icon: PackageSearch },
      ],
    },
    {
      title: '4. التخطيط والتصنيع (Planning & Manufacturing)',
      items: [
        {
          id: 'mfg-dashboard',
          label: 'نظرة عامة على التصنيع',
          icon: LayoutDashboard,
          badge: 'رئيسي',
        },
        { id: 'bom-main', label: 'قوائم المكونات BOM', icon: ListChecks },
        { id: 'bom-creator', label: 'منشئ الـ BOM والتكلفة', icon: ClipboardList },
        { id: 'bom-update-tool', label: 'أداة تحديث BOM', icon: Wrench },
        { id: 'technical', label: 'المستندات الفنية', icon: FileSpreadsheet },
        { id: 'work-order', label: 'أوامر التشغيل', icon: Factory },
        { id: 'production-ops', label: 'عمليات الورشة وبطاقات العمل', icon: GitBranch },
        { id: 'subcontracting', label: 'التصنيع بالباطن', icon: Factory },
        { id: 'sales-forecast', label: 'توقعات المبيعات', icon: TrendingUp },
        { id: 'production-plan', label: 'خطة الإنتاج', icon: CalendarRange },
        { id: 'mps', label: 'الجدول الرئيسي للإنتاج (MPS)', icon: CalendarRange },
        { id: 'item-lead-time', label: 'مهلة توريد الأصناف', icon: Timer },
        { id: 'material-request', label: 'طلبات المواد', icon: PackageSearch },
        { id: 'downtime-entry', label: 'تسجيل توقفات الإنتاج', icon: Timer },
        { id: 'quality-qc', label: 'فحص الجودة الطبية', icon: ShieldCheck },
      ],
    },
    {
      title: '5. التقارير (Reports)',
      items: [
        { id: 'report-bom-search', label: 'بحث BOM', icon: FileBarChart },
        { id: 'report-work-order-summary', label: 'ملخص أوامر التشغيل', icon: FileBarChart },
        { id: 'report-downtime-analysis', label: 'تحليل التوقفات', icon: FileBarChart },
        { id: 'report-job-card-summary', label: 'ملخص بطاقات العمل', icon: FileBarChart },
        { id: 'report-production-analytics', label: 'تحليلات الإنتاج', icon: BarChart3 },
        { id: 'report-bom-operations-time', label: 'زمن عمليات BOM', icon: FileBarChart },
        { id: 'report-consumed-materials', label: 'المواد المستهلكة', icon: FileBarChart },
        { id: 'report-production-planning', label: 'تقرير خطة الإنتاج', icon: ClipboardCheck },
        { id: 'report-forecasting', label: 'تقرير توقعات المبيعات', icon: BarChart3 },
      ],
    },
    {
      title: '6. التكاليف والربحية (Costing & Variances)',
      items: [
        { id: 'costing-general', label: 'تكلفة وربحية أوامر الشغل', icon: ClipboardList },
        { id: 'overhead-dashboard', label: 'مجمعات وتوزيع الأعباء', icon: Cpu },
        { id: 'std-vs-actual', label: 'المخطط مقابل الفعلي', icon: ArrowLeftRight },
      ],
    },
    {
      title: '7. المحاسبة والمالية (Accounting & Finance)',
      items: [
        { id: 'accounting-main', label: 'شجرة الحسابات والقيود', icon: BookOpen },
        { id: 'payments', label: 'سندات الصرف والقبض', icon: CreditCard },
        { id: 'balance-sheet', label: 'الميزانية والأصول الثابتة', icon: Scale },
        { id: 'profit-loss', label: 'قائمة الدخل', icon: TrendingUp },
        { id: 'expenses', label: 'المصروفات على أوامر الشغل', icon: CreditCard },
        { id: 'tax-customs', label: 'الضرائب والجمارك نموذج 41', icon: Landmark },
      ],
    },
    {
      title: '8. الإقفال والرقابة (Governance & Security)',
      items: [
        { id: 'closing-periods', label: 'إقفال الفترات والسنوات', icon: Lock },
        { id: 'users-roles', label: 'المستخدمين والأدوار', icon: Key },
        { id: 'user-restrictions', label: 'تقييد المستخدمين (فرع / مخزن)', icon: Lock },
        {
          id: 'audit-trail',
          label: 'سجل التدقيق الرقابي (Audit)',
          icon: ShieldAlert,
        },
      ],
    },
    {
      title: '9. الموارد البشرية (HR)',
      items: [
        { id: 'hr-main', label: 'الموظفين والعمولات والمرتبات', icon: Users },
        { id: 'attendance', label: 'الحضور والانصراف', icon: Timer },
        { id: 'leave', label: 'طلبات الإجازات', icon: CalendarRange },
      ],
    },
    {
      title: '10. الإعدادات (Setup)',
      items: [
        { id: 'organization', label: 'الهيكل التنظيمي', icon: GitBranch },
        { id: 'setup-mfg', label: 'مراكز العمل والعمليات', icon: Wrench },
      ],
    },
  ];

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800" dir={direction}>
      {/* ── Sidebar القائمة الجانبية الكبرى ── */}
      <aside
        className={`${
          sidebarOpen ? 'w-72' : 'w-20'
        } bg-slate-900 text-slate-200 transition-all duration-300 flex flex-col justify-between shadow-xl z-20 shrink-0`}
      >
        <div>
          {/* Logo */}
          <div className="p-4 flex items-center justify-between border-b border-slate-800">
            {sidebarOpen ? (
              <div>
                <h1 className="text-xl font-extrabold text-white tracking-wider flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="p-1.5 bg-teal-500 text-slate-900 rounded-lg text-sm"
                  >
                    M
                  </span>
                  {t('app.name')}
                </h1>
                <p className="text-[11px] text-teal-400 font-medium mt-0.5">
                  Enterprise v5.0 (All Modules)
                </p>
                <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                  {t('app.language')}
                  <select
                    className="bg-slate-800 text-slate-200 rounded px-1 py-0.5"
                    value={i18n.language}
                    onChange={(e) => void i18n.changeLanguage(e.target.value)}
                  >
                    <option value="ar">{t('app.languageName.ar')}</option>
                    <option value="en">{t('app.languageName.en')}</option>
                  </select>
                </label>
                <span data-testid="direction" hidden>
                  {direction}
                </span>
              </div>
            ) : (
              <span className="p-2 bg-teal-500 text-slate-900 rounded-lg font-bold mx-auto">M</span>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="p-3 space-y-5 overflow-y-auto max-h-[calc(100vh-130px)]">
            {menuSections.map((section, idx) => (
              <div key={idx} className="space-y-1">
                {sidebarOpen && (
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-teal-400 px-3 mb-1.5">
                    {section.title}
                  </h3>
                )}
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setCurrentTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition text-right cursor-pointer ${
                        isActive
                          ? 'bg-teal-600 text-white shadow-md'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : item.alert ? 'text-rose-400' : 'text-slate-400'}`}
                      />
                      {sidebarOpen && <span className="flex-1 truncate">{item.label}</span>}
                      {sidebarOpen && item.badge && (
                        <span className="text-[9px] bg-amber-400 text-slate-900 font-extrabold px-1.5 py-0.5 rounded">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-800 flex items-center gap-3 bg-slate-950/60">
          <div className="w-8 h-8 rounded-lg bg-teal-600/30 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold text-xs shrink-0">
            أد
          </div>
          {sidebarOpen && (
            <div className="flex-1 truncate">
              <p className="text-xs font-bold text-white">
                {sessionUser ? sessionUser.name : 'غير مسجّل الدخول'}
              </p>
              <p className="text-[10px] text-teal-400">
                {sessionUser ? sessionUser.role || '—' : 'Guest'}
              </p>
            </div>
          )}
          {sidebarOpen && (
            <button
              onClick={() => {
                if (sessionUser) {
                  logout();
                } else {
                  setLoginRequired(false);
                  setLoginOpen(true);
                }
              }}
              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
            >
              {sessionUser ? 'خروج' : 'دخول'}
            </button>
          )}
        </div>
      </aside>

      {/* ── مساحة عرض الشاشة المختارة (Main Workspace) ── */}
      <main className="flex-1 overflow-y-auto bg-slate-100">
        <PageErrorBoundary key={currentTab}>
          {/* 1. المبيعات والمشتريات */}
          {currentTab === 'sales-invoices' && <SalesInvoicePage />}
          {currentTab === 'purchase-orders' && <PurchaseOrderPage />}
          {currentTab === 'rfq' && <RfqPage />}
          {currentTab === 'sales-main' && <SalesPage />}
          {currentTab === 'quotations' && <QuotationPage />}
          {currentTab === 'delivery' && <DeliveryPage />}
          {currentTab === 'item-prices' && <ItemPricePage />}
          {currentTab === 'purchase-receipts' && <PurchaseReceiptPage />}
          {currentTab === 'material-issues' && <MaterialPage />}
          {currentTab === 'technical' && <TechnicalPage />}
          {currentTab === 'profit-loss' && <ProfitAndLossPage />}
          {currentTab === 'expenses' && <ExpensesPage />}
          {currentTab === 'users-roles' && <AuthPage />}
          {currentTab === 'hr-main' && <HrPage />}
          {currentTab === 'attendance' && <AttendancePage />}
          {currentTab === 'leave' && <LeaveApplicationPage />}
          {currentTab === 'organization' && <OrganizationPage />}
          {currentTab === 'setup-mfg' && <SetupPage />}
          {currentTab === 'contacts' && <ContactsPage />}

          {/* 2. المخازن والتتبع الطبي */}
          {currentTab === 'inventory-main' && <InventoryPage />}
          {currentTab === 'stock-entries' && <StockEntryPage />}
          {currentTab === 'stock-ledger' && <StockLedgerPage />}
          {currentTab === 'stock-reconcile' && <StockReconciliationPage />}
          {currentTab === 'medical-trace' && <BatchTracePage mode="trace" />}
          {currentTab === 'medical-recall' && <BatchTracePage mode="recall" />}

          {/* 3. التخطيط والتصنيع */}
          {currentTab === 'mfg-dashboard' && <ManufacturingPage />}
          {currentTab === 'bom-main' && <BomPage />}
          {currentTab === 'bom-creator' && <BomCreatorPage />}
          {currentTab === 'bom-update-tool' && <BomUpdateToolPage />}
          {currentTab === 'work-order' && <WorkOrderPage />}
          {currentTab === 'subcontracting' && <SubcontractingPage />}
          {currentTab === 'production-ops' && <ProductionOpsPage />}
          {currentTab === 'sales-forecast' && <SalesForecastPage />}
          {currentTab === 'production-plan' && <ProductionPlanPage />}
          {currentTab === 'mps' && <MpsPage />}
          {currentTab === 'item-lead-time' && <ItemLeadTimePage />}
          {currentTab === 'material-request' && <MaterialRequestPage />}
          {currentTab === 'downtime-entry' && <DowntimeEntryPage />}
          {currentTab === 'quality-qc' && <QualityPage />}

          {/* 4. التقارير */}
          {currentTab === 'report-bom-search' && <ReportBomSearchPage />}
          {currentTab === 'report-work-order-summary' && <ReportWorkOrderSummaryPage />}
          {currentTab === 'report-downtime-analysis' && <ReportDowntimeAnalysisPage />}
          {currentTab === 'report-job-card-summary' && <ReportJobCardSummaryPage />}
          {currentTab === 'report-production-analytics' && <ReportProductionAnalyticsPage />}
          {currentTab === 'report-bom-operations-time' && <ReportBomOperationsTimePage />}
          {currentTab === 'report-consumed-materials' && <ReportConsumedMaterialsPage />}
          {currentTab === 'report-production-planning' && <ReportProductionPlanningPage />}
          {currentTab === 'report-forecasting' && <ReportForecastingPage />}

          {/* 5. التكاليف والربحية */}
          {currentTab === 'std-vs-actual' && <PlannedVsActualPage />}
          {currentTab === 'overhead-dashboard' && <OverheadAllocationPage />}
          {currentTab === 'costing-general' && <CostingPage />}

          {/* 6. المحاسبة والضرائب */}
          {currentTab === 'accounting-main' && <AccountingPage />}
          {currentTab === 'payments' && <PaymentEntryPage />}
          {currentTab === 'balance-sheet' && <BalanceSheetPage />}
          {currentTab === 'tax-customs' && <TaxCustomsPage />}

          {/* 7. الإقفال والرقابة */}
          {currentTab === 'closing-periods' && <YearEndClosingPage />}
          {currentTab === 'audit-trail' && <AuditLogPage />}
          {currentTab === 'user-restrictions' && <UserRestrictionsPage />}
        </PageErrorBoundary>
      </main>

      {loginOpen && (
        <LoginDialog
          required={loginRequired}
          onLoggedIn={(user) => {
            setSessionUser(user);
            setLoginOpen(false);
            setLoginRequired(false);
          }}
          onClose={() => setLoginOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
