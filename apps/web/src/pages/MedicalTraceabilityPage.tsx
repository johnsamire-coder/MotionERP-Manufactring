import React, { useState } from 'react';
import {
  ShieldCheck,
  QrCode,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Calendar,
  Layers,
  Activity,
  FileText,
  Clock,
  Filter,
} from 'lucide-react';

// ── Types ──────────────────────────────────────
interface BatchRecord {
  id: string;
  batchNumber: string;
  itemName: string;
  itemCode: string;
  supplierName: string;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  quarantineStatus: 'pending_inspection' | 'accepted' | 'quarantined' | 'rejected';
  manufacturingDate: string;
  expiryDate: string;
  certificateNumber: string;
}

interface SerialDeviceRecord {
  id: string;
  serialNumber: string;
  itemName: string;
  customerName: string;
  hospitalDepartment: string;
  batchNumber: string;
  warrantyMonths: number;
  warrantyStartDate: string | null;
  warrantyEndDate: string | null;
  installedBy: string | null;
  status: 'allocated' | 'delivered' | 'installed' | 'warranty_active' | 'warranty_expired' | 'returned';
}

export const MedicalTraceabilityPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'batches' | 'serials' | 'warranty'>('batches');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // ── Mock Data للتجربة الفورية ────────────────
  const [batches] = useState<BatchRecord[]>([
    {
      id: 'b-1',
      batchNumber: 'LOT-2026-MED-0941',
      itemName: 'ألواح صاج ستانلس 304 طبي 1.5 مم',
      itemCode: 'RAW-SS-304-15',
      supplierName: 'العز للدرفلة والصلب المخصوص',
      receivedQty: 500,
      acceptedQty: 500,
      rejectedQty: 0,
      quarantineStatus: 'accepted',
      manufacturingDate: '2026-08-10',
      expiryDate: '2029-08-10',
      certificateNumber: 'CERT-ISO-89412',
    },
    {
      id: 'b-2',
      batchNumber: 'LOT-2026-MED-0945',
      itemName: 'موتور هيدروليكي لأسرة العمليات الطبية',
      itemCode: 'ACT-HYD-400W',
      supplierName: 'لينكولن ميديكال إيجيبت',
      receivedQty: 50,
      acceptedQty: 0,
      rejectedQty: 0,
      quarantineStatus: 'pending_inspection',
      manufacturingDate: '2026-09-01',
      expiryDate: '2028-09-01',
      certificateNumber: 'CE-MED-2026-78',
    },
    {
      id: 'b-3',
      batchNumber: 'LOT-2026-MED-0899',
      itemName: 'بودرة دهان إلكتروستاتيك مضادة للبكتيريا',
      itemCode: 'PNT-ANTI-BAC-9010',
      supplierName: 'كيمياويات البناء الحديث',
      receivedQty: 200,
      acceptedQty: 0,
      rejectedQty: 200,
      quarantineStatus: 'rejected',
      manufacturingDate: '2026-07-15',
      expiryDate: '2027-07-15',
      certificateNumber: 'CERT-REJ-441',
    },
  ]);

  const [serials] = useState<SerialDeviceRecord[]>([
    {
      id: 's-1',
      serialNumber: 'SN-ICU-2026-00814',
      itemName: 'سرير عناية مركزة كهربائي 5 حركات Motion-ICU',
      customerName: 'مستشفى دار الفؤاد - 6 أكتوبر',
      hospitalDepartment: 'جناح الرعاية الحرجة - غرفة 302',
      batchNumber: 'LOT-2026-MED-0941',
      warrantyMonths: 24,
      warrantyStartDate: '2026-09-05',
      warrantyEndDate: '2028-09-05',
      installedBy: 'م. سامح عزيز (فريق التركيبات الطبية)',
      status: 'warranty_active',
    },
    {
      id: 's-2',
      serialNumber: 'SN-OT-2026-00412',
      itemName: 'ترولي نقل مرضى وعمليات صاج ستانلس 304',
      customerName: 'مستشفى السلام الدولي بالمعادي',
      hospitalDepartment: 'قسم الطوارئ والاستقبال',
      batchNumber: 'LOT-2026-MED-0941',
      warrantyMonths: 12,
      warrantyStartDate: '2026-08-20',
      warrantyEndDate: '2027-08-20',
      installedBy: 'م. أحمد شكري',
      status: 'warranty_active',
    },
    {
      id: 's-3',
      serialNumber: 'SN-CAB-2026-00109',
      itemName: 'دولاب صيدلية أدوية مخدرة مزدوج القفل',
      customerName: 'معهد ناصر للبحوث والعلاج',
      hospitalDepartment: 'صيدلية العمليات الرئيسية',
      batchNumber: 'LOT-2026-MED-0941',
      warrantyMonths: 12,
      warrantyStartDate: null,
      warrantyEndDate: null,
      installedBy: null,
      status: 'delivered',
    },
  ]);

  // ── Helpers ──────────────────────────────────
  const getBatchBadge = (status: BatchRecord['quarantineStatus']) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> مقبول ومطابق
          </span>
        );
      case 'pending_inspection':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5" /> قيد الفحص الطبي
          </span>
        );
      case 'quarantined':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">
            <AlertTriangle className="w-3.5 h-3.5" /> حجر صحي تحفظي
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3.5 h-3.5" /> مرفوض ومستبعد
          </span>
        );
    }
  };

  const getSerialBadge = (status: SerialDeviceRecord['status']) => {
    switch (status) {
      case 'warranty_active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <ShieldCheck className="w-3.5 h-3.5" /> الضمان ساري
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
            <Building2 className="w-3.5 h-3.5" /> تم التسليم (بانتظار التركيب)
          </span>
        );
      case 'allocated':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-300">
            <QrCode className="w-3.5 h-3.5" /> مخصص لأمر التوريد
          </span>
        );
      case 'warranty_expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-600 border border-gray-400">
            منتهي الضمان
          </span>
        );
      default:
        return null;
    }
  };

  const filteredBatches = batches.filter(
    (b) =>
      b.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSerials = serials.filter(
    (s) =>
      s.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.hospitalDepartment && s.hospitalDepartment.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      {/* ── العنوان الرئيسي ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-600 text-white rounded-xl shadow-md">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">منظومة التتبع الطبي واللوطات (ISO 13485)</h1>
            <p className="text-sm text-slate-500">
              تتبع دورة حياة الصاج والمكونات الواردة حتى الأجهزة الطبية المشحونة للمستشفيات والضمان
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-medium shadow-sm transition">
            <QrCode className="w-4 h-4" /> فحص باركود فوري
          </button>
        </div>
      </div>

      {/* ── كروت المؤشرات الفورية (KPIs) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">لوطات واردة نشطة</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{batches.length} لوط</h3>
            <span className="text-xs text-emerald-600 font-medium">100% مطابقة للمواصفات الفنية</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">أجهزة تحت الضمان</p>
            <h3 className="text-2xl font-bold text-blue-700 mt-1">
              {serials.filter((s) => s.status === 'warranty_active').length} جهاز طبي
            </h3>
            <span className="text-xs text-blue-600 font-medium">مركبة بالمستشفيات</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">قيد الفحص المخبري</p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1">
              {batches.filter((b) => b.quarantineStatus === 'pending_inspection').length} شحنة
            </h3>
            <span className="text-xs text-amber-600 font-medium">بانتظار موافقة مهندس الجودة</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">مستشفيات ومراكز طبية</p>
            <h3 className="text-2xl font-bold text-purple-700 mt-1">12 مستشفى</h3>
            <span className="text-xs text-purple-600 font-medium">شبكة التوزيع المباشر</span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ── شريط التبويبات والبحث ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 p-4 gap-4">
          {/* التبويبات */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('batches')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === 'batches'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              شحنات ولوطات الموردين ({batches.length})
            </button>
            <button
              onClick={() => setActiveTab('serials')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === 'serials'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الأجهزة بالسيريال والمستشفيات ({serials.length})
            </button>
          </div>

          {/* البحث */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="بحث باللوط، السيريال، المستشفى..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
            />
          </div>
        </div>

        {/* ── محتوى التبويب 1: اللوطات الواردة ── */}
        {activeTab === 'batches' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-4">رقم اللوط (Batch No.)</th>
                  <th className="p-4">اسم الخامة / الصنف</th>
                  <th className="p-4">المورد المعتمد</th>
                  <th className="p-4">الكمية المستلمة</th>
                  <th className="p-4">حالة الحجر الطبي</th>
                  <th className="p-4">شهادة المطابقة</th>
                  <th className="p-4">تاريخ الإنتاج / الصلاحية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4">
                      <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded-md border border-teal-200">
                        {b.batchNumber}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold text-slate-900">{b.itemName}</p>
                      <p className="text-xs text-slate-400 font-mono">{b.itemCode}</p>
                    </td>
                    <td className="p-4 text-slate-700">{b.supplierName}</td>
                    <td className="p-4 font-semibold text-slate-900">
                      {b.receivedQty} وحدة
                    </td>
                    <td className="p-4">{getBatchBadge(b.quarantineStatus)}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        <FileText className="w-3 h-3 text-slate-400" />
                        {b.certificateNumber}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-500">
                      <div>إنتاج: {b.manufacturingDate}</div>
                      <div className="text-rose-600">انتهاء: {b.expiryDate}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── محتوى التبويب 2: الأجهزة الطبية والسيريالات ── */}
        {activeTab === 'serials' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-4">الرقم التسلسلي (Serial Number)</th>
                  <th className="p-4">الجهاز الطبي</th>
                  <th className="p-4">المستشفى والعميل</th>
                  <th className="p-4">القسم والغرفة</th>
                  <th className="p-4">لوط الخامة الأصلي</th>
                  <th className="p-4">حالة الضمان</th>
                  <th className="p-4">فترة وسريان الضمان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSerials.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4">
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 flex items-center gap-1.5 w-max">
                        <QrCode className="w-3.5 h-3.5" />
                        {s.serialNumber}
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-slate-900">{s.itemName}</td>
                    <td className="p-4 text-slate-800 font-medium">{s.customerName}</td>
                    <td className="p-4 text-xs text-slate-600">
                      {s.hospitalDepartment || '— لم يحدد بعد —'}
                    </td>
                    <td className="p-4 font-mono text-xs text-teal-700">
                      {s.batchNumber}
                    </td>
                    <td className="p-4">{getSerialBadge(s.status)}</td>
                    <td className="p-4 text-xs">
                      {s.warrantyStartDate ? (
                        <div>
                          <span className="text-emerald-700 font-medium">من: {s.warrantyStartDate}</span>
                          <div className="text-slate-500">إلى: {s.warrantyEndDate} ({s.warrantyMonths} شهر)</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">يبدأ عند إتمام التركيب</span>
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

export default MedicalTraceabilityPage;