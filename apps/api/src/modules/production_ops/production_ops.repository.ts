import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import {
  downtimeEntry,
  operation,
  productionStep,
  productionStepMaterial,
  productionStepTimeLog,
  subcontractingItem,
  subcontractingOrder,
  workCenter,
  workOrder,
  workOrderOperation,
  workstationType,
} from './production_ops.schema';
import type {
  CreateDowntimeEntryInput,
  CreateOperationInput,
  CreateProductionStepInput,
  CreateSubcontractingOrderInput,
  CreateWorkCenterInput,
  CreateWorkOrderInput,
  CreateWorkstationTypeInput,
  DowntimeEntryRecord,
  OperationRecord,
  OperationStatus,
  ProductionStepMaterialInput,
  ProductionStepMaterialRecord,
  ProductionStepRecord,
  ProductionStepStatus,
  ProductionStepTimeLogRecord,
  SubcontractingItemRecord,
  SubcontractingOrderRecord,
  SubcontractingOrderStatus,
  WorkCenterRecord,
  WorkCenterStatus,
  WorkOrderOperationInput,
  WorkOrderOperationRecord,
  WorkOrderRecord,
  WorkOrderStatus,
  WorkstationTypeRecord,
  WorkstationTypeStatus,
} from './production_ops.types';

const wcColumns = {
  id: workCenter.id, code: workCenter.code, name: workCenter.name,
  orgNodeId: workCenter.orgNodeId, ratePerMinute: workCenter.ratePerMinute,
  status: workCenter.status,
};

const woColumns = {
  id: workOrder.id, workOrderNumber: workOrder.workOrderNumber, productItemId: workOrder.productItemId,
  bomId: workOrder.bomId, orgNodeId: workOrder.orgNodeId, jobOrderReference: workOrder.jobOrderReference,
  qtyToManufacture: workOrder.qtyToManufacture, sourceWarehouseId: workOrder.sourceWarehouseId,
  wipWarehouseId: workOrder.wipWarehouseId, finishedGoodsWarehouseId: workOrder.finishedGoodsWarehouseId,
  plannedStartDate: workOrder.plannedStartDate, actualStartDate: workOrder.actualStartDate,
  actualEndDate: workOrder.actualEndDate, status: workOrder.status,
  useMultiLevelBom: workOrder.useMultiLevelBom, considerScrapItems: workOrder.considerScrapItems,
  materialConsumptionPercentage: workOrder.materialConsumptionPercentage,
  materialTransferMode: workOrder.materialTransferMode, trackOperations: workOrder.trackOperations,
  createdAt: workOrder.createdAt,
};

const stepColumns = {
  id: productionStep.id, jobOrderReference: productionStep.jobOrderReference, workOrderId: productionStep.workOrderId,
  orgNodeId: productionStep.orgNodeId, workCenterId: productionStep.workCenterId, operationName: productionStep.operationName,
  standardTimeMinutes: productionStep.standardTimeMinutes, actualTimeMinutes: productionStep.actualTimeMinutes,
  forQuantity: productionStep.forQuantity, completedQuantity: productionStep.completedQuantity,
  processLossQuantity: productionStep.processLossQuantity, allowOverproduction: productionStep.allowOverproduction,
  overproductionPercentage: productionStep.overproductionPercentage, operatorEmployeeId: productionStep.operatorEmployeeId,
  sequence: productionStep.sequence, status: productionStep.status,
};

const logColumns = {
  id: productionStepTimeLog.id, productionStepId: productionStepTimeLog.productionStepId,
  fromTime: productionStepTimeLog.fromTime, toTime: productionStepTimeLog.toTime,
  timeInMinutes: productionStepTimeLog.timeInMinutes, completedQuantity: productionStepTimeLog.completedQuantity,
  processLossQuantity: productionStepTimeLog.processLossQuantity,
};

const wtColumns = { id: workstationType.id, code: workstationType.code, name: workstationType.name, status: workstationType.status };
const opColumns = { id: operation.id, code: operation.code, name: operation.name, defaultWorkCenterId: operation.defaultWorkCenterId, standardTimeMinutes: operation.standardTimeMinutes, status: operation.status };
const dtColumns = { id: downtimeEntry.id, workCenterId: downtimeEntry.workCenterId, operatorEmployeeId: downtimeEntry.operatorEmployeeId, stopReason: downtimeEntry.stopReason, startTime: downtimeEntry.startTime, stopTime: downtimeEntry.stopTime, stoppageMinutes: downtimeEntry.stoppageMinutes, remarks: downtimeEntry.remarks };

