import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface JobOrderRecord { id: string; jobOrderNumber: string; customerId?: string; }

interface MaterialRow {
  name: string;
  length: number;
  width: number;
  height: number;
  thickness: number;
  qty: number;
  scrapPct: number;
  unitPrice: number;
}

interface AccessoryRow {
  name: string;
  uom: string;
  qty: number;
  unitPrice: number;
}

interface ConsumableRow {
  name: string;
  uom: string;
  qty: number;
  unitPrice: number;
}

interface OperationRow {
  name: string;
  mins: number;
  ratePerMin: number;
}

export function CostingPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'estimator' | 'variance'>('estimator');
  const [jobOrders, setJobOrders] = useState<JobOrderRecord[]>([]);
  const [selectedJO, setSelectedJO] = useState('');
  const [joQty, setJoQty] = useState<number>(5);

  // Default Excel Sheet Data for Single Unit (Model Metallic Cabinet)
  const [materials, setMaterials] = useState<MaterialRow[]>([
    { name: 'صاج مجلفن (1 مم)', length: 1.25, width: 3, height: 0, thickness: 1, qty: 3, scrapPct: 10, unitPrice: 1421.83 },
    { name: 'صاج مجلفن (2 مم)', length: 1.25, width: 2.5, height: 0, thickness: 2, qty: 0.08, scrapPct: 10, unitPrice: 2700 },
    { name: 'علب صلب 4*6 (2 مم)', length: 6, width: 4, height: 6, thickness: 2, qty: 4, scrapPct: 10, unitPrice: 660.15 },
    { name: 'علب صلب 4*10 (2 مم)', length: 10, width: 4, height: 6, thickness: 2, qty: 0.65, scrapPct: 10, unitPrice: 950 },
  ]);

  const [accessories, setAccessories] = useState<AccessoryRow[]>([
    { name: 'مسمار M5', uom: 'العدد', qty: 36, unitPrice: 0.12 },
    { name: 'طبة رجل', uom: 'العدد', qty: 12, unitPrice: 3.75 },
    { name: 'صامولة جلبة M10', uom: 'العدد', qty: 12, unitPrice: 0.5 },
    { name: 'رجلاش', uom: 'العدد', qty: 12, unitPrice: 5 },
    { name: 'مسمار سن صاج', uom: 'العدد', qty: 48, unitPrice: 0.2 },
    { name: 'صامولة M5', uom: 'العدد', qty: 36, unitPrice: 0.3 },
  ]);

  const [consumables, setConsumables] = useState<ConsumableRow[]>([
    { name: 'بودرة + مصنعية دهان', uom: 'دفعة', qty: 1, unitPrice: 3500 },
    { name: 'غاز أرجون', uom: 'لتر', qty: 22, unitPrice: 23.75 },
    { name: 'عدسة حماية فايبر ليزر', uom: 'عدد', qty: 0.5, unitPrice: 180 },
    { name: 'عدسة لحام', uom: 'عدد', qty: 0.07, unitPrice: 180 },
    { name: 'سلك لحام 1 مم', uom: 'كجم', qty: 0.27, unitPrice: 110 },
    { name: 'غاز CO2', uom: 'لتر', qty: 4.32, unitPrice: 30 },
    { name: 'حجر صنفرة', uom: 'عدد', qty: 1.5, unitPrice: 25 },
    { name: 'فواني لحام', uom: 'عدد', qty: 0.35, unitPrice: 20 },
    { name: 'كاب لحام', uom: 'عدد', qty: 0.35, unitPrice: 37.5 },
  ]);

  const [operations, setOperations] = useState<OperationRow[]>([
    { name: 'وقت الليزر (كهرباء 7.5 + عمالة)', mins: 70, ratePerMin: 8.65 },
    { name: 'وقت التناية (كهرباء 7.5 + عمالة)', mins: 90, ratePerMin: 7.83 },
    { name: 'وقت اللحام (كهرباء 7.5 + عمالة)', mins: 100, ratePerMin: 7.74 },
    { name: 'وقت البرادة (كهرباء 3.8 + عمالة)', mins: 105, ratePerMin: 3.80 },
    { name: 'وقت التجميع (كهرباء 3.8 + عمالة)', mins: 45, ratePerMin: 3.80 },
  ]);

  const [overheadPct, setOverheadPct] = useState<number>(20);

  // Calculations for Excel Estimator Model
  const totalMaterialsCost = materials.reduce((sum, m) => {
    const totalQty = m.qty * (1 + m.scrapPct / 100);
    return sum + (totalQty * m.unitPrice);
  }, 0);

  const totalAccessoriesCost = accessories.reduce((sum, a) => sum + (a.qty * a.unitPrice), 0);
  const totalConsumablesCost = consumables.reduce((sum, c) => sum + (c.qty * c.unitPrice), 0);
  const totalOperationsCost = operations.reduce((sum, o) => sum + (o.mins * o.ratePerMin), 0);

  const initialDirectCost = totalMaterialsCost + totalAccessoriesCost + totalConsumablesCost + totalOperationsCost;
  const overheadCost = (initialDirectCost * (overheadPct / 100));
  const estimatedUnitCost = initialDirectCost + overheadCost;

  // Actual JO simulation
  const joEstimatedTotal = estimatedUnitCost * joQty;
  const joActualMaterials = totalMaterialsCost * joQty * 1.08; // 8% material variance
  const joActualOperations = totalOperationsCost * joQty * 1.05; // 5% time variance
  const joActualConsumables = (totalAccessoriesCost + totalConsumablesCost) * joQty * 0.98;
  const joActualOverhead = overheadCost * joQty;
  const joActualTotal = joActualMaterials + joActualOperations + joActualConsumables + joActualOverhead;
  const joSellingPrice = 8500 * joQty; // 8,500 EGP per unit selling price
  const estimatedProfit = joSellingPrice - joEstimatedTotal;
  const actualProfit = joSellingPrice - joActualTotal;
  const varianceTotal = joActualTotal - joEstimatedTotal;

  useEffect(() => {
    async function fetchJOs(): Promise<void> {
      try {
        const res = await api.get<{ jobOrders: JobOrderRecord[] }>('/sales/job-orders');
        setJobOrders(res.jobOrders ?? []);
        if (res.jobOrders?.[0]) setSelectedJO(res.jobOrders[0].jobOrderNumber);
      } catch {
        // quiet
      }
    }
    void fetchJOs();
  }, []);

  const inputStyle = { padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13 };
  const thStyle = { background: '#1e293b', color: '#fff', padding: '8px 10px', fontSize: 12, textAlign: 'start' as const };
  const tdStyle = { padding: '8px 10px', borderBottom: '1px solid #e2e8f0', fontSize: 13 };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.costing.eyebrow')}</span>
          <h1>{t('pages.costing.title')}</h1>
          <p>{t('pages.costing.description')}</p>
        </div>
      </div>

      {/* Tabs Bar */}
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
          {/* Unit Cost Summary Top Banner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, background: '#0f172a', color: '#fff', padding: 20, borderRadius: 8 }}>
            <div>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>التكلفة المباشرة الأولية للقطعة</span>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold', color: '#38bdf8' }}>
                {initialDirectCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>إشراف وأهلاكات مضافة ({overheadPct}%)</span>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold', color: '#facc15' }}>
                {overheadCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>إجمالي التكلفة المعيارية للقطعة الواحدة</span>
              <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 'bold', color: '#4ade80' }}>
                {estimatedUnitCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </p>
            </div>
          </div>

          {/* 1. Raw Materials Excel Table */}
          <article className="panel module-panel">
            <h3 style={{ marginBottom: 12, color: '#1e293b' }}>1. {t('pages.costing.estimator.rawMaterials')}</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>الخامة</th>
                    <th style={thStyle}>طول م</th>
                    <th style={thStyle}>عرض م</th>
                    <th style={thStyle}>ارتفاع م</th>
                    <th style={thStyle}>سمك مم</th>
                    <th style={thStyle}>الكمية</th>
                    <th style={thStyle}>نسبة الهالك %</th>
                    <th style={thStyle}>إجمالي الكمية</th>
                    <th style={thStyle}>سعر القطعة/الوحدة</th>
                    <th style={thStyle}>السعر الإجمالي (ج.م)</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m, idx) => {
                    const totalQty = m.qty * (1 + m.scrapPct / 100);
                    const linePrice = totalQty * m.unitPrice;
                    return (
                      <tr key={idx}>
                        <td style={tdStyle}><b>{m.name}</b></td>
                        <td style={tdStyle}>{m.length}</td>
                        <td style={tdStyle}>{m.width}</td>
                        <td style={tdStyle}>{m.height}</td>
                        <td style={tdStyle}>{m.thickness}</td>
                        <td style={tdStyle}>{m.qty}</td>
                        <td style={tdStyle}>
                          <span className="status status--warning" style={{ fontSize: 11 }}>{m.scrapPct}%</span>
                        </td>
                        <td style={tdStyle}><b>{totalQty.toFixed(2)}</b></td>
                        <td style={tdStyle}>{m.unitPrice.toLocaleString()}</td>
                        <td style={{ ...tdStyle, fontWeight: 'bold', color: '#0f172a' }}>
                          {linePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
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

          {/* 2. Accessories & Consumables Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
            {/* Accessories */}
            <article className="panel module-panel">
              <h3 style={{ marginBottom: 12, color: '#1e293b' }}>2. {t('pages.costing.estimator.accessories')}</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>الإكسسوار</th>
                    <th style={thStyle}>الوحدة</th>
                    <th style={thStyle}>الكمية</th>
                    <th style={thStyle}>السعر</th>
                    <th style={thStyle}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {accessories.map((a, idx) => (
                    <tr key={idx}>
                      <td style={tdStyle}><b>{a.name}</b></td>
                      <td style={tdStyle}>{a.uom}</td>
                      <td style={tdStyle}>{a.qty}</td>
                      <td style={tdStyle}>{a.unitPrice}</td>
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>{(a.qty * a.unitPrice).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ textAlign: 'end', marginTop: 10, fontWeight: 'bold', fontSize: 14 }}>
                إجمالي الإكسسوارات: <span style={{ color: '#0369a1' }}>{totalAccessoriesCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP</span>
              </div>
            </article>

            {/* Consumables & Paint */}
            <article className="panel module-panel">
              <h3 style={{ marginBottom: 12, color: '#1e293b' }}>3. {t('pages.costing.estimator.consumables')}</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>البند / المادة</th>
                    <th style={thStyle}>الوحدة</th>
                    <th style={thStyle}>الكمية</th>
                    <th style={thStyle}>السعر</th>
                    <th style={thStyle}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {consumables.map((c, idx) => (
                    <tr key={idx}>
                      <td style={tdStyle}><b>{c.name}</b></td>
                      <td style={tdStyle}>{c.uom}</td>
                      <td style={tdStyle}>{c.qty}</td>
                      <td style={tdStyle}>{c.unitPrice}</td>
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>{(c.qty * c.unitPrice).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ textAlign: 'end', marginTop: 10, fontWeight: 'bold', fontSize: 14 }}>
                إجمالي الدهان والمستهلكات: <span style={{ color: '#0369a1' }}>{totalConsumablesCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP</span>
              </div>
            </article>
          </div>

          {/* 3. Operations & Time */}
          <article className="panel module-panel">
            <h3 style={{ marginBottom: 12, color: '#1e293b' }}>4. {t('pages.costing.estimator.operations')}</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>محطة التشغيل / العملية</th>
                  <th style={thStyle}>الوقت (دقيقة)</th>
                  <th style={thStyle}>تكلفة الدقيقة (عمالة + كهرباء)</th>
                  <th style={thStyle}>التكلفة الإجمالية (ج.م)</th>
                </tr>
              </thead>
              <tbody>
                {operations.map((o, idx) => (
                  <tr key={idx}>
                    <td style={tdStyle}><b>{o.name}</b></td>
                    <td style={tdStyle}>{o.mins} دقيقة</td>
                    <td style={tdStyle}>{o.ratePerMin} ج.م/دقيقة</td>
                    <td style={{ ...tdStyle, fontWeight: 'bold', color: '#0f172a' }}>{(o.mins * o.ratePerMin).toFixed(2)}</td>
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
          {/* JO Selection & Quantity Config */}
          <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 14, fontWeight: 'bold', color: '#475569' }}>أمر التشغيل (Job Order):</label>
              <select value={selectedJO} onChange={(e) => setSelectedJO(e.target.value)} style={{ ...inputStyle, minWidth: 200, fontWeight: 'bold' }}>
                {jobOrders.map((j) => <option key={j.id} value={j.jobOrderNumber}>{j.jobOrderNumber}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 14, fontWeight: 'bold', color: '#475569' }}>كمية الطلبية (عدد القطع):</label>
              <input type="number" min="1" value={joQty} onChange={(e) => setJoQty(Math.max(1, Number(e.target.value)))} style={{ ...inputStyle, width: 80, fontWeight: 'bold' }} />
            </div>
          </div>

          {/* Order Variance Executive Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <article className="panel" style={{ padding: 16 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>سعر بيع الطلبية للعميل (5 قطع)</span>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold', color: '#0f172a' }}>
                {joSellingPrice.toLocaleString('en-US')} EGP
              </p>
            </article>

            <article className="panel" style={{ padding: 16 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>الميزانية التقديرية المخططة</span>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold', color: '#0369a1' }}>
                {joEstimatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </p>
            </article>

            <article className="panel" style={{ padding: 16 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>المنفق الفعلي الحقيقي من المصنع</span>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold', color: joActualTotal > joEstimatedTotal ? '#b91c1c' : '#166534' }}>
                {joActualTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </p>
            </article>

            <article className="panel" style={{ padding: 16 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>صافي الربح الفعلي بعد الانحرافات</span>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold', color: actualProfit < estimatedProfit ? '#b91c1c' : '#166534' }}>
                {actualProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </p>
            </article>
          </div>

          {/* Detailed Line-by-Line Variance Comparison Table */}
          <article className="panel module-panel">
            <h3 style={{ marginBottom: 16, color: '#1e293b' }}>{t('pages.costing.variance.joTitle')}</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>بند التكلفة</th>
                  <th style={thStyle}>التقديري للطلب ({joQty} قطع)</th>
                  <th style={thStyle}>الفعلي الفعلي من المصنع</th>
                  <th style={thStyle}>قيمة الانحراف (فروق)</th>
                  <th style={thStyle}>نسبة الانحراف %</th>
                  <th style={thStyle}>الحالة والرقابة</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}><b>الخامات الرئيسية (صاج وعُلب)</b></td>
                  <td style={tdStyle}>{(totalMaterialsCost * joQty).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</td>
                  <td style={tdStyle}><b>{joActualMaterials.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</b></td>
                  <td style={{ ...tdStyle, color: '#b91c1c', fontWeight: 'bold' }}>+{(joActualMaterials - totalMaterialsCost * joQty).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</td>
                  <td style={tdStyle}><span className="status status--warning">+8.0%</span></td>
                  <td style={tdStyle}>⚠️ زيادة هالك الصاج والقص</td>
                </tr>

                <tr>
                  <td style={tdStyle}><b>أوقات التشغيل والماكينات</b></td>
                  <td style={tdStyle}>{(totalOperationsCost * joQty).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</td>
                  <td style={tdStyle}><b>{joActualOperations.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</b></td>
                  <td style={{ ...tdStyle, color: '#b91c1c', fontWeight: 'bold' }}>+{(joActualOperations - totalOperationsCost * joQty).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</td>
                  <td style={tdStyle}><span className="status status--warning">+5.0%</span></td>
                  <td style={tdStyle}>⚠️ تأخير في وقت التناية واللحام</td>
                </tr>

                <tr>
                  <td style={tdStyle}><b>الإكسسوارات والمستهلكات والدهان</b></td>
                  <td style={tdStyle}>{((totalAccessoriesCost + totalConsumablesCost) * joQty).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</td>
                  <td style={tdStyle}><b>{joActualConsumables.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</b></td>
                  <td style={{ ...tdStyle, color: '#166534', fontWeight: 'bold' }}>-{( (totalAccessoriesCost + totalConsumablesCost) * joQty - joActualConsumables ).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</td>
                  <td style={tdStyle}><span className="status status--success">-2.0%</span></td>
                  <td style={tdStyle}>✓ توفير في بودرة الدهان</td>
                </tr>

                <tr>
                  <td style={tdStyle}><b>الإشراف والمصروفات غير المباشرة (Overhead 20%)</b></td>
                  <td style={tdStyle}>{(overheadCost * joQty).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</td>
                  <td style={tdStyle}><b>{joActualOverhead.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</b></td>
                  <td style={tdStyle}>0.00 EGP</td>
                  <td style={tdStyle}><span className="status status--neutral">0.0%</span></td>
                  <td style={tdStyle}>مطابق للميزانية</td>
                </tr>

                <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                  <td style={{ ...tdStyle, fontSize: 14 }}>إجمالي أمر التشغيل بالكامل</td>
                  <td style={{ ...tdStyle, fontSize: 14 }}>{joEstimatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</td>
                  <td style={{ ...tdStyle, fontSize: 14, color: varianceTotal > 0 ? '#b91c1c' : '#166534' }}>{joActualTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</td>
                  <td style={{ ...tdStyle, fontSize: 14, color: varianceTotal > 0 ? '#b91c1c' : '#166534' }}>+{varianceTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</td>
                  <td style={tdStyle}><span className="status status--danger">+{((varianceTotal / joEstimatedTotal) * 100).toFixed(1)}%</span></td>
                  <td style={tdStyle}>⚠️ تآكل في صافي أرباح أمر التشغيل بقيمة {(estimatedProfit - actualProfit).toLocaleString()} ج.م</td>
                </tr>
              </tbody>
            </table>
          </article>
        </div>
      )}
    </section>
  );
}
