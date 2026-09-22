import React, { useState } from 'react';
import { ShoppingCart, Plus, CheckCircle2, Clock, DollarSign, Building2, Printer, Download } from 'lucide-react';

export const SalesInvoicePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'invoices' | 'quotations'>('invoices');

  const invoices = [
    { id: 'SINV-2026-0215', customer: 'مستشفى دار الفؤاد - 6 أكتوبر', amount: 376770, tax: 46270, date: '2026-10-10', status: 'paid', items: '10 أسرة عناية مركزة + 5 ترولي صاج' },
    { id: 'SINV-2026-0218', customer: 'مستشفى السلام الدولي بالمعادي', amount: 210900, tax: 25900, date: '2026-10-12', status: 'pending', items: '15 ترولي نقل مرضى صاج 304' },
    { id: 'SINV-2026-0220', customer: 'معهد ناصر للبحوث والعلاج', amount: 108300, tax: 13300, date: '2026-10-14', status: 'pending', items: '10 دولاب صيدلية أدوية مخدرة' },
  ];

  const quotations = [
    { id: 'QUO-2026-0189', customer: 'مستشفى دار الفؤاد - 6 أكتوبر', amount: 376770, date: '2026-09-22', validUntil: '2026-10-30', status: 'converted' },
    { id: 'QUO-2026-0192', customer: 'مستشفى الجلاء العسكري', amount: 364800, date: '2026-09-25', validUntil: '2026-11-01', status: 'sent' },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-600 text-white rounded-xl shadow-md"><ShoppingCart className="w-7 h-7" /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">إدارة فواتير المبيعات ومبيعات المستشفيات</h1>
            <p className="text-sm text-slate-500">إصدار الفواتير ضريبة القيمة المضافة 14% وعروض أسعار المناقصات</p>
          </div>
        </div>
        <button onClick={() => alert('إصدار فاتورة مبيعات جديدة')} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow transition cursor-pointer">
          <Plus className="w-4 h-4" /> إصدار فاتورة جديدة
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">إجمالي مبيعات الشهر</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">695,970 ج.م</h3>
          <span className="text-xs text-emerald-600 font-medium">+18% زيادة عن المستهدف</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">ضريبة القيمة المضافة (14% VAT)</p>
          <h3 className="text-2xl font-bold text-indigo-700 mt-1">85,470 ج.م</h3>
          <span className="text-xs text-indigo-600 font-medium">مستحقة التسوية لمصلحة الضرائب</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">عروض أسعار جارية</p>
          <h3 className="text-2xl font-bold text-amber-600 mt-1">2 عرض سعر</h3>
          <span className="text-xs text-amber-600 font-medium">بقيمة إجمالية 741,570 ج.م</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex gap-2 bg-slate-50">
          <button onClick={() => setActiveTab('invoices')} className={`px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${activeTab === 'invoices' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600'}`}>
            فواتير المبيعات الصادرة ({invoices.length})
          </button>
          <button onClick={() => setActiveTab('quotations')} className={`px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${activeTab === 'quotations' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600'}`}>
            عروض الأسعار والمناقصات ({quotations.length})
          </button>
        </div>

        {activeTab === 'invoices' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-4">رقم الفاتورة</th>
                  <th className="p-4">المستشفى / العميل</th>
                  <th className="p-4">الأصناف المباعة</th>
                  <th className="p-4">القيمة قبل الضريبة</th>
                  <th className="p-4">ضريبة 14%</th>
                  <th className="p-4">الإجمالي الشامل</th>
                  <th className="p-4">حالة السداد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-mono font-bold text-teal-700">{inv.id}</td>
                    <td className="p-4 font-semibold text-slate-900">{inv.customer}</td>
                    <td className="p-4 text-slate-600 text-xs">{inv.items}</td>
                    <td className="p-4 font-mono">{(inv.amount - inv.tax).toLocaleString()} ج.م</td>
                    <td className="p-4 font-mono text-indigo-700">+{inv.tax.toLocaleString()} ج.م</td>
                    <td className="p-4 font-mono font-bold text-slate-900">{inv.amount.toLocaleString()} ج.م</td>
                    <td className="p-4">
                      {inv.status === 'paid' ? (
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-300">مسددة بنكيا</span>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-300">بانتظار التحصيل (Net 30)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-4">رقم العرض</th>
                  <th className="p-4">المستشفى / العميل</th>
                  <th className="p-4">القيمة الإجمالية</th>
                  <th className="p-4">تاريخ العرض</th>
                  <th className="p-4">صلاحية العرض</th>
                  <th className="p-4">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-mono font-bold text-amber-600">{q.id}</td>
                    <td className="p-4 font-semibold text-slate-900">{q.customer}</td>
                    <td className="p-4 font-mono font-bold text-slate-900">{q.amount.toLocaleString()} ج.م</td>
                    <td className="p-4 text-xs font-mono text-slate-500">{q.date}</td>
                    <td className="p-4 text-xs font-mono text-slate-500">{q.validUntil}</td>
                    <td className="p-4">
                      {q.status === 'converted' ? (
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full">محول لأمر بيع</span>
                      ) : (
                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full">تم الإرسال للعميل</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default SalesInvoicePage;