import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { downtimeEntry, operation, productionStep, productionStepTimeLog, workCenter, workOrder, workOrderOperation, workstationType } from './production_ops.schema';
import type {
  AddTimeLogInput, CreateOperationInput, CreateProductionStepInput, CreateWorkCenterInput, CreateWorkOrderInput,
  CreateWorkstationTypeInput, OperationRecord, OperationStatus, ProductionStepRecord, ProductionStepStatus,
  ProductionStepTimeLogRecord, WorkCenterRecord, WorkCenterStatus, WorkOrderRecord, WorkOrderStatus,
  MaterialTransferMode,
  WorkOrderOperationInput, WorkOrderOperationRecord,
  CreateDowntimeEntryInput, DowntimeEntryRecord,
  WorkstationTypeRecord, WorkstationTypeStatus,
} from './production_ops.types';

const wcColumns = { id: workCenter.id, code: workCenter.code, name: workCenter.name, orgNodeId: workCenter.orgNodeId, ratePerMinute: workCenter.ratePerMinute, status: workCenter.status };
const stepColumns = {
  id: productionStep.id, jobOrderReference: productionStep.jobOrderReference, workOrderId: productionStep.workOrderId,
  orgNodeId: productionStep.orgNodeId, workCenterId: productionStep.workCenterId, operationName: productionStep.operationName,
  standardTimeMinutes: productionStep.standardTimeMinutes, actualTimeMinutes: productionStep.actualTimeMinutes,
  forQuantity: productionStep.forQuantity, completedQuantity: productionStep.completedQuantity,
  processLossQuantity: productionStep.processLossQuantity, allowOverproduction: productionStep.allowOverproduction,
  overproductionPercentage: productionStep.overproductionPercentage, operatorEmployeeId: productionStep.operatorEmployeeId,
  sequence: productionStep.sequence, status: productionStep.status,
};
const timeLogColumns = {
  id: productionStepTimeLog.id, productionStepId: productionStepTimeLog.productionStepId, fromTime: productionStepTimeLog.fromTime,
  toTime: productionStepTimeLog.toTime, timeInMinutes: productionStepTimeLog.timeInMinutes,
  completedQuantity: productionStepTimeLog.completedQuantity, processLossQuantity: productionStepTimeLog.processLossQuantity,
};
const woColumns = {
  id: workOrder.id, workOrderNumber: workOrder.workOrderNumber, productItemId: workOrder.productItemId, bomId: workOrder.bomId,
  orgNodeId: workOrder.orgNodeId, jobOrderReference: workOrder.jobOrderReference, qtyToManufacture: workOrder.qtyToManufacture,
  sourceWarehouseId: workOrder.sourceWarehouseId, wipWarehouseId: workOrder.wipWarehouseId, finishedGoodsWarehouseId: workOrder.finishedGoodsWarehouseId,
  createdAt: workOrder.createdAt,
  useMultiLevelBom: workOrder.useMultiLevelBom, considerScrapItems: workOrder.considerScrapItems,
  materialConsumptionPercentage: workOrder.materialConsumptionPercentage, materialTransferMode: workOrder.materialTransferMode,
  trackOperations: workOrder.trackOperations,
  plannedStartDate: workOrder.plannedStartDate, actualStartDate: workOrder.actualStartDate, actualEndDate: workOrder.actualEndDate,
  status: workOrder.status,
};
const wsTypeColumns = { id: workstationType.id, code: workstationType.code, name: workstationType.name, status: workstationType.status };
const operationColumns = {
  id: operation.id, code: operation.code, name: operation.name, defaultWorkCenterId: operation.defaultWorkCenterId,
  standardTimeMinutes: operation.standardTimeMinutes, status: operation.status,
};

