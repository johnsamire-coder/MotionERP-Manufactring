import React from 'react';
import { PackageCheck, CheckCircle2 } from 'lucide-react';

export const StockEntryPage: React.FC = () => {
  const entries = [
    { id: 'STE-2026-0811', type: 'صرف خامات للتشغيل', from: 'مخزن الخامات الرئيسي', to: 'ورشة تشكيل الصاج (WIP)', item: 'صاج ستانلس 304 (702 كجم)', ref: 'WO-2026-08112', date: '2026-10-10' },
    { id: 'STE-2026-0812', type: 'استلام منتج تام', from: 'خط التجميع النهائي', to: 'مخزن المنتج التام', item: '10 أسرة عناية مركزة كهربائية', ref: 'WO-2026-08150', date: '2026-10-11' },
    { id: 'STE-2026-0815', type: 'تحويل بين المخازن', from: 'مخزن الخامات الرئيسي', to: 'مخزن الإكسسوارات الطبية', item: '20 طقم بساتم هيدروليكية', ref: 'TRF-2026-012', date: '2026-10-12' },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-600 text-white rounded-xl shadow-md"><PackageCheck className="w-7 h-7" /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">أذون وحركات التحويل المخزني (Stock Entries)</h1>
            <p className="text-sm text-slate-500">إصدار أذون صرف التشغيل استلام المنتج التام والتحويلات بين المخازن</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-900">سجل حركات وأذون المخازن المرحلة</div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">رقم الإذن</th>
                <th className="p-4">نوع الحركة المخزنية</th>
                <th className="p-4">من مخزن / ورشة</th>
                <th className="p-4">إلى مخزن / ورشة</th>
                <th className="p-4">الأصناف المحولة</th>
                <th className="p-4">مرجع أمر الشغل</th>
                <th className="p-4">التاريخ والحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-mono font-bold text-teal-700">{e.id}</td>
                  <td className="p-4 font-semibold text-slate-900">{e.type}</td>
                  <td className="p-4 text-xs text-slate-600">{e.from}</td>
                  <td className="p-4 text-xs text-slate-600">{e.to}</td>
                  <td className="p-4 font-medium text-slate-800">{e.item}</td>
                  <td className="p-4 font-mono text-xs text-slate-500">{e.ref}</td>
                  <td className="p-4">
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-300 flex items-center gap-1 w-max">
                      <CheckCircle2 className="w-3.5 h-3.5" /> مرحل للدفاتر
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
export default StockEntryPage;