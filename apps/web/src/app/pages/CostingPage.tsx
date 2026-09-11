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
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Dynamic Form State for Item Cost Estimator
  const [materials, setMaterials] = useState<DynamicMaterialRow[]>([
    { id: '1', name: 'خامة صاج', length: 1, width: 1, height: 0, thickness: 1, qty: 1, scrapPct: 10, unitPrice: 1000 }
  ]);
  const [accessories, setAccessories] = useState<DynamicRow[]>([
    { id: '1', name: 'مسمار / طقم تثبيت', uomOrStation: 'عدد', qtyOrMins: 10, unitPriceOrRate: 2 }
  ]);
  const [consumables, setConsumables] = useState<DynamicRow[]>([
    { id: '1', name: 'دهان ومستلزمات', uomOrStation: 'لتر/كجم', qtyOrMins: 1, unitPriceOrRate: 500 }
  ]);
  const [operations, setOperations] = useState<DynamicRow[]>([
    { id: '1', name: 'وقت التجهيز والقص', uomOrStation: 'محطة القص', qtyOrMins: 30, unitPriceOrRate: 5 }
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
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ jobOrders: JobOrderRecord[] }>('/sales/job-orders'),
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
      setError(err instanceof ApiError ? err.message : 'Failed to load costing data');
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
    setMaterials([...materials, { id: String(Date.now()), name: '', length: 1, width: 1, height: 0, thickness: 1, qty: 1, scrapPct: 10, unitPrice: 0 }]);
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
          <span className="eyebrow">{t('pages.costing.eyebrow')}</span>
          <h1>{t('pages.costing.title')}</h1>
          <p>{t('pages.costing.description')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '2px solid #cbd5e1', paddingBottom: 10 }}>
        <button
          className={activeTab === 'estimator' ? 'primary-button' : 'filter-button'}
          onClick={() => setActiveTab('estimator')}
          style={{ fontWeight: 'bold' }}
        >
          📋 {t('pages.costing.tabs.estimator')}
        </button>
        <button
          className={activeTab === 'variance' ? 'primary-button' : 'filter-button'}
          onClick={() => setActiveTab('variance')}
          style={{ fontWeight: 'bold' }}
        >
          📊 {t('pages.costing.tabs.variance')}
        </button>
      </div>

      {activeTab === 'estimator' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Select Catalog Item */}
          <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 14, fontWeight: 'bold', color: '#0f172a' }}>اختر الصنف من الكتالوج لجلب/إنشاء شيت التكلفة:</label>
            <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} style={{ ...inputStyle, minWidth: 240, fontWeight: 'bold', width: 'auto' }}>
              {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <label style={{ fontSize: 12, color: '#64748b' }}>نسبة الإشراف والأهلاك %:</label>
              <input type="number" value={overheadPct} onChange={(e) => setOverheadPct(Number(e.target.value))} style={{ ...inputStyle, width: 80 }} />
            </div>
          </div>

          {/* Unit Cost Banner Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, background: '#0f172a', color: '#fff', padding: 20, borderRadius: 8 }}>
            <div>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>التكلفة المباشرة للقطعة</span>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold', color: '#38bdf8' }}>
                {initialDirectCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>مصروفات إشراف وأهلاك ({overheadPct}%)</span>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold', color: '#facc15' }}>
                {overheadCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>التكلفة التقديرية للقطعة الواحدة</span>
              <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 'bold', color: '#4ade80' }}>
                {estimatedUnitCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </p>
            </div>
          </div>

          {/* 1. Dynamic Raw Materials Table */}
          <article className="panel module-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: '#1e293b', margin: 0 }}>1. {t('pages.costing.estimator.rawMaterials')}</h3>
              <button className="filter-button" onClick={addMaterialRow}>+ إضافة سطر خامة</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>الخامة</th>
                    <th style={{ ...thStyle, width: 70 }}>طول م</th>
                    <th style={{ ...thStyle, width: 70 }}>عرض م</th>
                    <th style={{ ...thStyle, width: 70 }}>ارتفاع م</th>
                    <th style={{ ...thStyle, width: 70 }}>سمك مم</th>
                    <th style={{ ...thStyle, width: 70 }}>الكمية</th>
                    <th style={{ ...thStyle, width: 80 }}>الهالك %</th>
                    <th style={thStyle}>إجمالي الكمية</th>
                    <th style={{ ...thStyle, width: 110 }}>سعر الوحدة</th>
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
                        <td style={{ ...tdStyle, fontWeight: 'bold', color: '#0f172a' }}>{linePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ textAlign: 'end', marginTop: 10, fontWeight: 'bold', fontSize: 14 }}>
              إجمالي الخامات: <span style={{ color: '#0369a1' }}>{totalMaterialsCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP</span>
            </div>
          </article>

          {/* 2. Accessories & Consumables */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
            <article className="panel module-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ color: '#1e293b', margin: 0 }}>2. {t('pages.costing.estimator.accessories')}</h3>
                <button className="filter-button" onClick={addAccessoryRow}>+ بند إكسسوار</button>
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
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>{(a.qtyOrMins * a.unitPriceOrRate).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ textAlign: 'end', marginTop: 10, fontWeight: 'bold', fontSize: 14 }}>
                إجمالي الإكسسوارات: <span style={{ color: '#0369a1' }}>{totalAccessoriesCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP</span>
              </div>
            </article>

            <article className="panel module-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ color: '#1e293b', margin: 0 }}>3. {t('pages.costing.estimator.consumables')}</h3>
                <button className="filter-button" onClick={addConsumableRow}>+ بند دهان/مستهلك</button>
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
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>{(c.qtyOrMins * c.unitPriceOrRate).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ textAlign: 'end', marginTop: 10, fontWeight: 'bold', fontSize: 14 }}>
                إجمالي المستهلكات والدهان: <span style={{ color: '#0369a1' }}>{totalConsumablesCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP</span>
              </div>
            </article>
          </div>

          {/* 3. Operations & Time */}
          <article className="panel module-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: '#1e293b', margin: 0 }}>4. {t('pages.costing.estimator.operations')}</h3>
              <button className="filter-button" onClick={addOperationRow}>+ عملية/محطة تشغيل</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>اسم الخطوة/العملية</th>
                  <th style={thStyle}>اسم محطة التشغيل</th>
                  <th style={{ ...thStyle, width: 110 }}>الوقت (دقيقة)</th>
                  <th style={{ ...thStyle, width: 140 }}>تكلفة الدقيقة (ج.م)</th>
                  <th style={thStyle}>الإجمالي (ج.م)</th>
                </tr>
              </thead>
              <tbody>
                {operations.map((o, idx) => (
                  <tr key={o.id}>
                    <td style={tdStyle}><input value={o.name} onChange={(e) => { const updated = [...operations]; updated[idx]!.name = e.target.value; setOperations(updated); }} style={inputStyle} /></td>
                    <td style={tdStyle}><input value={o.uomOrStation} onChange={(e) => { const updated = [...operations]; updated[idx]!.uomOrStation = e.target.value; setOperations(updated); }} style={inputStyle} /></td>
                    <td style={tdStyle}><input type="number" value={o.qtyOrMins} onChange={(e) => { const updated = [...operations]; updated[idx]!.qtyOrMins = Number(e.target.value); setOperations(updated); }} style={inputStyle} /></td>
                    <td style={tdStyle}><input type="number" value={o.unitPriceOrRate} onChange={(e) => { const updated = [...operations]; updated[idx]!.unitPriceOrRate = Number(e.target.value); setOperations(updated); }} style={inputStyle} /></td>
                    <td style={{ ...tdStyle, fontWeight: 'bold', color: '#0f172a' }}>{(o.qtyOrMins * o.unitPriceOrRate).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: 'end', marginTop: 10, fontWeight: 'bold', fontSize: 14 }}>
              إجمالي عمالة وتشغيل المحطات: <span style={{ color: '#0369a1' }}>{totalOperationsCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP</span>
            </div>
          </article>
        </div>
      )}

      {activeTab === 'variance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Dynamic JO Selection & Parameters */}
          <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 14, fontWeight: 'bold', color: '#475569' }}>أمر التشغيل (Job Order):</label>
              <select value={selectedJO} onChange={(e) => { void handleJoChange(e.target.value); }} style={{ ...inputStyle, minWidth: 220, fontWeight: 'bold', width: 'auto' }}>
                {jobOrders.map((j) => <option key={j.id} value={j.jobOrderNumber}>{j.jobOrderNumber}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 14, fontWeight: 'bold', color: '#475569' }}>كمية الدفعة (عدد القطع):</label>
              <input type="number" min="1" value={batchQty} onChange={(e) => setBatchQty(Math.max(1, Number(e.target.value)))} style={{ ...inputStyle, width: 80, fontWeight: 'bold' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 14, fontWeight: 'bold', color: '#475569' }}>سعر بيع القطعة للعميل (EGP):</label>
              <input type="number" min="0" value={unitSellingPrice} onChange={(e) => setSellingPrice(Number(e.target.value))} style={{ ...inputStyle, width: 120, fontWeight: 'bold' }} />
            </div>
          </div>

          {/* Dynamic Variance Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <article className="panel" style={{ padding: 16 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>إجمالي سعر بيع الطلبية ({joBatchQty} قطع)</span>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold', color: '#0f172a' }}>
                {joTotalSelling.toLocaleString('en-US')} EGP
              </p>
            </article>

            <article className="panel" style={{ padding: 16 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>الميزانية التقديرية المخططة (الشيت التقديري × {joBatchQty})</span>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold', color: '#0369a1' }}>
                {joEstimatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </p>
            </article>

            <article className="panel" style={{ padding: 16 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>المنفق الفعلي المسجل بالداتابيز لأمر التشغيل</span>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold', color: actualCostFromDb > joEstimatedTotal ? '#b91c1c' : '#166534' }}>
                {actualCostFromDb.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </p>
            </article>

            <article className="panel" style={{ padding: 16 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>صافي الربح الفعلي الحقيقي</span>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold', color: actualProfit < estimatedProfit ? '#b91c1c' : '#166534' }}>
                {actualProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </p>
            </article>
          </div>

          {/* Variance Analysis Comparison Table */}
          <article className="panel module-panel">
            <h3 style={{ marginBottom: 16, color: '#1e293b' }}>مقارنة الميزانية بالمنفق الفعلي لأمر التشغيل ({selectedJO})</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>بند التكلفة</th>
                  <th style={thStyle}>التقديري للطلب ({joBatchQty} قطع)</th>
                  <th style={thStyle}>المنفق الفعلي من الداتابيز</th>
                  <th style={thStyle}>الانحراف (ج.م)</th>
                  <th style={thStyle}>التقييم والرقابة</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}><b>التكلفة المباشرة المجمعة (خامات + تشغيل)</b></td>
                  <td style={tdStyle}>{(initialDirectCost * joBatchQty).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</td>
                  <td style={tdStyle}><b>{actualCostFromDb.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</b></td>
                  <td style={{ ...tdStyle, color: varianceTotal > 0 ? '#b91c1c' : '#166534', fontWeight: 'bold' }}>
                    {varianceTotal > 0 ? `+${varianceTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `${varianceTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} EGP
                  </td>
                  <td style={tdStyle}>
                    <span className={`status status--${varianceTotal > 0 ? 'danger' : 'success'}`}>
                      {varianceTotal > 0 ? 'تجاوز الميزانية ⚠️' : 'ضمن الميزانية ✓'}
                    </span>
                  </td>
                </tr>

                <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                  <td style={{ ...tdStyle, fontSize: 14 }}>إجمالي الميزانية مقابل الفعلي</td>
                  <td style={{ ...tdStyle, fontSize: 14 }}>{joEstimatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</td>
                  <td style={{ ...tdStyle, fontSize: 14, color: varianceTotal > 0 ? '#b91c1c' : '#166534' }}>{actualCostFromDb.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</td>
                  <td style={{ ...tdStyle, fontSize: 14, color: varianceTotal > 0 ? '#b91c1c' : '#166534' }}>{varianceTotal > 0 ? `+${varianceTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `${varianceTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} EGP</td>
                  <td style={tdStyle}>
                    {varianceTotal > 0 ? (
                      <span style={{ color: '#b91c1c', fontSize: 12 }}>⚠️ تآكل في الأرباح بمقدار {varianceTotal.toLocaleString()} ج.م</span>
                    ) : (
                      <span style={{ color: '#166534', fontSize: 12 }}>✓ أرباح مستقرة ضمن الميزانية</span>
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
