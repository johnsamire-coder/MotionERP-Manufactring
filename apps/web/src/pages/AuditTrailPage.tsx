import React, { useState } from 'react';
import { ShieldAlert, Search, UserCheck, Clock, Laptop, Eye, Printer } from 'lucide-react';

interface AuditRow {
  id: string;
  entityName: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'POST' | 'REVERSE' | 'CLOSE' | 'REOPEN';
  performedByName: string;
  ipAddress: string;
  details: string;
  createdAt: string;
  oldValues?: string;
  newValues?: string;
}

export const AuditTrailPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditRow | null>(null);

  // ── سجلات تدقيق تجريبية حقيقية للمصنع ──
  const [logs] = useState<AuditRow[]>([
    {
      id: 'log-1',
      entityName: 'accounting_period',
      entityId: 'p-8 (أغسطس 2026)',
      action: 'CLOSE',
      performedByName: 'أ. سامح عبد العزيز (مدير الحسابات)',
      ipAddress: '192.168.1.104',
      details: 'إقفال وتجميد الفترة المحاسبية لشهر أغسطس 2026 بعد مطابقة ميزان المراجعة',
      createdAt: '2026-09-01 18:30:15',
      oldValues: JSON.stringify({ status: 'open', isLocked: false }, null, 2),
      newValues: JSON.stringify({ status: 'closed', isLocked: true }, null, 2),
    },
    {
      id: 'log-2',
      entityName: 'tax_settlement',
      entityId: 'VAT-SETTLE-2026-08',
      action: 'POST',
      performedByName: 'أ. هاني شكري (المحاسب القانوني)',
      ipAddress: '192.168.1.110',
      details: 'ترحيل قيد إقفال ضريبة القيمة المضافة 14% لشهر أغسطس بقيمة 102,200 ج.م',
      createdAt: '2026-09-01 16:45:20',
      newValues: JSON.stringify({ netVatPayable: 102200, status: 'filed' }, null, 2),
    },
    {
      id: 'log-3',
      entityName: 'work_order',
      entityId: 'WO-2026-08112',
      action: 'UPDATE',
      performedByName: 'م. حسام الألفي (مدير الإنتاج)',
      ipAddress: '192.168.1.55',
      details: 'تعديل كمية صرف الصاج الستانلس 304 من 702 كجم إلى 745 كجم بسبب هالك الليزر',
      createdAt: '2026-08-28 14:12:08',
      oldValues: JSON.stringify({ grossQty: 702, scrapPercentage: 8 }, null, 2),
      newValues: JSON.stringify({ grossQty: 745, scrapPercentage: 11.5 }, null, 2),
    },
    {
      id: 'log-4',
      entityName: 'item_batch',
      entityId: 'LOT-2026-MED-0899',
      action: 'REVERSE',
      performedByName: 'د. مجدي إبراهيم (مسؤول الجودة الطبية)',
      ipAddress: '192.168.1.201',
      details: 'رفض تشغيلة بودرة الدهان ونقلها إلى الحجر الصحي لعدم مطابقة مواصفة التعقيم',
      createdAt: '2026-08-25 11:20:44',
      oldValues: JSON.stringify({ quarantineStatus: 'pending_inspection' }, null, 2),
      newValues: JSON.stringify({ quarantineStatus: 'rejected' }, null, 2),
    },
  ]);

  const getActionBadge = (action: AuditRow['action']) => {
    switch (action) {
      case 'CLOSE':
        return (
          <span className="bg-slate-900 text-white text-xs px-2.5 py-1 rounded-full font-bold">
            إقفال فترة
          </span>
        );
      case 'POST':
        return (
          <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full font-bold">
            ترحيل قيد
          </span>
        );
      case 'UPDATE':
        return (
          <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold">
            تعديل بيانات
          </span>
        );
      case 'REVERSE':
        return (
          <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-1 rounded-full font-bold">
            استبعاد / عكس
          </span>
        );
      case 'CREATE':
        return (
          <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-bold">
            إنشاء سجل
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-800 text-xs px-2.5 py-1 rounded-full font-bold">
            {action}
          </span>
        );
    }
  };

  const filteredLogs = logs.filter((l) => {
    const matchSearch =
      l.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.entityId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.performedByName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.details.toLowerCase().includes(searchTerm.toLowerCase());

    const matchAction = actionFilter === 'ALL' || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      {/* ── العنوان الرئيسي ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-950 text-white rounded-xl shadow-md">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              سجل التدقيق الرقابي الشامل (Audit Trail & Change Log)
            </h1>
            <p className="text-sm text-slate-500">
              تتبع غير قابل للتعديل لكافة العمليات المالية، حركات المخازن، والقرارات الإدارية
              الحساسة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition"
          >
            <Printer className="w-4 h-4" /> طباعة تقرير الرقابة
          </button>
        </div>
      </div>

      {/* ── لوحة الفلترة والبحث ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActionFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                actionFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              الكل ({logs.length})
            </button>
            <button
              onClick={() => setActionFilter('CLOSE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                actionFilter === 'CLOSE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              إقفال فترات ({logs.filter((l) => l.action === 'CLOSE').length})
            </button>
            <button
              onClick={() => setActionFilter('POST')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                actionFilter === 'POST' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              ترحيل قيود ({logs.filter((l) => l.action === 'POST').length})
            </button>
            <button
              onClick={() => setActionFilter('UPDATE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                actionFilter === 'UPDATE' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              تعديلات ({logs.filter((l) => l.action === 'UPDATE').length})
            </button>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالموظف، المستند، البيان..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
            />
          </div>
        </div>

        {/* ── جدول الحركات الرقابية ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">المستند / الكيان</th>
                <th className="p-4">نوع الإجراء</th>
                <th className="p-4">المستخدم والمسؤول</th>
                <th className="p-4">عنوان IP والجهاز</th>
                <th className="p-4">تفاصيل وبيان الحركة</th>
                <th className="p-4">تاريخ ووقت التنفيذ</th>
                <th className="p-4 text-center">فحص الفروق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-4">
                    <p className="font-mono font-bold text-slate-900">{l.entityId}</p>
                    <p className="font-mono text-xs text-slate-400 mt-0.5">{l.entityName}</p>
                  </td>
                  <td className="p-4">{getActionBadge(l.action)}</td>
                  <td className="p-4">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-slate-400" />
                      {l.performedByName}
                    </div>
                  </td>
                  <td className="p-4 font-mono text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Laptop className="w-3.5 h-3.5 text-slate-400" />
                      {l.ipAddress}
                    </div>
                  </td>
                  <td className="p-4 text-slate-700 max-w-md">{l.details}</td>
                  <td className="p-4 font-mono text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {l.createdAt}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    {(l.oldValues || l.newValues) && (
                      <button
                        onClick={() => setSelectedLog(l)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                        title="عرض الفروق والقيم قبل وبعد التعديل"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal فحص التغييرات التفصيلية (Diff Viewer) ── */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-slate-900" />
                <h3 className="font-bold text-lg text-slate-900">
                  سجل التغييرات التفصيلي ({selectedLog.entityId})
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* البيانات السابقة */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-rose-700">
                  القيم السابقة قبل التعديل (Old Values):
                </span>
                <pre className="bg-rose-50/60 border border-rose-200 text-rose-950 p-3 rounded-xl text-xs font-mono overflow-auto max-h-60">
                  {selectedLog.oldValues || '— لا توجد قيم سابقة (سجل جديد) —'}
                </pre>
              </div>

              {/* البيانات الجديدة */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-emerald-700">
                  القيم الجديدة المعتمدة (New Values):
                </span>
                <pre className="bg-emerald-50/60 border border-emerald-200 text-emerald-950 p-3 rounded-xl text-xs font-mono overflow-auto max-h-60">
                  {selectedLog.newValues || '— تم الحذف —'}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold shadow"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditTrailPage;
