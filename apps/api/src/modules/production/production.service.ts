import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';
import { SalesService } from '../sales/sales.service';
import { ProductionNotFoundError, ProductionValidationError } from './production.errors';
import { ProductionRepository } from './production.repository';
import type { CreateMaterialRequestInput, MaterialRequestRecord } from './production.types';

@Injectable()
export class ProductionService {
  constructor(
    private readonly repository: ProductionRepository,
    private readonly inventoryService: InventoryService,
    private readonly salesService: SalesService,
  ) {}

  /**
   * Best-effort lookup of the referenced job order's orgNodeId. Unlike
   * technical/planning, production never required the job order to exist
   * before this change — adding that requirement now would be a new
   * validation rule, not just organizational linking — so a missing job
   * order simply leaves orgNodeId as null instead of throwing.
   */
  private async tryGetOrgNodeId(jobOrderReference: string): Promise<string | null> {
    const jobOrders = await this.salesService.getJobOrders();
    return jobOrders.find((jo) => jo.jobOrderNumber === jobOrderReference)?.orgNodeId ?? null;
  }

  async getRequests(jobOrderReference?: string): Promise<MaterialRequestRecord[]> {
    return this.repository.listRequests(jobOrderReference);
  }

  async getRequest(id: string): Promise<MaterialRequestRecord> {
    const found = await this.repository.findRequestById(id);
    if (!found) throw new ProductionNotFoundError(`material request ${id} does not exist`);
    return found;
  }

  async createRequest(input: CreateMaterialRequestInput): Promise<MaterialRequestRecord> {
    const planned = Number(input.plannedQuantity);
    const requested = Number(input.requestedQuantity);
    if (!Number.isFinite(planned) || planned < 0) throw new ProductionValidationError('plannedQuantity cannot be negative');
    if (!Number.isFinite(requested) || requested <= 0) throw new ProductionValidationError('requestedQuantity must be positive');

    const status = requested > planned ? 'pending_review' : 'approved';
    const orgNodeId = await this.tryGetOrgNodeId(input.jobOrderReference);
    return this.repository.insertRequest({ id: randomUUID(), orgNodeId, ...input, status });
  }

  async approveDeviation(id: string, deviationReason: string): Promise<MaterialRequestRecord> {
    const found = await this.repository.findRequestById(id);
    if (!found) throw new ProductionNotFoundError(`material request ${id} does not exist`);
    if (found.status !== 'pending_review') {
      throw new ProductionValidationError(`request ${id} is "${found.status}", not "pending_review"`);
    }
    if (!deviationReason || deviationReason.trim().length === 0) {
      throw new ProductionValidationError('a deviation reason is required to approve an over-request');
    }
    return this.repository.setStatus(id, 'approved', deviationReason.trim());
  }

  async rejectRequest(id: string, reason: string): Promise<MaterialRequestRecord> {
    const found = await this.repository.findRequestById(id);
    if (!found) throw new ProductionNotFoundError(`material request ${id} does not exist`);
    if (found.status !== 'pending_review' && found.status !== 'approved') {
      throw new ProductionValidationError(`request ${id} is "${found.status}" and cannot be rejected`);
    }
    return this.repository.setStatus(id, 'rejected', reason);
  }

  async issueRequest(id: string): Promise<MaterialRequestRecord> {
    const found = await this.repository.findRequestById(id);
    if (!found) throw new ProductionNotFoundError(`material request ${id} does not exist`);
    if (found.status !== 'approved') {
      throw new ProductionValidationError(`request ${id} is "${found.status}" and cannot be issued (must be "approved")`);
    }
    await this.inventoryService.createMovement({
      itemId: found.itemId, warehouseId: found.warehouseId, movementType: 'issue',
      quantity: found.requestedQuantity, note: `Material request ${id} (job order ${found.jobOrderReference})`,
    });
    return this.repository.recordIssue(id, found.requestedQuantity);
  }

  async closeRequest(id: string, actualUsedQuantity: string): Promise<MaterialRequestRecord> {
    const found = await this.repository.findRequestById(id);
    if (!found) throw new ProductionNotFoundError(`material request ${id} does not exist`);
    if (found.status !== 'issued') {
      throw new ProductionValidationError(`request ${id} is "${found.status}" and cannot be closed (must be "issued")`);
    }
    const used = Number(actualUsedQuantity);
    if (!Number.isFinite(used) || used < 0) throw new ProductionValidationError('actualUsedQuantity cannot be negative');
    return this.repository.closeRequest(id, actualUsedQuantity);
  }
}
