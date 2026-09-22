import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Percent,
  Printer,
  Download,
  Search,
  Filter,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Package,
} from 'lucide-react';

interface OrderProfitabilityRow {
  id: string;
  workOrderNumber: string;
  salesInvoiceNumber: string;
  customerName: string;
  productName: string;
  quantity: number;
  revenueEgp: number;
  actualMaterialCost: number;
  actualLaborCost: number;
  overheadCost: number;
  totalActualCost: number;
  netProfitEgp: number;
  netMarginPct: number;
  targetMarginPct: number;
  status: 'high_profit' | 'normal' | 'low_margin' | 'loss';
}

export const OrderProfitabilityPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // ── بيانات حقيقية لأوامر توريد المستشفيات ──
  const [orders] = useState<OrderProfitabilityRow[]>([
    {
      id: 'prof-1',
      workOrderNumber: 'WO-2026-08112',
      salesInvoiceNumber: 'SINV-2026-0189',
      customerName: 'مستشفى دار الفؤاد - 6 أكتوبر',
      productName: 'سرير عناية مركزة كهربائي 5 حركات Motion-ICU',
      quantity: 20,
      revenueEgp: 470000,
      actualMaterialCost: 281030,
      actualLaborCost: 19894,
      overheadCost: 75231,
      totalActualCost: 376155,
      netProfitEgp: 93845,
      netMarginPct: 20.0, // انخفضت من 25% بسبب هالك الصاج
      targetMarginPct: 25.0,
      status: 'normal',
    },
    {
      id: 'prof-2',
      workOrderNumber: 'WO-2026-08115',
      salesInvoiceNumber: 'SINV-2026-0194',
      customerName: 'مستشفى السلام الدولي بالمعادي',
      productName: 'ترولي نقل مرضى وعمليات صاج ستانلس 304',
      quantity: 15,
      revenueEgp: 185000,
      actualMaterialCost: 95000,
      actualLaborCost: 8500,
      overheadCost: 25875,
      totalActualCost: 129375,
      netProfitEgp: 55625,
      netMarginPct: 30.1, // أداء ممتاز وتوفير في الهدر
      targetMarginPct: 25.0,
      status: 'high_profit',
    },
    {
      id: 'prof-3',
      workOrderNumber: 'WO-2026-08120',
      salesInvoiceNumber: 'SINV-2026-0201',
      customerName: 'معهد ناصر للبحوث والعلاج',
      productName: 'دولاب صيدلية أدوية مخدرة مزدوج القفل صاج معالج',
      quantity: 10,
      revenueEgp: 95000,
      actualMaterialCost: 62000,
      actualLaborCost: 7200,
      overheadCost: 17300,
      totalActualCost: 86500,
      netProfitEgp: 8500,
      netMarginPct: 8.9, // هامش ربح ضعيف بسبب استبدال خامات مستوردة
      targetMarginPct: 22.0,
      status: 'low_margin',
    },
    {
      id: 'prof-4',
      workOrderNumber: 'WO-2026-08128',
      salesInvoiceNumber: 'SINV-2026-0210',
      customerName: 'مستشفى الجلاء العسكري',
      productName: 'طاولة عمليات هيدروليكية صاج ستانلس 316',
      quantity: 4,
      revenueEgp: 320000,
      actualMaterialCost: 165000,
      actualLaborCost: 18000,
      overheadCost: 45750,
      totalActualCost: 228750,
      netProfitEgp: 91250,
      netMarginPct: 28.5,
      targetMarginPct: 25.0,
      status: 'high_profit',
    },
  ]);

  // ── الإجماليات العامة ──
  const totalRevenue = orders.reduce((sum, o) => sum + o.revenueEgp, 0);
  const totalActualCost = orders.reduce((sum, o) => sum + o.totalActualCost, 0);
  const totalNetProfit = totalRevenue - totalActualCost;
  const overallMarginPct = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;

  const getStatusBadge = (status: OrderProfitabilityRow['status'], marginPct: number) => {
    switch (status) {
      case 'high_profit':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <ArrowUpRight className="w-3.5 h-3.5" /> ربحية عالية ({marginPct.toFixed(1)}%)
          </span>
        );
      case 'normal':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> متوافق مع المستهدف ({marginPct.toFixed(1)}%)
          </span>
        );
      case 'low_margin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" /> هامش منخفض ({marginPct.toFixed(1)}%)
          </span>
        );
      case 'loss':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <TrendingDown className="w-3.5 h-3.5" /> تشغيلة خاسرة ({marginPct.toFixed(1)}%)
          </span>
        );
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchSearch =
      o.workOrderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.productName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      {/* ── العنوان الرئيسي ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md">
            <TrendingUp className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">لوحة ربحية أوامر الشغل وهوامش المبيعات (Order Profitability)</h1>
            <p className="text-sm text-slate-500">
              تحليل الربح الفعلي لكل أمر شغل بعد استبعاد تكلفة الصاج والعمالة والـ Overhead
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow transition"
          >
            <Printer className="w-4 h-4" /> طباعة تقرير الأرباح
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-semibold shadow transition">
            <Download className="w-4 h-4" /> تصدير Excel
          </button>
        </div>
      </div>

      {/* ── كروت مؤشرات الربحية العامة ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase">إجمالي إيرادات المبيعات</p>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">{totalRevenue.toLocaleString()} ج.م</h3>
          <span className="text-xs text-blue-600 font-medium">صافي الفواتير الصادرة للعملاء</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase">إجمالي التكلفة الصناعية الفعلية</p>
            <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">{totalActualCost.toLocaleString()} ج.م</h3>
          <span className="text-xs text-slate-500 font-medium">خامات + تشغيل ماكينات + OH</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase">إجمالي الأرباح الصناعية المحققة</p>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-emerald-700 mt-2">+{totalNetProfit.toLocaleString()} ج.م</h3>
          <span className="text-xs text-emerald-600 font-medium">صافي العائد بعد كل المصروفات</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase">متوسط هامش الربح الكلي</p>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-purple-700 mt-2">{overallMarginPct.toFixed(1)}%</h3>
          <span className="text-xs text-purple-600 font-medium">المستهدف المعياري: 25.0%</span>
        </div>
      </div>

      {/* ── لوحة الفلترة والبحث ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              الكل ({orders.length})
            </button>
            <button
              onClick={() => setStatusFilter('high_profit')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'high_profit' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              ربحية عالية ({orders.filter((o) => o.status === 'high_profit').length})
            </button>
            <button
              onClick={() => setStatusFilter('low_margin')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'low_margin' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              هوامش منخفضة ({orders.filter((o) => o.status === 'low_margin').length})
            </button>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="بحث برقم الأمر، العميل، المنتج..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
          </div>
        </div>

        {/* ── جدول ربحية أوامر الشغل ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">أمر الشغل والفاتورة</th>
                <th className="p-4">العميل والمستشفى</th>
                <th className="p-4">المنتج والكمية</th>
                <th className="p-4">الإيراد المحقق</th>
                <th className="p-4">التكلفة الفعلية</th>
                <th className="p-4">صافي الربح الفعلي</th>
                <th className="p-4 text-center">الهامش الفعلي vs المستهدف</th>
                <th className="p-4">تقييم الربحية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-4">
                    <p className="font-mono font-bold text-slate-900">{o.workOrderNumber}</p>
                    <p className="font-mono text-xs text-slate-400 mt-0.5">{o.salesInvoiceNumber}</p>
                  </td>
                  <td className="p-4 font-semibold text-slate-800">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      {o.customerName}
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="font-medium text-slate-900">{o.productName}</p>
                    <span className="text-xs text-slate-500 font-mono font-bold">{o.quantity} وحدة</span>
                  </td>
                  <td className="p-4 font-mono font-bold text-slate-900">{o.revenueEgp.toLocaleString()} ج.م</td>
                  <td className="p-4 font-mono text-slate-600">{o.totalActualCost.toLocaleString()} ج.م</td>
                  <td className="p-4 font-mono font-bold text-emerald-700">+{o.netProfitEgp.toLocaleString()} ج.م</td>
                  <td className="p-4 text-center">
                    <div className="font-bold text-slate-900 font-mono">{o.netMarginPct.toFixed(1)}%</div>
                    <div className="text-[11px] text-slate-400 font-mono">مستهدف: {o.targetMarginPct.toFixed(1)}%</div>
                  </td>
                  <td className="p-4">{getStatusBadge(o.status, o.netMarginPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OrderProfitabilityPage;