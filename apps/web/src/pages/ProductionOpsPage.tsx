import React from 'react';
import { Factory, Play, CheckCircle2 } from 'lucide-react';

export const ProductionOpsPage: React.FC = () => {
  const workOrders = [
    { id: 'WO-2026-08112', product: 'سرير عناية مركزة كهربائي 5 حركات Motion-ICU', qty: 20, completed: 20, status: 'completed', line: 'خط ليزر فايبر + لحام TIG + دهان' },
    { id: 'WO-2026-08115', product: 'ترولي نقل مرضى وعمليات صاج ستانلس 304', qty: 15, completed: 15, status: 'completed', line: 'خط ثناية CNC + تجميع' },
    { id: 'WO-2026-08150', product: 'سرير عناية مركزة كهربائي (طلب مستشفى دار الفؤاد)', qty: 10, completed: 6, status: 'in_progress', line: 'ورشة تشكيل الصاج والدهان الحراري' },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-600 text-white rounded-xl shadow-md"><Factory className="w-7 h-7" /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">صالة الإنتاج وأوامر الشغل (Shop Floor & Work Orders)</h1>
            <p className="text-sm text-slate-500">متابعة خطوط تقطيع الليزر ثنايات CNC اللحام الدهان الإلكتروستاتيك والتجميع</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-900">سجل أوامر الشغل النشطة والمنتهية</div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">رقم أمر الشغل</th>
                <th className="p-4">المنتج الطبي</th>
                <th className="p-4">الكمية المطلوبة</th>
                <th className="p-4">المنجز الفعلي</th>
                <th className="p-4">خط التشغيل والورشة</th>
                <th className="p-4">حالة التنفيذ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workOrders.map((wo) => (
                <tr key={wo.id} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-mono font-bold text-purple-700">{wo.id}</td>
                  <td className="p-4 font-semibold text-slate-900">{wo.product}</td>
                  <td className="p-4 font-mono">{wo.qty} وحدة</td>
                  <td className="p-4 font-mono font-bold text-emerald-700">{wo.completed} وحدة</td>
                  <td className="p-4 text-xs text-slate-600">{wo.line}</td>
                  <td className="p-4">
                    {wo.status === 'completed' ? (
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-300">مكتمل 100%</span>
                    ) : (
                      <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-300 flex items-center gap-1 w-max">
                        <Play className="w-3 h-3 fill-amber-600" /> جاري التشكيل (60%)
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
export default ProductionOpsPage;