import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Printer,
  Percent,
  Layers,
  ShoppingBag,
  Scissors,
  Shuffle,
} from 'lucide-react';

interface MaterialVarianceRecord {
  id: string;
  materialName: string;
  // 1. انحراف السعر
  priceStandard: number;
  priceActual: number;
  qtyActual: number;
  priceVariance: number;
  // 2. انحراف الاستخدام
  qtyStandard: number;
  qtyActualUsed: number;
  qtyVarianceAmount: number;
  // 3. انحراف الإحلال
  substitutionImpact: number;
  substitutedWith?: string;
  // 4. انحراف الهالك غير المخطط
  standardScrapPct: number;
  actualScrapPct: number;
  scrapVarianceAmount: number;

  netTotalVariance: number;
}

export const MaterialVariancePage: React.FC = () => {
  const [_selectedWO] = useState('WO-2026-08112');

  // ── بيانات حقيقية من صالة الإنتاج والاشتريات (تشكيل الصاج) ──
  const [records] = useState<MaterialVarianceRecord[]>([
    {
      id: 'mv-1',
      materialName: 'صاج ستانلس 304 طبي 1.5 مم',
      priceStandard: 185,
      priceActual: 190, // اشرينا أغلى بـ 5 جنيه للكيلو
      qtyActual: 745,
      priceVariance: -3725, // (185 - 190) * 745 = -3725 (عجز سعر)

      qtyStandard: 702,
      qtyActualUsed: 745,
      qtyVarianceAmount: -7955, // عجز استخدام بسبب زيادة المنصرف

      substitutionImpact: 0, // لم يتم استبداله

      standardScrapPct: 8,
      actualScrapPct: 11.5, // الهالك الفعلي زاد لـ 11.5% بسبب عطل في الليزر
      scrapVarianceAmount: -4810, // هدر غير مخطط

      netTotalVariance: -16490,
    },
    {
      id: 'mv-2',
      materialName: 'مواسير ستانلس 304 قطر 1.25 بوصة',
      priceStandard: 140,
      priceActual: 135, // وفرنا 5 جنيه في المتر عند الشراء
      qtyActual: 120,
      priceVariance: 600, // وفر سعر

      qtyStandard: 126,
      qtyActualUsed: 120,
      qtyVarianceAmount: 840, // وفر استخدام

      substitutionImpact: 0,

      standardScrapPct: 5,
      actualScrapPct: 4.8, // الهالك مطابق للمعياري
      scrapVarianceAmount: 28,

      netTotalVariance: 1468,
    },
    {
      id: 'mv-3',
      materialName: 'علبة دهان بودرة إلكتروستاتيك طلي',
      priceStandard: 220,
      priceActual: 220,
      qtyActual: 66,
      priceVariance: 0,

      qtyStandard: 66,
      qtyActualUsed: 66,
      qtyVarianceAmount: 0,

      substitutionImpact: -1500, // اضطرينا نستخدم بودرة دهان ألماني لعدم توفر التركي
      substitutedWith: 'بودرة دهان جوتن ألماني مستورد',

      standardScrapPct: 10,
      actualScrapPct: 10,
      scrapVarianceAmount: 0,

      netTotalVariance: -1500,
    },
  ]);

  const getStatusIcon = (value: number) => {
    if (value >= 0) return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
    return <AlertTriangle className="w-5 h-5 text-rose-600 animate-pulse" />;
  };

  const getVarianceTextClass = (value: number) => {
    if (value > 0) return 'text-emerald-600 font-bold';
    if (value < 0) return 'text-rose-600 font-bold';
    return 'text-slate-500 font-medium';
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      {/* ── العنوان الرئيسي ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-700 text-white rounded-xl shadow-md">
            <Percent className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              انحرافات المواد على المستويات الأربعة (4-Level Variance)
            </h1>
            <p className="text-sm text-slate-500">
              تفكيك الانحراف الكلي للمواد لتحديد الهدر الدقيق الناتج عن الأسعار، الاستخدام، الإحلال،
              وهالك الليزر والصاج
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow transition">
            <Printer className="w-4 h-4" /> طباعة تقرير التحليل
          </button>
        </div>
      </div>

      {/* ── شرح المستويات الأربعة لمدير المصنع ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-500" />
          <div className="flex items-center gap-2 text-blue-700 font-bold mb-2">
            <ShoppingBag className="w-5 h-5" />
            <h4>1. انحراف السعر</h4>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            الفرق المالي الناتج عن تغير سعر شراء الطن أو القطعة من المورد مقارنة بالتكلفة المعيارية.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-purple-500" />
          <div className="flex items-center gap-2 text-purple-700 font-bold mb-2">
            <Layers className="w-5 h-5" />
            <h4>2. انحراف الاستخدام</h4>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            الفرق المالي الناتج عن زيادة أو نقصان استهلاك الأمتار أو الكيلوجرامات من الصاج بالورشة.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-amber-500" />
          <div className="flex items-center gap-2 text-amber-700 font-bold mb-2">
            <Shuffle className="w-5 h-5" />
            <h4>3. انحراف الإحلال</h4>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            الفرق المالي الناتج عن استخدام صنف بديل بمواصفة مختلفة لعدم توفر الخامة الأساسية
            بالمخزن.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-rose-500" />
          <div className="flex items-center gap-2 text-rose-700 font-bold mb-2">
            <Scissors className="w-5 h-5" />
            <h4>4. انحراف الهالك</h4>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            الفرق المالي الناتج عن تخطي نسبة الهالك المعيارية المسموح بها في مقطوعية الليزر وتشكيل
            الصاج.
          </p>
        </div>
      </div>

      {/* ── لوحة التحليلات والجدول الرئيسي ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-slate-50/50">
          <h3 className="font-bold text-slate-900 text-lg">
            تحليل الانحراف الرباعي التفصيلي للمواد
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            تفكيك كامل للتكلفة لمعرفة مسببي العجز أو الوفر بدقة
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">اسم المادة الخام</th>
                <th className="p-4">انحراف السعر (Price)</th>
                <th className="p-4">انحراف الاستخدام (Usage)</th>
                <th className="p-4">انحراف الإحلال (Subst.)</th>
                <th className="p-4">انحراف الهالك (Yield)</th>
                <th className="p-4">صافي الانحراف الكلي</th>
                <th className="p-4 text-center">مؤشر الفحص</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition">
                  {/* المادة الخام */}
                  <td className="p-4">
                    <p className="font-semibold text-slate-900">{r.materialName}</p>
                    {r.substitutedWith && (
                      <p className="text-xs text-amber-700 mt-1 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200 w-max">
                        تم إحلاله بـ: {r.substitutedWith}
                      </p>
                    )}
                  </td>

                  {/* 1. انحراف السعر */}
                  <td className="p-4 font-mono">
                    <span className={getVarianceTextClass(r.priceVariance)}>
                      {r.priceVariance.toLocaleString()} ج.م
                    </span>
                    <div className="text-[10px] text-slate-400 mt-1">
                      معياري: {r.priceStandard} / فعلي: {r.priceActual}
                    </div>
                  </td>

                  {/* 2. انحراف الاستخدام */}
                  <td className="p-4 font-mono">
                    <span className={getVarianceTextClass(r.qtyVarianceAmount)}>
                      {r.qtyVarianceAmount.toLocaleString()} ج.م
                    </span>
                    <div className="text-[10px] text-slate-400 mt-1">
                      معياري: {r.qtyStandard} / فعلي: {r.qtyActualUsed}
                    </div>
                  </td>

                  {/* 3. انحراف الإحلال */}
                  <td className="p-4 font-mono">
                    <span className={getVarianceTextClass(r.substitutionImpact)}>
                      {r.substitutionImpact.toLocaleString()} ج.م
                    </span>
                    <div className="text-[10px] text-slate-400 mt-1">أثر الإحلال على السعر</div>
                  </td>

                  {/* 4. انحراف الهالك */}
                  <td className="p-4 font-mono">
                    <span className={getVarianceTextClass(r.scrapVarianceAmount)}>
                      {r.scrapVarianceAmount.toLocaleString()} ج.م
                    </span>
                    <div className="text-[10px] text-slate-400 mt-1">
                      مسموح: {r.standardScrapPct}% / فعلي: {r.actualScrapPct}%
                    </div>
                  </td>

                  {/* صافي الانحراف الكلي */}
                  <td className="p-4 font-mono font-extrabold text-base">
                    <span className={getVarianceTextClass(r.netTotalVariance)}>
                      {r.netTotalVariance.toLocaleString()} ج.م
                    </span>
                  </td>

                  {/* مؤشر الفحص */}
                  <td className="p-4 text-center">
                    <div className="flex justify-center">{getStatusIcon(r.netTotalVariance)}</div>
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

export default MaterialVariancePage;
