import React, { useState, useEffect } from 'react';
import { Factory, Play, CheckCircle2, RefreshCw, Plus, AlertCircle } from 'lucide-react';

interface WorkOrder {
  id: string;
  workOrderNumber: string;
  productItemId: string;
  productCode: string;
  productName: string;
  quantity: string;
  completedQuantity: string;
  status: string;
  bomId: string;
}

interface Bom {
  id: string;
  productItemId: string;
  status: string;
}

export const ProductionOpsPage: React.FC = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // حقول أمر الشغل الجديد
  const [selectedBomId, setSelectedBomId] = useState('');
  const [qty, setQty] = useState('10');

  const API = 'http://localhost:3000/api/v1';

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const resWO = await fetch(API + '/production/work-orders');
      const dataWO = await resWO.json();
      setWorkOrders(dataWO.workOrders || dataWO || []);

      const resBOM = await fetch(API + '/technical/boms');
      const dataBOM = await resBOM.json();
      setBoms(
        (dataBOM.boms || dataBOM || []).filter((b: { status: string }) => b.status === 'approved'),
      );
    } catch (e) {
      setError('فشل الاتصال بالخادم: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateOrder = async () => {
    if (!selectedBomId) {
      alert('الرجاء اختيار BOM معتمد أولا');
      return;
    }
    try {
      const bom = boms.find((b) => b.id === selectedBomId);
      const res = await fetch(API + '/production/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bomId: selectedBomId,
          productItemId: bom?.productItemId,
          quantity: qty,
        }),
      });
      const data = await res.json();
      if (data.workOrder) {
        setShowCreate(false);
        fetchData();
      } else {
        alert('فشل الإنشاء: ' + JSON.stringify(data));
      }
    } catch (e) {
      alert('خطأ: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleStartOrder = async (id: string) => {
    try {
      await fetch(`${API}/production/work-orders/${id}/start`, { method: 'POST' });
      fetchData();
    } catch (e) {
      alert('خطأ: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleCompleteOrder = async (id: string) => {
    try {
      await fetch(`${API}/production/work-orders/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedQuantity: qty }),
      });
      fetchData();
    } catch (e) {
      alert('خطأ: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-600 text-white rounded-xl shadow-md">
            <Factory className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">صالة الإنتاج وأوامر الشغل الفعلية</h1>
            <p className="text-sm text-slate-500">
              متابعة وإطلاق أوامر التصنيع الحقيقية المربوطة بالـ BOM والداتابيز
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold shadow transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> إطلاق أمر شغل جديد
          </button>
          <button
            onClick={fetchData}
            className="p-2 border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 p-4 rounded-xl flex items-center gap-2 font-bold">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {showCreate && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md space-y-4">
          <h3 className="text-lg font-bold text-slate-900">تجهيز وإطلاق أمر شغل جديد بالصالة</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">
                اختار الـ BOM المعتمد للمنتج
              </label>
              <select
                value={selectedBomId}
                onChange={(e) => setSelectedBomId(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">-- اختار الـ BOM --</option>
                {boms.map((b) => (
                  <option key={b.id} value={b.id}>
                    BOM ID: {b.id.substring(0, 8)}...
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">
                الكمية المطلوبة للتصنيع
              </label>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <button
            onClick={handleCreateOrder}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm cursor-pointer"
          >
            تأكيد وإرسال لصالة الإنتاج
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-900">
          سجل أوامر الشغل الحية في الصالة
        </div>
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-bold">
            جاري تحميل أوامر الشغل من الداتابيز...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-4">رقم أمر الشغل</th>
                  <th className="p-4">المنتج</th>
                  <th className="p-4">الكمية المطلوبة</th>
                  <th className="p-4">المنجز الفعلي</th>
                  <th className="p-4">الحالة التشغيلية</th>
                  <th className="p-4">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workOrders.map((wo) => (
                  <tr key={wo.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-mono font-bold text-purple-700">
                      {wo.workOrderNumber || wo.id.substring(0, 8)}
                    </td>
                    <td className="p-4 font-semibold text-slate-900">
                      {wo.productName || 'منتج تجريبي'}
                    </td>
                    <td className="p-4 font-mono">{parseFloat(wo.quantity) || 0} وحدة</td>
                    <td className="p-4 font-mono font-bold text-emerald-700">
                      {parseFloat(wo.completedQuantity) || 0} وحدة
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                          wo.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : wo.status === 'in_progress'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-slate-100 text-slate-800 border-slate-300'
                        }`}
                      >
                        {wo.status === 'completed'
                          ? 'مكتمل 100%'
                          : wo.status === 'in_progress'
                            ? 'جاري التشغيل'
                            : 'مسودة / انتظار'}
                      </span>
                    </td>
                    <td className="p-4 flex gap-2">
                      {wo.status === 'draft' && (
                        <button
                          onClick={() => handleStartOrder(wo.id)}
                          className="flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" /> بدء التصنيع
                        </button>
                      )}
                      {wo.status === 'in_progress' && (
                        <button
                          onClick={() => handleCompleteOrder(wo.id)}
                          className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> إقفال واستلام تـام
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {workOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      لا توجد أوامر شغل جارية في قاعدة البيانات.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default ProductionOpsPage;
