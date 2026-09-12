export type QualityCheckPointType = 'production_step' | 'material_request';
export type QualityWorkflowStatus = 'pending' | 'approved' | 'rejected';

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
