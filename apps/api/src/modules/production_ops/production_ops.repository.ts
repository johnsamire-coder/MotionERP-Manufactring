import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { productionStep, workCenter } from './production_ops.schema';
import type {
  CreateProductionStepInput, CreateWorkCenterInput, ProductionStepRecord, ProductionStepStatus,
  WorkCenterRecord, WorkCenterStatus,
} from './production_ops.types';

const wcColumns = { id: workCenter.id, code: workCenter.code, name: workCenter.name, orgNodeId: workCenter.orgNodeId, ratePerMinute: workCenter.ratePerMinute, status: workCenter.status };
const stepColumns = {
  id: productionStep.id, jobOrderReference: productionStep.jobOrderReference, workCenterId: productionStep.workCenterId,
  operationName: productionStep.operationName, standardTimeMinutes: productionStep.standardTimeMinutes,
  actualTimeMinutes: productionStep.actualTimeMinutes, sequence: productionStep.sequence, status: productionStep.status,
};

interface WcRow { id: string; code: string; name: string; orgNodeId: string; ratePerMinute: string; status: string; }
interface StepRow {
  id: string; jobOrderReference: string; workCenterId: string; operationName: string;
  standardTimeMinutes: string; actualTimeMinutes: string | null; sequence: number; status: string;
}

function toWcRecord(row: WcRow): WorkCenterRecord {
  return { id: row.id, code: row.code, name: row.name, orgNodeId: row.orgNodeId, ratePerMinute: row.ratePerMinute, status: row.status as WorkCenterStatus };
}
function toStepRecord(row: StepRow): ProductionStepRecord {
  return { id: row.id, jobOrderReference: row.jobOrderReference, workCenterId: row.workCenterId,
    operationName: row.operationName, standardTimeMinutes: row.standardTimeMinutes,
    actualTimeMinutes: row.actualTimeMinutes, sequence: row.sequence, status: row.status as ProductionStepStatus };
}

@Injectable()
export class ProductionOpsRepository {
  constructor(private readonly database: DatabaseService) {}

  async listWorkCenters(): Promise<WorkCenterRecord[]> {
    const rows = await this.database.db.select(wcColumns).from(workCenter).orderBy(asc(workCenter.code));
    return rows.map(toWcRecord);
  }
  async findWorkCenterById(id: string): Promise<WorkCenterRecord | null> {
    const rows = await this.database.db.select(wcColumns).from(workCenter).where(eq(workCenter.id, id)).limit(1);
    return rows[0] ? toWcRecord(rows[0]) : null;
  }
  async findWorkCenterByCode(code: string): Promise<WorkCenterRecord | null> {
    const rows = await this.database.db.select(wcColumns).from(workCenter).where(eq(workCenter.code, code)).limit(1);
    return rows[0] ? toWcRecord(rows[0]) : null;
  }
  async insertWorkCenter(input: CreateWorkCenterInput & { id: string }): Promise<WorkCenterRecord> {
    const rows = await this.database.db.insert(workCenter).values({
      id: input.id, code: input.code, name: input.name, orgNodeId: input.orgNodeId, ratePerMinute: input.ratePerMinute ?? '0',
    }).returning(wcColumns);
    return toWcRecord(rows[0]!);
  }

  async listSteps(jobOrderReference?: string): Promise<ProductionStepRecord[]> {
    const rows = jobOrderReference
      ? await this.database.db.select(stepColumns).from(productionStep).where(eq(productionStep.jobOrderReference, jobOrderReference)).orderBy(asc(productionStep.sequence))
      : await this.database.db.select(stepColumns).from(productionStep).orderBy(asc(productionStep.sequence));
    return rows.map(toStepRecord);
  }
  async findStepById(id: string): Promise<ProductionStepRecord | null> {
    const rows = await this.database.db.select(stepColumns).from(productionStep).where(eq(productionStep.id, id)).limit(1);
    return rows[0] ? toStepRecord(rows[0]) : null;
  }
  async countSteps(jobOrderReference: string): Promise<number> {
    const rows = await this.database.db.select({ id: productionStep.id }).from(productionStep).where(eq(productionStep.jobOrderReference, jobOrderReference));
    return rows.length;
  }
  async insertStep(input: CreateProductionStepInput & { id: string; sequence: number }): Promise<ProductionStepRecord> {
    const rows = await this.database.db.insert(productionStep).values({
      id: input.id, jobOrderReference: input.jobOrderReference, workCenterId: input.workCenterId,
      operationName: input.operationName, standardTimeMinutes: input.standardTimeMinutes, sequence: input.sequence,
    }).returning(stepColumns);
    return toStepRecord(rows[0]!);
  }
  async setStepStatus(id: string, status: ProductionStepStatus): Promise<ProductionStepRecord> {
    const rows = await this.database.db.update(productionStep).set({ status }).where(eq(productionStep.id, id)).returning(stepColumns);
    return toStepRecord(rows[0]!);
  }
  async recordActualTime(id: string, actualTimeMinutes: string): Promise<ProductionStepRecord> {
    const rows = await this.database.db.update(productionStep).set({ actualTimeMinutes, status: 'done' }).where(eq(productionStep.id, id)).returning(stepColumns);
    return toStepRecord(rows[0]!);
  }
}
