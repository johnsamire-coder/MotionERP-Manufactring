import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { SalesService } from '../sales/sales.service';
import { TechnicalService } from '../technical/technical.service';
import { ProductionOpsNotFoundError, ProductionOpsValidationError } from './production_ops.errors';
import { ProductionOpsRepository } from './production_ops.repository';
import type { JobOrderRecord } from '../sales/sales.types';
import type {
  AddTimeLogInput, CreateOperationInput, CreateProductionStepInput, CreateWorkCenterInput, CreateWorkOrderInput,
  CreateWorkstationTypeInput, JobOrderLaborCost, OperationRecord, ProductionStepRecord, ProductionStepTimeLogRecord,
  WorkCenterRecord, WorkOrderRecord, WorkstationTypeRecord,
} from './production_ops.types';

@Injectable()
export class ProductionOpsService {
  constructor(
    private readonly repository: ProductionOpsRepository,
    private readonly salesService: SalesService,
    private readonly technicalService: TechnicalService,
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

  /**
   * Job Card — extended 14 Sep 2026 to optionally link to a Work Order
   * (owner's explicit choice, kept optional). When workOrderId is given, it
   * must reference an existing Work Order — no cross-field consistency check
   * against jobOrderReference is enforced yet (Motion's jobOrderReference and
   * ERPNext's Work Order model different things; deferred to a later stage).
   */
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
    if (step.status !== 'pending') throw new ProductionOpsValidationError(`step ${id} is "${step.status}" and cannot be started (must be "pending")`);
    return this.repository.setStepStatus(id, 'in_progress');
  }

  async closeStep(id: string, actualTimeMinutes: string): Promise<ProductionStepRecord> {
    const step = await this.repository.findStepById(id);
    if (!step) throw new ProductionOpsNotFoundError(`production step ${id} does not exist`);
    if (step.status !== 'in_progress') throw new ProductionOpsValidationError(`step ${id} is "${step.status}" and cannot be closed (must be "in_progress")`);
    const time = Number(actualTimeMinutes);
    if (!Number.isFinite(time) || time <= 0) throw new ProductionOpsValidationError('actualTimeMinutes must be positive');
    return this.repository.recordActualTime(id, actualTimeMinutes);
  }

  /**
   * A Time Log entry records one shift of actual execution on a Job Card,
   * matching ERPNext's real Time Logs child table (supports multiple
   * pause/resume entries per card). Also accumulates completedQuantity on
   * the parent step when a quantity is reported, without changing status.
   */
  async addTimeLog(input: AddTimeLogInput): Promise<ProductionStepTimeLogRecord> {
    const step = await this.repository.findStepById(input.productionStepId);
    if (!step) throw new ProductionOpsNotFoundError(`production step ${input.productionStepId} does not exist`);
    if (input.toTime && new Date(input.toTime) < new Date(input.fromTime)) {
      throw new ProductionOpsValidationError('toTime cannot be before fromTime');
    }
    const created = await this.repository.addTimeLog({ id: randomUUID(), ...input });
    if (input.completedQuantity) {
      await this.repository.incrementCompletedQuantity(input.productionStepId, input.completedQuantity);
    }
    return created;
  }

  async getTimeLogs(productionStepId: string): Promise<ProductionStepTimeLogRecord[]> {
    return this.repository.listTimeLogs(productionStepId);
  }

  async getJobOrderLaborCost(jobOrderReference: string): Promise<JobOrderLaborCost> {
    const steps = await this.repository.listSteps(jobOrderReference);
    let totalStandardMinutes = 0;
    let totalActualMinutes = 0;
    let totalStandardCost = 0;
    let totalActualCost = 0;
    let stepsDone = 0;

    for (const step of steps) {
      const wc = await this.repository.findWorkCenterById(step.workCenterId);
      const rate = wc ? Number(wc.ratePerMinute) : 0;
      const standardMin = Number(step.standardTimeMinutes);
      totalStandardMinutes += standardMin;
      totalStandardCost += standardMin * rate;
      if (step.actualTimeMinutes) {
        const actualMin = Number(step.actualTimeMinutes);
        totalActualMinutes += actualMin;
        totalActualCost += actualMin * rate;
        stepsDone += 1;
      }
    }

    return {
      jobOrderReference,
      totalStandardMinutes: totalStandardMinutes.toFixed(4),
      totalActualMinutes: totalActualMinutes.toFixed(4),
      totalStandardCost: totalStandardCost.toFixed(4),
      totalActualCost: totalActualCost.toFixed(4),
      stepsCount: steps.length,
      stepsDone,
    };
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
    if (bomRecord.productItemId !== input.productItemId) {
      throw new ProductionOpsValidationError(`BOM ${input.bomId} belongs to a different item than productItemId ${input.productItemId}`);
    }
    if (bomRecord.status !== 'approved') {
      throw new ProductionOpsValidationError(`BOM ${input.bomId} is "${bomRecord.status}" and cannot be used on a work order (must be "approved")`);
    }
    const sequence = (await this.repository.countWorkOrders()) + 1;
    const year = new Date().getFullYear();
    const workOrderNumber = `MFG-WO-${year}-${String(sequence).padStart(6, '0')}`;
    return this.repository.insertWorkOrder({ id: randomUUID(), workOrderNumber, ...input });
  }

