import React from 'react';
import { ClipboardList } from 'lucide-react';

export const CostingPage: React.FC = () => {
  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-600 text-white rounded-xl shadow-md"><ClipboardList className="w-7 h-7" /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">نظام تحليلات التكاليف المتقدمة والتسعير الصناعي</h1>
            <p className="text-sm text-slate-500">ربط التكاليف المباشرة وغير المباشرة مع شيتات تشكيل الصاج ومصنعية الورش</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 text-lg mb-2">كروت التكلفة الفعلية</h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">استعراض كروت تكلفة أوامر الشغل أسعار الخامات أزمنة الماكينات وتحميل الـ Overhead.</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 text-lg mb-2">انحرافات المواد الأربعة</h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">تحليل انحراف السعر الاستخدام الإحلال وهالك تقطيع الليزر وتشكيل الصاج.</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 text-lg mb-2">مجمعات التكاليف OH</h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">متابعة مصاريف كهرباء الصالة الإشراف الهندسية وإهلاك ماكينات المصنع.</p>
        </div>
      </div>
    </div>
  );
};
export default CostingPage;