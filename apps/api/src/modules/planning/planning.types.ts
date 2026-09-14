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