  async startWorkOrder(id: string): Promise<WorkOrderRecord> {
    const wo = await this.getWorkOrder(id);
    if (wo.status !== 'not_started') throw new ProductionOpsValidationError(`work order ${id} is "${wo.status}" and cannot be started (must be "not_started")`);
    return this.repository.recordActualStart(id);
  }

  async completeWorkOrder(id: string): Promise<WorkOrderRecord> {
    const wo = await this.getWorkOrder(id);
    if (wo.status !== 'in_progress') throw new ProductionOpsValidationError(`work order ${id} is "${wo.status}" and cannot be completed (must be "in_progress")`);
    return this.repository.recordActualEnd(id, 'completed');
  }

  async stopWorkOrder(id: string): Promise<WorkOrderRecord> {
    const wo = await this.getWorkOrder(id);
    if (wo.status !== 'in_progress') throw new ProductionOpsValidationError(`work order ${id} is "${wo.status}" and cannot be stopped (must be "in_progress")`);
    return this.repository.setWorkOrderStatus(id, 'stopped');
  }

  async closeWorkOrder(id: string): Promise<WorkOrderRecord> {
    const wo = await this.getWorkOrder(id);
    if (wo.status !== 'completed' && wo.status !== 'stopped') {
      throw new ProductionOpsValidationError(`work order ${id} is "${wo.status}" and cannot be closed (must be "completed" or "stopped")`);
    }
    return this.repository.setWorkOrderStatus(id, 'closed');
  }

  async getWorkstationTypes(): Promise<WorkstationTypeRecord[]> { return this.repository.listWorkstationTypes(); }

  async createWorkstationType(input: CreateWorkstationTypeInput): Promise<WorkstationTypeRecord> {
    const code = normalizeCode(input.code);
    const name = normalizeName(input.name);
    const existing = await this.repository.findWorkstationTypeByCode(code);
    if (existing) throw new ProductionOpsValidationError(`a workstation type with code "${code}" already exists`);
    return this.repository.insertWorkstationType({ id: randomUUID(), code, name });
  }

  async getOperations(): Promise<OperationRecord[]> { return this.repository.listOperations(); }

  async createOperation(input: CreateOperationInput): Promise<OperationRecord> {
    const code = normalizeCode(input.code);
    const name = normalizeName(input.name);
    const existing = await this.repository.findOperationByCode(code);
    if (existing) throw new ProductionOpsValidationError(`an operation with code "${code}" already exists`);
    if (input.defaultWorkCenterId) {
      const wc = await this.repository.findWorkCenterById(input.defaultWorkCenterId);
      if (!wc) throw new ProductionOpsNotFoundError(`work center ${input.defaultWorkCenterId} does not exist`);
    }
    return this.repository.insertOperation({ id: randomUUID(), code, name, defaultWorkCenterId: input.defaultWorkCenterId, standardTimeMinutes: input.standardTimeMinutes });
  }
}

function normalizeCode(raw: unknown): string {
  if (typeof raw !== 'string') throw new ProductionOpsValidationError('code is required');
  const trimmed = raw.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(trimmed)) throw new ProductionOpsValidationError('code must match ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$');
  return trimmed;
}
function normalizeName(raw: unknown): string {
  if (typeof raw !== 'string') throw new ProductionOpsValidationError('name is required');
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new ProductionOpsValidationError('name must not be blank');
  return trimmed;
}
