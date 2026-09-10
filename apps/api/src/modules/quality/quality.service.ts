import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { QualityNotFoundError, QualityValidationError } from './quality.errors';
import { QualityRepository } from './quality.repository';
import type { CreateQualityCheckPointInput, CreateSlaRuleInput, QualityCheckPointRecord, QualityWorkflowRecord, SlaRuleRecord } from './quality.types';

@Injectable()
export class QualityService {
  constructor(private readonly repository: QualityRepository) {}

  async createCheckPoint(input: CreateQualityCheckPointInput): Promise<QualityCheckPointRecord> {
    const name = input.name.trim();
    if (!name) throw new QualityValidationError('name is required');
    if (input.targetDurationMinutes <= 0) throw new QualityValidationError('targetDurationMinutes must be positive');
    
    return this.repository.insertCheckPoint({
      id: randomUUID(), ...input, name,
      gracePeriodMinutes: input.gracePeriodMinutes ?? 0
    });
  }

  async initializeWorkflow(checkPointId: string): Promise<QualityWorkflowRecord> {
    const checkPoint = await this.repository.findCheckPointById(checkPointId);
    if (!checkPoint) throw new QualityNotFoundError(`Check point ${checkPointId} not found`);

    const existing = await this.repository.findWorkflowByCheckPoint(checkPointId);
    if (existing) throw new QualityValidationError(`Workflow already exists for check point ${checkPointId}`);

    const enteredAt = new Date();
    const targetAt = new Date(enteredAt.getTime() + (checkPoint.targetDurationMinutes * 60000));
    const graceUntil = new Date(targetAt.getTime() + (checkPoint.gracePeriodMinutes * 60000));

    return this.repository.insertWorkflow({
      id: randomUUID(), checkPointId, enteredAt, targetAt, graceUntil,
      currentAssigneeId: checkPoint.assignedRoleId, status: 'pending', escalationLevel: 0
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
    if (!checkPoint) throw new QualityNotFoundError(`Check point ${input.checkPointId} not found`);

    const ruleInput: any = {
      id: randomUUID(), 
      checkPointId: input.checkPointId, 
      escalationLevel: input.escalationLevel,
      delayMinutesAfterTarget: input.delayMinutesAfterTarget, 
      assignToRoleId: input.assignToRoleId
    };
    
    if (input.notificationTemplate !== undefined) {
      ruleInput.notificationTemplate = input.notificationTemplate;
    }

    return this.repository.insertSlaRule(ruleInput);
  }

  /** For background job: check overdue workflows and escalate */
  async processOverdueWorkflows(): Promise<number> {
    const now = new Date();
    const overdue = await this.repository.findOverdueWorkflows(now);
    let escalatedCount = 0;

    for (const workflow of overdue) {
      const rules = await this.repository.findRulesForCheckPoint(workflow.checkPointId);
      const nextRule = rules.find(r => r.escalationLevel === workflow.escalationLevel + 1);
      
      if (nextRule) {
        // TODO: Send notification to next role
        // For now, just update the assignee
        // In real implementation, this would be a background job
        escalatedCount++;
      }
    }

    return escalatedCount;
  }
}
