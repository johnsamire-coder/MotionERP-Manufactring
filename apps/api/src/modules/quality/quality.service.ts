import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ProductionService } from '../production/production.service';
import { ProductionOpsService } from '../production_ops/production_ops.service';
import { QualityNotFoundError, QualityValidationError } from './quality.errors';
import { QualityRepository } from './quality.repository';
import type {
  CreateQualityCheckPointInput, CreateSlaRuleInput, QualityCheckPointRecord, QualityCheckPointType,
  QualityWorkflowRecord, SlaRuleRecord,
} from './quality.types';

@Injectable()
export class QualityService {
  constructor(
    private readonly repository: QualityRepository,
    private readonly productionService: ProductionService,
    private readonly productionOpsService: ProductionOpsService,
  ) {}

  /**
   * Mandatory validation of the related entity a check point points to
   * (D2/D20: through each module's public service surface only, no direct
   * FK from quality to production/production_ops). Any failure from the
   * other module (its own NotFoundError) is normalized into
   * QualityNotFoundError so quality's own exception filter handles it
   * uniformly (404), instead of leaking a foreign error type. The entity's
   * orgNodeId is returned so the check point inherits the same
   * company/activity automatically — this was previously never verified at
   * all (a check point could reference a non-existent entity silently).
   */
  private async resolveRelatedEntityOrgNodeId(
    relatedEntityType: QualityCheckPointType,
    relatedEntityId: string,
  ): Promise<string | null> {
    try {
      if (relatedEntityType === 'production_step') {
        const step = await this.productionOpsService.getStep(relatedEntityId);
        return step.orgNodeId;
      }
      const request = await this.productionService.getRequest(relatedEntityId);
      return request.orgNodeId;
    } catch {
      throw new QualityNotFoundError(`${relatedEntityType} "${relatedEntityId}" does not exist`);
    }
  }

  async createCheckPoint(input: CreateQualityCheckPointInput): Promise<QualityCheckPointRecord> {
    const name = input.name.trim();
    if (!name) throw new QualityValidationError('name is required');
    if (input.targetDurationMinutes <= 0) throw new QualityValidationError('targetDurationMinutes must be positive');

    const orgNodeId = await this.resolveRelatedEntityOrgNodeId(input.relatedEntityType, input.relatedEntityId);

    return this.repository.insertCheckPoint({
      id: randomUUID(), ...input, name, orgNodeId,
      gracePeriodMinutes: input.gracePeriodMinutes ?? 0,
    });
  }

  async initializeWorkflow(checkPointId: string): Promise<QualityWorkflowRecord> {
    const checkPoint = await this.repository.findCheckPointById(checkPointId);
    if (!checkPoint) throw new QualityNotFoundError(`check point ${checkPointId} does not exist`);

    const existing = await this.repository.findWorkflowByCheckPoint(checkPointId);
    if (existing) throw new QualityValidationError(`workflow already exists for check point ${checkPointId}`);

    const enteredAt = new Date();
    const targetAt = new Date(enteredAt.getTime() + checkPoint.targetDurationMinutes * 60000);
    const graceUntil = new Date(targetAt.getTime() + checkPoint.gracePeriodMinutes * 60000);

    return this.repository.insertWorkflow({
      id: randomUUID(), checkPointId, enteredAt, targetAt, graceUntil,
      currentAssigneeId: checkPoint.assignedRoleId, status: 'pending', escalationLevel: 0,
    });
  }

  async approveCheckPoint(workflowId: string, actionTakenById: string, resultNote?: string): Promise<QualityWorkflowRecord> {
    return this.repository.updateWorkflowStatus(workflowId, 'approved', actionTakenById, resultNote);
  }

  async rejectCheckPoint(workflowId: string, actionTakenById: string, resultNote?: string): Promise<QualityWorkflowRecord> {
    return this.repository.updateWorkflowStatus(workflowId, 'rejected', actionTakenById, resultNote);
  }

  async createSlaRule(input: CreateSlaRuleInput): Promise<SlaRuleRecord> {
    if (input.delayMinutesAfterTarget < 0) throw new QualityValidationError('delayMinutesAfterTarget must be non-negative');

    const checkPoint = await this.repository.findCheckPointById(input.checkPointId);
    if (!checkPoint) throw new QualityNotFoundError(`check point ${input.checkPointId} does not exist`);

    return this.repository.insertSlaRule({ id: randomUUID(), ...input });
  }

  async processOverdueWorkflows(): Promise<number> {
    const now = new Date();
    const overdue = await this.repository.findOverdueWorkflows(now);
    let escalatedCount = 0;

    for (const workflow of overdue) {
      const nextRule = await this.repository.findRuleByLevel(workflow.checkPointId, workflow.escalationLevel + 1);
      if (!nextRule) continue;

      const newGraceUntil = new Date(workflow.targetAt.getTime() + nextRule.delayMinutesAfterTarget * 60000);
      await this.repository.updateWorkflowEscalation(
        workflow.id, nextRule.assignToRoleId, nextRule.escalationLevel, newGraceUntil,
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
}
