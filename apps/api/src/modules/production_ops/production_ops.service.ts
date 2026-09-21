import { randomUUID } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { SalesService } from '../sales/sales.service';
import { TechnicalService } from '../technical/technical.service';
import { InventoryService } from '../inventory/inventory.service';
import { AccountingService } from '../accounting/accounting.service';
import { ProductionOpsNotFoundError, ProductionOpsValidationError } from './production_ops.errors';
import { ProductionOpsRepository } from './production_ops.repository';
import type { JobOrderRecord } from '../sales/sales.types';
import type {
  AddTimeLogInput, CreateOperationInput, CreateProductionStepInput, CreateWorkCenterInput, CreateWorkOrderInput,
  CreateWorkstationTypeInput, JobOrderLaborCost, OperationRecord, ProductionStepRecord, ProductionStepTimeLogRecord,
  WorkCenterRecord, WorkOrderRecord, WorkstationTypeRecord,
  CreateDowntimeEntryInput, DowntimeEntryRecord,
  WorkOrderOperationRecord, ProductionStepMaterialRecord, ProductionStepMaterialInput,
  SubcontractingOrderRecord, CreateSubcontractingOrderInput, CreateSubcontractingItemInput,
} from './production_ops.types';

@Injectable()
export class ProductionOpsService {
  constructor(
    private readonly repository: ProductionOpsRepository,
    private readonly salesService: SalesService,
    private readonly technicalService: TechnicalService,
    @Optional() private readonly inventoryService?: InventoryService,
    @Optional() private readonly accountingService?: AccountingService,
  ) {}

  private async getJobOrderOrThrow(jobOrderReference: string): Promise<JobOrderRecord> {
    const jobOrders = await this.salesService.getJobOrders();
    const found = jobOrders.find((jo) => jo.jobOrderNumber === jobOrderReference);
    if (!found) throw new ProductionOpsNotFoundError(`job order "${jobOrderReference}" does not exist`);
    return found;
  }

  async getWorkCenters(): Promise<WorkCenterRecord[]> { return this.repository.listWorkCenters(); }
  async createWorkCenter(input: CreateWorkCenterInput): Promise<WorkCenterRecord> {
    const code = normalizeCode(input.code);
    const name = normalizeName(input.name);
    const existing = await this.repository.findWorkCenterByCode(code);
    if (existing) throw new ProductionOpsValidationError(`a work center with code "${code}" already exists`);
    return this.repository.insertWorkCenter({ id: randomUUID(), code, name, orgNodeId: input.orgNodeId, ratePerMinute: input.ratePerMinute });
  }

  async getSteps(jobOrderReference?: string): Promise<ProductionStepRecord[]> { return this.repository.listSteps(jobOrderReference); }
  async getStep(id: string): Promise<ProductionStepRecord> {
    const found = await this.repository.findStepById(id);
    if (!found) throw new ProductionOpsNotFoundError(`production step ${id} does not exist`);
    return found;
  }
  async addStep(input: CreateProductionStepInput): Promise<ProductionStepRecord> {
    const wc = await this.repository.findWorkCenterById(input.workCenterId);
    if (!wc) throw new ProductionOpsNotFoundError(`work center ${input.workCenterId} does not exist`);
    const time = Number(input.standardTimeMinutes);
    if (!Number.isFinite(time) || time <= 0) throw new ProductionOpsValidationError('standardTimeMinutes must be positive');
    if (input.workOrderId) {
      const wo = await this.repository.findWorkOrderById(input.workOrderId);
      if (!wo) throw new ProductionOpsNotFoundError(`work order ${input.workOrderId} does not exist`);
    }
    const sequence = (await this.repository.countSteps(input.jobOrderReference)) + 1;
    const jobOrder = await this.getJobOrderOrThrow(input.jobOrderReference);
    return this.repository.insertStep({ id: randomUUID(), sequence, orgNodeId: jobOrder.orgNodeId, ...input });
  }
  async startStep(id: string): Promise<ProductionStepRecord> {
    const step = await this.repository.findStepById(id);
    if (!step) throw new ProductionOpsNotFoundError(`production step ${id} does not exist`);
    if (step.status !== 'pending') throw new ProductionOpsValidationError(`step ${id} is "${step.status}" and cannot be started`);
    return this.repository.setStepStatus(id, 'in_progress');
  }
  async closeStep(id: string, actualTimeMinutes: string): Promise<ProductionStepRecord> {
    const step = await this.repository.findStepById(id);
    if (!step) throw new ProductionOpsNotFoundError(`production step ${id} does not exist`);
    if (step.status !== 'in_progress') throw new ProductionOpsValidationError(`step ${id} is "${step.status}" and cannot be closed`);
    const time = Number(actualTimeMinutes);
    if (!Number.isFinite(time) || time <= 0) throw new ProductionOpsValidationError('actualTimeMinutes must be positive');
    return this.repository.recordActualTime(id, actualTimeMinutes);
  }
  async addTimeLog(input: AddTimeLogInput): Promise<ProductionStepTimeLogRecord> {
    const step = await this.repository.findStepById(input.productionStepId);
    if (!step) throw new ProductionOpsNotFoundError(`production step ${input.productionStepId} does not exist`);
    if (input.toTime && new Date(input.toTime) < new Date(input.fromTime)) throw new ProductionOpsValidationError('toTime cannot be before fromTime');
    const created = await this.repository.addTimeLog({ id: randomUUID(), ...input });
    if (input.completedQuantity) await this.repository.incrementCompletedQuantity(input.productionStepId, input.completedQuantity);
    return created;
  }
  async getTimeLogs(productionStepId: string): Promise<ProductionStepTimeLogRecord[]> { return this.repository.listTimeLogs(productionStepId); }

