import React from 'react';
import { CreditCard, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export const PaymentEntryPage: React.FC = () => {
  const payments = [
    {
      id: 'PAY-2026-089',
      partner: 'مستشفى دار الفؤاد - 6 أكتوبر',
      type: 'collection',
      amount: 376770,
      method: 'تحويل بنكي - البنك الأهلي',
      ref: 'TRF-DARALFOUAD-NOV-2026',
      date: '2026-11-10',
    },
    {
      id: 'PAY-2026-082',
      partner: 'شركة العز للدرفلة والصلب',
      type: 'payment',
      amount: 231250,
      method: 'شيك بنكي مقبول الدفع',
      ref: 'CHK-NBE-89410',
      date: '2026-08-15',
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md">
            <CreditCard className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              سندات القبض والصرف والتحصيلات البنكية
            </h1>
            <p className="text-sm text-slate-500">
              تحصيل مستحقات العملاء وسداد الموردين ومطابقة الحسابات البنكية
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-900">
          سجل المعاملات والتحصيلات الأخيرة
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">رقم السند</th>
                <th className="p-4">الجهة / الشريك</th>
                <th className="p-4">نوع الحركة</th>
                <th className="p-4">المبلغ</th>
                <th className="p-4">طريقة السداد والبنك</th>
                <th className="p-4">المرجع البنكي</th>
                <th className="p-4">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-mono font-bold text-blue-700">{p.id}</td>
                  <td className="p-4 font-semibold text-slate-900">{p.partner}</td>
                  <td className="p-4">
                    {p.type === 'collection' ? (
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-300 flex items-center gap-1 w-max">
                        <ArrowDownLeft className="w-3.5 h-3.5" /> تحصيل من عميل
                      </span>
                    ) : (
                      <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-300 flex items-center gap-1 w-max">
                        <ArrowUpRight className="w-3.5 h-3.5" /> سداد لمورد
                      </span>
                    )}
                  </td>
                  <td className="p-4 font-mono font-bold text-slate-900">
                    {p.amount.toLocaleString()} ج.م
                  </td>
                  <td className="p-4 text-xs text-slate-600">{p.method}</td>
                  <td className="p-4 font-mono text-xs text-slate-500">{p.ref}</td>
                  <td className="p-4 font-mono text-xs text-slate-500">{p.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default PaymentEntryPage;
