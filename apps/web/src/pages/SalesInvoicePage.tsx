import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, RefreshCw, AlertCircle, Save } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  totalAmount: string;
  taxAmount: string;
  grandTotal: string;
  status: string;
}

interface Item {
  id: string;
  code: string;
  name: string;
}

export const SalesInvoicePage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // حقول الفاتورة الجديدة
  const [customerId, setCustomerId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('1000');

  const API = 'http://localhost:3000/api/v1';

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const resInv = await fetch(API + '/finance/sales-invoices');
      const dataInv = await resInv.json();
      setInvoices(dataInv.invoices || dataInv || []);

      const resItems = await fetch(API + '/catalog/items');
      const dataItems = await resItems.json();
      setItems(dataItems.items || dataItems || []);
    } catch (e) {
      setError('فشل الاتصال بالخادم: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateInvoice = async () => {
    if (!selectedItemId || !customerId) {
      alert('الرجاء تعبئة بيانات العميل والصنف');
      return;
    }
    try {
      const res = await fetch(API + '/finance/sales-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          invoiceDate: new Date().toISOString().split('T')[0],
          currency: 'EGP',
          lines: [
            {
              itemId: selectedItemId,
              quantity: qty,
              unitPrice: price,
            },
          ],
        }),
      });
      const data = await res.json();
      if (data.invoice) {
        // ترحيل تلقائي فور الحفظ
        await fetch(`${API}/finance/sales-invoices/${data.invoice.id}/post`, { method: 'POST' });
        setShowCreate(false);
        fetchData();
      } else {
        alert('فشل إصدار الفاتورة: ' + JSON.stringify(data));
      }
    } catch (e) {
      alert('خطأ: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-600 text-white rounded-xl shadow-md">
            <ShoppingCart className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              فواتير المبيعات وعروض الأسعار الفعلية
            </h1>
            <p className="text-sm text-slate-500">
              إصدار وترحيل فواتير المبيعات الحقيقية بالربط مع ضريبة القيمة المضافة 14%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold shadow transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> إصدار فاتورة جديدة
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
          <h3 className="text-lg font-bold text-slate-900">إنشاء وإصدار فاتورة بيع جديدة</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">
                اسم العميل / المستشفى
              </label>
              <input
                type="text"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="مثال: مستشفى دار الفؤاد"
                className="w-full p-3 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">
                اختار المنتج الطبي
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">-- اختار صنف --</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code} - {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">الكمية المباعة</label>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">
                سعر بيع الوحدة (ج.م)
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <button
            onClick={handleCreateInvoice}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm cursor-pointer"
          >
            <Save className="w-4 h-4" /> إصدار الفاتورة وترحيل القيد آليا
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-900">
          سجل فواتير المبيعات المرحلة فعليا
        </div>
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-bold">
            جاري تحميل الفواتير من الداتابيز...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-4">رقم الفاتورة</th>
                  <th className="p-4">اسم العميل / المستشفى</th>
                  <th className="p-4">تاريخ الفاتورة</th>
                  <th className="p-4">القيمة قبل الضريبة</th>
                  <th className="p-4">ضريبة 14% VAT</th>
                  <th className="p-4">الإجمالي شامل الضريبة</th>
                  <th className="p-4">الحالة والترحيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-mono font-bold text-teal-700">{inv.invoiceNumber}</td>
                    <td className="p-4 font-semibold text-slate-900">
                      {inv.customerName || 'مستشفى دار الفؤاد'}
                    </td>
                    <td className="p-4 font-mono text-slate-500">{inv.invoiceDate}</td>
                    <td className="p-4 font-mono">
                      {(parseFloat(inv.totalAmount) || 0).toLocaleString()} ج.م
                    </td>
                    <td className="p-4 font-mono text-amber-700 font-bold">
                      {(parseFloat(inv.taxAmount) || 0).toLocaleString()} ج.م
                    </td>
                    <td className="p-4 font-mono font-bold text-teal-700">
                      {(parseFloat(inv.grandTotal) || 0).toLocaleString()} ج.م
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                          inv.status === 'posted'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-slate-50 text-slate-800 border-slate-300'
                        }`}
                      >
                        {inv.status === 'posted' ? 'مرحل ومقيد آليا' : 'مسودة'}
                      </span>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      لا توجد فواتير مبيعات مسجلة في قاعدة البيانات حاليا.
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
export default SalesInvoicePage;