  async getJobOrderLaborCost(jobOrderReference: string): Promise<JobOrderLaborCost> {
    const steps = await this.repository.listSteps(jobOrderReference);
    let totalStandardMinutes = 0, totalActualMinutes = 0, totalStandardCost = 0, totalActualCost = 0, stepsDone = 0;
    for (const step of steps) {
      const wc = await this.repository.findWorkCenterById(step.workCenterId);
      const rate = wc ? Number(wc.ratePerMinute) : 0;
      const standardMin = Number(step.standardTimeMinutes);
      totalStandardMinutes += standardMin; totalStandardCost += standardMin * rate;
      if (step.actualTimeMinutes) { const actualMin = Number(step.actualTimeMinutes); totalActualMinutes += actualMin; totalActualCost += actualMin * rate; stepsDone += 1; }
    }
    return { jobOrderReference, totalStandardMinutes: totalStandardMinutes.toFixed(4), totalActualMinutes: totalActualMinutes.toFixed(4), totalStandardCost: totalStandardCost.toFixed(4), totalActualCost: totalActualCost.toFixed(4), stepsCount: steps.length, stepsDone };
  }

  async getWorkOrders(): Promise<WorkOrderRecord[]> { return this.repository.listWorkOrders(); }
  async getWorkOrder(id: string): Promise<WorkOrderRecord> {
    const found = await this.repository.findWorkOrderById(id);
    if (!found) throw new ProductionOpsNotFoundError(`work order ${id} does not exist`);
    return found;
  }
  async createWorkOrder(input: CreateWorkOrderInput): Promise<WorkOrderRecord> {
    const qty = Number(input.qtyToManufacture);
    if (!Number.isFinite(qty) || qty <= 0) throw new ProductionOpsValidationError('qtyToManufacture must be positive');
    const bomRecord = await this.technicalService.getBom(input.bomId);
    if (bomRecord.productItemId !== input.productItemId) throw new ProductionOpsValidationError(`BOM ${input.bomId} belongs to a different item`);
    if (bomRecord.status !== 'approved') throw new ProductionOpsValidationError(`BOM ${input.bomId} must be "approved"`);
    const sequence = (await this.repository.countWorkOrders()) + 1;
    const year = new Date().getFullYear();
    return this.repository.insertWorkOrder({ id: randomUUID(), workOrderNumber: `MFG-WO-${year}-${String(sequence).padStart(6, '0')}`, ...input });
  }
  async getWorkOrderOperations(workOrderId: string): Promise<WorkOrderOperationRecord[]> {
    await this.getWorkOrder(workOrderId);
    return this.repository.listWorkOrderOperations(workOrderId);
  }
  async startWorkOrder(id: string): Promise<WorkOrderRecord> {
    const wo = await this.getWorkOrder(id);
    if (wo.status !== 'not_started') throw new ProductionOpsValidationError(`work order ${id} is "${wo.status}"`);
    return this.repository.recordActualStart(id);
  }
  async completeWorkOrder(id: string): Promise<WorkOrderRecord> {
    const wo = await this.getWorkOrder(id);
    if (wo.status !== 'in_progress') throw new ProductionOpsValidationError(`work order ${id} is "${wo.status}"`);
    return this.repository.recordActualEnd(id, 'completed');
  }
  async stopWorkOrder(id: string): Promise<WorkOrderRecord> {
    const wo = await this.getWorkOrder(id);
    if (wo.status !== 'in_progress') throw new ProductionOpsValidationError(`work order ${id} is "${wo.status}"`);
    return this.repository.setWorkOrderStatus(id, 'stopped');
  }
  async closeWorkOrder(id: string): Promise<WorkOrderRecord> {
    const wo = await this.getWorkOrder(id);
    if (wo.status !== 'completed' && wo.status !== 'stopped') throw new ProductionOpsValidationError(`work order ${id} is "${wo.status}"`);
    return this.repository.setWorkOrderStatus(id, 'closed');
  }

