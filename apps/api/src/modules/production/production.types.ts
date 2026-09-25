export type MaterialRequestStatus =
  'approved' | 'pending_review' | 'rejected' | 'issued' | 'closed';

export interface MaterialRequestRecord {
  id: string;
  jobOrderReference: string;
  orgNodeId: string | null;
  itemId: string;
  warehouseId: string;
  plannedQuantity: string;
  requestedQuantity: string;
  issuedQuantity: string | null;
  actualUsedQuantity: string | null;
  issueMovementId: string | null;
  issuedValue: string | null;
  status: MaterialRequestStatus;
  deviationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaterialRequestInput {
  jobOrderReference: string;
  itemId: string;
  warehouseId: string;
  plannedQuantity: string;
  requestedQuantity: string;
}

/** One material request line of the planned-vs-actual report (values at the actual issue rate). */
export interface MaterialVarianceLine {
  requestId: string;
  itemId: string;
  warehouseId: string;
  status: MaterialRequestStatus;
  deviationReason: string | null;
  plannedQuantity: string;
  requestedQuantity: string;
  issuedQuantity: string | null;
  actualUsedQuantity: string | null;
  overRequestQuantity: string;
  usageVarianceQuantity: string | null;
  notReturnedQuantity: string | null;
  actualRate: string | null;
  plannedValue: string | null;
  issuedValue: string | null;
  usedValue: string | null;
  usageVarianceValue: string | null;
}

export interface MaterialVarianceReport {
  jobOrderReference: string;
  lines: MaterialVarianceLine[];
  totals: {
    plannedValue: string;
    issuedValue: string;
    usedValue: string;
    usageVarianceValue: string;
    notReturnedValue: string;
  };
  /** Lines not issued yet (or issued before the issue value was recorded): no value yet. */
  pendingLines: number;
}
