export type WorkCenterStatus = 'active' | 'inactive' | 'archived';
export type ProductionStepStatus = 'pending' | 'in_progress' | 'done';
export type WorkOrderStatus = 'not_started' | 'in_progress' | 'completed' | 'stopped' | 'closed';

export interface WorkCenterRecord {
  id: string; code: string; name: string; orgNodeId: string; ratePerMinute: string; status: WorkCenterStatus;
}
export interface CreateWorkCenterInput { code: string; name: string; orgNodeId: string; ratePerMinute?: string; }

export interface ProductionStepRecord {
  id: string; jobOrderReference: string; orgNodeId: string | null; workCenterId: string; operationName: string;
  standardTimeMinutes: string; actualTimeMinutes: string | null; sequence: number; status: ProductionStepStatus;
}
export interface CreateProductionStepInput {
  jobOrderReference: string; workCenterId: string; operationName: string; standardTimeMinutes: string;
}

export interface JobOrderLaborCost {
  jobOrderReference: string; totalStandardMinutes: string; totalActualMinutes: string;
  totalStandardCost: string; totalActualCost: string; stepsCount: number; stepsDone: number;
}

export interface WorkOrderRecord {
  id: string; workOrderNumber: string; productItemId: string; bomId: string; orgNodeId: string;
  jobOrderReference: string | null; qtyToManufacture: string;
  sourceWarehouseId: string | null; wipWarehouseId: string | null; finishedGoodsWarehouseId: string;
  plannedStartDate: string | null; actualStartDate: string | null; actualEndDate: string | null;
  status: WorkOrderStatus;
}
export interface CreateWorkOrderInput {
  productItemId: string; bomId: string; orgNodeId: string; jobOrderReference?: string;
  qtyToManufacture: string; sourceWarehouseId?: string; wipWarehouseId?: string; finishedGoodsWarehouseId: string;
  plannedStartDate?: string;
}
