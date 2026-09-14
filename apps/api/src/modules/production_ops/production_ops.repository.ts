import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { productionStep, workCenter, workOrder } from './production_ops.schema';
import type {
  CreateProductionStepInput, CreateWorkCenterInput, CreateWorkOrderInput, ProductionStepRecord, ProductionStepStatus,
  WorkCenterRecord, WorkCenterStatus, WorkOrderRecord, WorkOrderStatus,
} from './production_ops.types';

const wcColumns = { id: workCenter.id, code: workCenter.code, name: workCenter.name, orgNodeId: workCenter.orgNodeId, ratePerMinute: workCenter.ratePerMinute, status: workCenter.status };
const stepColumns = {
  id: productionStep.id, jobOrderReference: productionStep.jobOrderReference, orgNodeId: productionStep.orgNodeId, workCenterId: productionStep.workCenterId,
  operationName: productionStep.operationName, standardTimeMinutes: productionStep.standardTimeMinutes,
  actualTimeMinutes: productionStep.actualTimeMinutes, sequence: productionStep.sequence, status: productionStep.status,
};
const woColumns = {
  id: workOrder.id, workOrderNumber: workOrder.workOrderNumber, productItemId: workOrder.productItemId, bomId: workOrder.bomId,
  orgNodeId: workOrder.orgNodeId, jobOrderReference: workOrder.jobOrderReference, qtyToManufacture: workOrder.qtyToManufacture,
  sourceWarehouseId: workOrder.sourceWarehouseId, wipWarehouseId: workOrder.wipWarehouseId, finishedGoodsWarehouseId: workOrder.finishedGoodsWarehouseId,
  plannedStartDate: workOrder.plannedStartDate, actualStartDate: workOrder.actualStartDate, actualEndDate: workOrder.actualEndDate,
  status: workOrder.status,
};

interface WcRow { id: string; code: string; name: string; orgNodeId: string; ratePerMinute: string; status: string; }
interface StepRow {
  id: string; jobOrderReference: string; orgNodeId: string | null; workCenterId: string; operationName: string;
  standardTimeMinutes: string; actualTimeMinutes: string | null; sequence: number; status: string;
}
interface WoRow {
  id: string; workOrderNumber: string; productItemId: string; bomId: string; orgNodeId: string;
  jobOrderReference: string | null; qtyToManufacture: string;
  sourceWarehouseId: string | null; wipWarehouseId: string | null; finishedGoodsWarehouseId: string;
  plannedStartDate: Date | null; actualStartDate: Date | null; actualEndDate: Date | null; status: string;
}

function toWcRecord(row: WcRow): WorkCenterRecord {
  return { id: row.id, code: row.code, name: row.name, orgNodeId: row.orgNodeId, ratePerMinute: row.ratePerMinute, status: row.status as WorkCenterStatus };
}
function toStepRecord(row: StepRow): ProductionStepRecord {
  return { id: row.id, jobOrderReference: row.jobOrderReference, orgNodeId: row.orgNodeId, workCenterId: row.workCenterId,
    operationName: row.operationName, standardTimeMinutes: row.standardTimeMinutes,
    actualTimeMinutes: row.actualTimeMinutes, sequence: row.sequence, status: row.status as ProductionStepStatus };
}
function toWoRecord(row: WoRow): WorkOrderRecord {
  return {
    id: row.id, workOrderNumber: row.workOrderNumber, productItemId: row.productItemId, bomId: row.bomId, orgNodeId: row.orgNodeId,
    jobOrderReference: row.jobOrderReference, qtyToManufacture: row.qtyToManufacture,
    sourceWarehouseId: row.sourceWarehouseId, wipWarehouseId: row.wipWarehouseId, finishedGoodsWarehouseId: row.finishedGoodsWarehouseId,
    plannedStartDate: row.plannedStartDate ? row.plannedStartDate.toISOString() : null,
    actualStartDate: row.actualStartDate ? row.actualStartDate.toISOString() : null,
    actualEndDate: row.actualEndDate ? row.actualEndDate.toISOString() : null,
    status: row.status as WorkOrderStatus,
  };
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
  async insertStep(input: CreateProductionStepInput & { id: string; sequence: number; orgNodeId: string | null }): Promise<ProductionStepRecord> {
    const rows = await this.database.db.insert(productionStep).values({
      id: input.id, jobOrderReference: input.jobOrderReference, orgNodeId: input.orgNodeId, workCenterId: input.workCenterId,
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

  async listWorkOrders(): Promise<WorkOrderRecord[]> {
    const rows = await this.database.db.select(woColumns).from(workOrder).orderBy(asc(workOrder.workOrderNumber));
    return rows.map(toWoRecord);
  }
  async findWorkOrderById(id: string): Promise<WorkOrderRecord | null> {
    const rows = await this.database.db.select(woColumns).from(workOrder).where(eq(workOrder.id, id)).limit(1);
    return rows[0] ? toWoRecord(rows[0]) : null;
  }
  async countWorkOrders(): Promise<number> {
    const rows = await this.database.db.select({ id: workOrder.id }).from(workOrder);
    return rows.length;
  }
  async insertWorkOrder(input: CreateWorkOrderInput & { id: string; workOrderNumber: string }): Promise<WorkOrderRecord> {
    const rows = await this.database.db.insert(workOrder).values({
      id: input.id, workOrderNumber: input.workOrderNumber, productItemId: input.productItemId, bomId: input.bomId,
      orgNodeId: input.orgNodeId, jobOrderReference: input.jobOrderReference ?? null, qtyToManufacture: input.qtyToManufacture,
      sourceWarehouseId: input.sourceWarehouseId ?? null, wipWarehouseId: input.wipWarehouseId ?? null,
      finishedGoodsWarehouseId: input.finishedGoodsWarehouseId,
      plannedStartDate: input.plannedStartDate ? new Date(input.plannedStartDate) : null,
    }).returning(woColumns);
    return toWoRecord(rows[0]!);
  }
  async setWorkOrderStatus(id: string, status: WorkOrderStatus): Promise<WorkOrderRecord> {
    const rows = await this.database.db.update(workOrder).set({ status }).where(eq(workOrder.id, id)).returning(woColumns);
    return toWoRecord(rows[0]!);
  }
  async recordActualStart(id: string): Promise<WorkOrderRecord> {
    const rows = await this.database.db.update(workOrder).set({ status: 'in_progress', actualStartDate: new Date() }).where(eq(workOrder.id, id)).returning(woColumns);
    return toWoRecord(rows[0]!);
  }
  async recordActualEnd(id: string, status: WorkOrderStatus): Promise<WorkOrderRecord> {
    const rows = await this.database.db.update(workOrder).set({ status, actualEndDate: new Date() }).where(eq(workOrder.id, id)).returning(woColumns);
    return toWoRecord(rows[0]!);
  }
}
