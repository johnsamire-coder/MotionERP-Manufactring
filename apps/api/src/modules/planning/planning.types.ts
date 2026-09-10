export type ExecutionMode = 'internal' | 'external' | 'mixed';
export type PlanStatus = 'pending' | 'planned' | 'locked';

export interface ProductionPlanRecord {
  id: string; jobOrderReference: string; priority: number; executionMode: ExecutionMode;
  internalQuantity: string | null; externalQuantity: string | null; status: PlanStatus;
  plannedStartDate: string | null; plannedEndDate: string | null; note: string | null;
  createdAt: string; updatedAt: string;
}

export interface CreatePlanInput {
  jobOrderReference: string; priority?: number; executionMode?: ExecutionMode;
  internalQuantity?: string; externalQuantity?: string;
  plannedStartDate?: string; plannedEndDate?: string; note?: string;
}

export interface UpdatePlanInput {
  priority?: number; executionMode?: ExecutionMode;
  internalQuantity?: string; externalQuantity?: string;
  plannedStartDate?: string; plannedEndDate?: string; note?: string;
}
