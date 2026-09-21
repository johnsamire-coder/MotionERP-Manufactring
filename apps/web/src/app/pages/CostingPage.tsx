import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface ItemRecord { id: string; code: string; name: string; }
interface JobOrderRecord { id: string; jobOrderNumber: string; customerId?: string; }
interface CostSummaryRecord {
  jobOrderReference: string;
  currencyCode?: string;
  estimatedTotal?: string | number;
  actualTotal?: string | number;
  variance?: string | number;
  margin?: string | number;
  entries?: Array<{ componentType: string; estimated: string; actual: string; variance: string }>;
}

interface DynamicMaterialRow {
  id: string;
  name: string;
  length: number;
  width: number;
  height: number;
  thickness: number;
  qty: number;
  scrapPct: number;
  unitPrice: number;
}

interface DynamicRow {
  id: string;
  name: string;
  uomOrStation: string;
  qtyOrMins: number;
  unitPriceOrRate: number;
}

export function CostingPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'estimator' | 'variance'>('estimator');
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [jobOrders, setJobOrders] = useState<JobOrderRecord[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedJO, setSelectedJO] = useState('');
  const [summary, setSummary] = useState<CostSummaryRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dynamic Form State for Item Cost Estimator
  const [materials, setMaterials] = useState<DynamicMaterialRow[]>([
    { id: '1', name: 'صاج مجلفن طبي 1.2 مم', length: 1, width: 1, height: 0, thickness: 1.2, qty: 1, scrapPct: 10, unitPrice: 150 }
  ]);
  const [accessories, setAccessories] = useState<DynamicRow[]>([
    { id: '1', name: 'طقم مجرى أدراج + كوالين ومقابض وبراغي', uomOrStation: 'طقم', qtyOrMins: 1, unitPriceOrRate: 450 }
  ]);
  const [consumables, setConsumables] = useState<DynamicRow[]>([
    { id: '1', name: 'بودرة دهان إلكتروستاتيك ومستلزمات فرن', uomOrStation: 'لتر/كجم', qtyOrMins: 1, unitPriceOrRate: 500 }
  ]);
  const [operations, setOperations] = useState<DynamicRow[]>([
    { id: '1', name: 'قص ليزر فايبر + تشكيل ثناية CNC', uomOrStation: 'محطة الليزر', qtyOrMins: 30, unitPriceOrRate: 15 }
  ]);

  const [overheadPct, setOverheadPct] = useState<number>(20);
  const [batchQty, setBatchQty] = useState<number>(1);
  const [unitSellingPrice, setSellingPrice] = useState<number>(10000);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemsRes, joRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`).catch(() => ({ items: [] })),
        api.get<{ jobOrders: JobOrderRecord[] }>('/sales/job-orders').catch(() => ({ jobOrders: [] })),
      ]);
      setItems(itemsRes.items ?? []);
      setJobOrders(joRes.jobOrders ?? []);

      if (!selectedItemId && itemsRes.items?.[0]) setSelectedItemId(itemsRes.items[0].id);
      const activeJO = selectedJO || (joRes.jobOrders?.[0]?.jobOrderNumber ?? '');
      if (activeJO) {
        setSelectedJO(activeJO);
        await loadJoCostData(activeJO);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تحميل بيانات التكاليف');
    } finally {
      setLoading(false);
    }
  }

  async function loadJoCostData(joNumber: string): Promise<void> {
    try {
      const res = await api.get<any>(`/cost/jobs/${joNumber}/summary`);
      setSummary(res?.summary ?? res);
    } catch {
      setSummary(null);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  async function handleJoChange(joNumber: string): Promise<void> {
    setSelectedJO(joNumber);
    await loadJoCostData(joNumber);
  }

  // Row Adders
  function addMaterialRow(): void {
    setMaterials([...materials, { id: String(Date.now()), name: '', length: 1, width: 1, height: 0, thickness: 1.2, qty: 1, scrapPct: 10, unitPrice: 0 }]);
  }
  function addAccessoryRow(): void {
    setAccessories([...accessories, { id: String(Date.now()), name: '', uomOrStation: 'عدد', qtyOrMins: 1, unitPriceOrRate: 0 }]);
  }
  function addConsumableRow(): void {
    setConsumables([...consumables, { id: String(Date.now()), name: '', uomOrStation: 'وحدة', qtyOrMins: 1, unitPriceOrRate: 0 }]);
  }
  function addOperationRow(): void {
    setOperations([...operations, { id: String(Date.now()), name: '', uomOrStation: 'محطة تشغيل', qtyOrMins: 10, unitPriceOrRate: 0 }]);
  }

  // Dynamic Cost Calculations
  const totalMaterialsCost = materials.reduce((sum, m) => {
    const totalQty = (Number(m.qty) || 0) * (1 + (Number(m.scrapPct) || 0) / 100);
    return sum + (totalQty * (Number(m.unitPrice) || 0));
  }, 0);

  const totalAccessoriesCost = accessories.reduce((sum, a) => sum + ((Number(a.qtyOrMins) || 0) * (Number(a.unitPriceOrRate) || 0)), 0);
  const totalConsumablesCost = consumables.reduce((sum, c) => sum + ((Number(c.qtyOrMins) || 0) * (Number(c.unitPriceOrRate) || 0)), 0);
  const totalOperationsCost = operations.reduce((sum, o) => sum + ((Number(o.qtyOrMins) || 0) * (Number(o.unitPriceOrRate) || 0)), 0);

  const initialDirectCost = totalMaterialsCost + totalAccessoriesCost + totalConsumablesCost + totalOperationsCost;
  const overheadCost = (initialDirectCost * ((Number(overheadPct) || 0) / 100));
  const estimatedUnitCost = initialDirectCost + overheadCost;

  // Actual JO Comparison Calculations
  const joBatchQty = Math.max(1, batchQty);
  const joEstimatedTotal = estimatedUnitCost * joBatchQty;
  const actualCostFromDb = Number(summary?.actualTotal ?? 0);
  const joTotalSelling = unitSellingPrice * joBatchQty;
  const estimatedProfit = joTotalSelling - joEstimatedTotal;
  const actualProfit = joTotalSelling - actualCostFromDb;
  const varianceTotal = actualCostFromDb - joEstimatedTotal;

  const inputStyle = { padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, width: '100%' };
  const thStyle = { background: '#1e293b', color: '#fff', padding: '8px 10px', fontSize: 12, textAlign: 'start' as const };
  const tdStyle = { padding: '6px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 13 };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">التكاليف المعيارية والفعلية</span>
          <h1>لوحة حساب وتحليل ربحية أوامر الشغل</h1>
          <p>تقدير تكلفة الصاج الطبية، الإكسسوارات، الدهان، وأزمنة التشغيل ومقارنتها بالمنصرف الفعلي في صالة الإنتاج</p>
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '2px solid #cbd5e1', paddingBottom: 10 }}>
        <button
          className={activeTab === 'estimator' ? 'btn btn--primary' : 'btn btn--secondary'}
          onClick={() => setActiveTab('estimator')}
          style={{ fontWeight: 'bold' }}
        >
          📋 الشيت التقديري وحساب تكلفة الصاج ومعدلات الهالك
        </button>
        <button
          className={activeTab === 'variance' ? 'btn btn--primary' : 'btn btn--secondary'}
          onClick={() => setActiveTab('variance')}
          style={{ fontWeight: 'bold' }}
        >
          📊 كارت تكلفة أمر الشغل والربحية الفعلية
        </button>
      </div>

      {activeTab === 'estimator' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Select Catalog Item */}
          <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 14, fontWeight: 'bold', color: '#0f172a' }}>اختر الصنف الفني من الكتالوج:</label>
            <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} style={{ ...inputStyle, minWidth: 240, fontWeight: 'bold', width: 'auto' }}>
              {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <label style={{ fontSize: 12, color: '#64748b' }}>تحميل المصنع العام (Overhead %):</label>
              <input type="number" value={overheadPct} onChange={(e) => setOverheadPct(Number(e.target.value))} style={{ ...inputStyle, width: 80 }} />
            </div>
          </div>

          {/* Unit Cost Banner Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, background: '#0f172a', color: '#fff', padding: 20, borderRadius: 8 }}>
            <div>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>إجمالي التكلفة المباشرة للقطعة</span>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold', color: '#38bdf8' }}>
                {initialDirectCost.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>مصروفات إشراف وإهلاك صناعية ({overheadPct}%)</span>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold', color: '#facc15' }}>
                {overheadCost.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.m
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>التكلفة التقديرية النهائية للمنتج الواحد</span>
              <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 'bold', color: '#4ade80' }}>
                {estimatedUnitCost.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
              </p>
            </div>
          </div>

          {/* 1. Dynamic Raw Materials Table */}
          <article className="panel module-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: '#1e293b', margin: 0 }}>1. المواد المباشرة والخامات الرئيسية (مع احتساب الهالك)</h3>
              <button className="btn btn--sm" onClick={addMaterialRow}>+ إضافة سطر صاج / خامة</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>الصنف / الخامة</th>
                    <th style={{ ...thStyle, width: 70 }}>طول م</th>
                    <th style={{ ...thStyle, width: 70 }}>عرض م</th>
                    <th style={{ ...thStyle, width: 70 }}>ارتفاع م</th>
                    <th style={{ ...thStyle, width: 70 }}>سمك مم</th>
                    <th style={{ ...thStyle, width: 70 }}>الكمية</th>
                    <th style={{ ...thStyle, width: 80 }}>الهالك %</th>
                    <th style={thStyle}>الكمية المحملة</th>
                    <th style={{ ...thStyle, width: 110 }}>سعر اللوح</th>
                    <th style={thStyle}>الإجمالي (ج.م)</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m, idx) => {
                    const totalQty = (Number(m.qty) || 0) * (1 + (Number(m.scrapPct) || 0) / 100);
                    const linePrice = totalQty * (Number(m.unitPrice) || 0);
                    return (
                      <tr key={m.id}>
                        <td style={tdStyle}>
                          <input value={m.name} onChange={(e) => { const updated = [...materials]; updated[idx]!.name = e.target.value; setMaterials(updated); }} style={inputStyle} />
                        </td>
                        <td style={tdStyle}><input type="number" value={m.length} onChange={(e) => { const updated = [...materials]; updated[idx]!.length = Number(e.target.value); setMaterials(updated); }} style={inputStyle} /></td>
                        <td style={tdStyle}><input type="number" value={m.width} onChange={(e) => { const updated = [...materials]; updated[idx]!.width = Number(e.target.value); setMaterials(updated); }} style={inputStyle} /></td>
                        <td style={tdStyle}><input type="number" value={m.height} onChange={(e) => { const updated = [...materials]; updated[idx]!.height = Number(e.target.value); setMaterials(updated); }} style={inputStyle} /></td>
                        <td style={tdStyle}><input type="number" value={m.thickness} onChange={(e) => { const updated = [...materials]; updated[idx]!.thickness = Number(e.target.value); setMaterials(updated); }} style={inputStyle} /></td>
                        <td style={tdStyle}><input type="number" value={m.qty} onChange={(e) => { const updated = [...materials]; updated[idx]!.qty = Number(e.target.value); setMaterials(updated); }} style={inputStyle} /></td>
                        <td style={tdStyle}><input type="number" value={m.scrapPct} onChange={(e) => { const updated = [...materials]; updated[idx]!.scrapPct = Number(e.target.value); setMaterials(updated); }} style={inputStyle} /></td>
                        <td style={tdStyle}><b>{totalQty.toFixed(2)}</b></td>
                        <td style={tdStyle}><input type="number" value={m.unitPrice} onChange={(e) => { const updated = [...materials]; updated[idx]!.unitPrice = Number(e.target.value); setMaterials(updated); }} style={inputStyle} /></td>
                        <td style={{ ...tdStyle, fontWeight: 'bold', color: '#0f172a' }}>{linePrice.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>

          {/* 2. Accessories & Consumables */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
            <article className="panel module-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ color: '#1e293b', margin: 0 }}>2. الإكسسوارات الطبية ومستلزمات الحركة</h3>
                <button className="btn btn--sm" onClick={addAccessoryRow}>+ بند إكسسوار</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>الإكسسوار</th>
                    <th style={thStyle}>الوحدة</th>
                    <th style={{ ...thStyle, width: 70 }}>الكمية</th>
                    <th style={{ ...thStyle, width: 90 }}>السعر</th>
                    <th style={thStyle}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {accessories.map((a, idx) => (
                    <tr key={a.id}>
                      <td style={tdStyle}><input value={a.name} onChange={(e) => { const updated = [...accessories]; updated[idx]!.name = e.target.value; setAccessories(updated); }} style={inputStyle} /></td>
                      <td style={tdStyle}><input value={a.uomOrStation} onChange={(e) => { const updated = [...accessories]; updated[idx]!.uomOrStation = e.target.value; setAccessories(updated); }} style={inputStyle} /></td>
                      <td style={tdStyle}><input type="number" value={a.qtyOrMins} onChange={(e) => { const updated = [...accessories]; updated[idx]!.qtyOrMins = Number(e.target.value); setAccessories(updated); }} style={inputStyle} /></td>
                      <td style={tdStyle}><input type="number" value={a.unitPriceOrRate} onChange={(e) => { const updated = [...accessories]; updated[idx]!.unitPriceOrRate = Number(e.target.value); setAccessories(updated); }} style={inputStyle} /></td>
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>{(a.qtyOrMins * a.unitPriceOrRate).toFixed(2)} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>

            <article className="panel module-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ color: '#1e293b', margin: 0 }}>3. مواد الدهان ومستهلكات الورش</h3>
                <button className="btn btn--sm" onClick={addConsumableRow}>+ إضافة مادة/دهان</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>المادة</th>
                    <th style={thStyle}>الوحدة</th>
                    <th style={{ ...thStyle, width: 70 }}>الكمية</th>
                    <th style={{ ...thStyle, width: 90 }}>السعر</th>
                    <th style={thStyle}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {consumables.map((c, idx) => (
                    <tr key={c.id}>
                      <td style={tdStyle}><input value={c.name} onChange={(e) => { const updated = [...consumables]; updated[idx]!.name = e.target.value; setConsumables(updated); }} style={inputStyle} /></td>
                      <td style={tdStyle}><input value={c.uomOrStation} onChange={(e) => { const updated = [...consumables]; updated[idx]!.uomOrStation = e.target.value; setConsumables(updated); }} style={inputStyle} /></td>
                      <td style={tdStyle}><input type="number" value={c.qtyOrMins} onChange={(e) => { const updated = [...consumables]; updated[idx]!.qtyOrMins = Number(e.target.value); setConsumables(updated); }} style={inputStyle} /></td>
                      <td style={tdStyle}><input type="number" value={c.unitPriceOrRate} onChange={(e) => { const updated = [...consumables]; updated[idx]!.unitPriceOrRate = Number(e.target.value); setConsumables(updated); }} style={inputStyle} /></td>
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>{(c.qtyOrMins * c.unitPriceOrRate).toFixed(2)} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          </div>

          {/* 3. Operations & Time */}
          <article className="panel module-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: '#1e293b', margin: 0 }}>4. أزمنة عمليات الماكينات والعمالة (ليزر، ثناية، تجميع)</h3>
              <button className="btn btn--sm" onClick={addOperationRow}>+ إضافة عملية تشغيلية</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>العملية</th>
                  <th style={thStyle}>محطة التشغيل / خط الإنتاج</th>
                  <th style={{ ...thStyle, width: 110 }}>الوقت (بالدقيقة)</th>
                  <th style={{ ...thStyle, width: 140 }}>أجر عمالة + كهرباء / دقيقة</th>
                  <th style={thStyle}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {operations.map((o, idx) => (
                  <tr key={o.id}>
                    <td style={tdStyle}><input value={o.name} onChange={(e) => { const updated = [...operations]; updated[idx]!.name = e.target.value; setOperations(updated); }} style={inputStyle} /></td>
                    <td style={tdStyle}><input value={o.uomOrStation} onChange={(e) => { const updated = [...operations]; updated[idx]!.uomOrStation = e.target.value; setOperations(updated); }} style={inputStyle} /></td>
                    <td style={tdStyle}><input type="number" value={o.qtyOrMins} onChange={(e) => { const updated = [...operations]; updated[idx]!.qtyOrMins = Number(e.target.value); setOperations(updated); }} style={inputStyle} /></td>
                    <td style={tdStyle}><input type="number" value={o.unitPriceOrRate} onChange={(e) => { const updated = [...operations]; updated[idx]!.unitPriceOrRate = Number(e.target.value); setOperations(updated); }} style={inputStyle} /></td>
                    <td style={{ ...tdStyle, fontWeight: 'bold', color: '#0f172a' }}>{(o.qtyOrMins * o.unitPriceOrRate).toFixed(2)} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </div>
      )}

      {activeTab === 'variance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Select JO */}
          <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 14, fontWeight: 'bold', color: '#475569' }}>اختر أمر الشغل (Job Order):</label>
              <select value={selectedJO} onChange={(e) => { void handleJoChange(e.target.value); }} style={{ ...inputStyle, minWidth: 220, fontWeight: 'bold', width: 'auto' }}>
                {jobOrders.map((j) => <option key={j.id} value={j.jobOrderNumber}>{j.jobOrderNumber}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 14, fontWeight: 'bold', color: '#475569' }}>الكمية المنجزة:</label>
              <input type="number" min="1" value={batchQty} onChange={(e) => setBatchQty(Math.max(1, Number(e.target.value)))} style={{ ...inputStyle, width: 80, fontWeight: 'bold' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 14, fontWeight: 'bold', color: '#475569' }}>سعر البيع للعميل:</label>
              <input type="number" min="0" value={unitSellingPrice} onChange={(e) => setSellingPrice(Number(e.target.value))} style={{ ...inputStyle, width: 120, fontWeight: 'bold' }} />
            </div>
          </div>

          {/* Variance Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <article className="panel" style={{ padding: 16 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>إجمالي مبيعات أمر الشغل</span>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold', color: '#0f172a' }}>
                {joTotalSelling.toLocaleString('ar-EG')} ج.م
              </p>
            </article>

            <article className="panel" style={{ padding: 16 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>إجمالي الميزانية التقديرية</span>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold', color: '#0369a1' }}>
                {joEstimatedTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
              </p>
            </article>

            <article className="panel" style={{ padding: 16 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>المنصرف والمنفذ الفعلي من صالة الإنتاج</span>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold', color: actualCostFromDb > joEstimatedTotal ? '#b91c1c' : '#166534' }}>
                {actualCostFromDb.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
              </p>
            </article>

            <article className="panel" style={{ padding: 16 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>صافي الأرباح الفعلية المحققة للمصنع</span>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold', color: actualProfit < estimatedProfit ? '#b91c1c' : '#166534' }}>
                {actualProfit.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
              </p>
            </article>
          </div>

          {/* Comparison Table */}
          <article className="panel module-panel">
            <h3 style={{ marginBottom: 16, color: '#1e293b' }}>مقارنة المخطط بالمنفذ الفعلي لأمر الشغل ({selectedJO})</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>بند التكلفة</th>
                  <th style={thStyle}>التقديري للمخطط</th>
                  <th style={thStyle}>المنفذ والمنصرف الفعلي</th>
                  <th style={thStyle}>الانحراف والوفر</th>
                  <th style={thStyle}>تقييم ورقابة التكاليف</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}><b>التكلفة المباشرة المجمعة (خامات + عمالة + تشغيل)</b></td>
                  <td style={tdStyle}>{(initialDirectCost * joBatchQty).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                  <td style={tdStyle}><b>{actualCostFromDb.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</b></td>
                  <td style={{ ...tdStyle, color: varianceTotal > 0 ? '#b91c1c' : '#166534', fontWeight: 'bold' }}>
                    {varianceTotal > 0 ? `+${varianceTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}` : `${varianceTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}`} ج.م
                  </td>
                  <td style={tdStyle}>
                    <span className={`status-badge status-badge--${varianceTotal > 0 ? 'cancelled' : 'active'}`}>
                      {varianceTotal > 0 ? 'تجاوز في الميزانية ⚠️' : 'وفر حقيقي ومطابق لميزانيتك ✅'}
                    </span>
                  </td>
                </tr>

                <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                  <td style={{ ...tdStyle, fontSize: 14 }}>إجمالي الميزانية مقابل الفعلي</td>
                  <td style={{ ...tdStyle, fontSize: 14 }}>{joEstimatedTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                  <td style={{ ...tdStyle, fontSize: 14, color: varianceTotal > 0 ? '#b91c1c' : '#166534' }}>{actualCostFromDb.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
                  <td style={{ ...tdStyle, fontSize: 14, color: varianceTotal > 0 ? '#b91c1c' : '#166534' }}>{varianceTotal > 0 ? `+${varianceTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}` : `${varianceTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}`} ج.م</td>
                  <td style={tdStyle}>
                    {varianceTotal > 0 ? (
                      <span style={{ color: '#b91c1c', fontSize: 12 }}>⚠️ تأكل في الأرباح بمقدار {varianceTotal.toLocaleString()} ج.م</span>
                    ) : (
                      <span style={{ color: '#166534', fontSize: 12 }}>✅ زيادة ممتازة في الأرباح التشغيلية</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </article>
        </div>
      )}
    </section>
  );
}