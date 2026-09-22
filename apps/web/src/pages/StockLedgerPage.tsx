import React from 'react';
import { FileSpreadsheet } from 'lucide-react';

export const StockLedgerPage: React.FC = () => {
  const ledger = [
    { id: 'SLE-1001', item: 'صاج ستانلس 304 طبي 1.5 مم', date: '2026-10-01', voucher: 'PINV-2026-0412', inQty: 1250, outQty: 0, balanceQty: 1250, rate: 185, balanceVal: 231250 },
    { id: 'SLE-1002', item: 'صاج ستانلس 304 طبي 1.5 مم', date: '2026-10-10', voucher: 'STE-2026-0811', inQty: 0, outQty: 702, balanceQty: 548, rate: 185, balanceVal: 101380 },
    { id: 'SLE-1003', item: 'سرير عناية مركزة كهربائي 5 حركات', date: '2026-10-11', voucher: 'STE-2026-0812', inQty: 10, outQty: 0, balanceQty: 10, rate: 15033, balanceVal: 150330 },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-600 text-white rounded-xl shadow-md"><FileSpreadsheet className="w-7 h-7" /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">السجل المالي التراكمي للمخزون (Stock Ledger)</h1>
            <p className="text-sm text-slate-500">تتبع القيمة المالية والرصيد التراكمي بالمتوسط المتحرك الآلي لكل حركة</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-900">سجل القيود المالية الحركية للمخزون</div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">رقم السجل</th>
                <th className="p-4">الصنف والخامة</th>
                <th className="p-4">المرجع</th>
                <th className="p-4">الوارد (+)</th>
                <th className="p-4">المنصرف (-)</th>
                <th className="p-4">الرصيد المتبقي</th>
                <th className="p-4">سعر الوحدة</th>
                <th className="p-4">القيمة التراكمية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledger.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-mono font-bold text-teal-700">{row.id}</td>
                  <td className="p-4 font-semibold text-slate-900">{row.item}</td>
                  <td className="p-4 font-mono text-xs text-slate-600">{row.voucher}</td>
                  <td className="p-4 font-mono font-bold text-emerald-700">{row.inQty > 0 ? `+${row.inQty}` : '—'}</td>
                  <td className="p-4 font-mono font-bold text-rose-600">{row.outQty > 0 ? `-${row.outQty}` : '—'}</td>
                  <td className="p-4 font-mono font-bold text-slate-900">{row.balanceQty}</td>
                  <td className="p-4 font-mono">{row.rate.toLocaleString()} ج.م</td>
                  <td className="p-4 font-mono font-bold text-indigo-700">{row.balanceVal.toLocaleString()} ج.م</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default StockLedgerPage;