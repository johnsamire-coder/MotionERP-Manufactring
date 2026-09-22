import React, { useState } from 'react';
import {
  Landmark,
  Receipt,
  FileSpreadsheet,
  FileText,
  Printer,
  Download,
  CheckCircle2,
  Calculator,
  Building2,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Ship,
  DollarSign,
  AlertCircle,
  Plus,
} from 'lucide-react';

// ── Types ──────────────────────────────────────
interface VatSettlementRecord {
  id: string;
  settlementNumber: string;
  taxPeriod: string; // e.g. "2026-08"
  totalSalesTaxable: number;
  outputVatAmount: number;
  totalPurchaseTaxable: number;
  inputVatAmount: number;
  netVatPayable: number;
  status: 'draft' | 'filed' | 'paid';
  paymentReference?: string;
  paymentDate?: string;
}

interface WhtRecord {
  id: string;
  entryNumber: string;
  partnerName: string;
  taxRegistrationNum: string;
  invoiceNumber: string;
  entryDate: string;
  quarter: number;
  direction: 'deducted_by_us' | 'deducted_from_us';
  baseAmount: number;
  whtRate: number; // 1% or 3%
  whtAmount: number;
  status: 'recorded' | 'declared' | 'settled';
}

interface CustomsRecord {
  id: string;
  declarationNumber: string; // رقم 46 ك.م
  portName: string;
  supplierName: string;
  declarationDate: string;
  billOfLading: string;
  cifValueEgp: number;
  customsDutyAmount: number;
  developmentFee: number;
  vatPaidAtCustoms: number;
  totalPaidAmount: number;
  status: 'draft' | 'cleared' | 'capitalized';
}

