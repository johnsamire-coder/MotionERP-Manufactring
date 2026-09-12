import { Injectable } from '@nestjs/common';
import { and, asc, eq, gt, gte, lte } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { qualityCheckPoint, qualityWorkflow, slaRule } from './quality.schema';
import type {
  CreateQualityCheckPointInput, CreateSlaRuleInput, QualityCheckPointRecord, QualityWorkflowRecord, SlaRuleRecord
} from './quality.types';

const cpColumns = {
  id: qualityCheckPoint.id, relatedEntityType: qualityCheckPoint.relatedEntityType, relatedEntityId: qualityCheckPoint.relatedEntityId,
  orgNodeId: qualityCheckPoint.orgNodeId,
  name: qualityCheckPoint.name, targetDurationMinutes: qualityCheckPoint.targetDurationMinutes, gracePeriodMinutes: qualityCheckPoint.gracePeriodMinutes,
  assignedRoleId: qualityCheckPoint.assignedRoleId
};

const wfColumns = {
  id: qualityWorkflow.id, checkPointId: qualityWorkflow.checkPointId, enteredAt: qualityWorkflow.enteredAt, targetAt: qualityWorkflow.targetAt,
  graceUntil: qualityWorkflow.graceUntil, currentAssigneeId: qualityWorkflow.currentAssigneeId, status: qualityWorkflow.status,
  actionTakenAt: qualityWorkflow.actionTakenAt, actionTakenById: qualityWorkflow.actionTakenById, resultNote: qualityWorkflow.resultNote,
  escalationLevel: qualityWorkflow.escalationLevel
};

const ruleColumns = {
  id: slaRule.id, checkPointId: slaRule.checkPointId, escalationLevel: slaRule.escalationLevel,
  delayMinutesAfterTarget: slaRule.delayMinutesAfterTarget, assignToRoleId: slaRule.assignToRoleId, notificationTemplate: slaRule.notificationTemplate
};

interface CpRow {
  id: string; relatedEntityType: string; relatedEntityId: string; orgNodeId: string | null; name: string; targetDurationMinutes: number;
  gracePeriodMinutes: number; assignedRoleId: string | null;
}

interface WfRow {
  id: string; checkPointId: string; enteredAt: Date; targetAt: Date; graceUntil: Date; currentAssigneeId: string | null;
  status: string; actionTakenAt: Date | null; actionTakenById: string | null; resultNote: string | null; escalationLevel: number;
}

interface RuleRow {
  id: string; checkPointId: string; escalationLevel: number; delayMinutesAfterTarget: number;
  assignToRoleId: string; notificationTemplate: string | null;
}

function toCpRecord(row: CpRow): QualityCheckPointRecord {
  return {
    id: row.id, relatedEntityType: row.relatedEntityType as any, relatedEntityId: row.relatedEntityId, orgNodeId: row.orgNodeId, name: row.name,
    targetDurationMinutes: row.targetDurationMinutes, gracePeriodMinutes: row.gracePeriodMinutes, assignedRoleId: row.assignedRoleId
  };
}

function toWfRecord(row: WfRow): QualityWorkflowRecord {
  return {
    id: row.id, checkPointId: row.checkPointId, enteredAt: row.enteredAt, targetAt: row.targetAt, graceUntil: row.graceUntil,
    currentAssigneeId: row.currentAssigneeId, status: row.status as any, actionTakenAt: row.actionTakenAt, actionTakenById: row.actionTakenById,
    resultNote: row.resultNote, escalationLevel: row.escalationLevel
  };
}

function toRuleRecord(row: RuleRow): SlaRuleRecord {
  return {
    id: row.id, checkPointId: row.checkPointId, escalationLevel: row.escalationLevel, delayMinutesAfterTarget: row.delayMinutesAfterTarget,
    assignToRoleId: row.assignToRoleId, notificationTemplate: row.notificationTemplate
  };
}

@Injectable()
export class QualityRepository {
  constructor(private readonly database: DatabaseService) {}

  async findCheckPointById(id: string): Promise<QualityCheckPointRecord | null> {
    const rows = await this.database.db.select(cpColumns).from(qualityCheckPoint).where(eq(qualityCheckPoint.id, id)).limit(1);
    return rows[0] ? toCpRecord(rows[0]) : null;
  }

