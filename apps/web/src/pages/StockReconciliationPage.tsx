import React from 'react';
import { Scale, CheckCircle2 } from 'lucide-react';

export const StockReconciliationPage: React.FC = () => {
  const reconciliations = [
    {
      id: 'RECON-2026-03',
      warehouse: 'مخزن الخامات الرئيسي',
      item: 'صاج ستانلس 304 طبي 1.5 مم',
      bookQty: 548,
      physicalQty: 548,
      diff: 0,
      status: 'matched',
    },
    {
      id: 'RECON-2026-04',
      warehouse: 'مخزن الإكسسوارات الطبية',
      item: 'مواتير وبساتم هيدروليكية',
      bookQty: 35,
      physicalQty: 35,
      diff: 0,
      status: 'matched',
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-600 text-white rounded-xl shadow-md">
            <Scale className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              الجرد الفعلي وتسويات عجز وزيادة المخازن
            </h1>
            <p className="text-sm text-slate-500">
              مقارنة الأرصدة الدفترية بالرصيد الفعلي وتوليد قيود تسوية العجز والزيادة آليا
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-900">
          سجل تسويات الجرد المخزني الحالية
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">رقم الجلسة</th>
                <th className="p-4">المخزن المفحوص</th>
                <th className="p-4">الصنف والخامة</th>
                <th className="p-4">الرصيد الدفتري</th>
                <th className="p-4">الرصيد الفعلي بالجرد</th>
                <th className="p-4">فرق الكمية</th>
                <th className="p-4">حالة المطابقة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reconciliations.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-mono font-bold text-teal-700">{r.id}</td>
                  <td className="p-4 font-semibold text-slate-900">{r.warehouse}</td>
                  <td className="p-4 text-slate-700">{r.item}</td>
                  <td className="p-4 font-mono font-bold text-slate-900">{r.bookQty}</td>
                  <td className="p-4 font-mono font-bold text-indigo-700">{r.physicalQty}</td>
                  <td className="p-4 font-mono text-emerald-700 font-bold">
                    {r.diff === 0 ? '0 (مطابق)' : r.diff}
                  </td>
                  <td className="p-4">
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-300 flex items-center gap-1 w-max">
                      <CheckCircle2 className="w-3.5 h-3.5" /> لا يوجد فروق جرد
                    </span>
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
export default StockReconciliationPage;
