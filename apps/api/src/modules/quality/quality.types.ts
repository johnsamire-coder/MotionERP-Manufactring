export type QualityCheckPointType = 'production_step' | 'material_request';
export type QualityWorkflowStatus = 'pending' | 'approved' | 'rejected';
export type QualityInspectionReferenceType =
  'purchase_receipt' | 'production_step' | 'delivery_order';
export type QualityInspectionStatus = 'pending' | 'passed' | 'failed';
export type QualityParameterStatus = 'pending' | 'pass' | 'fail';

export interface QualityCheckPointRecord {
  id: string;
  relatedEntityType: QualityCheckPointType;
  relatedEntityId: string;
  orgNodeId: string | null;
  name: string;
  targetDurationMinutes: number;
  gracePeriodMinutes: number;
  assignedRoleId: string | null;
}

export interface CreateQualityCheckPointInput {
  relatedEntityType: QualityCheckPointType;
  relatedEntityId: string;
  name: string;
  targetDurationMinutes: number;
  gracePeriodMinutes?: number;
  assignedRoleId?: string;
}

export interface QualityWorkflowRecord {
  id: string;
  checkPointId: string;
  enteredAt: Date;
  targetAt: Date;
  graceUntil: Date;
  currentAssigneeId: string | null;
  status: QualityWorkflowStatus;
  actionTakenAt: Date | null;
  actionTakenById: string | null;
  resultNote: string | null;
  escalationLevel: number;
}

export interface SlaRuleRecord {
  id: string;
  checkPointId: string;
  escalationLevel: number;
  delayMinutesAfterTarget: number;
  assignToRoleId: string;
  notificationTemplate: string | null;
}

export interface CreateSlaRuleInput {
  checkPointId: string;
  escalationLevel: number;
  delayMinutesAfterTarget: number;
  assignToRoleId: string;
  notificationTemplate?: string;
}

// --- New Quality Inspection Types ---
export interface QualityInspectionParameterRecord {
  id: string;
  inspectionId: string;
  parameterName: string;
  targetValue: string;
  actualValue: string | null;
  status: QualityParameterStatus;
  createdAt: string;
}

export interface QualityInspectionRecord {
  id: string;
  inspectionNumber: string;
  orgNodeId: string;
  itemId: string;
  referenceType: QualityInspectionReferenceType;
  referenceId: string;
  status: QualityInspectionStatus;
  inspectedBy: string | null;
  inspectedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  parameters: QualityInspectionParameterRecord[];
}

export interface CreateInspectionParameterInput {
  parameterName: string;
  targetValue: string;
}

export interface CreateQualityInspectionInput {
  orgNodeId: string;
  itemId: string;
  referenceType: QualityInspectionReferenceType;
  referenceId: string;
  notes?: string;
  parameters: CreateInspectionParameterInput[];
}
