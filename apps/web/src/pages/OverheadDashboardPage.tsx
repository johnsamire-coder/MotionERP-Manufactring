import React, { useState } from 'react';
import {
  Factory,
  Zap,
  Users,
  Wrench,
  Building,
  Calculator,
  Printer,
  Download,
  Percent,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Layers,
} from 'lucide-react';

interface OverheadPool {
  id: string;
  code: string;
  name: string;
  allocationBasis: 'machine_hours' | 'labor_hours' | 'direct_cost_pct';
  allocationBasisLabel: string;
  periodActualCost: number;     // المصروف الفعلي في أغسطس
  appliedToProduction: number;   // المحمّل فعلياً على أوامر الشغل
  absorptionVariance: number;    // فرق التحميل (Over / Under Absorption)
  ratePerUnit: number;           // معدل التحميل المحسوب
  rateUnitLabel: string;
}

export const OverheadDashboardPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState('أغسطس 2026');

  // ── مجمعات التكاليف الفعلية لشهر أغسطس (طبقاً لشيت العميل) ──
  const [pools] = useState<OverheadPool[]>([
    {
      id: 'pool-1',
      code: 'OH-ELEC-01',
      name: 'كهرباء وطاقة صالة التصنيع والأفران',
      allocationBasis: 'machine_hours',
      allocationBasisLabel: 'ساعات تشغيل الماكينات (Machine Hours)',
      periodActualCost: 85000,
      appliedToProduction: 88400,
      absorptionVariance: 3400, // Over-applied (وفر تحميل)
      ratePerUnit: 185,         // 185 ج.م لكل ساعة تشغيل ماكينة
      rateUnitLabel: 'ج.م / ساعة ماكينة',
    },
    {
      id: 'pool-2',
      code: 'OH-SUP-02',
      name: 'مرتبات الإشراف الهندسي ومراقبة الجودة الطبية',
      allocationBasis: 'labor_hours',
      allocationBasisLabel: 'ساعات العمالة المباشرة (Direct Labor Hours)',
      periodActualCost: 110000,
      appliedToProduction: 104500,
      absorptionVariance: -5500, // Under-applied (عجز تحميل)
      ratePerUnit: 95,           // 95 ج.م لكل ساعة عمل مباشر
      rateUnitLabel: 'ج.م / ساعة عامل',
    },
    {
      id: 'pool-3',
      code: 'OH-DEPR-03',
      name: 'إهلاك وصيانة ماكينات الليزر والثنايات CNC',
      allocationBasis: 'machine_hours',
      allocationBasisLabel: 'ساعات تشغيل الماكينات (Machine Hours)',
      periodActualCost: 65000,
      appliedToProduction: 65000,
      absorptionVariance: 0,
      ratePerUnit: 140,
      rateUnitLabel: 'ج.م / ساعة ماكينة',
    },
    {
      id: 'pool-4',
      code: 'OH-RENT-04',
      name: 'إيجار مباني المصنع والمنافع العامة والمياه',
      allocationBasis: 'direct_cost_pct',
      allocationBasisLabel: 'نسبة من التكلفة المباشرة (Direct Cost %)',
      periodActualCost: 75000,
      appliedToProduction: 72000,
      absorptionVariance: -3000,
      ratePerUnit: 7.5, // 7.5% من التكلفة المباشرة
      rateUnitLabel: '% من التكلفة المباشرة',
    },
  ]);

  // ── الإجماليات ──
  const totalActualOH = pools.reduce((acc, p) => acc + p.periodActualCost, 0);
  const totalAppliedOH = pools.reduce((acc, p) => acc + p.appliedToProduction, 0);
  const netAbsorptionVariance = totalAppliedOH - totalActualOH;

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      {/* ── الرأس الرئيسي ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md">
            <Factory className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">إدارة التكاليف غير المباشرة ومجمعات التحميل (Overhead Dashboard)</h1>
              <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-1 rounded-full">
                {selectedMonth}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              متابعة مجمعات مصاريف الكهرباء، الإشراف، الإهلاك، وسياسات التوزيع والتحميل على أوامر الشغل
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow transition"
          >
            <Printer className="w-4 h-4" /> طباعة تقرير التحميل
          </button>
        </div>
      </div>

      {/* ── كروت المؤشرات العامة (KPIs) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase">المصروف الفعلي (Actual OH)</p>
            <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">{totalActualOH.toLocaleString()} ج.م</h3>
          <span className="text-xs text-slate-500 font-medium">إجمالي المصروفات الدفترية للشهر</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase">المحمل على الإنتاج (Applied OH)</p>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-indigo-700 mt-2">{totalAppliedOH.toLocaleString()} ج.م</h3>
          <span className="text-xs text-indigo-600 font-medium">تم امتصاصه في تكلفة أوامر الشغل</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase">صافي فرق التحميل (Variance)</p>
            <div className={`p-2.5 rounded-xl ${netAbsorptionVariance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              {netAbsorptionVariance >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
          </div>
          <h3 className={`text-2xl font-bold mt-2 ${netAbsorptionVariance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {Math.abs(netAbsorptionVariance).toLocaleString()} ج.م
          </h3>
          <span className="text-xs font-medium text-slate-500">
            {netAbsorptionVariance >= 0 ? 'Over-Applied (وفر تحميل)' : 'Under-Applied (عجز تحميل)'}
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase">مجمعات التكلفة النشطة</p>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Sliders className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-amber-700 mt-2">{pools.length} مجمعات</h3>
          <span className="text-xs text-amber-600 font-medium">تغطي كافة أقسام المصنع</span>
        </div>
      </div>

      {/* ── جدول مجمعات التكاليف وسياسات التوزيع ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">مجمعات التكاليف غير المباشرة (Cost Pools & Allocation Drivers)</h3>
            <p className="text-xs text-slate-500 mt-1">معدلات التحميل المحسوبة طبقاً لساعات التشغيل والعمالة المباشرة</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">كود واسم المجمع</th>
                <th className="p-4">أساس التوزيع والتحميل (Driver)</th>
                <th className="p-4">معدل التحميل المحسوب</th>
                <th className="p-4">المصروف الفعلي</th>
                <th className="p-4">المحمل على أوامر الشغل</th>
                <th className="p-4">فرق الامتصاص (Absorption Variance)</th>
                <th className="p-4 text-center">حالة التحميل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pools.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-4">
                    <p className="font-semibold text-slate-900">{p.name}</p>
                    <span className="text-xs font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 mt-1 inline-block">
                      {p.code}
                    </span>
                  </td>
                  <td className="p-4 text-slate-700">
                    <div className="flex items-center gap-1.5">
                      {p.allocationBasis === 'machine_hours' ? (
                        <Zap className="w-4 h-4 text-amber-500" />
                      ) : p.allocationBasis === 'labor_hours' ? (
                        <Users className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Building className="w-4 h-4 text-purple-500" />
                      )}
                      <span>{p.allocationBasisLabel}</span>
                    </div>
                  </td>
                  <td className="p-4 font-mono font-bold text-indigo-700">
                    {p.ratePerUnit} {p.rateUnitLabel}
                  </td>
                  <td className="p-4 font-mono font-medium">{p.periodActualCost.toLocaleString()} ج.م</td>
                  <td className="p-4 font-mono font-bold text-slate-900">{p.appliedToProduction.toLocaleString()} ج.م</td>
                  <td className="p-4 font-mono font-bold">
                    {p.absorptionVariance > 0 ? (
                      <span className="text-emerald-700">+{p.absorptionVariance.toLocaleString()} ج.م (وفر)</span>
                    ) : p.absorptionVariance < 0 ? (
                      <span className="text-rose-700">{p.absorptionVariance.toLocaleString()} ج.م (عجز)</span>
                    ) : (
                      <span className="text-slate-500">0 ج.م (متوازن)</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {p.absorptionVariance >= 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" /> تحميل كافي
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        <AlertCircle className="w-3.5 h-3.5" /> عجز تحميل
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OverheadDashboardPage;