export const TaxAndCustomsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vat' | 'wht' | 'customs'>('vat');
  const [selectedQuarter, setSelectedQuarter] = useState<number>(3); // الربع الثالث
  const [selectedYear, setSelectedYear] = useState<string>('2026');

  // ── Mock Data واقعية للمصنع ───────────────────
  const [vatSettlements] = useState<VatSettlementRecord[]>([
    {
      id: 'vat-1',
      settlementNumber: 'VAT-SETTLE-2026-08',
      taxPeriod: 'أغسطس 2026',
      totalSalesTaxable: 1850000,
      outputVatAmount: 259000, // 14%
      totalPurchaseTaxable: 1120000,
      inputVatAmount: 156800,  // 14%
      netVatPayable: 102200,   // الصافي واجب السداد
      status: 'paid',
      paymentReference: 'CBE-EGP-TAX-891044',
      paymentDate: '2026-09-15',
    },
    {
      id: 'vat-2',
      settlementNumber: 'VAT-SETTLE-2026-09',
      taxPeriod: 'سبتمبر 2026',
      totalSalesTaxable: 2100000,
      outputVatAmount: 294000,
      totalPurchaseTaxable: 1450000,
      inputVatAmount: 203000,
      netVatPayable: 91000,
      status: 'draft',
    },
  ]);

  const [whtEntries] = useState<WhtRecord[]>([
    {
      id: 'wht-1',
      entryNumber: 'WHT-2026-081',
      partnerName: 'شركة العز للدرفلة والصلب المخصوص',
      taxRegistrationNum: '100-245-891',
      invoiceNumber: 'PINV-2026-0412',
      entryDate: '2026-08-12',
      quarter: 3,
      direction: 'deducted_by_us',
      baseAmount: 350000,
      whtRate: 1, // 1% توريد خامات صاج
      whtAmount: 3500,
      status: 'declared',
    },
    {
      id: 'wht-2',
      entryNumber: 'WHT-2026-082',
      partnerName: 'المركز التخصصي للدهان الإلكتروستاتيك',
      taxRegistrationNum: '203-118-944',
      invoiceNumber: 'PINV-2026-0428',
      entryDate: '2026-08-25',
      quarter: 3,
      direction: 'deducted_by_us',
      baseAmount: 85000,
      whtRate: 3, // 3% خدمات وتشغيل
      whtAmount: 2550,
      status: 'declared',
    },
    {
      id: 'wht-3',
      entryNumber: 'WHT-2026-083',
      partnerName: 'مستشفى دار الفؤاد - 6 أكتوبر',
      taxRegistrationNum: '300-881-209',
      invoiceNumber: 'SINV-2026-0189',
      entryDate: '2026-09-02',
      quarter: 3,
      direction: 'deducted_from_us',
      baseAmount: 620000,
      whtRate: 1, // خصموه من مستحقاتنا
      whtAmount: 6200,
      status: 'recorded',
    },
  ]);

  const [customsList] = useState<CustomsRecord[]>([
    {
      id: 'cust-1',
      declarationNumber: 'شهادة جمركية 46 ك.م - 89412/2026',
      portName: 'ميناء الدخيلة - الإسكندرية',
      supplierName: 'POSCO International (Stainless Coils)',
      declarationDate: '2026-08-18',
      billOfLading: 'MED-BL-994102',
      cifValueEgp: 1450000,
      customsDutyAmount: 72500,   // 5% ضريبة جمركية
      developmentFee: 43500,      // 3% رسم تنمية
      vatPaidAtCustoms: 219240,   // 14% تسدد بالجمارك وتسترد كمدخلات
      totalPaidAmount: 335240,
      status: 'capitalized',
    },
  ]);

  // ── الحسابات الإجمالية ───────────────────────
  const totalWhtDeductedByUs = whtEntries
    .filter((w) => w.direction === 'deducted_by_us')
    .reduce((acc, w) => acc + w.whtAmount, 0);

  const totalWhtDeductedFromUs = whtEntries
    .filter((w) => w.direction === 'deducted_from_us')
    .reduce((acc, w) => acc + w.whtAmount, 0);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      {/* ── الرأس الرئيسي ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md">
            <Landmark className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">منظومة مصلحة الضرائب المصرية والجمارك</h1>
            <p className="text-sm text-slate-500">
              تسويات القيمة المضافة (14%)، إقرارات الخصم والإضافة (نموذج 41)، ورسملة الرسوم الجمركية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow transition"
          >
            <Printer className="w-4 h-4" /> طباعة الموقف الضريبي
          </button>
        </div>
      </div>

      {/* ── كروت المؤشرات الضريبية ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ضريبة المبيعات (مخرجات 14%)</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">294,000 ج.م</h3>
            <span className="text-xs text-indigo-600 font-medium">عن مبيعات شهر سبتمبر</span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ضريبة المشتريات (مدخلات 14%)</p>
            <h3 className="text-2xl font-bold text-emerald-700 mt-1">203,000 ج.م</h3>
            <span className="text-xs text-emerald-600 font-medium">قابلة للخصم من الإقرار</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">صافي ضريبة VAT المستحقة</p>
            <h3 className="text-2xl font-bold text-rose-700 mt-1">91,000 ج.م</h3>
            <span className="text-xs text-rose-600 font-medium">واجبة السداد للمصلحة</span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <Calculator className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">مستقطعات نموذج 41 (Q3)</p>
            <h3 className="text-2xl font-bold text-amber-700 mt-1">
              {totalWhtDeductedByUs.toLocaleString()} ج.م
            </h3>
            <span className="text-xs text-amber-600 font-medium">مستحقة التوريد للضرائب</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ── لوحة التبويبات والمحتوى ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 p-4 gap-4">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('vat')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === 'vat'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              إقرارات ضريبة القيمة المضافة (VAT 14%)
            </button>
            <button
              onClick={() => setActiveTab('wht')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === 'wht'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الخصم والتحصيل (نموذج 41 ضرائب)
            </button>
            <button
              onClick={() => setActiveTab('customs')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === 'customs'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الإفراجات الجمركية (46 ك.م)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition">
              <Download className="w-4 h-4" /> تصدير إقرار معتمد (PDF)
            </button>
          </div>
        </div>

        {/* ── 1. تبويب ضريبة القيمة المضافة ── */}
        {activeTab === 'vat' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-4">رقم التسوية</th>
                  <th className="p-4">الفترة الضريبية</th>
                  <th className="p-4">وعاء المبيعات</th>
                  <th className="p-4">ضريبة المخرجات (14%)</th>
                  <th className="p-4">وعاء المشتريات</th>
                  <th className="p-4">ضريبة المدخلات (14%)</th>
                  <th className="p-4">الصافي المستحق</th>
                  <th className="p-4">حالة الإقرار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vatSettlements.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 font-mono font-bold text-indigo-700">{v.settlementNumber}</td>
                    <td className="p-4 font-semibold text-slate-900">{v.taxPeriod}</td>
                    <td className="p-4 text-slate-700">{v.totalSalesTaxable.toLocaleString()} ج.م</td>
                    <td className="p-4 font-semibold text-indigo-700">+{v.outputVatAmount.toLocaleString()} ج.م</td>
                    <td className="p-4 text-slate-700">{v.totalPurchaseTaxable.toLocaleString()} ج.م</td>
                    <td className="p-4 font-semibold text-emerald-700">-{v.inputVatAmount.toLocaleString()} ج.م</td>
                    <td className="p-4 font-bold text-rose-700">{v.netVatPayable.toLocaleString()} ج.م</td>
                    <td className="p-4">
                      {v.status === 'paid' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" /> مسدد ({v.paymentReference})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <Calculator className="w-3.5 h-3.5" /> بانتظار الإقفال والسداد
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 2. تبويب نموذج 41 ضرائب ── */}
        {activeTab === 'wht' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-4">رقم الحركة</th>
                  <th className="p-4">اسم المورد / العميل</th>
                  <th className="p-4">رقم التسجيل الضريبي</th>
                  <th className="p-4">رقم الفاتورة</th>
                  <th className="p-4">تاريخ الحركة</th>
                  <th className="p-4">القيمة الخاضعة</th>
                  <th className="p-4">النسبة</th>
                  <th className="p-4">مبلغ الخصم</th>
                  <th className="p-4">نوع الخصم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {whtEntries.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 font-mono font-bold text-slate-900">{w.entryNumber}</td>
                    <td className="p-4 font-semibold text-slate-900">{w.partnerName}</td>
                    <td className="p-4 font-mono text-xs text-indigo-700 bg-slate-50 px-2 py-1 rounded">
                      {w.taxRegistrationNum}
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-600">{w.invoiceNumber}</td>
                    <td className="p-4 text-xs text-slate-500">{w.entryDate}</td>
                    <td className="p-4 font-medium">{w.baseAmount.toLocaleString()} ج.م</td>
                    <td className="p-4 font-bold text-indigo-700">{w.whtRate}%</td>
                    <td className="p-4 font-bold text-amber-700">{w.whtAmount.toLocaleString()} ج.م</td>
                    <td className="p-4">
                      {w.direction === 'deducted_by_us' ? (
                        <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          خصم لصالح المصلحة
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                          مخصوم من مستحقاتنا
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 3. تبويب الجمارك ── */}
        {activeTab === 'customs' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-4">رقم الشهادة 46 ك.م</th>
                  <th className="p-4">الميناء والمورد</th>
                  <th className="p-4">رقم البوليصة B/L</th>
                  <th className="p-4">القيمة السيف (CIF EGP)</th>
                  <th className="p-4">ضريبة الوارد الجمركية</th>
                  <th className="p-4">رسم التنمية</th>
                  <th className="p-4">VAT 14% بالجمارك</th>
                  <th className="p-4">إجمالي المسدد</th>
                  <th className="p-4">أثر التكلفة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customsList.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 font-mono font-bold text-indigo-700">{c.declarationNumber}</td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-900">{c.supplierName}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Ship className="w-3.5 h-3.5 text-slate-400" />
                        {c.portName}
                      </div>
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-600">{c.billOfLading}</td>
                    <td className="p-4 font-medium">{c.cifValueEgp.toLocaleString()} ج.م</td>
                    <td className="p-4 text-slate-800">{c.customsDutyAmount.toLocaleString()} ج.م</td>
                    <td className="p-4 text-slate-800">{c.developmentFee.toLocaleString()} ج.م</td>
                    <td className="p-4 font-bold text-emerald-700">{c.vatPaidAtCustoms.toLocaleString()} ج.م</td>
                    <td className="p-4 font-bold text-rose-700">{c.totalPaidAmount.toLocaleString()} ج.م</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> مرسملة على المخزون
                      </span>
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

export default TaxAndCustomsPage;