interface WcRow { id: string; code: string; name: string; orgNodeId: string; ratePerMinute: string; status: string; }
interface StepRow {
  id: string; jobOrderReference: string; workOrderId: string | null; orgNodeId: string | null; workCenterId: string;
  operationName: string; standardTimeMinutes: string; actualTimeMinutes: string | null;
  forQuantity: string | null; completedQuantity: string; processLossQuantity: string | null;
  allowOverproduction: boolean; overproductionPercentage: string | null; operatorEmployeeId: string | null;
  sequence: number; status: string;
}
interface TimeLogRow {
  id: string; productionStepId: string; fromTime: Date; toTime: Date | null; timeInMinutes: string | null;
  completedQuantity: string | null; processLossQuantity: string | null;
}
interface WoRow {
  id: string; workOrderNumber: string; productItemId: string; bomId: string; orgNodeId: string;
  jobOrderReference: string | null; qtyToManufacture: string;
  sourceWarehouseId: string | null; wipWarehouseId: string | null; finishedGoodsWarehouseId: string;
  createdAt: Date;
  plannedStartDate: Date | null; actualStartDate: Date | null; actualEndDate: Date | null; status: string; useMultiLevelBom: boolean; considerScrapItems: boolean; materialConsumptionPercentage: string; materialTransferMode: string; trackOperations: boolean;
}
interface WsTypeRow { id: string; code: string; name: string; status: string; }
interface OperationRow { id: string; code: string; name: string; defaultWorkCenterId: string | null; standardTimeMinutes: string | null; status: string; }

function toWcRecord(row: WcRow): WorkCenterRecord {
  return { id: row.id, code: row.code, name: row.name, orgNodeId: row.orgNodeId, ratePerMinute: row.ratePerMinute, status: row.status as WorkCenterStatus };
}
function toStepRecord(row: StepRow): ProductionStepRecord {
  return {
    id: row.id, jobOrderReference: row.jobOrderReference, workOrderId: row.workOrderId, orgNodeId: row.orgNodeId, workCenterId: row.workCenterId,
    operationName: row.operationName, standardTimeMinutes: row.standardTimeMinutes, actualTimeMinutes: row.actualTimeMinutes,
    forQuantity: row.forQuantity, completedQuantity: row.completedQuantity, processLossQuantity: row.processLossQuantity,
    allowOverproduction: row.allowOverproduction, overproductionPercentage: row.overproductionPercentage, operatorEmployeeId: row.operatorEmployeeId,
    sequence: row.sequence, status: row.status as ProductionStepStatus,
  };
}
function toTimeLogRecord(row: TimeLogRow): ProductionStepTimeLogRecord {
  return {
    id: row.id, productionStepId: row.productionStepId, fromTime: row.fromTime.toISOString(),
    toTime: row.toTime ? row.toTime.toISOString() : null, timeInMinutes: row.timeInMinutes,
    completedQuantity: row.completedQuantity, processLossQuantity: row.processLossQuantity,
  };
}
function toWoRecord(row: WoRow): WorkOrderRecord {
  return {
    id: row.id, workOrderNumber: row.workOrderNumber, productItemId: row.productItemId, bomId: row.bomId, orgNodeId: row.orgNodeId,
    jobOrderReference: row.jobOrderReference, qtyToManufacture: row.qtyToManufacture,
    sourceWarehouseId: row.sourceWarehouseId, wipWarehouseId: row.wipWarehouseId, finishedGoodsWarehouseId: row.finishedGoodsWarehouseId,
    plannedStartDate: row.plannedStartDate ? row.plannedStartDate.toISOString() : null,
    actualStartDate: row.actualStartDate ? row.actualStartDate.toISOString() : null,
    actualEndDate: row.actualEndDate ? row.actualEndDate.toISOString() : null,
    status: row.status as WorkOrderStatus, createdAt: row.createdAt.toISOString(),
    useMultiLevelBom: row.useMultiLevelBom, considerScrapItems: row.considerScrapItems,
    materialConsumptionPercentage: row.materialConsumptionPercentage, materialTransferMode: row.materialTransferMode as MaterialTransferMode,
    trackOperations: row.trackOperations,
  };
}
function toWsTypeRecord(row: WsTypeRow): WorkstationTypeRecord {
  return { id: row.id, code: row.code, name: row.name, status: row.status as WorkstationTypeStatus };
}
function toOperationRecord(row: OperationRow): OperationRecord {
  return { id: row.id, code: row.code, name: row.name, defaultWorkCenterId: row.defaultWorkCenterId, standardTimeMinutes: row.standardTimeMinutes, status: row.status as OperationStatus };
}

const dteColumns = {
  id: downtimeEntry.id, workCenterId: downtimeEntry.workCenterId, operatorEmployeeId: downtimeEntry.operatorEmployeeId,
  stopReason: downtimeEntry.stopReason, startTime: downtimeEntry.startTime, stopTime: downtimeEntry.stopTime,
  stoppageMinutes: downtimeEntry.stoppageMinutes, remarks: downtimeEntry.remarks,
};

