import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { SalesService } from '../sales/sales.service';
import { PlanningNotFoundError, PlanningValidationError } from './planning.errors';
import { PlanningRepository } from './planning.repository';
import type { CreatePlanInput, ProductionPlanRecord, UpdatePlanInput } from './planning.types';

@Injectable()
export class PlanningService {
  constructor(
    private readonly repository: PlanningRepository,
    private readonly salesService: SalesService,
  ) {}

  async getPlans(): Promise<ProductionPlanRecord[]> { return this.repository.listPlans(); }

  async getPlan(id: string): Promise<ProductionPlanRecord> {
    const found = await this.repository.findPlanById(id);
    if (!found) throw new PlanningNotFoundError(`production plan ${id} does not exist`);
    return found;
  }

  /**
   * Creates a planning record for a job order. Looks up the job order via
   * SalesService's public surface only (D2/D20) — planning never touches the
   * sales schema directly, it just verifies the referenced job order number
   * corresponds to a real job order before planning it.
   */
  async createPlan(input: CreatePlanInput): Promise<ProductionPlanRecord> {
    const jobOrders = await this.salesService.getJobOrders();
    const matchingJobOrder = jobOrders.find((jo) => jo.jobOrderNumber === input.jobOrderReference);
    if (!matchingJobOrder) {
      throw new PlanningNotFoundError(`job order "${input.jobOrderReference}" does not exist`);
    }

    const existing = await this.repository.findPlanByJobOrderReference(input.jobOrderReference);
    if (existing) {
      throw new PlanningValidationError(`job order "${input.jobOrderReference}" is already planned`);
    }

    this.validateExecutionMode(input.executionMode, input.internalQuantity, input.externalQuantity);

    return this.repository.insertPlan({ id: randomUUID(), ...input });
  }

  async updatePlan(id: string, patch: UpdatePlanInput): Promise<ProductionPlanRecord> {
    const plan = await this.repository.findPlanById(id);
    if (!plan) throw new PlanningNotFoundError(`production plan ${id} does not exist`);
    if (plan.status === 'locked') {
      throw new PlanningValidationError(`production plan ${id} is locked and cannot be modified`);
    }

    const effectiveMode = patch.executionMode ?? plan.executionMode;
    const effectiveInternal = patch.internalQuantity ?? plan.internalQuantity ?? undefined;
    const effectiveExternal = patch.externalQuantity ?? plan.externalQuantity ?? undefined;
    this.validateExecutionMode(effectiveMode, effectiveInternal, effectiveExternal);

    return this.repository.updatePlanFields(id, patch);
  }

  async lockPlan(id: string): Promise<ProductionPlanRecord> {
    const plan = await this.repository.findPlanById(id);
    if (!plan) throw new PlanningNotFoundError(`production plan ${id} does not exist`);
    return this.repository.setPlanStatus(id, 'locked');
  }

  private validateExecutionMode(
    mode: CreatePlanInput['executionMode'],
    internalQuantity?: string,
    externalQuantity?: string,
  ): void {
    if (mode === 'mixed') {
      const internalNum = Number(internalQuantity);
      const externalNum = Number(externalQuantity);
      if (!internalQuantity || !Number.isFinite(internalNum) || internalNum <= 0) {
        throw new PlanningValidationError('mixed execution mode requires a positive internalQuantity');
      }
      if (!externalQuantity || !Number.isFinite(externalNum) || externalNum <= 0) {
        throw new PlanningValidationError('mixed execution mode requires a positive externalQuantity');
      }
    }
  }
}
