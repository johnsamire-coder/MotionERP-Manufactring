export type WorkCenterStatus = 'active' | 'inactive' | 'archived';
export type ProductionStepStatus = 'pending' | 'in_progress' | 'done';
export type WorkOrderStatus = 'not_started' | 'in_progress' | 'completed' | 'stopped' | 'closed';
export type WorkstationTypeStatus = 'active' | 'inactive';
export type OperationStatus = 'active' | 'inactive';

export interface WorkCenterRecord {
  id: string; code: string; name: string; orgNodeId: string; ratePerMinute: string; status: WorkCenterStatus;
}
export interface CreateWorkCenterInput { code: string; name: string; orgNodeId: string; ratePerMinute?: string; }

export interface ProductionStepRecord {
  id: string; jobOrderReference: string; workOrderId: string | null; orgNodeId: string | null; workCenterId: string;
  operationName: string; standardTimeMinutes: string; actualTimeMinutes: string | null;
  forQuantity: string | null; completedQuantity: string; processLossQuantity: string | null;
  allowOverproduction: boolean; overproductionPercentage: string | null; operatorEmployeeId: string | null;
  sequence: number; status: ProductionStepStatus;
}
export interface CreateProductionStepInput {
  jobOrderReference: string; workOrderId?: string; workCenterId: string; operationName: string; standardTimeMinutes: string;
  forQuantity?: string; allowOverproduction?: boolean; overproductionPercentage?: string; operatorEmployeeId?: string;
}

export interface ProductionStepTimeLogRecord {
  id: string; productionStepId: string; fromTime: string; toTime: string | null; timeInMinutes: string | null;
  completedQuantity: string | null; processLossQuantity: string | null;
}
export interface AddTimeLogInput {
  productionStepId: string; fromTime: string; toTime?: string; timeInMinutes?: string;
  completedQuantity?: string; processLossQuantity?: string;
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
  createdAt: string;
}
export interface CreateWorkOrderInput {
  productItemId: string; bomId: string; orgNodeId: string; jobOrderReference?: string;
  qtyToManufacture: string; sourceWarehouseId?: string; wipWarehouseId?: string; finishedGoodsWarehouseId: string;
  plannedStartDate?: string;
}

export interface WorkstationTypeRecord { id: string; code: string; name: string; status: WorkstationTypeStatus; }
export interface CreateWorkstationTypeInput { code: string; name: string; }

export interface OperationRecord {
  id: string; code: string; name: string; defaultWorkCenterId: string | null; standardTimeMinutes: string | null; status: OperationStatus;
}
export interface CreateOperationInput {
  code: string; name: string; defaultWorkCenterId?: string; standardTimeMinutes?: string;
}

export interface DowntimeEntryRecord {
  id: string; workCenterId: string; operatorEmployeeId: string | null; stopReason: string;
  startTime: string; stopTime: string | null; stoppageMinutes: string | null; remarks: string | null;
}
export interface CreateDowntimeEntryInput {
  workCenterId: string; operatorEmployeeId?: string; stopReason: string; startTime: string; remarks?: string;
}