const wooColumns = {
  id: workOrderOperation.id, workOrderId: workOrderOperation.workOrderId, name: workOrderOperation.name,
  workCenterId: workOrderOperation.workCenterId, plannedStartTime: workOrderOperation.plannedStartTime,
  plannedEndTime: workOrderOperation.plannedEndTime, processLossQuantity: workOrderOperation.processLossQuantity,
  sequentialOrder: workOrderOperation.sequentialOrder,
};

const matColumns = {
  id: productionStepMaterial.id, productionStepId: productionStepMaterial.productionStepId,
  itemId: productionStepMaterial.itemId, requiredQuantity: productionStepMaterial.requiredQuantity,
  consumedQuantity: productionStepMaterial.consumedQuantity, warehouseId: productionStepMaterial.warehouseId,
  lineNumber: productionStepMaterial.lineNumber,
};

const scoColumns = {
  id: subcontractingOrder.id, voucherNumber: subcontractingOrder.voucherNumber, orgNodeId: subcontractingOrder.orgNodeId,
  supplierId: subcontractingOrder.supplierId, workOrderId: subcontractingOrder.workOrderId, postingDate: subcontractingOrder.postingDate,
  totalServiceCost: subcontractingOrder.totalServiceCost, serviceAccountId: subcontractingOrder.serviceAccountId,
  status: subcontractingOrder.status, notes: subcontractingOrder.notes, createdAt: subcontractingOrder.createdAt, updatedAt: subcontractingOrder.updatedAt,
};

const sciColumns = {
  id: subcontractingItem.id, subcontractingOrderId: subcontractingItem.subcontractingOrderId, itemId: subcontractingItem.itemId,
  warehouseId: subcontractingItem.warehouseId, quantity: subcontractingItem.quantity, rawMaterialCost: subcontractingItem.rawMaterialCost,
  serviceRate: subcontractingItem.serviceRate, newValuationRate: subcontractingItem.newValuationRate, createdAt: subcontractingItem.createdAt,
};

@Injectable()
export class ProductionOpsRepository {
  constructor(private readonly database: DatabaseService) {}

  // --- Work Centers ---
  async listWorkCenters(): Promise<WorkCenterRecord[]> {
    const rows = await this.database.db.select(wcColumns).from(workCenter).orderBy(asc(workCenter.code));
    return rows.map((r) => ({ ...r, status: r.status as WorkCenterStatus }));
  }
  async findWorkCenterById(id: string): Promise<WorkCenterRecord | null> {
    const rows = await this.database.db.select(wcColumns).from(workCenter).where(eq(workCenter.id, id)).limit(1);
    return rows[0] ? { ...rows[0], status: rows[0].status as WorkCenterStatus } : null;
  }
  async findWorkCenterByCode(code: string): Promise<WorkCenterRecord | null> {
    const rows = await this.database.db.select(wcColumns).from(workCenter).where(eq(workCenter.code, code)).limit(1);
    return rows[0] ? { ...rows[0], status: rows[0].status as WorkCenterStatus } : null;
  }
  async insertWorkCenter(input: CreateWorkCenterInput & { id: string }): Promise<WorkCenterRecord> {
    const rows = await this.database.db.insert(workCenter).values({
      id: input.id, code: input.code, name: input.name, orgNodeId: input.orgNodeId,
      ratePerMinute: input.ratePerMinute ?? '0',
    }).returning(wcColumns);
    return { ...rows[0]!, status: rows[0]!.status as WorkCenterStatus };
  }

