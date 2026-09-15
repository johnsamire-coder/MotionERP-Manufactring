export type SalesForecastBasedOn = 'job_order';
export type SalesForecastPeriodicity = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
export type SalesForecastStatus = 'draft' | 'submitted';

export interface SalesForecastLineRecord {
  id: string; salesForecastId: string; itemId: string; warehouseId: string | null;
  forecastQuantity: string; plannedQuantity: string | null; lineNumber: number;
}
export interface SalesForecastLineInput {
  itemId: string; warehouseId?: string; forecastQuantity: string; plannedQuantity?: string;
}

export interface SalesForecastRecord {
  id: string; forecastNumber: string; orgNodeId: string; itemCategoryId: string;
  warehouseId: string | null; fromDate: string; toDate: string;
  basedOn: SalesForecastBasedOn; forecastPeriodicity: SalesForecastPeriodicity;
  status: SalesForecastStatus; lines: SalesForecastLineRecord[];
}
export interface CreateSalesForecastInput {
  orgNodeId: string; itemCategoryId: string; warehouseId?: string;
  fromDate: string; toDate: string; forecastPeriodicity?: SalesForecastPeriodicity;
  lines: SalesForecastLineInput[];
}

export type MaterialRequestPurpose = 'purchase' | 'material_transfer' | 'material_issue' | 'manufacture';
export type MaterialRequestStatus = 'draft' | 'submitted' | 'cancelled';

export interface MaterialRequestLineRecord {
  id: string; materialRequestId: string; itemId: string; warehouseId: string | null;
  quantity: string; scheduleDate: string | null; lineNumber: number;
}
export interface MaterialRequestLineInput {
  itemId: string; warehouseId?: string; quantity: string; scheduleDate?: string;
}

export interface MaterialRequestRecord {
  id: string; requestNumber: string; orgNodeId: string; purpose: MaterialRequestPurpose;
  transactionDate: string; requiredByDate: string | null; jobOrderReference: string | null;
  status: MaterialRequestStatus; lines: MaterialRequestLineRecord[];
}
export interface CreateMaterialRequestInput {
  orgNodeId: string; purpose?: MaterialRequestPurpose; requiredByDate?: string;
  jobOrderReference?: string; lines: MaterialRequestLineInput[];
}

export type ProductionPlanBy = 'job_order' | 'material_request' | 'sales_forecast';
export type ProductionPlanStatus = 'draft' | 'submitted' | 'completed' | 'closed';

export interface ProductionPlanItemRecord {
  id: string; productionPlanId: string; productItemId: string; bomId: string;
  qtyToPlan: string; warehouseId: string | null; workOrderId: string | null; lineNumber: number;
}
export interface ProductionPlanItemInput {
  productItemId: string; bomId: string; qtyToPlan: string; warehouseId?: string;
}

export interface ProductionPlanRecord {
  id: string; planNumber: string; orgNodeId: string; planBy: ProductionPlanBy;
  fromDate: string; toDate: string; status: ProductionPlanStatus; items: ProductionPlanItemRecord[];
}
export interface CreateProductionPlanInput {
  orgNodeId: string; planBy?: ProductionPlanBy; fromDate: string; toDate: string;
  items: ProductionPlanItemInput[];
}

export interface SupplierLeadTimeRecord { id: string; itemLeadTimeId: string; supplierName: string; leadTimeDays: string; }
export interface SupplierLeadTimeInput { supplierName: string; leadTimeDays: string; }

export interface ItemLeadTimeRecord {
  id: string; itemId: string; orgNodeId: string;
  manufacturingTimeHours: string | null; isManufacturingLeadTime: boolean; manufacturingBufferDays: string | null;
  purchaseTimeDays: string | null; isPurchaseLeadTime: boolean; purchaseBufferDays: string | null;
  supplierLeadTimes: SupplierLeadTimeRecord[];
}
export interface CreateItemLeadTimeInput {
  itemId: string; orgNodeId: string;
  manufacturingTimeHours?: string; isManufacturingLeadTime?: boolean; manufacturingBufferDays?: string;
  purchaseTimeDays?: string; isPurchaseLeadTime?: boolean; purchaseBufferDays?: string;
  supplierLeadTimes?: SupplierLeadTimeInput[];
}

export type MpsPeriod = 'week' | 'month' | 'quarter' | 'year';
export type MpsStatus = 'draft' | 'submitted';

export interface MpsScheduleLineRecord {
  id: string; masterProductionScheduleId: string; period: MpsPeriod;
  startDate: string; endDate: string; forecastQuantity: string; plannedQuantity: string | null; lineNumber: number;
}
export interface MpsScheduleLineInput {
  period: MpsPeriod; startDate: string; endDate: string; forecastQuantity: string; plannedQuantity?: string;
}

export interface MasterProductionScheduleRecord {
  id: string; mpsNumber: string; itemId: string; orgNodeId: string; warehouseId: string | null;
  fromDate: string; toDate: string; totalForecastQuantity: string | null; projectedQuantity: string | null;
  plannedQuantity: string | null; status: MpsStatus; scheduleLines: MpsScheduleLineRecord[];
}
export interface CreateMpsInput {
  itemId: string; orgNodeId: string; warehouseId?: string; fromDate: string; toDate: string;
  totalForecastQuantity?: string; plannedQuantity?: string; scheduleLines: MpsScheduleLineInput[];
}
