import React, { useState } from 'react';
import {
  Calculator,
  Layers,
  Cpu,
  Printer,
  Download,
  Clock,
  Package,
  DollarSign,
} from 'lucide-react';
import { costExportService } from '../services/cost-export.service';

interface MaterialLine {
  id: string;
  name: string;
  category: 'sheet_metal' | 'accessories' | 'powder_paint' | 'consumables';
  unit: string;
  netQty: number;
  scrapPercentage: number;
  grossQty: number;
  unitCost: number;
  totalCost: number;
}

interface OperationLine {
  id: string;
  workstation: string;
  operationName: string;
  setupTimeMin: number;
  runTimeMin: number;
  totalTimeMin: number;
  hourlyRate: number;
  totalCost: number;
}

export const JobCostSheetPage: React.FC = () => {
  const [selectedOrder] = useState('WO-2026-08112');
  const [targetUnits] = useState<number>(20);
  const [profitMargin] = useState<number>(25);
  const [overheadRate] = useState<number>(25);

  const [materials] = useState<MaterialLine[]>([
    {
      id: 'm-1',
      name: 'صاج ستانلس 304 طبي 1.5 مم (هيكل وشاسيه السرير)',
      category: 'sheet_metal',
      unit: 'كجم',
      netQty: 650,
      scrapPercentage: 8,
      grossQty: 702,
      unitCost: 185,
      totalCost: 129870,
    },
    {
      id: 'm-2',
      name: 'مواسير ستانلس 304 قطر 1.25 بوصة للجوانب المتحركة',
      category: 'sheet_metal',
      unit: 'متر',
      netQty: 120,
      scrapPercentage: 5,
      grossQty: 126,
      unitCost: 140,
      totalCost: 17640,
    },
    {
      id: 'm-3',
      name: 'مواتير وبساتم هيدروليكية 400W مع ريموت تحكم طبي',
      category: 'accessories',
      unit: 'طقم',
      netQty: 20,
      scrapPercentage: 0,
      grossQty: 20,
      unitCost: 4500,
      totalCost: 90000,
    },
    {
      id: 'm-4',
      name: 'عجل طبي 5 بوصة مزود بفرامل مركزية مقاومة للبكتيريا',
      category: 'accessories',
      unit: 'طقم',
      netQty: 20,
      scrapPercentage: 0,
      grossQty: 20,
      unitCost: 950,
      totalCost: 19000,
    },
    {
      id: 'm-5',
      name: 'بودرة دهان إلكتروستاتيك مضادة للميكروبات (رال 9010)',
      category: 'powder_paint',
      unit: 'كجم',
      netQty: 60,
      scrapPercentage: 10,
      grossQty: 66,
      unitCost: 220,
      totalCost: 14520,
    },
    {
      id: 'm-6',
      name: 'مستهلكات إنتاج (سلك لحام أرجون + غاز + أحجار تجليخ وسنفرة)',
      category: 'consumables',
      unit: 'مقطوعية',
      netQty: 1,
      scrapPercentage: 0,
      grossQty: 1,
      unitCost: 8500,
      totalCost: 8500,
    },
  ]);

  const [operations] = useState<OperationLine[]>([
    {
      id: 'op-1',
      workstation: 'ماكينة ليزر فايبر 6KW صاج',
      operationName: 'تقطيع ألواح الصاج والشاسيه',
      setupTimeMin: 45,
      runTimeMin: 420,
      totalTimeMin: 465,
      hourlyRate: 650,
      totalCost: 5037.5,
    },
    {
      id: 'op-2',
      workstation: 'ثناية هيدروليكية CNC 160 طن',
      operationName: 'تشكيل وتثني كمر وقوائم السرير',
      setupTimeMin: 30,
      runTimeMin: 360,
      totalTimeMin: 390,
      hourlyRate: 450,
      totalCost: 2925,
    },
    {
      id: 'op-3',
      workstation: 'محطة لحام TIG / MIG ستانلس',
      operationName: 'تجميع وتثبيت الشاسيه والهيكل الرئيسي',
      setupTimeMin: 20,
      runTimeMin: 680,
      totalTimeMin: 700,
      hourlyRate: 280,
      totalCost: 3266.67,
    },
    {
      id: 'op-4',
      workstation: 'قسم البرادة والتجهيز والسنفرة',
      operationName: 'تنظيف وتنعيم اللحامات ومعالجة الأسطح',
      setupTimeMin: 15,
      runTimeMin: 300,
      totalTimeMin: 315,
      hourlyRate: 180,
      totalCost: 945,
    },
    {
      id: 'op-5',
      workstation: 'خط الدهان الإلكتروستاتيك والفرن الحراري',
      operationName: 'رش البودرة الطبية وتصليدها بالفرن (200°م)',
      setupTimeMin: 60,
      runTimeMin: 360,
      totalTimeMin: 420,
      hourlyRate: 550,
      totalCost: 3850,
    },
    {
      id: 'op-6',
      workstation: 'خط التجميع الكهربائي والميكانيكي النهائي',
      operationName: 'تركيب المواتير العجل الجوانب والفحص الطبي',
      setupTimeMin: 30,
      runTimeMin: 480,
      totalTimeMin: 510,
      hourlyRate: 220,
      totalCost: 1870,
    },
  ]);

  const totalDirectMaterials = materials.reduce((sum, m) => sum + m.totalCost, 0);
  const totalDirectLaborMachine = operations.reduce((sum, o) => sum + o.totalCost, 0);
  const totalDirectCost = totalDirectMaterials + totalDirectLaborMachine;
  const totalOverhead = (totalDirectCost * overheadRate) / 100;
  const totalJobCost = totalDirectCost + totalOverhead;
  const unitCost = totalJobCost / targetUnits;

  const targetProfitAmount = (totalJobCost * profitMargin) / 100;
  const priceBeforeTax = totalJobCost + targetProfitAmount;
  const vat14 = priceBeforeTax * 0.14;
  const finalSellingPriceWithVat = priceBeforeTax + vat14;
  const unitSellingPrice = finalSellingPriceWithVat / targetUnits;

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      {/* ── العنوان الرئيسي ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-600 text-white rounded-xl shadow-md">
            <Calculator className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                كارت التكلفة الصناعية الفعلية (Job Cost Sheet)
              </h1>
              <span className="bg-amber-100 text-amber-800 font-mono text-xs px-2.5 py-1 rounded-full font-bold">
                {selectedOrder}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              تحليل تكلفة الخامات المباشرة أزمنة الماكينات نسب الهالك وتحميل الـ Overhead وهامش
              الربح
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow transition cursor-pointer"
          >
            <Printer className="w-4 h-4" /> طباعة كارت التكلفة
          </button>
          <button
            onClick={() =>
              costExportService.exportJobCostSheetToExcel(
                selectedOrder,
                {
                  targetUnits,
                  totalDirectMaterials,
                  totalDirectLabor: totalDirectLaborMachine,
                  totalOverhead,
                  totalJobCost,
                  unitCost,
                  unitSellingPriceWithVat: unitSellingPrice,
                },
                materials,
                operations,
              )
            }
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-semibold shadow transition cursor-pointer"
          >
            <Download className="w-4 h-4" /> تصدير Excel
          </button>
        </div>
      </div>

      {/* ── كروت ملخص التكلفة (KPIs) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase">إجمالي تكلفة أمر الشغل</p>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">
            {totalJobCost.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            لتصنيع {targetUnits} سرير عناية مركزة
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase">
              الخامات المباشرة + الهالك
            </p>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-blue-700 mt-2">
            {totalDirectMaterials.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م
          </h3>
          <span className="text-xs text-blue-600 font-medium">
            تمثل {((totalDirectMaterials / totalJobCost) * 100).toFixed(1)}% من التكلفة
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase">
              أزمنة الماكينات والعمالة
            </p>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-purple-700 mt-2">
            {totalDirectLaborMachine.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م
          </h3>
          <span className="text-xs text-purple-600 font-medium">
            إجمالي 46.6 ساعة تشغيل بالورشة
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase">تكلفة القطعة الواحدة</p>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-emerald-700 mt-2">
            {unitCost.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م
          </h3>
          <span className="text-xs text-emerald-600 font-medium">تكلفة تصنيع السرير الواحد</span>
        </div>
      </div>

      {/* ── 1. جدول تفصيل الخامات والصاج والهالك ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-lg">
              1. تكلفة الخامات والصاج والمستلزمات (Direct Materials)
            </h3>
          </div>
          <span className="text-sm font-bold text-blue-700">
            الإجمالي: {totalDirectMaterials.toLocaleString('ar-EG')} ج.م
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">بيان الخامة والصنف</th>
                <th className="p-4">الوحدة</th>
                <th className="p-4">الصافي المطلوب</th>
                <th className="p-4">نسبة الهالك %</th>
                <th className="p-4">المنصرف الفعلي</th>
                <th className="p-4">سعر الوحدة</th>
                <th className="p-4">إجمالي التكلفة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {materials.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-4 font-semibold text-slate-800">{m.name}</td>
                  <td className="p-4 text-slate-600">{m.unit}</td>
                  <td className="p-4 font-mono">{m.netQty}</td>
                  <td className="p-4 font-mono text-amber-700 font-bold">
                    {m.scrapPercentage > 0 ? `+${m.scrapPercentage}%` : '—'}
                  </td>
                  <td className="p-4 font-mono font-bold text-slate-900">{m.grossQty}</td>
                  <td className="p-4 font-mono">{m.unitCost.toLocaleString()} ج.م</td>
                  <td className="p-4 font-mono font-bold text-blue-700">
                    {m.totalCost.toLocaleString()} ج.م
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 2. جدول أزمنة التشغيل ومراكز العمل ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-slate-900 text-lg">
              2. أزمنة ومصنعيات مراكز التشغيل (Workstation Operations)
            </h3>
          </div>
          <span className="text-sm font-bold text-purple-700">
            الإجمالي:{' '}
            {totalDirectLaborMachine.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">مركز العمل / الماكينة</th>
                <th className="p-4">العملية الصناعية</th>
                <th className="p-4">زمن التجهيز (Setup)</th>
                <th className="p-4">زمن التشغيل (Run)</th>
                <th className="p-4">إجمالي الزمن (دقيقة)</th>
                <th className="p-4">معدل الساعة (عمالة + كهرباء)</th>
                <th className="p-4">تكلفة التشغيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {operations.map((op) => (
                <tr key={op.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-4 font-semibold text-slate-800">{op.workstation}</td>
                  <td className="p-4 text-slate-600">{op.operationName}</td>
                  <td className="p-4 font-mono text-slate-500">{op.setupTimeMin} د</td>
                  <td className="p-4 font-mono text-slate-500">{op.runTimeMin} د</td>
                  <td className="p-4 font-mono font-bold text-slate-900">
                    {op.totalTimeMin} دقيقة
                  </td>
                  <td className="p-4 font-mono">{op.hourlyRate} ج.م/ساعة</td>
                  <td className="p-4 font-mono font-bold text-purple-700">
                    {op.totalCost.toLocaleString('ar-EG', { maximumFractionDigits: 1 })} ج.م
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 3. كارت التسعير والربحية المقترحة ── */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-lg space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-700 pb-4 gap-4">
          <div>
            <h3 className="text-xl font-bold">
              3. هيكل التسعير والربحية المقترح (Pricing & Margins)
            </h3>
            <p className="text-sm text-slate-400">
              حساب سعر البيع الموصى به للمستشفيات طبقا لشيت العميل
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="text-slate-400">نسبة الـ Overhead:</span>
              <span className="font-bold text-amber-400">{overheadRate}%</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="text-slate-400">هامش الربح:</span>
              <span className="font-bold text-emerald-400">{profitMargin}%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
          <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">التكلفة المباشرة (خامات + تشغيل)</p>
            <h4 className="text-xl font-bold text-slate-100">
              {totalDirectCost.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م
            </h4>
          </div>

          <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">
              المصاريف غير المباشرة (OH {overheadRate}%)
            </p>
            <h4 className="text-xl font-bold text-amber-400">
              +{totalOverhead.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م
            </h4>
          </div>

          <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">الربح المستهدف ({profitMargin}%)</p>
            <h4 className="text-xl font-bold text-emerald-400">
              +{targetProfitAmount.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م
            </h4>
          </div>

          <div className="p-4 bg-emerald-950/80 rounded-xl border border-emerald-600/50">
            <p className="text-xs text-emerald-300 mb-1">سعر بيع السرير للعميل (شامل 14% VAT)</p>
            <h4 className="text-2xl font-extrabold text-emerald-400">
              {unitSellingPrice.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م
            </h4>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobCostSheetPage;
