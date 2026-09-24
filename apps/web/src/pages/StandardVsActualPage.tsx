import React, { useState } from 'react';
import { ArrowLeftRight, TrendingDown, TrendingUp, AlertTriangle, Printer } from 'lucide-react';

interface VarianceRow {
  id: string;
  item: string;
  type: 'material' | 'labor' | 'overhead';
  unit: string;
  standardQty: number;
  actualQty: number;
  qtyVariance: number; // الفرق في الكمية/الوقت
  standardCost: number;
  actualCost: number;
  costVariance: number; // الفرق المالي
}

export const StandardVsActualPage: React.FC = () => {
  const [_selectedWO, _setSelectedOrder] = useState('WO-2026-08112');
  const [showOnlyAlerts, setShowOnlyAlerts] = useState(false);

  // ── بيانات مقارنة فعلية لأمر تشغيل (20 وحدة درج وضلفة) ──
  const [variances] = useState<VarianceRow[]>([
    {
      id: 'v-1',
      item: 'صاج ستانلس 304 طبي 1.5 مم',
      type: 'material',
      unit: 'كجم',
      standardQty: 702, // المعياري شامل 8% هالك
      actualQty: 745, // الفعلي (حصل هدر صاج زيادة في ورشة الليزر)
      qtyVariance: -43, // عجز (هدر زيادة)
      standardCost: 129870,
      actualCost: 137825,
      costVariance: -7955, // تكلفة إضافية غير مخططة
    },
    {
      id: 'v-2',
      item: 'مواسير ستانلس 304 قطر 1.25 بوصة',
      type: 'material',
      unit: 'متر',
      standardQty: 126,
      actualQty: 120, // الفنيين وفروا في تقطيع المواسير
      qtyVariance: 6, // وفر (Favorable)
      standardCost: 17640,
      actualCost: 16800,
      costVariance: 840, // وفر مالي
    },
    {
      id: 'v-3',
      item: 'مواتير وبساتم هيدروليكية 400W',
      type: 'material',
      unit: 'طقم',
      standardQty: 20,
      actualQty: 20, // لا يوجد انحراف في الملحقات الثابتة
      qtyVariance: 0,
      standardCost: 90000,
      actualCost: 90000,
      costVariance: 0,
    },
    {
      id: 'v-4',
      item: 'زمن ماكينة الليزر فايبر (تقطيع صاج)',
      type: 'labor',
      unit: 'دقيقة',
      standardQty: 465,
      actualQty: 510, // الماكينة عطلت أثناء الشغل فزادت المدة
      qtyVariance: -45,
      standardCost: 5037.5,
      actualCost: 5525,
      costVariance: -487.5,
    },
    {
      id: 'v-5',
      item: 'زمن ثناية هيدروليكية CNC (تشكيل صاج)',
      type: 'labor',
      unit: 'دقيقة',
      standardQty: 390,
      actualQty: 360, // الفني كان سريع وأنجز التشكيل بدري
      qtyVariance: 30,
      standardCost: 2925,
      actualCost: 2700,
      costVariance: 225,
    },
    {
      id: 'v-6',
      item: 'زمن خط الدهان الإلكتروستاتيك والفرن',
      type: 'labor',
      unit: 'دقيقة',
      standardQty: 420,
      actualQty: 420,
      qtyVariance: 0,
      standardCost: 3850,
      actualCost: 3850,
      costVariance: 0,
    },
    {
      id: 'v-7',
      item: 'تحميل المصاريف غير المباشرة (Overhead)',
      type: 'overhead',
      unit: 'ج.م',
      standardQty: 1,
      actualQty: 1,
      qtyVariance: 0,
      standardCost: 62480,
      actualCost: 65120, // الفعلي زاد بسبب زيادة فاتورة كهرباء أغسطس
      costVariance: -2640,
    },
  ]);

  // ── الحسابات الإجمالية ──
  const totalStandard = variances.reduce((acc, r) => acc + r.standardCost, 0);
  const totalActual = variances.reduce((acc, r) => acc + r.actualCost, 0);
  const netCostVariance = totalStandard - totalActual; // الوفر أو العجز الإجمالي

  const getCostVarianceBadge = (val: number) => {
    if (val > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <TrendingDown className="w-3.5 h-3.5" /> وفر: {val.toLocaleString()} ج.م
        </span>
      );
    } else if (val < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
          <TrendingUp className="w-3.5 h-3.5" /> زيادة: {Math.abs(val).toLocaleString()} ج.م
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
          مطابق تماماً
        </span>
      );
    }
  };

  const getQtyVarianceStyle = (val: number) => {
    if (val > 0) return 'text-emerald-600 font-bold';
    if (val < 0) return 'text-rose-600 font-bold';
    return 'text-slate-500';
  };

  const filteredVariances = showOnlyAlerts
    ? variances.filter((v) => v.costVariance < 0)
    : variances;

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      {/* ── العنوان الرئيسي ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-600 text-white rounded-xl shadow-md">
            <ArrowLeftRight className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              مقارنة التكلفة المعيارية بالفعلية (Standard vs Actual)
            </h1>
            <p className="text-sm text-slate-500">
              تحليل الانحرافات اللحظي للمواد الخام، الأجور المباشرة، وساعات الماكينات لكشف مواطن
              الهدر بالمصنع
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow transition"
          >
            <Printer className="w-4 h-4" /> طباعة تقرير الانحرافات
          </button>
        </div>
      </div>

      {/* ── كروت تحليل الانحراف المالي الإجمالي ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            التكلفة المعيارية المقدرة
          </p>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">
            {totalStandard.toLocaleString()} ج.م
          </h3>
          <p className="text-xs text-slate-500 mt-1">المخطط له طبقاً لـ BOM وكروت التكلفة</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            التكلفة الفعلية المنصرفة
          </p>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">
            {totalActual.toLocaleString()} ج.م
          </h3>
          <p className="text-xs text-rose-600 font-medium mt-1">
            بزيادة قدرها {(((totalActual - totalStandard) / totalStandard) * 100).toFixed(1)}% عن
            المخطط
          </p>
        </div>

        <div
          className={`p-6 rounded-2xl border shadow-sm ${
            netCostVariance >= 0
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wider">
            صافي الانحراف الكلي للتشغيلة
          </p>
          <h3 className="text-3xl font-extrabold mt-2">
            {Math.abs(netCostVariance).toLocaleString()} ج.م
            {netCostVariance >= 0 ? ' (وفر)' : ' (عجز)'}
          </h3>
          <p className="text-xs mt-1 font-medium">
            {netCostVariance >= 0
              ? 'أداء ممتاز! تم توفير تكاليف مقارنة بالمستهدف'
              : 'تحذير: توجد زيادة في الهدر بالصاج أو أزمنة الماكينات'}
          </p>
        </div>
      </div>

      {/* ── لوحة التحكم والجدول ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">
              جدول مقارنة بنود التكلفة وتحليل الانحراف
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              مقارنة تفصيلية لكل بند منصرف مخزني أو مركز عمل صناعي
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-rose-800 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyAlerts}
                onChange={(e) => setShowOnlyAlerts(e.target.checked)}
                className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
              />
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              عرض بنود العجز فقط
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">البند الصناعي</th>
                <th className="p-4">نوع التكلفة</th>
                <th className="p-4 text-center">الوحدة</th>
                <th className="p-4 text-center">المعياري المخطط</th>
                <th className="p-4 text-center">الفعلي الحقيقي</th>
                <th className="p-4 text-center">انحراف الكمية</th>
                <th className="p-4">التكلفة المعيارية</th>
                <th className="p-4">التكلفة الفعلية</th>
                <th className="p-4">صافي الانحراف المالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVariances.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-4 font-semibold text-slate-800">{r.item}</td>
                  <td className="p-4">
                    {r.type === 'material' ? (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                        خامات صاج وإكسسوار
                      </span>
                    ) : r.type === 'labor' ? (
                      <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                        أزمنة ماكينات وعمالة
                      </span>
                    ) : (
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                        مصاريف غير مباشرة
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-center font-medium text-slate-500">{r.unit}</td>
                  <td className="p-4 text-center font-mono font-bold text-slate-700">
                    {r.standardQty.toLocaleString()}
                  </td>
                  <td className="p-4 text-center font-mono font-bold text-slate-900">
                    {r.actualQty.toLocaleString()}
                  </td>
                  <td className={`p-4 text-center font-mono ${getQtyVarianceStyle(r.qtyVariance)}`}>
                    {r.qtyVariance > 0
                      ? `+${r.qtyVariance}`
                      : r.qtyVariance < 0
                        ? r.qtyVariance
                        : '0'}
                  </td>
                  <td className="p-4 font-mono font-medium">
                    {r.standardCost.toLocaleString()} ج.م
                  </td>
                  <td className="p-4 font-mono font-medium">{r.actualCost.toLocaleString()} ج.م</td>
                  <td className="p-4">{getCostVarianceBadge(r.costVariance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StandardVsActualPage;
