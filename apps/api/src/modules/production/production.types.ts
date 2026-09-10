export type MaterialRequestStatus = 'approved' | 'pending_review' | 'rejected' | 'issued' | 'closed';

export interface MaterialRequestRecord {
  id: string; jobOrderReference: string; itemId: string; warehouseId: string;
  plannedQuantity: string; requestedQuantity: string; issuedQuantity: string | null;
  actualUsedQuantity: string | null; status: MaterialRequestStatus; deviationReason: string | null;
  createdAt: string; updatedAt: string;
}

export interface CreateMaterialRequestInput {
  jobOrderReference: string; itemId: string; warehouseId: string;
  plannedQuantity: string; requestedQuantity: string;
}
