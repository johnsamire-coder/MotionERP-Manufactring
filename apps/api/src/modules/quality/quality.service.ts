import { randomUUID } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { ProductionService } from '../production/production.service';
import { ProductionOpsService } from '../production_ops/production_ops.service';
import { QualityNotFoundError, QualityValidationError } from './quality.errors';
import { QualityRepository } from './quality.repository';
import type {
  CreateQualityCheckPointInput,
  CreateSlaRuleInput,
  QualityCheckPointRecord,
  QualityCheckPointType,
  QualityWorkflowRecord,
  SlaRuleRecord,
  QualityInspectionRecord,
  CreateQualityInspectionInput,
  QualityInspectionStatus,
} from './quality.types';

@Injectable()
export class QualityService {
  constructor(
    private readonly repository: QualityRepository,
    @Optional() private readonly productionService?: ProductionService,
    @Optional() private readonly productionOpsService?: ProductionOpsService,
  ) {}

  private async resolveRelatedEntityOrgNodeId(
    relatedEntityType: QualityCheckPointType,
    relatedEntityId: string,
  ): Promise<string | null> {
    try {
      if (relatedEntityType === 'production_step' && this.productionOpsService) {
        const step = await this.productionOpsService.getStep(relatedEntityId);
        return step.orgNodeId;
      }
      if (relatedEntityType === 'material_request' && this.productionService) {
        const request = await this.productionService.getRequest(relatedEntityId);
        return request.orgNodeId;
      }
      return null;
    } catch {
      throw new QualityNotFoundError(`${relatedEntityType} "${relatedEntityId}" does not exist`);
    }
  }

  async createCheckPoint(input: CreateQualityCheckPointInput): Promise<QualityCheckPointRecord> {
    const name = input.name.trim();
    if (!name) throw new QualityValidationError('name is required');
    if (input.targetDurationMinutes <= 0)
      throw new QualityValidationError('targetDurationMinutes must be positive');

    const orgNodeId = await this.resolveRelatedEntityOrgNodeId(
      input.relatedEntityType,
      input.relatedEntityId,
    );

    return this.repository.insertCheckPoint({
      id: randomUUID(),
      ...input,
      name,
      orgNodeId,
      gracePeriodMinutes: input.gracePeriodMinutes ?? 0,
    });
  }

  async initializeWorkflow(checkPointId: string): Promise<QualityWorkflowRecord> {
    const checkPoint = await this.repository.findCheckPointById(checkPointId);
    if (!checkPoint) throw new QualityNotFoundError(`check point ${checkPointId} does not exist`);

    const existing = await this.repository.findWorkflowByCheckPoint(checkPointId);
    if (existing)
      throw new QualityValidationError(`workflow already exists for check point ${checkPointId}`);

    const enteredAt = new Date();
    const targetAt = new Date(enteredAt.getTime() + checkPoint.targetDurationMinutes * 60000);
    const graceUntil = new Date(targetAt.getTime() + checkPoint.gracePeriodMinutes * 60000);

    return this.repository.insertWorkflow({
      id: randomUUID(),
      checkPointId,
      enteredAt,
      targetAt,
      graceUntil,
      currentAssigneeId: checkPoint.assignedRoleId,
      status: 'pending',
      escalationLevel: 0,
    });
  }

  async approveCheckPoint(
    workflowId: string,
    actionTakenById: string,
    resultNote?: string,
  ): Promise<QualityWorkflowRecord> {
    return this.repository.updateWorkflowStatus(
      workflowId,
      'approved',
      actionTakenById,
      resultNote,
    );
  }

  async rejectCheckPoint(
    workflowId: string,
    actionTakenById: string,
    resultNote?: string,
  ): Promise<QualityWorkflowRecord> {
    return this.repository.updateWorkflowStatus(
      workflowId,
      'rejected',
      actionTakenById,
      resultNote,
    );
  }

  async createSlaRule(input: CreateSlaRuleInput): Promise<SlaRuleRecord> {
    if (input.delayMinutesAfterTarget < 0)
      throw new QualityValidationError('delayMinutesAfterTarget must be non-negative');

    const checkPoint = await this.repository.findCheckPointById(input.checkPointId);
    if (!checkPoint)
      throw new QualityNotFoundError(`check point ${input.checkPointId} does not exist`);

    return this.repository.insertSlaRule({ id: randomUUID(), ...input });
  }

  async processOverdueWorkflows(): Promise<number> {
    const now = new Date();
    const overdue = await this.repository.findOverdueWorkflows(now);
    let escalatedCount = 0;

    for (const workflow of overdue) {
      const nextRule = await this.repository.findRuleByLevel(
        workflow.checkPointId,
        workflow.escalationLevel + 1,
      );
      if (!nextRule) continue;

      const newGraceUntil = new Date(
        workflow.targetAt.getTime() + nextRule.delayMinutesAfterTarget * 60000,
      );
      await this.repository.updateWorkflowEscalation(
        workflow.id,
        nextRule.assignToRoleId,
        nextRule.escalationLevel,
        newGraceUntil,
      );
      escalatedCount++;
    }

    return escalatedCount;
  }

  async getCheckPoints(): Promise<QualityCheckPointRecord[]> {
    return this.repository.findAllCheckPoints();
  }

  async getWorkflows(): Promise<QualityWorkflowRecord[]> {
    return this.repository.findAllWorkflows();
  }

  // --- Quality Inspection Management (New) ---

  async createQualityInspection(
    input: CreateQualityInspectionInput,
  ): Promise<QualityInspectionRecord> {
    if (!input.orgNodeId) throw new QualityValidationError('orgNodeId is required');
    if (!input.itemId) throw new QualityValidationError('itemId is required');
    if (!input.parameters || input.parameters.length === 0) {
      throw new QualityValidationError('inspection parameters are required');
    }

    const sequence = (await this.repository.countInspections()) + 1;
    const year = new Date().getFullYear();
    const inspectionNumber = `QINSP-${year}-${String(sequence).padStart(6, '0')}`;

    return this.repository.insertInspection({
      ...input,
      id: randomUUID(),
      inspectionNumber,
    });
  }

  async getInspection(id: string): Promise<QualityInspectionRecord> {
    const found = await this.repository.findInspectionById(id);
    if (!found) throw new QualityNotFoundError(`quality inspection ${id} does not exist`);
    return found;
  }

  async evaluateInspection(
    id: string,
    inspectedBy: string,
    notes?: string,
    paramResults?: Array<{ parameterId: string; actualValue: string; status: 'pass' | 'fail' }>,
  ): Promise<QualityInspectionRecord> {
    const inspection = await this.getInspection(id);
    if (inspection.status !== 'pending') {
      throw new QualityValidationError(`inspection ${id} is already completed`);
    }

    let finalStatus: QualityInspectionStatus = 'passed';
    if (paramResults) {
      const hasFailure = paramResults.some((p) => p.status === 'fail');
      if (hasFailure) finalStatus = 'failed';
    }

    return this.repository.updateInspectionStatus(
      id,
      finalStatus,
      inspectedBy,
      notes,
      paramResults,
    );
  }
}
