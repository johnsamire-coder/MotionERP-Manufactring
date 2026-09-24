import React from 'react';
import { ShoppingBag } from 'lucide-react';

export const PurchaseOrderPage: React.FC = () => {
  const purchases = [
    {
      id: 'PINV-2026-0412',
      supplier: 'شركة العز للدرفلة والصلب المخصوص',
      items: 'صاج ستانلس 304 طبي 1.5 مم (702 كجم)',
      amount: 231250,
      vat: 32375,
      status: 'received_and_cleared',
      grniRef: 'GRNI-2026-089',
    },
    {
      id: 'PINV-2026-0428',
      supplier: 'المركز التخصصي للدهان الإلكتروستاتيك',
      items: 'مصنعية دهان أسرة وتروليات طلي مضاد للبكتيريا',
      amount: 85000,
      vat: 11900,
      status: 'cleared',
      grniRef: 'GRNI-2026-094',
    },
    {
      id: 'PINV-2026-0435',
      supplier: 'لينكولن ميديكال إيجيبت',
      items: 'مواتير وبساتم هيدروليكية 400W (20 طقم)',
      amount: 90000,
      vat: 12600,
      status: 'pending_grni',
      grniRef: 'قيد الاستلام',
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              فواتير المشتريات ومصادقة الاستلام المخزني (GRNI)
            </h1>
            <p className="text-sm text-slate-500">
              متابعة مشتريات صاج الستانلس والمكونات الهيدروليكية وحساب وسيط GRNI
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">مشتريات خامات الصاج</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">406,250 ج.م</h3>
          <span className="text-xs text-blue-600 font-medium">مشتريات شهر أغسطس وسبتمبر</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">حساب وسيط GRNI الحالي</p>
          <h3 className="text-2xl font-bold text-amber-600 mt-1">90,000 ج.م</h3>
          <span className="text-xs text-amber-600 font-medium">
            استلامات بانتظار الفاتورة النهائية
          </span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">
            ضريبة المدخلات (Input VAT 14%)
          </p>
          <h3 className="text-2xl font-bold text-emerald-700 mt-1">56,875 ج.م</h3>
          <span className="text-xs text-emerald-600 font-medium">قابلة للخصم والإسترداد</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-bold text-slate-900">سجل فواتير المشتريات ومطابقة المخازن</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">رقم الفاتورة</th>
                <th className="p-4">المورد المعتمد</th>
                <th className="p-4">الخامات والمكونات المستلمة</th>
                <th className="p-4">المبلغ الخاضع</th>
                <th className="p-4">ضريبة 14%</th>
                <th className="p-4">مرجع GRNI</th>
                <th className="p-4">حالة المطابقة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchases.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-mono font-bold text-blue-700">{p.id}</td>
                  <td className="p-4 font-semibold text-slate-900">{p.supplier}</td>
                  <td className="p-4 text-xs text-slate-600">{p.items}</td>
                  <td className="p-4 font-mono font-medium">{p.amount.toLocaleString()} ج.م</td>
                  <td className="p-4 font-mono text-emerald-700">+{p.vat.toLocaleString()} ج.م</td>
                  <td className="p-4 font-mono text-xs text-slate-500">{p.grniRef}</td>
                  <td className="p-4">
                    {p.status === 'received_and_cleared' ? (
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full">
                        مستلم ومطابق GRNI
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">
                        بانتظار الإغلاق
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
export default PurchaseOrderPage;
