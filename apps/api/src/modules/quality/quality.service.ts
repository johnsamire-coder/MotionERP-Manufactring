import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { QualityNotFoundError, QualityValidationError } from './quality.errors';
import { QualityRepository } from './quality.repository';
import type {
  CreateQualityCheckPointInput, CreateSlaRuleInput, QualityCheckPointRecord,
  QualityWorkflowRecord, SlaRuleRecord,
} from './quality.types';

@Injectable()
export class QualityService {
  constructor(private readonly repository: QualityRepository) {}

  async createCheckPoint(input: CreateQualityCheckPointInput): Promise<QualityCheckPointRecord> {
    const name = input.name.trim();
    if (!name) throw new QualityValidationError('name is required');
    if (input.targetDurationMinutes <= 0) throw new QualityValidationError('targetDurationMinutes must be positive');

    return this.repository.insertCheckPoint({
      id: randomUUID(), ...input, name,
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

  /**
   * The actual escalation logic (was a TODO stub before this fix): for every
   * workflow still 'pending' past its graceUntil, find the SLA rule for the
   * NEXT escalation level. If found, reassign the workflow to that rule's
   * role, bump escalationLevel, and push graceUntil forward by
   * delayMinutesAfterTarget from the ORIGINAL targetAt (so each level's
   * deadline is anchored to the original target, not to "now"). If no next
   * rule exists, the workflow simply stays overdue at its current level —
   * there is no 'escalated' status in the schema by design; escalation is
   * expressed purely via escalationLevel + currentAssigneeId while status
   * remains 'pending'.
   */
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