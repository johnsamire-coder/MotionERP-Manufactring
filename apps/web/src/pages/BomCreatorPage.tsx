import React, { useState, useEffect } from 'react';
import { Plus, Save, CheckCircle2, Trash2, Calculator } from 'lucide-react';

interface BomLine {
  componentItemId: string;
  componentName: string;
  quantity: string;
  unitCost: number;
  standardTimeMinutes: string;
}

interface Item {
  id: string;
  code: string;
  name: string;
  itemType: string;
}

export const BomCreatorPage: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [productName, setProductName] = useState('');
  const [productItemId, setProductItemId] = useState('');
  const [outputQty, setOutputQty] = useState('1');
  const [lines, setLines] = useState<BomLine[]>([]);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedBomId, setSavedBomId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const API = 'http://localhost:3000/api/v1';

  useEffect(() => {
    fetch(API + '/catalog/items')
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => {});
  }, []);

  const rawMaterials = items.filter((i) => i.itemType === 'raw_material');
  const finishedProducts = items.filter((i) => i.itemType === 'finished_product');

  const addLine = () => {
    setLines([
      ...lines,
      {
        componentItemId: '',
        componentName: '',
        quantity: '1',
        unitCost: 0,
        standardTimeMinutes: '0',
      },
    ]);
  };

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof BomLine, value: any) => {
    const updated = [...lines];
    (updated[idx] as any)[field] = value;
    if (field === 'componentItemId') {
      const item = items.find((i) => i.id === value);
      const row = updated[idx];
      if (row) row.componentName = item ? (item.code + ' - ' + item.name) : '';
    }
    setLines(updated);
  };

  const totalMaterialCost = lines.reduce(
    (sum, l) => sum + (parseFloat(l.quantity) || 0) * l.unitCost,
    0
  );
  const totalLaborMinutes = lines.reduce(
    (sum, l) => sum + (parseFloat(l.standardTimeMinutes) || 0),
    0
  );
  const laborCost = (totalLaborMinutes / 60) * 280;
  const overheadCost = (totalMaterialCost + laborCost) * 0.25;
  const totalCost = totalMaterialCost + laborCost + overheadCost;
  const unitCost = totalCost / (parseFloat(outputQty) || 1);

  const saveBom = async () => {
    if (!productItemId || lines.length === 0) {
      setErrorMsg('اختار المنتج التام وأضف خامة واحدة على الأقل');
      setStatus('error');
      return;
    }
    setStatus('saving');
    setErrorMsg('');
    try {
      const orgNodes = await fetch(API + '/organization/tree').then((r) => r.json());
      const manufacturingNode =
        orgNodes.tree?.[0]?.children?.[0]?.children?.find((c: any) => c.name === 'Manufacturing');
      const orgNodeId = manufacturingNode?.id || orgNodes.tree?.[0]?.children?.[0]?.id;

      const body = {
        productItemId,
        orgNodeId,
        outputQuantity: outputQty,
        isActive: true,
        isDefault: true,
        isPhantomBom: false,
        allowAlternativeItem: false,
        qualityInspectionRequired: true,
        consumeComponentsBasedOn: 'bom',
        lines: lines.map((l) => ({
          componentItemId: l.componentItemId,
          quantity: l.quantity,
          standardTimeMinutes: l.standardTimeMinutes,
        })),
      };

      const res = await fetch(API + '/technical/boms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.bom) {
        setSavedBomId(data.bom.id);
        setStatus('saved');
        await fetch(API + '/technical/boms/' + data.bom.id + '/approve', { method: 'POST' });
      } else {
        setErrorMsg('فشل الحفظ: ' + JSON.stringify(data));
        setStatus('error');
      }
    } catch (e: any) {
      setErrorMsg('خطأ: ' + e.message);
      setStatus('error');
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-600 text-white rounded-xl shadow-md">
            <Calculator className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">إنشاء BOM + التكلفة التقديرية</h1>
            <p className="text-sm text-slate-500">
              حدد المنتج التام وأضف الخامات والعمليات والتكلفة التقديرية لكل بند
            </p>
          </div>
        </div>
        <button
          onClick={saveBom}
          disabled={status === 'saving'}
          className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 text-white rounded-xl font-bold shadow transition cursor-pointer"
        >
          <Save className="w-5 h-5" /> {status === 'saving' ? 'جاري الحفظ...' : 'حفظ واعتماد الـ BOM'}
        </button>
      </div>

      {status === 'saved' && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-4 rounded-xl flex items-center gap-2 font-bold">
          <CheckCircle2 className="w-5 h-5" /> تم حفظ واعتماد الـ BOM بنجاح! رقم الـ BOM: {savedBomId}
        </div>
      )}
      {status === 'error' && (
        <div className="bg-red-50 border border-red-300 text-red-800 p-4 rounded-xl font-bold">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <label className="text-xs font-bold text-slate-500 block mb-2">
            المنتج التام (Finished Product)
          </label>
          <select
            value={productItemId}
            onChange={(e) => {
              setProductItemId(e.target.value);
              setProductName(items.find((i) => i.id === e.target.value)?.name || '');
            }}
            className="w-full p-3 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">-- اختار المنتج --</option>
            {finishedProducts.map((i) => (
              <option key={i.id} value={i.id}>
                {i.code} - {i.name}
              </option>
            ))}
          </select>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <label className="text-xs font-bold text-slate-500 block mb-2">المنتج المختار</label>
          <p className="p-3 bg-slate-50 rounded-lg text-sm font-bold text-slate-900">
            {productName || 'لم يتم الاختيار'}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <label className="text-xs font-bold text-slate-500 block mb-2">كمية الإنتاج</label>
          <input
            type="number"
            value={outputQty}
            onChange={(e) => setOutputQty(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-lg text-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-slate-900">
            بنود الـ BOM (الخامات + العمليات + التكلفة التقديرية)
          </h3>
          <button
            onClick={addLine}
            className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" /> أضف بند
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">الخامة / المكون</th>
                <th className="p-3">الكمية</th>
                <th className="p-3">تكلفة الوحدة (ج.م)</th>
                <th className="p-3">إجمالي الخامة</th>
                <th className="p-3">زمن التشغيل (دقيقة)</th>
                <th className="p-3">تكلفة التشغيل</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-3">
                    <select
                      value={l.componentItemId}
                      onChange={(e) => updateLine(idx, 'componentItemId', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded text-xs"
                    >
                      <option value="">-- اختار --</option>
                      {rawMaterials.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.code} - {i.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      value={l.quantity}
                      onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                      className="w-20 p-2 border border-slate-300 rounded text-xs text-center"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      value={l.unitCost}
                      onChange={(e) => updateLine(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                      className="w-24 p-2 border border-slate-300 rounded text-xs text-center"
                    />
                  </td>
                  <td className="p-3 font-mono font-bold text-blue-700">
                    {((parseFloat(l.quantity) || 0) * l.unitCost).toLocaleString()} ج.م
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      value={l.standardTimeMinutes}
                      onChange={(e) => updateLine(idx, 'standardTimeMinutes', e.target.value)}
                      className="w-20 p-2 border border-slate-300 rounded text-xs text-center"
                    />
                  </td>
                  <td className="p-3 font-mono font-bold text-purple-700">
                    {(((parseFloat(l.standardTimeMinutes) || 0) / 60) * 280).toLocaleString(
                      'ar-EG',
                      { maximumFractionDigits: 0 }
                    )}{' '}
                    ج.م
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => removeLine(idx)}
                      className="text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    اضغط "أضف بند" لبدء إضافة الخامات والمكونات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {lines.length > 0 && (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-bold mb-4">ملخص التكلفة التقديرية</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div className="p-3 bg-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">خامات</p>
              <p className="text-lg font-bold text-blue-400">
                {totalMaterialCost.toLocaleString()} ج.م
              </p>
            </div>
            <div className="p-3 bg-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">عمالة (280 ج/س)</p>
              <p className="text-lg font-bold text-purple-400">
                {laborCost.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م
              </p>
            </div>
            <div className="p-3 bg-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">OH 25%</p>
              <p className="text-lg font-bold text-amber-400">
                {overheadCost.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م
              </p>
            </div>
            <div className="p-3 bg-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">إجمالي التكلفة</p>
              <p className="text-lg font-bold text-white">
                {totalCost.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م
              </p>
            </div>
            <div className="p-3 bg-emerald-950 rounded-xl border border-emerald-600">
              <p className="text-xs text-emerald-300">تكلفة الوحدة</p>
              <p className="text-xl font-extrabold text-emerald-400">
                {unitCost.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BomCreatorPage;
