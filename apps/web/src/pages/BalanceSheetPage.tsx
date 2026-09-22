import React from 'react';
import { Scale } from 'lucide-react';

export const BalanceSheetPage: React.FC = () => {
  const assets = [
    { code: '1000', name: 'النقدية وما في حكمها (بنوك وخزينة)', amount: '995,000 ج.م' },
    { code: '1100', name: 'إجمالي المخزون (خامات + تام + WIP)', amount: '524,010 ج.م' },
    { code: '1200', name: 'الأصول الثابتة (ماكينات ليزر وثنايات)', amount: '2,100,000 ج.م' },
    { code: '1201', name: 'خصم: مجمع إهلاك الماكينات', amount: '-420,000 ج.م' },
  ];

  const liabilities = [
    { code: '2000', name: 'مستحقات الموردين وموردي الصلب', amount: '231,250 ج.م' },
    { code: '2100', name: 'مستحقات مصلحة الضرائب (VAT)', amount: '46,270 ج.م' },
    { code: '3000', name: 'رأس المال والاحتياطيات', amount: '2,001,490 ج.م' },
    { code: '3001', name: 'الأرباح المرحلة والمحتجزة', amount: '920,000 ج.م' },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md"><Scale className="w-7 h-7" /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">الميزانية العمومية وسجل الأصول الثابتة (Balance Sheet)</h1>
            <p className="text-sm text-slate-500">عرض الموقف المالي العام: الأصول = الالتزامات + حقوق الملكية متوازنة 100%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-lg text-emerald-800">جانب الأصول (Assets)</h3>
            <span className="font-mono font-bold text-emerald-700 text-lg">3,199,010 ج.م</span>
          </div>
          <div className="space-y-2 text-sm">
            {assets.map((a) => (
              <div key={a.code} className="flex justify-between p-2 bg-slate-50 rounded-xl">
                <span className="font-medium text-slate-800">{a.name}</span>
                <span className="font-mono font-bold text-slate-900">{a.amount}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-lg text-indigo-800">الالتزامات وحقوق الملكية (Liabilities & Equity)</h3>
            <span className="font-mono font-bold text-indigo-700 text-lg">3,199,010 ج.م</span>
          </div>
          <div className="space-y-2 text-sm">
            {liabilities.map((l) => (
              <div key={l.code} className="flex justify-between p-2 bg-slate-50 rounded-xl">
                <span className="font-medium text-slate-800">{l.name}</span>
                <span className="font-mono font-bold text-slate-900">{l.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
export default BalanceSheetPage;