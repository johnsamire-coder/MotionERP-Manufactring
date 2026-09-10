import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { productionPlan } from './planning.schema';
import type { CreatePlanInput, ExecutionMode, PlanStatus, ProductionPlanRecord, UpdatePlanInput } from './planning.types';

const planColumns = {
  id: productionPlan.id, jobOrderReference: productionPlan.jobOrderReference, priority: productionPlan.priority,
  executionMode: productionPlan.executionMode, internalQuantity: productionPlan.internalQuantity,
  externalQuantity: productionPlan.externalQuantity, status: productionPlan.status,
  plannedStartDate: productionPlan.plannedStartDate, plannedEndDate: productionPlan.plannedEndDate,
  note: productionPlan.note, createdAt: productionPlan.createdAt, updatedAt: productionPlan.updatedAt,
};

interface PlanRow {
  id: string; jobOrderReference: string; priority: number; executionMode: string;
  internalQuantity: string | null; externalQuantity: string | null; status: string;
  plannedStartDate: Date | null; plannedEndDate: Date | null; note: string | null;
  createdAt: Date; updatedAt: Date;
}

function toPlanRecord(row: PlanRow): ProductionPlanRecord {
  return {
    id: row.id, jobOrderReference: row.jobOrderReference, priority: row.priority,
    executionMode: row.executionMode as ExecutionMode, internalQuantity: row.internalQuantity,
    externalQuantity: row.externalQuantity, status: row.status as PlanStatus,
    plannedStartDate: row.plannedStartDate ? row.plannedStartDate.toISOString() : null,
    plannedEndDate: row.plannedEndDate ? row.plannedEndDate.toISOString() : null,
    note: row.note, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class PlanningRepository {
  constructor(private readonly database: DatabaseService) {}

  async listPlans(): Promise<ProductionPlanRecord[]> {
    const rows = await this.database.db.select(planColumns).from(productionPlan).orderBy(asc(productionPlan.priority));
    return rows.map(toPlanRecord);
  }

  async findPlanById(id: string): Promise<ProductionPlanRecord | null> {
    const rows = await this.database.db.select(planColumns).from(productionPlan).where(eq(productionPlan.id, id)).limit(1);
    return rows[0] ? toPlanRecord(rows[0]) : null;
  }

  async findPlanByJobOrderReference(jobOrderReference: string): Promise<ProductionPlanRecord | null> {
    const rows = await this.database.db.select(planColumns).from(productionPlan)
      .where(eq(productionPlan.jobOrderReference, jobOrderReference)).limit(1);
    return rows[0] ? toPlanRecord(rows[0]) : null;
  }

  async insertPlan(input: CreatePlanInput & { id: string }): Promise<ProductionPlanRecord> {
    const rows = await this.database.db.insert(productionPlan).values({
      id: input.id, jobOrderReference: input.jobOrderReference, priority: input.priority ?? 0,
      executionMode: input.executionMode ?? 'internal', internalQuantity: input.internalQuantity ?? null,
      externalQuantity: input.externalQuantity ?? null,
      plannedStartDate: input.plannedStartDate ? new Date(input.plannedStartDate) : null,
      plannedEndDate: input.plannedEndDate ? new Date(input.plannedEndDate) : null,
      note: input.note ?? null,
    }).returning(planColumns);
    return toPlanRecord(rows[0]!);
  }

  async updatePlanFields(id: string, fields: UpdatePlanInput): Promise<ProductionPlanRecord> {
    const dbFields: Record<string, unknown> = {};
    if (fields.priority !== undefined) dbFields.priority = fields.priority;
    if (fields.executionMode !== undefined) dbFields.executionMode = fields.executionMode;
    if (fields.internalQuantity !== undefined) dbFields.internalQuantity = fields.internalQuantity;
    if (fields.externalQuantity !== undefined) dbFields.externalQuantity = fields.externalQuantity;
    if (fields.plannedStartDate !== undefined) dbFields.plannedStartDate = fields.plannedStartDate ? new Date(fields.plannedStartDate) : null;
    if (fields.plannedEndDate !== undefined) dbFields.plannedEndDate = fields.plannedEndDate ? new Date(fields.plannedEndDate) : null;
    if (fields.note !== undefined) dbFields.note = fields.note;
    const rows = await this.database.db.update(productionPlan).set(dbFields).where(eq(productionPlan.id, id)).returning(planColumns);
    return toPlanRecord(rows[0]!);
  }

  async setPlanStatus(id: string, status: PlanStatus): Promise<ProductionPlanRecord> {
    const rows = await this.database.db.update(productionPlan).set({ status }).where(eq(productionPlan.id, id)).returning(planColumns);
    return toPlanRecord(rows[0]!);
  }
}
