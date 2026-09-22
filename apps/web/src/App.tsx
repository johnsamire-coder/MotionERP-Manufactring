import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  Boxes,
  ClipboardList,
  Factory,
  Cpu,
  ShieldCheck,
  Calculator,
  ArrowLeftRight,
  Percent,
  TrendingUp,
  Activity,
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
} from 'lucide-react';

// ── 1. الموديولات الرئيسية للسيستم ──
import AccountingPage from './pages/AccountingPage';
import InventoryPage from './pages/InventoryPage';
import StockLedgerPage from './pages/StockLedgerPage';
import StockReconciliationPage from './pages/StockReconciliationPage';
import SalesInvoicePage from './pages/SalesInvoicePage';
import PurchaseOrderPage from './pages/PurchaseOrderPage';
import PaymentEntryPage from './pages/PaymentEntryPage';
import CostingPage from './pages/CostingPage';
import BalanceSheetPage from './pages/BalanceSheetPage';
import QualityPage from './pages/QualityPage';
import StockEntryPage from './pages/StockEntryPage';
import ProductionOpsPage from './pages/ProductionOpsPage';

// ── 2. موديولات التكاليف والضرائب والرقابة المستحدثة ──
import JobCostSheetPage from './pages/JobCostSheetPage';
import StandardVsActualPage from './pages/StandardVsActualPage';
import MaterialVariancePage from './pages/MaterialVariancePage';
import OrderProfitabilityPage from './pages/OrderProfitabilityPage';
import OverheadDashboardPage from './pages/OverheadDashboardPage';
import MedicalTraceabilityPage from './pages/MedicalTraceabilityPage';
import MedicalRecallPage from './pages/MedicalRecallPage';
import TaxAndCustomsPage from './pages/TaxAndCustomsPage';
import PeriodAndYearClosingPage from './pages/PeriodAndYearClosingPage';
import AuditTrailPage from './pages/AuditTrailPage';
import RbacPermissionsPage from './pages/RbacPermissionsPage';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('sales-invoices');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── القائمة الجانبية الشاملة لجميع الموديولات الـ 19 ──
  const menuSections = [
    {
      title: '1. المبيعات والعملاء (Sales & CRM)',
      items: [
        { id: 'sales-invoices', label: 'فواتير المبيعات', icon: ShoppingCart, badge: 'المبيعات' },
      ],
    },
    {
      title: '2. المشتريات والموردين (Purchases)',
      items: [
        { id: 'purchase-orders', label: 'فواتير المشتريات والـ GRNI', icon: ShoppingBag },
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
        { id: 'medical-recall', label: 'غرفة الاستدعاء الطبي', icon: AlertOctagon, alert: true },
      ],
    },
    {
      title: '4. الإنتاج والجودة (Manufacturing & QC)',
      items: [
        { id: 'production-ops', label: 'أوامر الشغل وعمليات الورشة', icon: Factory },
        { id: 'quality-qc', label: 'فحص الجودة الطبية', icon: ShieldCheck },
      ],
    },
    {
      title: '5. التكاليف والربحية (Costing & Variances)',
      items: [
        { id: 'job-cost', label: 'كارت التكلفة الفعلي', icon: Calculator, badge: 'رئيسي' },
        { id: 'std-vs-actual', label: 'المعياري vs الفعلي', icon: ArrowLeftRight },
        { id: 'material-variance', label: 'انحرافات المواد 4-Level', icon: Percent },
        { id: 'order-profitability', label: 'ربحية أوامر الشغل', icon: TrendingUp },
        { id: 'overhead-dashboard', label: 'مجمعات الـ Overhead', icon: Cpu },
        { id: 'costing-general', label: 'تحليلات التكاليف العامة', icon: ClipboardList },
      ],
    },
    {
      title: '6. المحاسبة والمالية (Accounting & Finance)',
      items: [
        { id: 'accounting-main', label: 'شجرة الحسابات والقيود', icon: BookOpen },
        { id: 'payments', label: 'سندات الصرف والقبض', icon: CreditCard },
        { id: 'balance-sheet', label: 'الميزانية والأصول الثابتة', icon: Scale },
        { id: 'tax-customs', label: 'الضرائب والجمارك نموذج 41', icon: Landmark },
      ],
    },
    {
      title: '7. الإقفال والرقابة (Governance & Security)',
      items: [
        { id: 'closing-periods', label: 'إقفال الفترات والسنوات', icon: Lock },
        { id: 'audit-trail', label: 'سجل التدقيق الرقابي (Audit)', icon: ShieldAlert },
        { id: 'rbac-matrix', label: 'مصفوفة الصلاحيات (RBAC)', icon: Key },
      ],
    },
  ];

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800" dir="rtl">
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
                  <span className="p-1.5 bg-teal-500 text-slate-900 rounded-lg text-sm">M</span>
                  Motion ERP
                </h1>
                <p className="text-[11px] text-teal-400 font-medium mt-0.5">Enterprise v5.0 (All Modules)</p>
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
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : item.alert ? 'text-rose-400' : 'text-slate-400'}`} />
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
              <p className="text-xs font-bold text-white">مدير النظام والمصنع</p>
              <p className="text-[10px] text-teal-400">Super Administrator</p>
            </div>
          )}
        </div>
      </aside>

      {/* ── مساحة عرض الشاشة المختارة (Main Workspace) ── */}
      <main className="flex-1 overflow-y-auto bg-slate-100">
        {/* 1. المبيعات والمشتريات */}
        {currentTab === 'sales-invoices' && <SalesInvoicePage />}
        {currentTab === 'purchase-orders' && <PurchaseOrderPage />}

        {/* 2. المخازن والتتبع الطبي */}
        {currentTab === 'inventory-main' && <InventoryPage />}
        {currentTab === 'stock-entries' && <StockEntryPage />}
        {currentTab === 'stock-ledger' && <StockLedgerPage />}
        {currentTab === 'stock-reconcile' && <StockReconciliationPage />}
        {currentTab === 'medical-trace' && <MedicalTraceabilityPage />}
        {currentTab === 'medical-recall' && <MedicalRecallPage />}

        {/* 3. التصنيع والجودة */}
        {currentTab === 'production-ops' && <ProductionOpsPage />}
        {currentTab === 'quality-qc' && <QualityPage />}

        {/* 4. التكاليف والربحية */}
        {currentTab === 'job-cost' && <JobCostSheetPage />}
        {currentTab === 'std-vs-actual' && <StandardVsActualPage />}
        {currentTab === 'material-variance' && <MaterialVariancePage />}
        {currentTab === 'order-profitability' && <OrderProfitabilityPage />}
        {currentTab === 'overhead-dashboard' && <OverheadDashboardPage />}
        {currentTab === 'costing-general' && <CostingPage />}

        {/* 5. المحاسبة والضرائب */}
        {currentTab === 'accounting-main' && <AccountingPage />}
        {currentTab === 'payments' && <PaymentEntryPage />}
        {currentTab === 'balance-sheet' && <BalanceSheetPage />}
        {currentTab === 'tax-customs' && <TaxAndCustomsPage />}

        {/* 6. الإقفال والرقابة */}
        {currentTab === 'closing-periods' && <PeriodAndYearClosingPage />}
        {currentTab === 'audit-trail' && <AuditTrailPage />}
        {currentTab === 'rbac-matrix' && <RbacPermissionsPage />}
      </main>
    </div>
  );
};

export default App;