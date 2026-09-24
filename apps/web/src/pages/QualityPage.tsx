import React from 'react';
import { ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';

export const QualityPage: React.FC = () => {
  const tests = [
    {
      id: 'INSP-2026-089',
      item: 'سرير عناية مركزة كهربائي (WO-2026-08150)',
      standard: 'ISO 13485 / IEC 60601',
      result: 'pass',
      inspector: 'د. مجدي إبراهيم',
      date: '2026-10-08',
    },
    {
      id: 'INSP-2026-085',
      item: 'صاج ستانلس 304 طبي (LOT-2026-MED-0941)',
      standard: 'ISO 22196 (مقاومة بكتيريا)',
      result: 'pass',
      inspector: 'م. أحمد شكري',
      date: '2026-08-10',
    },
    {
      id: 'INSP-2026-081',
      item: 'بودرة دهان إلكتروستاتيك (LOT-2026-MED-0899)',
      standard: 'سمك الطلاء والتصليد',
      result: 'fail',
      inspector: 'د. مجدي إبراهيم',
      date: '2026-07-15',
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              مراقبة الجودة الطبية والامتثال القياسي (ISO 13485)
            </h1>
            <p className="text-sm text-slate-500">
              اختبارات الفحص المخبري معايير القبول Zero Defect وسجلات الحجر الصحي
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-900">
          سجل عمليات الفحص والجودة الأخيرة
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">رقم الفحص</th>
                <th className="p-4">الصنف أو التشغيلة المفحوصة</th>
                <th className="p-4">المعيار الطبي القياسي</th>
                <th className="p-4">مهندس الجودة</th>
                <th className="p-4">التاريخ</th>
                <th className="p-4">نتيجة الفحص (Zero Defect)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tests.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-mono font-bold text-emerald-700">{t.id}</td>
                  <td className="p-4 font-semibold text-slate-900">{t.item}</td>
                  <td className="p-4 text-xs text-slate-600 font-mono">{t.standard}</td>
                  <td className="p-4 text-slate-700">{t.inspector}</td>
                  <td className="p-4 text-xs font-mono text-slate-500">{t.date}</td>
                  <td className="p-4">
                    {t.result === 'pass' ? (
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-300 flex items-center gap-1 w-max">
                        <CheckCircle2 className="w-3.5 h-3.5" /> مقبول ومطابق
                      </span>
                    ) : (
                      <span className="bg-rose-100 text-rose-800 text-xs font-bold px-2.5 py-1 rounded-full border border-rose-300 flex items-center gap-1 w-max">
                        <XCircle className="w-3.5 h-3.5" /> مرفوض وحجر صحي
                      </span>
                    )}
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
export default QualityPage;