interface DteRow {
  id: string; workCenterId: string; operatorEmployeeId: string | null; stopReason: string;
  startTime: Date; stopTime: Date | null; stoppageMinutes: string | null; remarks: string | null;
}

function toDteRecord(row: DteRow): DowntimeEntryRecord {
  return {
    id: row.id, workCenterId: row.workCenterId, operatorEmployeeId: row.operatorEmployeeId, stopReason: row.stopReason,
    startTime: row.startTime.toISOString(), stopTime: row.stopTime ? row.stopTime.toISOString() : null,
    stoppageMinutes: row.stoppageMinutes, remarks: row.remarks,
  };
}

const wooColumns = {
  id: workOrderOperation.id, workOrderId: workOrderOperation.workOrderId, name: workOrderOperation.name,
  workCenterId: workOrderOperation.workCenterId, plannedStartTime: workOrderOperation.plannedStartTime,
  plannedEndTime: workOrderOperation.plannedEndTime, processLossQuantity: workOrderOperation.processLossQuantity,
  sequentialOrder: workOrderOperation.sequentialOrder,
};
interface WooRow {
  id: string; workOrderId: string; name: string; workCenterId: string | null;
  plannedStartTime: Date | null; plannedEndTime: Date | null; processLossQuantity: string | null; sequentialOrder: number;
}
function toWooRecord(row: WooRow): WorkOrderOperationRecord {
  return {
    id: row.id, workOrderId: row.workOrderId, name: row.name, workCenterId: row.workCenterId,
    plannedStartTime: row.plannedStartTime ? row.plannedStartTime.toISOString() : null,
    plannedEndTime: row.plannedEndTime ? row.plannedEndTime.toISOString() : null,
    processLossQuantity: row.processLossQuantity, sequentialOrder: row.sequentialOrder,
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
      id: input.id, jobOrderReference: input.jobOrderReference, workOrderId: input.workOrderId ?? null, orgNodeId: input.orgNodeId,
      workCenterId: input.workCenterId, operationName: input.operationName, standardTimeMinutes: input.standardTimeMinutes,
      forQuantity: input.forQuantity ?? null, allowOverproduction: input.allowOverproduction ?? false,
      overproductionPercentage: input.overproductionPercentage ?? null, operatorEmployeeId: input.operatorEmployeeId ?? null,
      sequence: input.sequence,
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
  async incrementCompletedQuantity(id: string, addQuantity: string): Promise<ProductionStepRecord> {
    const current = await this.findStepById(id);
    const newQty = (Number(current?.completedQuantity ?? '0') + Number(addQuantity)).toString();
    const rows = await this.database.db.update(productionStep).set({ completedQuantity: newQty }).where(eq(productionStep.id, id)).returning(stepColumns);
    return toStepRecord(rows[0]!);
  }

  async addTimeLog(input: AddTimeLogInput & { id: string }): Promise<ProductionStepTimeLogRecord> {
    const rows = await this.database.db.insert(productionStepTimeLog).values({
      id: input.id, productionStepId: input.productionStepId, fromTime: new Date(input.fromTime),
      toTime: input.toTime ? new Date(input.toTime) : null, timeInMinutes: input.timeInMinutes ?? null,
      completedQuantity: input.completedQuantity ?? null, processLossQuantity: input.processLossQuantity ?? null,
    }).returning(timeLogColumns);
    return toTimeLogRecord(rows[0]!);
  }
  async listTimeLogs(productionStepId: string): Promise<ProductionStepTimeLogRecord[]> {
    const rows = await this.database.db.select(timeLogColumns).from(productionStepTimeLog).where(eq(productionStepTimeLog.productionStepId, productionStepId)).orderBy(asc(productionStepTimeLog.fromTime));
    return rows.map(toTimeLogRecord);
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
      useMultiLevelBom: input.useMultiLevelBom ?? false, considerScrapItems: input.considerScrapItems ?? false,
      materialConsumptionPercentage: input.materialConsumptionPercentage ?? '100', materialTransferMode: input.materialTransferMode ?? 'transfer',
      trackOperations: input.trackOperations ?? false,
    }).returning(woColumns);
    const created = toWoRecord(rows[0]!);
    if (input.operations && input.operations.length > 0) {
      await this.insertWorkOrderOperations(created.id, input.operations);
    }
    return created;
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

  async listWorkstationTypes(): Promise<WorkstationTypeRecord[]> {
    const rows = await this.database.db.select(wsTypeColumns).from(workstationType).orderBy(asc(workstationType.code));
    return rows.map(toWsTypeRecord);
  }
  async findWorkstationTypeByCode(code: string): Promise<WorkstationTypeRecord | null> {
    const rows = await this.database.db.select(wsTypeColumns).from(workstationType).where(eq(workstationType.code, code)).limit(1);
    return rows[0] ? toWsTypeRecord(rows[0]) : null;
  }
  async insertWorkstationType(input: CreateWorkstationTypeInput & { id: string }): Promise<WorkstationTypeRecord> {
    const rows = await this.database.db.insert(workstationType).values({ id: input.id, code: input.code, name: input.name }).returning(wsTypeColumns);
    return toWsTypeRecord(rows[0]!);
  }

  async listOperations(): Promise<OperationRecord[]> {
    const rows = await this.database.db.select(operationColumns).from(operation).orderBy(asc(operation.code));
    return rows.map(toOperationRecord);
  }
  async findOperationByCode(code: string): Promise<OperationRecord | null> {
    const rows = await this.database.db.select(operationColumns).from(operation).where(eq(operation.code, code)).limit(1);
    return rows[0] ? toOperationRecord(rows[0]) : null;
  }
  async insertOperation(input: CreateOperationInput & { id: string }): Promise<OperationRecord> {
    const rows = await this.database.db.insert(operation).values({
      id: input.id, code: input.code, name: input.name, defaultWorkCenterId: input.defaultWorkCenterId ?? null,
      standardTimeMinutes: input.standardTimeMinutes ?? null,
    }).returning(operationColumns);
    return toOperationRecord(rows[0]!);
  }

  async listDowntimeEntries(): Promise<DowntimeEntryRecord[]> {
    const rows = await this.database.db.select(dteColumns).from(downtimeEntry).orderBy(asc(downtimeEntry.startTime));
    return rows.map(toDteRecord);
  }

  async findDowntimeEntryById(id: string): Promise<DowntimeEntryRecord | null> {
    const rows = await this.database.db.select(dteColumns).from(downtimeEntry).where(eq(downtimeEntry.id, id)).limit(1);
    return rows[0] ? toDteRecord(rows[0]) : null;
  }

  async insertDowntimeEntry(input: CreateDowntimeEntryInput & { id: string }): Promise<DowntimeEntryRecord> {
    const rows = await this.database.db.insert(downtimeEntry).values({
      id: input.id, workCenterId: input.workCenterId, operatorEmployeeId: input.operatorEmployeeId ?? null,
      stopReason: input.stopReason, startTime: new Date(input.startTime), remarks: input.remarks ?? null,
    }).returning(dteColumns);
    return toDteRecord(rows[0]!);
  }

  async closeDowntimeEntry(id: string, stopTime: Date, stoppageMinutes: string): Promise<DowntimeEntryRecord> {
    const rows = await this.database.db.update(downtimeEntry).set({ stopTime, stoppageMinutes }).where(eq(downtimeEntry.id, id)).returning(dteColumns);
    return toDteRecord(rows[0]!);
  }

  async replaceBomInWorkOrders(oldBomId: string, newBomId: string): Promise<number> {
    const rows = await this.database.db.update(workOrder).set({ bomId: newBomId }).where(eq(workOrder.bomId, oldBomId)).returning({ id: workOrder.id });
    return rows.length;
  }

  async listWorkOrderOperations(workOrderId: string): Promise<WorkOrderOperationRecord[]> {
    const rows = await this.database.db.select(wooColumns).from(workOrderOperation)
      .where(eq(workOrderOperation.workOrderId, workOrderId)).orderBy(asc(workOrderOperation.sequentialOrder));
    return rows.map(toWooRecord);
  }

  async insertWorkOrderOperations(workOrderId: string, inputOps: WorkOrderOperationInput[]): Promise<WorkOrderOperationRecord[]> {
    let sequentialOrder = 1;
    for (const op of inputOps) {
      await this.database.db.insert(workOrderOperation).values({
        workOrderId, name: op.name, workCenterId: op.workCenterId ?? null,
        plannedStartTime: op.plannedStartTime ? new Date(op.plannedStartTime) : null,
        plannedEndTime: op.plannedEndTime ? new Date(op.plannedEndTime) : null,
        processLossQuantity: op.processLossQuantity ?? null, sequentialOrder,
      });
      sequentialOrder += 1;
    }
    return this.listWorkOrderOperations(workOrderId);
  }
}
