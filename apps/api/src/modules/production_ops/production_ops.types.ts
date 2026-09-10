export type WorkCenterStatus = 'active' | 'inactive' | 'archived';
export type ProductionStepStatus = 'pending' | 'in_progress' | 'done';

export interface WorkCenterRecord {
  id: string; code: string; name: string; orgNodeId: string; ratePerMinute: string; status: WorkCenterStatus;
}
export interface CreateWorkCenterInput { code: string; name: string; orgNodeId: string; ratePerMinute?: string; }

export interface ProductionStepRecord {
  id: string; jobOrderReference: string; workCenterId: string; operationName: string;
  standardTimeMinutes: string; actualTimeMinutes: string | null; sequence: number; status: ProductionStepStatus;
}
export interface CreateProductionStepInput {
  jobOrderReference: string; workCenterId: string; operationName: string; standardTimeMinutes: string;
}

export interface JobOrderLaborCost {
  jobOrderReference: string; totalStandardMinutes: string; totalActualMinutes: string;
  totalStandardCost: string; totalActualCost: string; stepsCount: number; stepsDone: number;
}
