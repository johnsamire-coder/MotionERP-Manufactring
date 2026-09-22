import React, { useState } from 'react';
import {
  AlertOctagon,
  Search,
  ArrowRightLeft,
  Building2,
  Package,
  Layers,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  PhoneCall,
  Download,
  Printer,
  ShieldAlert,
  GitFork,
  ArrowDownRight,
  Send,
} from 'lucide-react';

// ── Types ──────────────────────────────────────
interface TraceResult {
  searchQuery: string;
  searchType: 'batch' | 'serial';
  rawMaterial: {
    batchNumber: string;
    itemName: string;
    supplierName: string;
    receivedDate: string;
    certificateNumber: string;
    status: string;
  };
  manufacturing: {
    workOrderNumber: string;
    productionLine: string;
    completionDate: string;
    producedQty: number;
    supervisorName: string;
  };
  affectedDevices: {
    id: string;
    serialNumber: string;
    deviceModel: string;
    hospitalName: string;
    department: string;
    contactPerson: string;
    contactPhone: string;
    deliveryDate: string;
    warrantyStatus: string;
    recallStatus: 'active_in_use' | 'quarantined' | 'recalled' | 'inspected_safe';
  }[];
}

export const MedicalRecallPage: React.FC = () => {
  const [searchInput, setSearchInput] = useState('LOT-2026-MED-0941');
  const [hasSearched, setHasSearched] = useState(true);
  const [recallAlertTriggered, setRecallAlertTriggered] = useState(false);

  // ── Mock Trace Result Data ───────────────────
  const [traceData, setTraceData] = useState<TraceResult>({
    searchQuery: 'LOT-2026-MED-0941',
    searchType: 'batch',
    rawMaterial: {
      batchNumber: 'LOT-2026-MED-0941',
      itemName: 'ألواح صاج ستانلس 304 طبي 1.5 مم (سماكة عالية)',
      supplierName: 'العز للدرفلة والصلب المخصوص',
      receivedDate: '2026-08-10',
      certificateNumber: 'CERT-ISO-89412-M',
      status: 'مقبول مبدئياً بالمخزن',
    },
    manufacturing: {
      workOrderNumber: 'WO-2026-08112',
      productionLine: 'خط ليزر وتشكيل الصاج 02 + لحام TIG',
      completionDate: '2026-08-28',
      producedQty: 18,
      supervisorName: 'م. حسام الألفي (مدير الإنتاج)',
    },
    affectedDevices: [
      {
        id: 'dev-1',
        serialNumber: 'SN-ICU-2026-00814',
        deviceModel: 'سرير عناية مركزة كهربائي Motion-ICU Plus',
        hospitalName: 'مستشفى دار الفؤاد - 6 أكتوبر',
        department: 'الرعاية المركزة - غرفة 302',
        contactPerson: 'د. مجدي إبراهيم (مدير التجهيزات الطبية)',
        contactPhone: '01001234567',
        deliveryDate: '2026-09-05',
        warrantyStatus: 'ساري (24 شهر)',
        recallStatus: 'active_in_use',
      },
      {
        id: 'dev-2',
        serialNumber: 'SN-ICU-2026-00815',
        deviceModel: 'سرير عناية مركزة كهربائي Motion-ICU Plus',
        hospitalName: 'مستشفى دار الفؤاد - 6 أكتوبر',
        department: 'الرعاية المركزة - غرفة 303',
        contactPerson: 'د. مجدي إبراهيم (مدير التجهيزات الطبية)',
        contactPhone: '01001234567',
        deliveryDate: '2026-09-05',
        warrantyStatus: 'ساري (24 شهر)',
        recallStatus: 'active_in_use',
      },
      {
        id: 'dev-3',
        serialNumber: 'SN-OT-2026-00412',
        deviceModel: 'ترولي نقل مرضى وعمليات صاج ستانلس 304',
        hospitalName: 'مستشفى السلام الدولي بالمعادي',
        department: 'قسم الطوارئ والاستقبال - بوابة 1',
        contactPerson: 'م. إنجي فريد (مسؤولة الصيانة الطبية)',
        contactPhone: '01229876543',
        deliveryDate: '2026-08-20',
        warrantyStatus: 'ساري (12 شهر)',
        recallStatus: 'active_in_use',
      },
      {
        id: 'dev-4',
        serialNumber: 'SN-CAB-2026-00109',
        deviceModel: 'دولاب صيدلية أدوية مخدرة مزدوج القفل',
        hospitalName: 'معهد ناصر للبحوث والعلاج',
        department: 'صيدلية العمليات الرئيسية',
        contactPerson: 'د. هناء شلبي',
        contactPhone: '01115554321',
        deliveryDate: '2026-09-02',
        warrantyStatus: 'ساري (12 شهر)',
        recallStatus: 'quarantined',
      },
    ],
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setHasSearched(true);
  };

  const handleTriggerRecall = () => {
    setRecallAlertTriggered(true);
    // تحديث حالات الأجهزة إلى وضع الاستدعاء المحجوز
    setTraceData((prev) => ({
      ...prev,
      affectedDevices: prev.affectedDevices.map((d) => ({
        ...d,
        recallStatus: 'recalled',
      })),
    }));
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      {/* ── العنوان الرئيسي ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-600 text-white rounded-xl shadow-md">
            <AlertOctagon className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">غرفة الاستدعاء والتتبع الطبي السريع (Medical Recall)</h1>
            <p className="text-sm text-slate-500">
              تتبع مسار أي تشغيلة خامات معيوبة وحصر جميع الأجهزة الطبية المتأثرة بالمستشفيات فوراً
            </p>
          </div>
        </div>

        {recallAlertTriggered && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-2 rounded-xl text-sm font-bold animate-pulse">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            حالة استدعاء طبي نشطة (Recall Active)
          </div>
        )}
      </div>

      {/* ── نموذج البحث الفوري ── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute right-4 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="أدخل رقم اللوط (Batch No.) أو السيريال نمبر (Serial No.) لبدء التتبع الشامل..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white text-base transition font-mono"
            />
          </div>
          <button
            type="submit"
            className="flex items-center justify-center gap-2 px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow transition"
          >
            <GitFork className="w-5 h-5" /> فحص شجرة التتبع
          </button>
        </form>
      </div>

      {hasSearched && (
        <div className="space-y-6">
          {/* ── شجرة التتبع والتسلسل الهندسي (Genealogy Pipeline) ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. خامة المورد */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2 h-full bg-teal-500" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded">المرحلة 1: التوريد والخام</span>
                <Package className="w-5 h-5 text-teal-600" />
              </div>
              <h3 className="font-mono font-bold text-slate-900 text-lg">{traceData.rawMaterial.batchNumber}</h3>
              <p className="text-sm font-semibold text-slate-700 mt-1">{traceData.rawMaterial.itemName}</p>
              <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                <div>المورد: <span className="font-medium text-slate-800">{traceData.rawMaterial.supplierName}</span></div>
                <div>تاريخ الاستلام: <span className="font-medium text-slate-800">{traceData.rawMaterial.receivedDate}</span></div>
                <div>شهادة المطابقة: <span className="font-mono text-teal-700">{traceData.rawMaterial.certificateNumber}</span></div>
              </div>
            </div>

            {/* 2. أمر الشغل والتصنيع */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2 h-full bg-blue-500" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded">المرحلة 2: خطوط الإنتاج</span>
                <Layers className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-mono font-bold text-slate-900 text-lg">{traceData.manufacturing.workOrderNumber}</h3>
              <p className="text-sm font-semibold text-slate-700 mt-1">{traceData.manufacturing.productionLine}</p>
              <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                <div>تاريخ الإغلاق: <span className="font-medium text-slate-800">{traceData.manufacturing.completionDate}</span></div>
                <div>الكمية المصنعة: <span className="font-bold text-blue-700">{traceData.manufacturing.producedQty} وحدة تامة</span></div>
                <div>المشرف: <span className="font-medium text-slate-800">{traceData.manufacturing.supervisorName}</span></div>
              </div>
            </div>

            {/* 3. نطاق التأثير والانتشار */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2 h-full bg-rose-500" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded">المرحلة 3: التوزيع بالمستشفيات</span>
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-2xl">{traceData.affectedDevices.length} أجهزة مطابقة</h3>
              <p className="text-sm text-slate-600 mt-1">موزعة على 3 مستشفيات ومراكز طبية</p>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-rose-600 font-semibold">تتطلب مراجعة فورية</span>
                <button
                  onClick={handleTriggerRecall}
                  disabled={recallAlertTriggered}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition ${
                    recallAlertTriggered ? 'bg-slate-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700 shadow-sm'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" /> {recallAlertTriggered ? 'تم إطلاق الاستدعاء' : 'إطلاق أمر استدعاء'}
                </button>
              </div>
            </div>
          </div>

          {/* ── جدول الأجهزة المتأثرة وخطة التحرك ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-slate-200 gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">سجل الأجهزة الطبية المشحونة من هذه التشغيلة</h3>
                <p className="text-xs text-slate-500">بيانات الاتصال الدقيقة بالمستشفيات لفرق الصيانة الميدانية</p>
              </div>

              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition">
                  <Printer className="w-4 h-4" /> طباعة استدعاء رسمي
                </button>
                <button className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition">
                  <Download className="w-4 h-4" /> تصدير Excel
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">السيريال نمبر</th>
                    <th className="p-4">طراز الجهاز الطبي</th>
                    <th className="p-4">المستشفى والموقع الدقيق</th>
                    <th className="p-4">مسؤول الاستلام والتواصل</th>
                    <th className="p-4">تاريخ التوريد</th>
                    <th className="p-4">حالة الاستدعاء</th>
                    <th className="p-4 text-center">إجراء فوري</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {traceData.affectedDevices.map((dev) => (
                    <tr key={dev.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                          {dev.serialNumber}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-800">{dev.deviceModel}</td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          {dev.hospitalName}
                        </div>
                        <div className="text-xs text-rose-700 font-medium mt-0.5">{dev.department}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-slate-800 font-medium">{dev.contactPerson}</div>
                        <div className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <PhoneCall className="w-3 h-3 text-slate-400" />
                          {dev.contactPhone}
                        </div>
                      </td>
                      <td className="p-4 text-xs text-slate-600">{dev.deliveryDate}</td>
                      <td className="p-4">
                        {dev.recallStatus === 'recalled' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            <AlertTriangle className="w-3.5 h-3.5" /> مطلوب سحبه فوراً
                          </span>
                        ) : dev.recallStatus === 'quarantined' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            متحفظ عليه
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            قيد التشغيل الطبي
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <button className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition">
                          فتح بلاغ صيانة
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalRecallPage;