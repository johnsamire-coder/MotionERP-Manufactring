import { Injectable } from '@nestjs/common';
import { and, asc, eq, lte } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import {
  qualityCheckPoint,
  qualityWorkflow,
  slaRule,
  qualityInspection,
  qualityInspectionParameter,
} from './quality.schema';
import type {
  CreateQualityCheckPointInput,
  CreateSlaRuleInput,
  QualityCheckPointRecord,
  QualityWorkflowRecord,
  QualityWorkflowStatus,
  SlaRuleRecord,
  QualityInspectionRecord,
  QualityInspectionStatus,
  CreateQualityInspectionInput,
  QualityInspectionParameterRecord,
} from './quality.types';
import type {
  QualityCheckPointType,
  QualityInspectionReferenceType,
  QualityParameterStatus,
} from './quality.types';

const cpColumns = {
  id: qualityCheckPoint.id,
  relatedEntityType: qualityCheckPoint.relatedEntityType,
  relatedEntityId: qualityCheckPoint.relatedEntityId,
  orgNodeId: qualityCheckPoint.orgNodeId,
  name: qualityCheckPoint.name,
  targetDurationMinutes: qualityCheckPoint.targetDurationMinutes,
  gracePeriodMinutes: qualityCheckPoint.gracePeriodMinutes,
  assignedRoleId: qualityCheckPoint.assignedRoleId,
};

const wfColumns = {
  id: qualityWorkflow.id,
  checkPointId: qualityWorkflow.checkPointId,
  enteredAt: qualityWorkflow.enteredAt,
  targetAt: qualityWorkflow.targetAt,
  graceUntil: qualityWorkflow.graceUntil,
  currentAssigneeId: qualityWorkflow.currentAssigneeId,
  status: qualityWorkflow.status,
  actionTakenAt: qualityWorkflow.actionTakenAt,
  actionTakenById: qualityWorkflow.actionTakenById,
  resultNote: qualityWorkflow.resultNote,
  escalationLevel: qualityWorkflow.escalationLevel,
};

const ruleColumns = {
  id: slaRule.id,
  checkPointId: slaRule.checkPointId,
  escalationLevel: slaRule.escalationLevel,
  delayMinutesAfterTarget: slaRule.delayMinutesAfterTarget,
  assignToRoleId: slaRule.assignToRoleId,
  notificationTemplate: slaRule.notificationTemplate,
};

const qiColumns = {
  id: qualityInspection.id,
  inspectionNumber: qualityInspection.inspectionNumber,
  orgNodeId: qualityInspection.orgNodeId,
  itemId: qualityInspection.itemId,
  referenceType: qualityInspection.referenceType,
  referenceId: qualityInspection.referenceId,
  status: qualityInspection.status,
  inspectedBy: qualityInspection.inspectedBy,
  inspectedAt: qualityInspection.inspectedAt,
  notes: qualityInspection.notes,
  createdAt: qualityInspection.createdAt,
  updatedAt: qualityInspection.updatedAt,
};

const qipColumns = {
  id: qualityInspectionParameter.id,
  inspectionId: qualityInspectionParameter.inspectionId,
  parameterName: qualityInspectionParameter.parameterName,
  targetValue: qualityInspectionParameter.targetValue,
  actualValue: qualityInspectionParameter.actualValue,
  status: qualityInspectionParameter.status,
  createdAt: qualityInspectionParameter.createdAt,
};

@Injectable()
export class QualityRepository {
  constructor(private readonly database: DatabaseService) {}

  // --- Checkpoints & SLA Workflows ---
  async findCheckPointById(id: string): Promise<QualityCheckPointRecord | null> {
    const rows = await this.database.db
      .select(cpColumns)
      .from(qualityCheckPoint)
      .where(eq(qualityCheckPoint.id, id))
      .limit(1);
    return rows[0]
      ? {
          id: rows[0].id,
          relatedEntityType: rows[0].relatedEntityType as QualityCheckPointType,
          relatedEntityId: rows[0].relatedEntityId,
          orgNodeId: rows[0].orgNodeId,
          name: rows[0].name,
          targetDurationMinutes: rows[0].targetDurationMinutes,
          gracePeriodMinutes: rows[0].gracePeriodMinutes,
          assignedRoleId: rows[0].assignedRoleId,
        }
      : null;
  }

  async insertCheckPoint(
    input: CreateQualityCheckPointInput & { id: string; orgNodeId: string | null },
  ): Promise<QualityCheckPointRecord> {
    const rows = await this.database.db
      .insert(qualityCheckPoint)
      .values({
        id: input.id,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        orgNodeId: input.orgNodeId,
        name: input.name,
        targetDurationMinutes: input.targetDurationMinutes,
        gracePeriodMinutes: input.gracePeriodMinutes ?? 0,
        assignedRoleId: input.assignedRoleId,
      })
      .returning(cpColumns);
    const r = rows[0]!;
    return {
      id: r.id,
      relatedEntityType: r.relatedEntityType as QualityCheckPointType,
      relatedEntityId: r.relatedEntityId,
      orgNodeId: r.orgNodeId,
      name: r.name,
      targetDurationMinutes: r.targetDurationMinutes,
      gracePeriodMinutes: r.gracePeriodMinutes,
      assignedRoleId: r.assignedRoleId,
    };
  }

  async findWorkflowByCheckPoint(checkPointId: string): Promise<QualityWorkflowRecord | null> {
    const rows = await this.database.db
      .select(wfColumns)
      .from(qualityWorkflow)
      .where(
        and(eq(qualityWorkflow.checkPointId, checkPointId), eq(qualityWorkflow.status, 'pending')),
      )
      .limit(1);
    return rows[0] ? { ...rows[0], status: rows[0].status as QualityWorkflowStatus } : null;
  }

  async insertWorkflow(
    input: typeof qualityWorkflow.$inferInsert & { id: string },
  ): Promise<QualityWorkflowRecord> {
    const rows = await this.database.db.insert(qualityWorkflow).values(input).returning(wfColumns);
    const r = rows[0]!;
    return { ...r, status: r.status as QualityWorkflowStatus };
  }

  async updateWorkflowStatus(
    id: string,
    status: QualityWorkflowStatus,
    actionTakenById: string,
    resultNote?: string,
  ): Promise<QualityWorkflowRecord> {
    const rows = await this.database.db
      .update(qualityWorkflow)
      .set({
        status,
        actionTakenAt: new Date(),
        actionTakenById,
        resultNote,
      })
      .where(eq(qualityWorkflow.id, id))
      .returning(wfColumns);
    const r = rows[0]!;
    return { ...r, status: r.status as QualityWorkflowStatus };
  }

  async findOverdueWorkflows(now: Date): Promise<QualityWorkflowRecord[]> {
    const rows = await this.database.db
      .select(wfColumns)
      .from(qualityWorkflow)
      .where(and(eq(qualityWorkflow.status, 'pending'), lte(qualityWorkflow.graceUntil, now)));
    return rows.map((r) => ({ ...r, status: r.status as QualityWorkflowStatus }));
  }

  async findRulesForCheckPoint(checkPointId: string): Promise<SlaRuleRecord[]> {
    const rows = await this.database.db
      .select(ruleColumns)
      .from(slaRule)
      .where(eq(slaRule.checkPointId, checkPointId))
      .orderBy(asc(slaRule.escalationLevel));
    return rows.map((r) => ({ ...r, notificationTemplate: r.notificationTemplate }));
  }

  async findRuleByLevel(checkPointId: string, level: number): Promise<SlaRuleRecord | null> {
    const rows = await this.database.db
      .select(ruleColumns)
      .from(slaRule)
      .where(and(eq(slaRule.checkPointId, checkPointId), eq(slaRule.escalationLevel, level)))
      .limit(1);
    return rows[0] ? { ...rows[0], notificationTemplate: rows[0].notificationTemplate } : null;
  }

  async updateWorkflowEscalation(
    id: string,
    currentAssigneeId: string,
    escalationLevel: number,
    graceUntil: Date,
  ): Promise<QualityWorkflowRecord> {
    const rows = await this.database.db
      .update(qualityWorkflow)
      .set({
        currentAssigneeId,
        escalationLevel,
        graceUntil,
      })
      .where(eq(qualityWorkflow.id, id))
      .returning(wfColumns);
    const r = rows[0]!;
    return { ...r, status: r.status as QualityWorkflowStatus };
  }

  async insertSlaRule(input: CreateSlaRuleInput & { id: string }): Promise<SlaRuleRecord> {
    const rows = await this.database.db
      .insert(slaRule)
      .values({
        id: input.id,
        checkPointId: input.checkPointId,
        escalationLevel: input.escalationLevel,
        delayMinutesAfterTarget: input.delayMinutesAfterTarget,
        assignToRoleId: input.assignToRoleId,
        notificationTemplate: input.notificationTemplate ?? null,
      })
      .returning(ruleColumns);
    return { ...rows[0]!, notificationTemplate: rows[0]!.notificationTemplate };
  }

  async findAllCheckPoints(): Promise<QualityCheckPointRecord[]> {
    const rows = await this.database.db.select(cpColumns).from(qualityCheckPoint);
    return rows.map((r) => ({
      id: r.id,
      relatedEntityType: r.relatedEntityType as QualityCheckPointType,
      relatedEntityId: r.relatedEntityId,
      orgNodeId: r.orgNodeId,
      name: r.name,
      targetDurationMinutes: r.targetDurationMinutes,
      gracePeriodMinutes: r.gracePeriodMinutes,
      assignedRoleId: r.assignedRoleId,
    }));
  }

  async findAllWorkflows(): Promise<QualityWorkflowRecord[]> {
    const rows = await this.database.db.select(wfColumns).from(qualityWorkflow);
    return rows.map((r) => ({ ...r, status: r.status as QualityWorkflowStatus }));
  }

  // --- Quality Inspections & Parameter Management (New) ---

  async countInspections(): Promise<number> {
    const rows = await this.database.db
      .select({ id: qualityInspection.id })
      .from(qualityInspection);
    return rows.length;
  }

  async insertInspection(
    input: CreateQualityInspectionInput & { id: string; inspectionNumber: string },
  ): Promise<QualityInspectionRecord> {
    const rows = await this.database.db
      .insert(qualityInspection)
      .values({
        id: input.id,
        inspectionNumber: input.inspectionNumber,
        orgNodeId: input.orgNodeId,
        itemId: input.itemId,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        notes: input.notes ?? null,
        status: 'pending',
      })
      .returning(qiColumns);

    const r = rows[0]!;
    const insertedParams: QualityInspectionParameterRecord[] = [];

    for (const p of input.parameters) {
      const pRows = await this.database.db
        .insert(qualityInspectionParameter)
        .values({
          id: (await import('node:crypto')).randomUUID(),
          inspectionId: r.id,
          parameterName: p.parameterName,
          targetValue: p.targetValue,
          status: 'pending',
        })
        .returning(qipColumns);

      const pr = pRows[0]!;
      insertedParams.push({
        id: pr.id,
        inspectionId: pr.inspectionId,
        parameterName: pr.parameterName,
        targetValue: pr.targetValue,
        actualValue: pr.actualValue,
        status: pr.status as QualityParameterStatus,
        createdAt: pr.createdAt.toISOString(),
      });
    }

    return {
      id: r.id,
      inspectionNumber: r.inspectionNumber,
      orgNodeId: r.orgNodeId,
      itemId: r.itemId,
      referenceType: r.referenceType as QualityInspectionReferenceType,
      referenceId: r.referenceId,
      status: r.status as QualityInspectionStatus,
      inspectedBy: r.inspectedBy,
      inspectedAt: r.inspectedAt ? r.inspectedAt.toISOString() : null,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      parameters: insertedParams,
    };
  }

  async findInspectionById(id: string): Promise<QualityInspectionRecord | null> {
    const rows = await this.database.db
      .select(qiColumns)
      .from(qualityInspection)
      .where(eq(qualityInspection.id, id))
      .limit(1);
    if (!rows[0]) return null;
    const r = rows[0];

    const params = await this.database.db
      .select(qipColumns)
      .from(qualityInspectionParameter)
      .where(eq(qualityInspectionParameter.inspectionId, r.id));

    return {
      id: r.id,
      inspectionNumber: r.inspectionNumber,
      orgNodeId: r.orgNodeId,
      itemId: r.itemId,
      referenceType: r.referenceType as QualityInspectionReferenceType,
      referenceId: r.referenceId,
      status: r.status as QualityInspectionStatus,
      inspectedBy: r.inspectedBy,
      inspectedAt: r.inspectedAt ? r.inspectedAt.toISOString() : null,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      parameters: params.map((p) => ({
        id: p.id,
        inspectionId: p.inspectionId,
        parameterName: p.parameterName,
        targetValue: p.targetValue,
        actualValue: p.actualValue,
        status: p.status as QualityParameterStatus,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }

  async updateInspectionStatus(
    id: string,
    status: QualityInspectionStatus,
    inspectedBy: string,
    notes?: string,
    paramResults?: Array<{ parameterId: string; actualValue: string; status: 'pass' | 'fail' }>,
  ): Promise<QualityInspectionRecord> {
    if (paramResults) {
      for (const pr of paramResults) {
        await this.database.db
          .update(qualityInspectionParameter)
          .set({ actualValue: pr.actualValue, status: pr.status })
          .where(eq(qualityInspectionParameter.id, pr.parameterId));
      }
    }

    await this.database.db
      .update(qualityInspection)
      .set({
        status,
        inspectedBy,
        inspectedAt: new Date(),
        notes: notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(qualityInspection.id, id));

    return (await this.findInspectionById(id))!;
  }
}
