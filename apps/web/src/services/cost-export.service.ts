// ============================================================
// Motion ERP — Costing & Profitability Export Service
// Step 88 | Professional Excel (xlsx) & PDF Generators
// ============================================================
import * as XLSX from 'xlsx';

export interface CostExportMaterial {
  name: string;
  unit: string;
  netQty: number;
  scrapPercentage: number;
  grossQty: number;
  unitCost: number;
  totalCost: number;
}
export interface CostExportOperation {
  workstation: string;
  operationName: string;
  setupTimeMin: number;
  runTimeMin: number;
  totalTimeMin: number;
  hourlyRate: number;
  totalCost: number;
}

export const costExportService = {
  // ── 1. تصدير كارت التكلفة الشامل إلى Excel ──
  exportJobCostSheetToExcel(
    workOrderNumber: string,
    summary: {
      targetUnits: number;
      totalDirectMaterials: number;
      totalDirectLabor: number;
      totalOverhead: number;
      totalJobCost: number;
      unitCost: number;
      unitSellingPriceWithVat: number;
    },
    materials: CostExportMaterial[],
    operations: CostExportOperation[],
  ) {
    const wb = XLSX.utils.book_new();

    // Sheet 1: الملخص المالي العام
    const summaryData = [
      ['Motion ERP — كارت التكلفة الصناعية الفعلية', ''],
      ['رقم أمر الشغل (Work Order)', workOrderNumber],
      ['الكمية المصنعة (وحدة)', summary.targetUnits],
      ['تاريخ الاستخراج', new Date().toLocaleDateString('ar-EG')],
      ['', ''],
      ['بيان التكلفة', 'المبلغ (جنيه مصري)'],
      ['1. إجمالي الخامات المباشرة والصاج (Direct Materials)', summary.totalDirectMaterials],
      ['2. إجمالي أزمنة الماكينات والعمالة (Direct Labor & Machines)', summary.totalDirectLabor],
      ['3. المصاريف الصناعية غير المباشرة (Applied Overhead 25%)', summary.totalOverhead],
      ['إجمالي التكلفة الصناعية الكلية لأمر الشغل', summary.totalJobCost],
      ['تكلفة تصنيع الوحدة الواحدة', summary.unitCost],
      ['سعر البيع المقترح للوحدة (شامل 14% ضريبة)', summary.unitSellingPriceWithVat],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'الملخص المالي والتسعير');

    // Sheet 2: تفصيل الخامات والصاج والهالك
    const materialsData = [
      [
        'بيان الخامة والصنف',
        'الوحدة',
        'الكمية الصافية',
        'نسبة الهالك %',
        'المنصرف الفعلي',
        'سعر الوحدة',
        'إجمالي التكلفة',
      ],
      ...materials.map((m) => [
        m.name,
        m.unit,
        m.netQty,
        m.scrapPercentage > 0 ? `${m.scrapPercentage}%` : '0%',
        m.grossQty,
        m.unitCost,
        m.totalCost,
      ]),
    ];
    const wsMaterials = XLSX.utils.aoa_to_sheet(materialsData);
    XLSX.utils.book_append_sheet(wb, wsMaterials, 'الخامات والصاج والهالك');

    // Sheet 3: أزمنة الماكينات والتشغيل
    const operationsData = [
      [
        'مركز العمل / الماكينة',
        'العملية الصناعية',
        'زمن التجهيز (د)',
        'زمن التشغيل (د)',
        'إجمالي الزمن (د)',
        'معدل الساعة',
        'تكلفة التشغيل',
      ],
      ...operations.map((op) => [
        op.workstation,
        op.operationName,
        op.setupTimeMin,
        op.runTimeMin,
        op.totalTimeMin,
        op.hourlyRate,
        op.totalCost,
      ]),
    ];
    const wsOperations = XLSX.utils.aoa_to_sheet(operationsData);
    XLSX.utils.book_append_sheet(wb, wsOperations, 'أزمنة ومصنعيات الماكينات');

    // حفظ وتنزيل الملف
    XLSX.writeFile(wb, `Job_Cost_Sheet_${workOrderNumber}_${Date.now()}.xlsx`);
  },

  // ── 2. تصدير كشف مقارنة المعياري بالفعلي إلى Excel ──
  exportStandardVsActualToExcel(
    workOrderNumber: string,
    variances: Array<Record<string, unknown>>,
  ) {
    const wb = XLSX.utils.book_new();

    const data = [
      ['تقرير مقارنة التكلفة المعيارية بالفعلية وتحليل الانحرافات', ''],
      ['رقم أمر الشغل', workOrderNumber],
      ['تاريخ التقرير', new Date().toLocaleDateString('ar-EG')],
      ['', ''],
      [
        'البند الصناعي',
        'نوع التكلفة',
        'الوحدة',
        'المعياري المخطط',
        'الفعلي الحقيقي',
        'انحراف الكمية',
        'التكلفة المعيارية',
        'التكلفة الفعلية',
        'صافي الانحراف المالي',
      ],
      ...variances.map((v) => [
        v.item,
        v.type,
        v.unit,
        v.standardQty,
        v.actualQty,
        v.qtyVariance,
        v.standardCost,
        v.actualCost,
        v.costVariance,
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'مقارنة المعياري والفعلي');
    XLSX.writeFile(wb, `Standard_Vs_Actual_${workOrderNumber}.xlsx`);
  },

  // ── 3. تصدير كشف ربحية أوامر الشغل إلى Excel ──
  exportProfitabilityToExcel(orders: Array<Record<string, unknown>>) {
    const wb = XLSX.utils.book_new();

    const data = [
      ['تقرير ربحية أوامر الشغل ومبيعات المستشفيات', ''],
      ['تاريخ الاستخراج', new Date().toLocaleDateString('ar-EG')],
      ['', ''],
      [
        'أمر الشغل',
        'رقم الفاتورة',
        'المستشفى / العميل',
        'المنتج الطبي',
        'الكمية',
        'الإيراد المحقق',
        'التكلفة الفعلية',
        'صافي الربح الفعلي',
        'هامش الربح %',
        'المستهدف %',
      ],
      ...orders.map((o) => [
        o.workOrderNumber,
        o.salesInvoiceNumber,
        o.customerName,
        o.productName,
        o.quantity,
        o.revenueEgp,
        o.totalActualCost,
        o.netProfitEgp,
        `${o.netMarginPct}%`,
        `${o.targetMarginPct}%`,
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'ربحية أوامر الشغل');
    XLSX.writeFile(wb, `Order_Profitability_Report_${Date.now()}.xlsx`);
  },
};