  async getWorkstationTypes(): Promise<WorkstationTypeRecord[]> { return this.repository.listWorkstationTypes(); }
  async createWorkstationType(input: CreateWorkstationTypeInput): Promise<WorkstationTypeRecord> {
    const code = normalizeCode(input.code); const name = normalizeName(input.name);
    const existing = await this.repository.findWorkstationTypeByCode(code);
    if (existing) throw new ProductionOpsValidationError(`a workstation type with code "${code}" already exists`);
    return this.repository.insertWorkstationType({ id: randomUUID(), code, name });
  }

  async getOperations(): Promise<OperationRecord[]> { return this.repository.listOperations(); }
  async createOperation(input: CreateOperationInput): Promise<OperationRecord> {
    const code = normalizeCode(input.code); const name = normalizeName(input.name);
    const existing = await this.repository.findOperationByCode(code);
    if (existing) throw new ProductionOpsValidationError(`an operation with code "${code}" already exists`);
    return this.repository.insertOperation({ id: randomUUID(), code, name, defaultWorkCenterId: input.defaultWorkCenterId, standardTimeMinutes: input.standardTimeMinutes });
  }

  async getDowntimeEntries(): Promise<DowntimeEntryRecord[]> { return this.repository.listDowntimeEntries(); }
  async createDowntimeEntry(input: CreateDowntimeEntryInput): Promise<DowntimeEntryRecord> {
    if (!input.stopReason || !input.stopReason.trim()) throw new ProductionOpsValidationError('stopReason is required');
    return this.repository.insertDowntimeEntry({ id: randomUUID(), ...input });
  }
  async closeDowntimeEntry(id: string): Promise<DowntimeEntryRecord> {
    const found = await this.repository.findDowntimeEntryById(id);
    if (!found) throw new ProductionOpsNotFoundError(`downtime entry ${id} does not exist`);
    if (found.stopTime) throw new ProductionOpsValidationError(`downtime entry ${id} is already closed`);
    const minutes = (new Date().getTime() - new Date(found.startTime).getTime()) / 60000;
    return this.repository.closeDowntimeEntry(id, new Date(), minutes.toFixed(2));
  }
  async replaceBomInWorkOrders(oldBomId: string, newBomId: string): Promise<number> { return this.repository.replaceBomInWorkOrders(oldBomId, newBomId); }

