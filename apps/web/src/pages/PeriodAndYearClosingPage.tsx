import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Layers,
  ArrowRightLeft,
  ShieldCheck,
  RotateCcw,
  DollarSign,
  Building2,
  Printer,
  TrendingUp,
  Award,
  Sparkles,
  Zap,
} from 'lucide-react';

interface PeriodItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed';
  isLocked: boolean;
  totalDebit: number;
  totalCredit: number;
}

export const PeriodAndYearClosingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'monthly' | 'annual' | 'opening'>('monthly');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [closingModalOpen, setClosingModalOpen] = useState(false);
  const [selectedPeriodToClose, setSelectedPeriodToClose] = useState<PeriodItem | null>(null);

  // ── شهور السنة الـ 12 ──
  const [periods, setPeriods] = useState<PeriodItem[]>([
    { id: 'p-1', name: 'يناير 2026', startDate: '2026-01-01', endDate: '2026-01-31', status: 'closed', isLocked: true, totalDebit: 1250000, totalCredit: 1250000 },
    { id: 'p-2', name: 'فبراير 2026', startDate: '2026-02-01', endDate: '2026-02-28', status: 'closed', isLocked: true, totalDebit: 1340000, totalCredit: 1340000 },
    { id: 'p-3', name: 'مارس 2026', startDate: '2026-03-01', endDate: '2026-03-31', status: 'closed', isLocked: true, totalDebit: 1420000, totalCredit: 1420000 },
    { id: 'p-4', name: 'أبريل 2026', startDate: '2026-04-01', endDate: '2026-04-30', status: 'closed', isLocked: true, totalDebit: 1390000, totalCredit: 1390000 },
    { id: 'p-5', name: 'مايو 2026', startDate: '2026-05-01', endDate: '2026-05-31', status: 'closed', isLocked: true, totalDebit: 1510000, totalCredit: 1510000 },
    { id: 'p-6', name: 'يونيو 2026', startDate: '2026-06-01', endDate: '2026-06-30', status: 'closed', isLocked: true, totalDebit: 1620000, totalCredit: 1620000 },
    { id: 'p-7', name: 'يوليو 2026', startDate: '2026-07-01', endDate: '2026-07-31', status: 'closed', isLocked: true, totalDebit: 1580000, totalCredit: 1580000 },
    { id: 'p-8', name: 'أغسطس 2026', startDate: '2026-08-01', endDate: '2026-08-31', status: 'open', isLocked: false, totalDebit: 1850420, totalCredit: 1850420 },
    { id: 'p-9', name: 'سبتمبر 2026', startDate: '2026-09-01', endDate: '2026-09-30', status: 'open', isLocked: false, totalDebit: 1200000, totalCredit: 1200000 },
    { id: 'p-10', name: 'أكتوبر 2026', startDate: '2026-10-01', endDate: '2026-10-31', status: 'open', isLocked: false, totalDebit: 0, totalCredit: 0 },
    { id: 'p-11', name: 'نوفمبر 2026', startDate: '2026-11-01', endDate: '2026-11-30', status: 'open', isLocked: false, totalDebit: 0, totalCredit: 0 },
    { id: 'p-12', name: 'ديسمبر 2026', startDate: '2026-12-01', endDate: '2026-12-31', status: 'open', isLocked: false, totalDebit: 0, totalCredit: 0 },
  ]);

  // ── معاينة الإقفال السنوي ──
  const annualSummary = {
    fiscalYear: '2026',
    totalRevenues: 4850000,
    totalCogs: 2950000,
    totalExpenses: 980000,
    totalCosts: 3930000,
    netProfit: 920000,
    retainedEarningsAccount: '3001 - الأرباح المرحلة والمحتجزة',
  };

  const handleClosePeriodAction = (period: PeriodItem) => {
    setPeriods((prev) =>
      prev.map((p) => (p.id === period.id ? { ...p, status: 'closed', isLocked: true } : p))
    );
    setClosingModalOpen(false);
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      {/* ── العنوان الرئيسي ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-900 text-white rounded-xl shadow-md">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">إقفال الفترات والسنوات المالية والقيود الافتتاحية</h1>
              <span className="bg-slate-100 text-slate-800 font-mono text-xs px-2.5 py-1 rounded-full font-bold">
                السنة المالية: {selectedYear}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              تجميد الفترات الدورية، تصفير حسابات الأرباح والخسائر، وتدوير الأرصدة للعام الجديد
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition"
          >
            <Printer className="w-4 h-4" /> طباعة شهادة الإقفال
          </button>
        </div>
      </div>

      {/* ── التبويبات الرئيسية ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 p-4 bg-slate-50/50 gap-2">
          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === 'monthly'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4" /> 1. إقفال الفترات الشهرية (Monthly Periods)
          </button>
          <button
            onClick={() => setActiveTab('annual')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === 'annual'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> 2. إقفال السنة المالية (Year-End Closing)
          </button>
          <button
            onClick={() => setActiveTab('opening')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === 'opening'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" /> 3. تدوير الأرصدة والقيود الافتتاحية
          </button>
        </div>

        {/* ── التبويب 1: إقفال الفترات الشهرية ── */}
        {activeTab === 'monthly' && (
          <div className="p-6 space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-blue-600" />
                <div>
                  <h4 className="font-bold text-blue-950 text-sm">سياسة الرقابة الصارمة لمنع التعديل بأثر رجعي</h4>
                  <p className="text-xs text-blue-700 mt-0.5">
                    إقفال الفترة يؤدي لتجميد القيود اليومية وحركات المخازن والفواتير الصادرة والواردة داخل الفترة فوراً.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {periods.map((p) => (
                <div
                  key={p.id}
                  className={`p-5 rounded-2xl border transition relative overflow-hidden ${
                    p.status === 'closed'
                      ? 'bg-slate-50 border-slate-200 text-slate-600'
                      : 'bg-white border-blue-300 shadow-sm ring-1 ring-blue-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-base text-slate-900">{p.name}</span>
                    {p.status === 'closed' ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-200 px-2.5 py-1 rounded-full">
                        <Lock className="w-3.5 h-3.5" /> مغلقة ومجمدة
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                        <Unlock className="w-3.5 h-3.5" /> فترة نشطة
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 space-y-1 mb-4">
                    <div>تاريخ البداية: <span className="font-mono">{p.startDate}</span></div>
                    <div>تاريخ النهاية: <span className="font-mono">{p.endDate}</span></div>
                    {p.totalDebit > 0 && (
                      <div className="pt-2 border-t border-slate-100 font-medium text-slate-800">
                        ميزان المراجعة: {p.totalDebit.toLocaleString()} ج.م
                      </div>
                    )}
                  </div>

                  {p.status === 'open' ? (
                    <button
                      onClick={() => {
                        setSelectedPeriodToClose(p);
                        setClosingModalOpen(true);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
                    >
                      <Lock className="w-3.5 h-3.5" /> تنفيذ الإقفال الشهري
                    </button>
                  ) : (
                    <button
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-medium transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> طلب إعادة الفتح (إدارة)
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── التبويب 2: إقفال السنة المالية ── */}
        {activeTab === 'annual' && (
          <div className="p-6 space-y-6">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-md space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-700 pb-4 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Award className="w-6 h-6 text-amber-400" />
                    <h3 className="text-xl font-bold">معاينة إقفال السنة المالية وتصفير حسابات النتيجة ({annualSummary.fiscalYear})</h3>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    سيتم تصفير الإيرادات والمصروفات بالكامل وترحيل صافي الربح إلى الأرباح المرحلة
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> فحص التوازن مكتمل 100%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">إجمالي إيرادات المبيعات</p>
                  <h4 className="text-xl font-bold text-slate-100">{annualSummary.totalRevenues.toLocaleString()} ج.م</h4>
                </div>

                <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">تكلفة البضاعة المباعة (COGS)</p>
                  <h4 className="text-xl font-bold text-amber-400">-{annualSummary.totalCogs.toLocaleString()} ج.م</h4>
                </div>

                <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">المصروفات العمومية والتشغيلية</p>
                  <h4 className="text-xl font-bold text-rose-400">-{annualSummary.totalExpenses.toLocaleString()} ج.م</h4>
                </div>

                <div className="p-4 bg-emerald-950/90 rounded-xl border border-emerald-500/50">
                  <p className="text-xs text-emerald-300 mb-1">صافي الأرباح المرحلة للأعوام القادمة</p>
                  <h4 className="text-2xl font-extrabold text-emerald-400">+{annualSummary.netProfit.toLocaleString()} ج.م</h4>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => alert('تم إقفال السنة المالية 2026 وترحيل 920,000 ج.م للأرباح المرحلة بنجاح!')}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md transition cursor-pointer"
                >
                  <Lock className="w-4 h-4" /> اعتماد قيد الإقفال السنوي النهائي
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── التبويب 3: تدوير الأرصدة والقيود الافتتاحية ── */}
        {activeTab === 'opening' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm gap-4">
              <div>
                <h4 className="font-bold text-slate-900 text-lg">تدوير أرصدة الميزانية العمومية للعام المالي الجديد (2027)</h4>
                <p className="text-sm text-slate-500 mt-0.5">
                  توليد القيد الافتتاحي المتوازن لنقل أرصدة البنوك، المخازن، العملاء، والموردين في 1 يناير
                </p>
              </div>

              <button
                onClick={() => alert('تم توليد وترحيل القيد الافتتاحي لعام 2027 بنجاح!')}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-sm transition"
              >
                <Sparkles className="w-4 h-4 text-amber-400" /> تدوير الأرصدة وتوليد القيد الافتتاحي
              </button>
            </div>

            {/* معاينة القيد الافتتاحي المتوازن */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
              <h5 className="font-bold text-slate-900 text-sm">مسودة القيد الافتتاحي المتوازن (1 يناير 2027):</h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {/* الأصول (مدين) */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between font-bold text-emerald-800 border-b pb-2">
                    <span>الجانب المدين (الأصول المنقولة)</span>
                    <span>5,560,000 ج.م</span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1.5">
                    <div className="flex justify-between"><span>أرصدة البنوك والخزينة</span><span>850,000 ج.م</span></div>
                    <div className="flex justify-between"><span>مخزون الصاج والمستلزمات</span><span>1,250,000 ج.م</span></div>
                    <div className="flex justify-between"><span>مخزون تام الصنع (أجهزة طبية)</span><span>620,000 ج.م</span></div>
                    <div className="flex justify-between"><span>مديونيات المستشفيات والعملاء</span><span>740,000 ج.م</span></div>
                    <div className="flex justify-between"><span>ماكينات الليزر والأصول الثابتة</span><span>2,100,000 ج.م</span></div>
                  </div>
                </div>

                {/* الالتزامات وحقوق الملكية (دائن) */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between font-bold text-blue-800 border-b pb-2">
                    <span>الجانب الدائن (الالتزامات + حقوق الملكية)</span>
                    <span>5,560,000 ج.م</span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1.5">
                    <div className="flex justify-between"><span>مجمع إهلاك الماكينات</span><span>420,000 ج.م</span></div>
                    <div className="flex justify-between"><span>مستحقات موردي الصلب والخامات</span><span>890,000 ج.م</span></div>
                    <div className="flex justify-between"><span>مستحقات مصلحة الضرائب</span><span>102,200 ج.م</span></div>
                    <div className="flex justify-between"><span>مخصص الضمان الطبي</span><span>125,000 ج.م</span></div>
                    <div className="flex justify-between"><span>رأس المال المدفوع</span><span>3,102,800 ج.م</span></div>
                    <div className="flex justify-between font-bold text-emerald-700"><span>الأرباح المرحلة من 2026</span><span>920,000 ج.م</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal تأكيد الإقفال الشهري ── */}
      {closingModalOpen && selectedPeriodToClose && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-right">
            <div className="flex items-center gap-3 text-slate-900 border-b pb-3">
              <Lock className="w-6 h-6 text-amber-600" />
              <h3 className="font-bold text-lg">تأكيد إقفال {selectedPeriodToClose.name}</h3>
            </div>

            <div className="text-sm text-slate-600 space-y-2">
              <p>هل أنت متأكد من رغبتك في إقفال وتجميد هذه الفترة المحاسبية؟</p>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" /> ميزان المراجعة متوازن بالكامل
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" /> تم إثبات إهلاك الأصول والماكينات
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" /> تم تسوية إقرار ضريبة القيمة المضافة 14%
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setClosingModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleClosePeriodAction(selectedPeriodToClose)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow transition"
              >
                تأكيد الإقفال والتجميد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PeriodAndYearClosingPage;