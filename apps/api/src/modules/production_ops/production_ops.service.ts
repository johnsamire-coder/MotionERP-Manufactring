import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { SalesService } from '../sales/sales.service';
import { ProductionOpsNotFoundError, ProductionOpsValidationError } from './production_ops.errors';
import { ProductionOpsRepository } from './production_ops.repository';
import type { JobOrderRecord } from '../sales/sales.types';
import type {
  CreateProductionStepInput, CreateWorkCenterInput, JobOrderLaborCost, ProductionStepRecord, WorkCenterRecord,
} from './production_ops.types';

@Injectable()
export class ProductionOpsService {
  constructor(
    private readonly repository: ProductionOpsRepository,
    private readonly salesService: SalesService,
  ) {}

  /**
   * Looks up the referenced job order through SalesService's public surface
   * only (D2/D20), and rejects unknown references before creating a step.
   */
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

  async addStep(input: CreateProductionStepInput): Promise<ProductionStepRecord> {
    const wc = await this.repository.findWorkCenterById(input.workCenterId);
    if (!wc) throw new ProductionOpsNotFoundError(`work center ${input.workCenterId} does not exist`);
    const time = Number(input.standardTimeMinutes);
    if (!Number.isFinite(time) || time <= 0) throw new ProductionOpsValidationError('standardTimeMinutes must be positive');
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
