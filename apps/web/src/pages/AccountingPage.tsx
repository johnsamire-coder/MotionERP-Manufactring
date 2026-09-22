import React, { useState } from 'react';
import { BookOpen, CheckCircle2 } from 'lucide-react';

export const AccountingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'coa' | 'journals'>('coa');

  const coa = [
    { code: '1001', name: 'الخزينة الرئيسية (Cash)', type: 'Asset', balance: '145,000 ج.م' },
    { code: '1002', name: 'حساب بنك مصر - جاري EGP', type: 'Asset', balance: '850,000 ج.م' },
    { code: '1101', name: 'مخزن الخامات وصاج الستانلس', type: 'Asset', balance: '298,450 ج.م' },
    { code: '1102', name: 'مخزن المنتج التام (أجهزة طبية)', type: 'Asset', balance: '150,330 ج.م' },
    { code: '1103', name: 'إنتاج تحت التشغيل (WIP)', type: 'Asset', balance: '75,230 ج.م' },
    { code: '1104', name: 'مديونيات العملاء والمستشفيات (AR)', type: 'Asset', balance: '376,770 ج.م' },
    { code: '2001', name: 'مستحقات الموردين (AP)', type: 'Liability', balance: '231,250 ج.م' },
    { code: '2101', name: 'ضريبة القيمة المضافة (Output VAT)', type: 'Liability', balance: '46,270 ج.م' },
    { code: '3001', name: 'الأرباح المحتجزة / المرحلة', type: 'Equity', balance: '920,000 ج.م' },
    { code: '4101', name: 'إيرادات مبيعات الأجهزة الطبية', type: 'Revenue', balance: '695,970 ج.م' },
    { code: '5101', name: 'تكلفة المبيعات (COGS)', type: 'Cost', balance: '300,924 ج.م' },
  ];

  const journals = [
    { id: 'JV-2026-0941', date: '2026-10-10', ref: 'SINV-2026-0215', desc: 'إثبات مبيعات أسرة عناية مركزة لمستشفى دار الفؤاد', debit: '376,770 ج.م', credit: '376,770 ج.م' },
    { id: 'JV-2026-0942', date: '2026-10-10', ref: 'WO-2026-08150', desc: 'صرف صاج ستانلس 304 من المخزن للتشغيل', debit: '140,515 ج.م', credit: '140,515 ج.م' },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md"><BookOpen className="w-7 h-7" /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">شجرة الحسابات القياسية ودفتر اليومية العامة</h1>
            <p className="text-sm text-slate-500">الدليل المحاسبي المتكامل ومحرك الترحيل الآلي للقيود (Posting Engine)</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex gap-2 bg-slate-50">
          <button onClick={() => setActiveTab('coa')} className={`px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${activeTab === 'coa' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}>
            دليل الحسابات (Chart of Accounts)
          </button>
          <button onClick={() => setActiveTab('journals')} className={`px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${activeTab === 'journals' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}>
            دفتر القيود التلقائية المترحلة ({journals.length})
          </button>
        </div>

        {activeTab === 'coa' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-4">كود الحساب</th>
                  <th className="p-4">اسم الحساب في الدليل</th>
                  <th className="p-4">نوع الحساب</th>
                  <th className="p-4">الرصيد الدفتري الحالي</th>
                  <th className="p-4">حالة التفاعل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coa.map((acc) => (
                  <tr key={acc.code} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-mono font-bold text-indigo-700">{acc.code}</td>
                    <td className="p-4 font-semibold text-slate-900">{acc.name}</td>
                    <td className="p-4 text-xs"><span className="bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded border border-slate-200">{acc.type}</span></td>
                    <td className="p-4 font-mono font-bold text-slate-900">{acc.balance}</td>
                    <td className="p-4"><span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1 w-max"><CheckCircle2 className="w-3.5 h-3.5" /> نشط وموصول آليا</span></td>
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
                  <th className="p-4">رقم القيد</th>
                  <th className="p-4">التاريخ</th>
                  <th className="p-4">المرجع المستندي</th>
                  <th className="p-4">بيان ووصف القيد</th>
                  <th className="p-4">إجمالي المدين</th>
                  <th className="p-4">إجمالي الدائن</th>
                  <th className="p-4">التوازن</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {journals.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-mono font-bold text-indigo-700">{j.id}</td>
                    <td className="p-4 font-mono text-xs text-slate-500">{j.date}</td>
                    <td className="p-4 font-mono text-xs text-slate-700">{j.ref}</td>
                    <td className="p-4 font-medium text-slate-900">{j.desc}</td>
                    <td className="p-4 font-mono font-bold text-emerald-700">{j.debit}</td>
                    <td className="p-4 font-mono font-bold text-blue-700">{j.credit}</td>
                    <td className="p-4"><span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">متوازن 100%</span></td>
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
export default AccountingPage;