  async insertCheckPoint(input: CreateQualityCheckPointInput & { id: string; orgNodeId: string | null }): Promise<QualityCheckPointRecord> {
    const rows = await this.database.db.insert(qualityCheckPoint).values({
      id: input.id, relatedEntityType: input.relatedEntityType, relatedEntityId: input.relatedEntityId, orgNodeId: input.orgNodeId, name: input.name,
      targetDurationMinutes: input.targetDurationMinutes, gracePeriodMinutes: input.gracePeriodMinutes ?? 0,
      assignedRoleId: input.assignedRoleId
    }).returning(cpColumns);
    return toCpRecord(rows[0]!);
  }

  async findWorkflowByCheckPoint(checkPointId: string): Promise<QualityWorkflowRecord | null> {
    const rows = await this.database.db.select(wfColumns).from(qualityWorkflow)
      .where(and(eq(qualityWorkflow.checkPointId, checkPointId), eq(qualityWorkflow.status, 'pending'))).limit(1);
    return rows[0] ? toWfRecord(rows[0]) : null;
  }

  async insertWorkflow(input: any & { id: string }): Promise<QualityWorkflowRecord> {
    const rows = await this.database.db.insert(qualityWorkflow).values(input).returning(wfColumns);
    return toWfRecord(rows[0]!);
  }

  async updateWorkflowStatus(id: string, status: string, actionTakenById: string, resultNote?: string): Promise<QualityWorkflowRecord> {
    const rows = await this.database.db.update(qualityWorkflow).set({
      status, actionTakenAt: new Date(), actionTakenById, resultNote
    }).where(eq(qualityWorkflow.id, id)).returning(wfColumns);
    return toWfRecord(rows[0]!);
  }

  async findOverdueWorkflows(now: Date): Promise<QualityWorkflowRecord[]> {
    const rows = await this.database.db.select(wfColumns).from(qualityWorkflow)
      .where(and(eq(qualityWorkflow.status, 'pending'), lte(qualityWorkflow.graceUntil, now)));
    return rows.map(toWfRecord);
  }

  async findRulesForCheckPoint(checkPointId: string): Promise<SlaRuleRecord[]> {
    const rows = await this.database.db.select(ruleColumns).from(slaRule)
      .where(eq(slaRule.checkPointId, checkPointId)).orderBy(asc(slaRule.escalationLevel));
    return rows.map(toRuleRecord);
  }

  async findRuleByLevel(checkPointId: string, level: number): Promise<SlaRuleRecord | null> {
    const rows = await this.database.db.select(ruleColumns).from(slaRule)
      .where(and(eq(slaRule.checkPointId, checkPointId), eq(slaRule.escalationLevel, level))).limit(1);
    return rows[0] ? toRuleRecord(rows[0]) : null;
  }

  async updateWorkflowEscalation(id: string, currentAssigneeId: string, escalationLevel: number, graceUntil: Date): Promise<QualityWorkflowRecord> {
    const rows = await this.database.db.update(qualityWorkflow).set({
      currentAssigneeId, escalationLevel, graceUntil
    }).where(eq(qualityWorkflow.id, id)).returning(wfColumns);
    return toWfRecord(rows[0]!);
  }
  async insertSlaRule(input: CreateSlaRuleInput & { id: string }): Promise<SlaRuleRecord> {
    const rows = await this.database.db.insert(slaRule).values({
      id: input.id, checkPointId: input.checkPointId, escalationLevel: input.escalationLevel,
      delayMinutesAfterTarget: input.delayMinutesAfterTarget, assignToRoleId: input.assignToRoleId,
      notificationTemplate: input.notificationTemplate
    }).returning(ruleColumns);
    return toRuleRecord(rows[0]!);
  }
  async findAllCheckPoints(): Promise<QualityCheckPointRecord[]> {
    const rows = await this.database.db.select(cpColumns).from(qualityCheckPoint);
    return rows.map(toCpRecord);
  }

  async findAllWorkflows(): Promise<QualityWorkflowRecord[]> {
    const rows = await this.database.db.select(wfColumns).from(qualityWorkflow);
    return rows.map(toWfRecord);
  }
}