  // --- Production Steps ---
  async listSteps(jobOrderReference?: string): Promise<ProductionStepRecord[]> {
    const query = this.database.db.select(stepColumns).from(productionStep);
    const rows = jobOrderReference ? await query.where(eq(productionStep.jobOrderReference, jobOrderReference)).orderBy(asc(productionStep.sequence)) : await query.orderBy(asc(productionStep.sequence));
    return rows.map((r) => ({ ...r, status: r.status as ProductionStepStatus }));
  }
  async findStepById(id: string): Promise<ProductionStepRecord | null> {
    const rows = await this.database.db.select(stepColumns).from(productionStep).where(eq(productionStep.id, id)).limit(1);
    return rows[0] ? { ...rows[0], status: rows[0].status as ProductionStepStatus } : null;
  }
  async countSteps(jobOrderReference: string): Promise<number> {
    const rows = await this.database.db.select({ id: productionStep.id }).from(productionStep).where(eq(productionStep.jobOrderReference, jobOrderReference));
    return rows.length;
  }
  async insertStep(input: CreateProductionStepInput & { id: string; sequence: number; orgNodeId: string | null }): Promise<ProductionStepRecord> {
    const rows = await this.database.db.insert(productionStep).values({
      id: input.id, jobOrderReference: input.jobOrderReference, workOrderId: input.workOrderId ?? null,
      orgNodeId: input.orgNodeId, workCenterId: input.workCenterId, operationName: input.operationName,
      standardTimeMinutes: input.standardTimeMinutes, forQuantity: input.forQuantity ?? null,
      allowOverproduction: input.allowOverproduction ?? false, overproductionPercentage: input.overproductionPercentage ?? null,
      operatorEmployeeId: input.operatorEmployeeId ?? null, sequence: input.sequence, status: 'pending',
    }).returning(stepColumns);
    return { ...rows[0]!, status: rows[0]!.status as ProductionStepStatus };
  }
  async setStepStatus(id: string, status: ProductionStepStatus): Promise<ProductionStepRecord> {
    const rows = await this.database.db.update(productionStep).set({ status, updatedAt: new Date() }).where(eq(productionStep.id, id)).returning(stepColumns);
    return { ...rows[0]!, status: rows[0]!.status as ProductionStepStatus };
  }
  async recordActualTime(id: string, actualTimeMinutes: string): Promise<ProductionStepRecord> {
    const rows = await this.database.db.update(productionStep).set({ actualTimeMinutes, status: 'done', updatedAt: new Date() }).where(eq(productionStep.id, id)).returning(stepColumns);
    return { ...rows[0]!, status: rows[0]!.status as ProductionStepStatus };
  }

  // --- Time Logs ---
  async addTimeLog(input: { id: string; productionStepId: string; fromTime: string; toTime?: string; timeInMinutes?: string; completedQuantity?: string; processLossQuantity?: string }): Promise<ProductionStepTimeLogRecord> {
    const rows = await this.database.db.insert(productionStepTimeLog).values({
      id: input.id, productionStepId: input.productionStepId, fromTime: new Date(input.fromTime),
      toTime: input.toTime ? new Date(input.toTime) : null, timeInMinutes: input.timeInMinutes ?? null,
      completedQuantity: input.completedQuantity ?? null, processLossQuantity: input.processLossQuantity ?? null,
    }).returning(logColumns);
    const r = rows[0]!;
    return {
      id: r.id, productionStepId: r.productionStepId, fromTime: r.fromTime.toISOString(),
      toTime: r.toTime ? r.toTime.toISOString() : null, timeInMinutes: r.timeInMinutes,
      completedQuantity: r.completedQuantity, processLossQuantity: r.processLossQuantity,
    };
  }
  async listTimeLogs(productionStepId: string): Promise<ProductionStepTimeLogRecord[]> {
    const rows = await this.database.db.select(logColumns).from(productionStepTimeLog).where(eq(productionStepTimeLog.productionStepId, productionStepId));
    return rows.map((r) => ({
      id: r.id, productionStepId: r.productionStepId, fromTime: r.fromTime.toISOString(),
      toTime: r.toTime ? r.toTime.toISOString() : null, timeInMinutes: r.timeInMinutes,
      completedQuantity: r.completedQuantity, processLossQuantity: r.processLossQuantity,
    }));
  }
  async incrementCompletedQuantity(productionStepId: string, qty: string): Promise<void> {
    await this.database.db.execute(sql`UPDATE ${productionStep} SET completed_quantity = completed_quantity + ${qty}::numeric WHERE id = ${productionStepId}`);
  }