  // --- Subcontracting ---
  async getSubcontractingOrders(orgNodeId?: string): Promise<SubcontractingOrderRecord[]> { return this.repository.listSubcontractingOrders(orgNodeId); }
  async getSubcontractingOrder(id: string): Promise<SubcontractingOrderRecord> {
    const found = await this.repository.findSubcontractingOrderById(id);
    if (!found) throw new ProductionOpsNotFoundError(`Subcontracting order ${id} does not exist`);
    return found;
  }
  async createSubcontractingOrder(input: CreateSubcontractingOrderInput): Promise<SubcontractingOrderRecord> {
    if (!input.orgNodeId) throw new ProductionOpsValidationError('orgNodeId is required');
    if (!input.supplierId) throw new ProductionOpsValidationError('supplierId is required');
    if (!input.serviceAccountId) throw new ProductionOpsValidationError('serviceAccountId is required');
    const totalService = Number(input.totalServiceCost);
    if (!Number.isFinite(totalService) || totalService <= 0) throw new ProductionOpsValidationError('totalServiceCost must be positive');
    if (!input.items || input.items.length === 0) throw new ProductionOpsValidationError('must have at least one item');

    const computedItems = input.items.map((item: CreateSubcontractingItemInput) => {
      const qty = Number(item.quantity); const rawCost = Number(item.rawMaterialCost); const serviceRate = Number(item.serviceRate);
      if (qty <= 0 || rawCost < 0 || serviceRate < 0) throw new ProductionOpsValidationError('Invalid item data');
      return { id: randomUUID(), itemId: item.itemId, warehouseId: item.warehouseId, quantity: item.quantity, rawMaterialCost: item.rawMaterialCost, serviceRate: item.serviceRate, newValuationRate: ((rawCost / qty) + serviceRate).toFixed(6) };
    });

    const sequence = (await this.repository.countSubcontractingOrders()) + 1;
    return this.repository.insertSubcontractingOrder({ ...input, id: randomUUID(), voucherNumber: `SUB-WO-${new Date().getFullYear()}-${String(sequence).padStart(6, '0')}`, totalServiceCost: totalService.toFixed(4), computedItems });
  }
  async postSubcontractingOrder(id: string): Promise<SubcontractingOrderRecord> {
    const order = await this.getSubcontractingOrder(id);
    if (order.status !== 'draft') throw new ProductionOpsValidationError(`order ${id} is "${order.status}"`);
    if (this.accountingService) {
      const config = await (this.accountingService as any).getCompanyConfig(order.orgNodeId);
      const wipAccountId = config?.defaultWipAccountId;
      if (wipAccountId) {
        const draft = await this.accountingService.createEntry({ orgNodeId: order.orgNodeId, description: `[Auto] رسملة مصنعية مقاول الباطن: ${order.voucherNumber}`, reference: order.voucherNumber, entryDate: order.postingDate, isAutoGenerated: true, idempotencyKey: `subcontract-${order.id}`, sourceEventType: 'subcontracting', lines: [{ accountId: wipAccountId, debitAmount: order.totalServiceCost, creditAmount: '0', description: `[Auto] WIP: ${order.voucherNumber}` }, { accountId: order.serviceAccountId, debitAmount: '0', creditAmount: order.totalServiceCost, description: `[Auto] Service Liability: ${order.voucherNumber}` }] });
        await this.accountingService.postEntry(draft.id);
      }
    }

    // Issue raw materials from subcontractor warehouse to close the custody loop
    if (this.inventoryService) {
      for (const item of order.items) {
        await this.inventoryService.createMovement({
          itemId: item.itemId,
          warehouseId: item.warehouseId,
          movementType: 'issue',
          quantity: item.quantity,
          sourceModule: 'production',
          sourceId: order.id,
          note: `تسوية صرف عهدة خامات لمقاول الباطن لسند ${order.voucherNumber}`,
        });
      }
    }

    return this.repository.setSubcontractingOrderStatus(id, 'posted');
  }
  async cancelSubcontractingOrder(id: string): Promise<SubcontractingOrderRecord> {
    const order = await this.getSubcontractingOrder(id);
    if (order.status === 'posted') throw new ProductionOpsValidationError(`order ${id} is already posted`);
    return this.repository.setSubcontractingOrderStatus(id, 'cancelled');
  }
}

function normalizeCode(raw: unknown): string {
  if (typeof raw !== 'string') throw new ProductionOpsValidationError('code is required');
  const trimmed = raw.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(trimmed)) throw new ProductionOpsValidationError('invalid code format');
  return trimmed;
}
function normalizeName(raw: unknown): string {
  if (typeof raw !== 'string') throw new ProductionOpsValidationError('name is required');
  if (raw.trim().length === 0) throw new ProductionOpsValidationError('name must not be blank');
  return raw.trim();
}