import React from 'react';
import { Boxes } from 'lucide-react';

export const InventoryPage: React.FC = () => {
  const stockItems = [
    {
      code: 'RAW-SS-304-15',
      name: 'صاج ستانلس 304 طبي 1.5 مم',
      warehouse: 'مخزن الخامات الرئيسي',
      qty: '1,250 كجم',
      avgCost: '185 ج.م',
      totalValue: '231,250 ج.م',
      batch: 'LOT-2026-MED-0941',
    },
    {
      code: 'RAW-PIPE-125',
      name: 'مواسير ستانلس 304 قطر 1.25 بوصة',
      warehouse: 'مخزن الخامات الرئيسي',
      qty: '480 متر',
      avgCost: '140 ج.م',
      totalValue: '67,200 ج.م',
      batch: 'LOT-2026-MED-0941',
    },
    {
      code: 'ACC-HYD-400W',
      name: 'مواتير وبساتم هيدروليكية 400W',
      warehouse: 'مخزن الإكسسوارات الطبية',
      qty: '35 طقم',
      avgCost: '4,500 ج.م',
      totalValue: '157,500 ج.م',
      batch: 'CE-MED-2026-78',
    },
    {
      code: 'FG-ICU-BED-01',
      name: 'سرير عناية مركزة كهربائي 5 حركات',
      warehouse: 'مخزن المنتج التام',
      qty: '10 أسرة',
      avgCost: '15,033 ج.م',
      totalValue: '150,330 ج.م',
      batch: 'BATCH-2026-09-ICU',
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-600 text-white rounded-xl shadow-md">
            <Boxes className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              دليل الأصناف وأرصدة المخازن التراكمية
            </h1>
            <p className="text-sm text-slate-500">
              متابعة أرصدة الصاج الإكسسوارات الطبية والمنتج التام مع حساب المتوسط المتحرك
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">
            إجمالي قيمة المخزون الدفتري
          </p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">606,280 ج.م</h3>
          <span className="text-xs text-amber-600 font-medium">محسوب بالمتوسط المتحرك الآلي</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">صاج وخامات ستانلس 304</p>
          <h3 className="text-2xl font-bold text-blue-700 mt-1">1,730 وحدة</h3>
          <span className="text-xs text-blue-600 font-medium">مكفية إنتاج الشهر</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">أسرة عناية تامة الصنع</p>
          <h3 className="text-2xl font-bold text-emerald-700 mt-1">10 أسرة</h3>
          <span className="text-xs text-emerald-600 font-medium">جاهزة للتسليم للمستشفى</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-bold text-slate-900">جدول أرصدة المخازن الحالية</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">كود الصنف</th>
                <th className="p-4">اسم الصنف والخامة</th>
                <th className="p-4">المخزن الحالي</th>
                <th className="p-4">الرصيد الفعلي</th>
                <th className="p-4">متوسط التكلفة</th>
                <th className="p-4">القيمة الإجمالية</th>
                <th className="p-4">رقم اللوط الطبي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stockItems.map((item) => (
                <tr key={item.code} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-mono font-bold text-amber-700">{item.code}</td>
                  <td className="p-4 font-semibold text-slate-900">{item.name}</td>
                  <td className="p-4 text-xs text-slate-600">{item.warehouse}</td>
                  <td className="p-4 font-mono font-bold text-slate-900">{item.qty}</td>
                  <td className="p-4 font-mono text-slate-700">{item.avgCost}</td>
                  <td className="p-4 font-mono font-bold text-emerald-700">{item.totalValue}</td>
                  <td className="p-4 font-mono text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 w-max">
                    {item.batch}
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
export default InventoryPage;