  // --- Work Orders ---
  async listWorkOrders(): Promise<WorkOrderRecord[]> {
    const rows = await this.database.db.select(woColumns).from(workOrder).orderBy(desc(workOrder.createdAt));
    return rows.map((r) => ({
      id: r.id, workOrderNumber: r.workOrderNumber, productItemId: r.productItemId, bomId: r.bomId,
      orgNodeId: r.orgNodeId, jobOrderReference: r.jobOrderReference, qtyToManufacture: r.qtyToManufacture,
      sourceWarehouseId: r.sourceWarehouseId, wipWarehouseId: r.wipWarehouseId, finishedGoodsWarehouseId: r.finishedGoodsWarehouseId,
      plannedStartDate: r.plannedStartDate ? r.plannedStartDate.toISOString() : null,
      actualStartDate: r.actualStartDate ? r.actualStartDate.toISOString() : null,
      actualEndDate: r.actualEndDate ? r.actualEndDate.toISOString() : null,
      status: r.status as WorkOrderStatus, useMultiLevelBom: r.useMultiLevelBom, considerScrapItems: r.considerScrapItems,
      materialConsumptionPercentage: r.materialConsumptionPercentage, materialTransferMode: r.materialTransferMode as any,
      trackOperations: r.trackOperations, createdAt: r.createdAt.toISOString(),
    }));
  }
  async findWorkOrderById(id: string): Promise<WorkOrderRecord | null> {
    const rows = await this.database.db.select(woColumns).from(workOrder).where(eq(workOrder.id, id)).limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id, workOrderNumber: r.workOrderNumber, productItemId: r.productItemId, bomId: r.bomId,
      orgNodeId: r.orgNodeId, jobOrderReference: r.jobOrderReference, qtyToManufacture: r.qtyToManufacture,
      sourceWarehouseId: r.sourceWarehouseId, wipWarehouseId: r.wipWarehouseId, finishedGoodsWarehouseId: r.finishedGoodsWarehouseId,
      plannedStartDate: r.plannedStartDate ? r.plannedStartDate.toISOString() : null,
      actualStartDate: r.actualStartDate ? r.actualStartDate.toISOString() : null,
      actualEndDate: r.actualEndDate ? r.actualEndDate.toISOString() : null,
      status: r.status as WorkOrderStatus, useMultiLevelBom: r.useMultiLevelBom, considerScrapItems: r.considerScrapItems,
      materialConsumptionPercentage: r.materialConsumptionPercentage, materialTransferMode: r.materialTransferMode as any,
      trackOperations: r.trackOperations, createdAt: r.createdAt.toISOString(),
    };
  }
  async countWorkOrders(): Promise<number> {
    const rows = await this.database.db.select({ id: workOrder.id }).from(workOrder);
    return rows.length;
  }
  async insertWorkOrder(input: CreateWorkOrderInput & { id: string; workOrderNumber: string }): Promise<WorkOrderRecord> {
    const rows = await this.database.db.insert(workOrder).values({
      id: input.id, workOrderNumber: input.workOrderNumber, productItemId: input.productItemId,
      bomId: input.bomId, orgNodeId: input.orgNodeId, jobOrderReference: input.jobOrderReference ?? null,
      qtyToManufacture: input.qtyToManufacture, sourceWarehouseId: input.sourceWarehouseId ?? null,
      wipWarehouseId: input.wipWarehouseId ?? null, finishedGoodsWarehouseId: input.finishedGoodsWarehouseId,
      plannedStartDate: input.plannedStartDate ? new Date(input.plannedStartDate) : null,
      useMultiLevelBom: input.useMultiLevelBom ?? false, considerScrapItems: input.considerScrapItems ?? false,
      materialConsumptionPercentage: input.materialConsumptionPercentage ?? '100',
      materialTransferMode: input.materialTransferMode ?? 'transfer', trackOperations: input.trackOperations ?? false,
      status: 'not_started',
    }).returning(woColumns);
    const r = rows[0]!;
    return {
      id: r.id, workOrderNumber: r.workOrderNumber, productItemId: r.productItemId, bomId: r.bomId,
      orgNodeId: r.orgNodeId, jobOrderReference: r.jobOrderReference, qtyToManufacture: r.qtyToManufacture,
      sourceWarehouseId: r.sourceWarehouseId, wipWarehouseId: r.wipWarehouseId, finishedGoodsWarehouseId: r.finishedGoodsWarehouseId,
      plannedStartDate: r.plannedStartDate ? r.plannedStartDate.toISOString() : null,
      actualStartDate: r.actualStartDate ? r.actualStartDate.toISOString() : null,
      actualEndDate: r.actualEndDate ? r.actualEndDate.toISOString() : null,
      status: r.status as WorkOrderStatus, useMultiLevelBom: r.useMultiLevelBom, considerScrapItems: r.considerScrapItems,
      materialConsumptionPercentage: r.materialConsumptionPercentage, materialTransferMode: r.materialTransferMode as any,
      trackOperations: r.trackOperations, createdAt: r.createdAt.toISOString(),
    };
  }
  async recordActualStart(id: string): Promise<WorkOrderRecord> {
    await this.database.db.update(workOrder).set({ status: 'in_progress', actualStartDate: new Date(), updatedAt: new Date() }).where(eq(workOrder.id, id));
    return (await this.findWorkOrderById(id))!;
  }
  async recordActualEnd(id: string, status: WorkOrderStatus): Promise<WorkOrderRecord> {
    await this.database.db.update(workOrder).set({ status, actualEndDate: new Date(), updatedAt: new Date() }).where(eq(workOrder.id, id));
    return (await this.findWorkOrderById(id))!;
  }
  async setWorkOrderStatus(id: string, status: WorkOrderStatus): Promise<WorkOrderRecord> {
    await this.database.db.update(workOrder).set({ status, updatedAt: new Date() }).where(eq(workOrder.id, id));
    return (await this.findWorkOrderById(id))!;
  }

  // --- Work Order Operations ---
  async listWorkOrderOperations(workOrderId: string): Promise<WorkOrderOperationRecord[]> {
    const rows = await this.database.db.select(wooColumns).from(workOrderOperation).where(eq(workOrderOperation.workOrderId, workOrderId));
    return rows.map((r) => ({
      id: r.id, workOrderId: r.workOrderId, name: r.name, workCenterId: r.workCenterId,
      plannedStartTime: r.plannedStartTime ? r.plannedStartTime.toISOString() : null,
      plannedEndTime: r.plannedEndTime ? r.plannedEndTime.toISOString() : null,
      processLossQuantity: r.processLossQuantity, sequentialOrder: r.sequentialOrder,
    }));
  }

  // --- Workstation Types & Operations ---
  async listWorkstationTypes(): Promise<WorkstationTypeRecord[]> {
    const rows = await this.database.db.select(wtColumns).from(workstationType);
    return rows.map((r) => ({ ...r, status: r.status as WorkstationTypeStatus }));
  }
  async findWorkstationTypeByCode(code: string): Promise<WorkstationTypeRecord | null> {
    const rows = await this.database.db.select(wtColumns).from(workstationType).where(eq(workstationType.code, code)).limit(1);
    return rows[0] ? { ...rows[0], status: rows[0].status as WorkstationTypeStatus } : null;
  }
  async insertWorkstationType(input: CreateWorkstationTypeInput & { id: string }): Promise<WorkstationTypeRecord> {
    const rows = await this.database.db.insert(workstationType).values(input).returning(wtColumns);
    return { ...rows[0]!, status: rows[0]!.status as WorkstationTypeStatus };
  }

  async listOperations(): Promise<OperationRecord[]> {
    const rows = await this.database.db.select(opColumns).from(operation);
    return rows.map((r) => ({ ...r, status: r.status as OperationStatus }));
  }
  async findOperationByCode(code: string): Promise<OperationRecord | null> {
    const rows = await this.database.db.select(opColumns).from(operation).where(eq(operation.code, code)).limit(1);
    return rows[0] ? { ...rows[0], status: rows[0].status as OperationStatus } : null;
  }
  async insertOperation(input: CreateOperationInput & { id: string }): Promise<OperationRecord> {
    const rows = await this.database.db.insert(operation).values({
      id: input.id, code: input.code, name: input.name, defaultWorkCenterId: input.defaultWorkCenterId ?? null,
      standardTimeMinutes: input.standardTimeMinutes ?? null,
    }).returning(opColumns);
    return { ...rows[0]!, status: rows[0]!.status as OperationStatus };
  }

  // --- Downtime ---
  async listDowntimeEntries(): Promise<DowntimeEntryRecord[]> {
    const rows = await this.database.db.select(dtColumns).from(downtimeEntry);
    return rows.map((r) => ({
      id: r.id, workCenterId: r.workCenterId, operatorEmployeeId: r.operatorEmployeeId, stopReason: r.stopReason,
      startTime: r.startTime.toISOString(), stopTime: r.stopTime ? r.stopTime.toISOString() : null,
      stoppageMinutes: r.stoppageMinutes, remarks: r.remarks,
    }));
  }
  async findDowntimeEntryById(id: string): Promise<DowntimeEntryRecord | null> {
    const rows = await this.database.db.select(dtColumns).from(downtimeEntry).where(eq(downtimeEntry.id, id)).limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id, workCenterId: r.workCenterId, operatorEmployeeId: r.operatorEmployeeId, stopReason: r.stopReason,
      startTime: r.startTime.toISOString(), stopTime: r.stopTime ? r.stopTime.toISOString() : null,
      stoppageMinutes: r.stoppageMinutes, remarks: r.remarks,
    };
  }
  async insertDowntimeEntry(input: CreateDowntimeEntryInput & { id: string }): Promise<DowntimeEntryRecord> {
    const rows = await this.database.db.insert(downtimeEntry).values({
      id: input.id, workCenterId: input.workCenterId, operatorEmployeeId: input.operatorEmployeeId ?? null,
      stopReason: input.stopReason, startTime: new Date(input.startTime), remarks: input.remarks ?? null,
    }).returning(dtColumns);
    const r = rows[0]!;
    return {
      id: r.id, workCenterId: r.workCenterId, operatorEmployeeId: r.operatorEmployeeId, stopReason: r.stopReason,
      startTime: r.startTime.toISOString(), stopTime: r.stopTime ? r.stopTime.toISOString() : null,
      stoppageMinutes: r.stoppageMinutes, remarks: r.remarks,
    };
  }
  async closeDowntimeEntry(id: string, stopTime: Date, stoppageMinutes: string): Promise<DowntimeEntryRecord> {
    const rows = await this.database.db.update(downtimeEntry).set({ stopTime, stoppageMinutes, updatedAt: new Date() }).where(eq(downtimeEntry.id, id)).returning(dtColumns);
    const r = rows[0]!;
    return {
      id: r.id, workCenterId: r.workCenterId, operatorEmployeeId: r.operatorEmployeeId, stopReason: r.stopReason,
      startTime: r.startTime.toISOString(), stopTime: r.stopTime ? r.stopTime.toISOString() : null,
      stoppageMinutes: r.stoppageMinutes, remarks: r.remarks,
    };
  }
  async replaceBomInWorkOrders(oldBomId: string, newBomId: string): Promise<number> {
    const result = await this.database.db.update(workOrder).set({ bomId: newBomId, updatedAt: new Date() }).where(eq(workOrder.bomId, oldBomId));
    return (result as any).rowCount ?? 0;
  }

  // --- Subcontracting ---
  async listSubcontractingOrders(orgNodeId?: string): Promise<SubcontractingOrderRecord[]> {
    const query = this.database.db.select(scoColumns).from(subcontractingOrder);
    const rows = orgNodeId ? await query.where(eq(subcontractingOrder.orgNodeId, orgNodeId)) : await query;
    const results: SubcontractingOrderRecord[] = [];
    for (const r of rows) {
      const items = await this.database.db.select(sciColumns).from(subcontractingItem).where(eq(subcontractingItem.subcontractingOrderId, r.id));
      results.push({
        id: r.id, voucherNumber: r.voucherNumber, orgNodeId: r.orgNodeId, supplierId: r.supplierId, workOrderId: r.workOrderId,
        postingDate: r.postingDate.toISOString(), totalServiceCost: r.totalServiceCost, serviceAccountId: r.serviceAccountId,
        status: r.status as SubcontractingOrderStatus, notes: r.notes, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
        items: items.map((i) => ({
          id: i.id, subcontractingOrderId: i.subcontractingOrderId, itemId: i.itemId, warehouseId: i.warehouseId,
          quantity: i.quantity, rawMaterialCost: i.rawMaterialCost, serviceRate: i.serviceRate, newValuationRate: i.newValuationRate,
          createdAt: i.createdAt.toISOString(),
        })),
      });
    }
    return results;
  }

  async findSubcontractingOrderById(id: string): Promise<SubcontractingOrderRecord | null> {
    const rows = await this.database.db.select(scoColumns).from(subcontractingOrder).where(eq(subcontractingOrder.id, id)).limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    const items = await this.database.db.select(sciColumns).from(subcontractingItem).where(eq(subcontractingItem.subcontractingOrderId, r.id));
    return {
      id: r.id, voucherNumber: r.voucherNumber, orgNodeId: r.orgNodeId, supplierId: r.supplierId, workOrderId: r.workOrderId,
      postingDate: r.postingDate.toISOString(), totalServiceCost: r.totalServiceCost, serviceAccountId: r.serviceAccountId,
      status: r.status as SubcontractingOrderStatus, notes: r.notes, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
      items: items.map((i) => ({
        id: i.id, subcontractingOrderId: i.subcontractingOrderId, itemId: i.itemId, warehouseId: i.warehouseId,
        quantity: i.quantity, rawMaterialCost: i.rawMaterialCost, serviceRate: i.serviceRate, newValuationRate: i.newValuationRate,
        createdAt: i.createdAt.toISOString(),
      })),
    };
  }

  async countSubcontractingOrders(): Promise<number> {
    const rows = await this.database.db.select({ id: subcontractingOrder.id }).from(subcontractingOrder);
    return rows.length;
  }

  async insertSubcontractingOrder(
    input: CreateSubcontractingOrderInput & {
      id: string;
      voucherNumber: string;
      totalServiceCost: string;
      computedItems: Array<{
        id: string;
        itemId: string;
        warehouseId: string;
        quantity: string;
        rawMaterialCost: string;
        serviceRate: string;
        newValuationRate: string;
      }>;
    },
  ): Promise<SubcontractingOrderRecord> {
    const rows = await this.database.db.insert(subcontractingOrder).values({
      id: input.id, voucherNumber: input.voucherNumber, orgNodeId: input.orgNodeId,
      supplierId: input.supplierId, workOrderId: input.workOrderId ?? null,
      postingDate: input.postingDate ? new Date(input.postingDate) : new Date(),
      totalServiceCost: input.totalServiceCost, serviceAccountId: input.serviceAccountId,
      status: 'draft', notes: input.notes ?? null,
    }).returning(scoColumns);

    const insertedOrder = rows[0]!;
    const insertedItems: SubcontractingItemRecord[] = [];

    for (const item of input.computedItems) {
      const itemRows = await this.database.db.insert(subcontractingItem).values({
        id: item.id, subcontractingOrderId: insertedOrder.id, itemId: item.itemId,
        warehouseId: item.warehouseId, quantity: item.quantity, rawMaterialCost: item.rawMaterialCost,
        serviceRate: item.serviceRate, newValuationRate: item.newValuationRate,
      }).returning(sciColumns);

      const lci = itemRows[0]!;
      insertedItems.push({
        id: lci.id, subcontractingOrderId: lci.subcontractingOrderId, itemId: lci.itemId,
        warehouseId: lci.warehouseId, quantity: lci.quantity, rawMaterialCost: lci.rawMaterialCost,
        serviceRate: lci.serviceRate, newValuationRate: lci.newValuationRate,
        createdAt: lci.createdAt.toISOString(),
      });
    }

    return {
      id: insertedOrder.id, voucherNumber: insertedOrder.voucherNumber, orgNodeId: insertedOrder.orgNodeId,
      supplierId: insertedOrder.supplierId, workOrderId: insertedOrder.workOrderId,
      postingDate: insertedOrder.postingDate.toISOString(), totalServiceCost: insertedOrder.totalServiceCost,
      serviceAccountId: insertedOrder.serviceAccountId, status: insertedOrder.status as SubcontractingOrderStatus,
      notes: insertedOrder.notes, createdAt: insertedOrder.createdAt.toISOString(),
      updatedAt: insertedOrder.updatedAt.toISOString(), items: insertedItems,
    };
  }

  async setSubcontractingOrderStatus(id: string, status: SubcontractingOrderStatus): Promise<SubcontractingOrderRecord> {
    await this.database.db.update(subcontractingOrder).set({ status, updatedAt: new Date() }).where(eq(subcontractingOrder.id, id));
    return (await this.findSubcontractingOrderById(id))!;
  }
}