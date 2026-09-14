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
