import { randomUUID } from 'node:crypto';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { CostService } from '../cost/cost.service';
import { InventoryService } from '../inventory/inventory.service';
import { SalesService } from '../sales/sales.service';
import { ProductionNotFoundError, ProductionValidationError } from './production.errors';
import { ProductionRepository } from './production.repository';
import type { JobOrderRecord } from '../sales/sales.types';
import type {
  CreateMaterialRequestInput,
  MaterialRequestRecord,
  MaterialVarianceLine,
  MaterialVarianceReport,
} from './production.types';

@Injectable()
export class ProductionService {
  constructor(
    private readonly repository: ProductionRepository,
    private readonly inventoryService: InventoryService,
    private readonly salesService: SalesService,
    @Optional() private readonly costService?: CostService,
  ) {}

  private readonly logger = new Logger(ProductionService.name);

  /**
   * Looks up the referenced job order through SalesService's public surface
   * only (D2/D20), and rejects unknown references before creating a request.
   */
  private async getJobOrderOrThrow(jobOrderReference: string): Promise<JobOrderRecord> {
    const jobOrders = await this.salesService.getJobOrders();
    const found = jobOrders.find((jo) => jo.jobOrderNumber === jobOrderReference);
    if (!found)
      throw new ProductionNotFoundError(`job order "${jobOrderReference}" does not exist`);
    return found;
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
    if (!Number.isFinite(planned) || planned < 0)
      throw new ProductionValidationError('plannedQuantity cannot be negative');
    if (!Number.isFinite(requested) || requested <= 0)
      throw new ProductionValidationError('requestedQuantity must be positive');

    const status = requested > planned ? 'pending_review' : 'approved';
    const jobOrder = await this.getJobOrderOrThrow(input.jobOrderReference);
    return this.repository.insertRequest({
      id: randomUUID(),
      orgNodeId: jobOrder.orgNodeId,
      ...input,
      status,
    });
  }

  async approveDeviation(id: string, deviationReason: string): Promise<MaterialRequestRecord> {
    const found = await this.repository.findRequestById(id);
    if (!found) throw new ProductionNotFoundError(`material request ${id} does not exist`);
    if (found.status !== 'pending_review') {
      throw new ProductionValidationError(
        `request ${id} is "${found.status}", not "pending_review"`,
      );
    }
    if (!deviationReason || deviationReason.trim().length === 0) {
      throw new ProductionValidationError(
        'a deviation reason is required to approve an over-request',
      );
    }
    return this.repository.setStatus(id, 'approved', deviationReason.trim());
  }

  async rejectRequest(id: string, reason: string): Promise<MaterialRequestRecord> {
    const found = await this.repository.findRequestById(id);
    if (!found) throw new ProductionNotFoundError(`material request ${id} does not exist`);
    if (found.status !== 'pending_review' && found.status !== 'approved') {
      throw new ProductionValidationError(
        `request ${id} is "${found.status}" and cannot be rejected`,
      );
    }
    return this.repository.setStatus(id, 'rejected', reason);
  }

  async issueRequest(id: string): Promise<MaterialRequestRecord> {
    const found = await this.repository.findRequestById(id);
    if (!found) throw new ProductionNotFoundError(`material request ${id} does not exist`);
    if (found.status !== 'approved') {
      throw new ProductionValidationError(
        `request ${id} is "${found.status}" and cannot be issued (must be "approved")`,
      );
    }
    // Issued to production: posts Dr WIP / Cr stock (not stock adjustment), and the movement is
    // linked back to the request so its actual value feeds the planned-vs-actual variance.
    const movement = await this.inventoryService.createMovement({
      itemId: found.itemId,
      warehouseId: found.warehouseId,
      movementType: 'issue',
      purpose: 'manufacture_consumption',
      quantity: found.requestedQuantity,
      sourceModule: 'production',
      sourceId: id,
      note: `Material request ${id} (job order ${found.jobOrderReference})`,
    });
    const issued = await this.repository.recordIssue(id, found.requestedQuantity, {
      movementId: movement.id,
      value: movement.totalValue,
    });
    // Owner decision: every issue is recorded as actual material cost on the job order's cost
    // sheet. The stock has already moved and posted, so a failure here is logged, not thrown; the
    // entry is keyed by the request so a later re-sync never records it twice.
    if (this.costService && Number(movement.totalValue ?? 0) > 0) {
      try {
        await this.costService.recordActualMaterialCost(
          found.jobOrderReference,
          Number(movement.totalValue).toFixed(4),
          `material-request:${id}`,
          `صرف خامات — طلب ${id.slice(0, 8)}`,
        );
      } catch (err) {
        this.logger.warn(
          `material request ${id}: issued, but its actual cost was not recorded on job order ${found.jobOrderReference}: ${(err as Error).message}`,
        );
      }
    }
    return issued;
  }

  /**
   * Planned vs actual materials of a job order, from its material requests. Every quantity is
   * valued at the actual moving-average rate of its issue: usage variance = (used − planned) × rate,
   * over-request = requested − planned, and "not returned" = issued − used (still in WIP).
   */
  async getMaterialVariance(jobOrderReference: string): Promise<MaterialVarianceReport> {
    const requests = (await this.repository.listRequests(jobOrderReference)).filter(
      (r) => r.status !== 'rejected',
    );
    const r4 = (n: number): string => n.toFixed(4);
    let plannedValue = 0,
      issuedValue = 0,
      usedValue = 0,
      usageVariance = 0,
      notReturnedValue = 0;
    const lines: MaterialVarianceLine[] = requests.map((r) => {
      const planned = Number(r.plannedQuantity);
      const requested = Number(r.requestedQuantity);
      const issued = Number(r.issuedQuantity ?? 0);
      const used = r.actualUsedQuantity == null ? null : Number(r.actualUsedQuantity);
      const value = r.issuedValue == null ? null : Number(r.issuedValue);
      const rate = value != null && issued > 0 ? value / issued : null;
      const line: MaterialVarianceLine = {
        requestId: r.id,
        itemId: r.itemId,
        warehouseId: r.warehouseId,
        status: r.status,
        deviationReason: r.deviationReason,
        plannedQuantity: r.plannedQuantity,
        requestedQuantity: r.requestedQuantity,
        issuedQuantity: r.issuedQuantity,
        actualUsedQuantity: r.actualUsedQuantity,
        overRequestQuantity: r4(requested - planned),
        usageVarianceQuantity: used == null ? null : r4(used - planned),
        notReturnedQuantity: used == null ? null : r4(issued - used),
        actualRate: rate == null ? null : r4(rate),
        plannedValue: rate == null ? null : r4(planned * rate),
        issuedValue: value == null ? null : r4(value),
        usedValue: rate == null || used == null ? null : r4(used * rate),
        usageVarianceValue: rate == null || used == null ? null : r4((used - planned) * rate),
      };
      if (rate != null) {
        plannedValue += planned * rate;
        issuedValue += value ?? 0;
        if (used != null) {
          usedValue += used * rate;
          usageVariance += (used - planned) * rate;
          notReturnedValue += (issued - used) * rate;
        }
      }
      return line;
    });
    return {
      jobOrderReference,
      lines,
      totals: {
        plannedValue: r4(plannedValue),
        issuedValue: r4(issuedValue),
        usedValue: r4(usedValue),
        usageVarianceValue: r4(usageVariance),
        notReturnedValue: r4(notReturnedValue),
      },
      pendingLines: lines.filter((l) => l.issuedValue == null).length,
    };
  }

  async closeRequest(id: string, actualUsedQuantity: string): Promise<MaterialRequestRecord> {
    const found = await this.repository.findRequestById(id);
    if (!found) throw new ProductionNotFoundError(`material request ${id} does not exist`);
    if (found.status !== 'issued') {
      throw new ProductionValidationError(
        `request ${id} is "${found.status}" and cannot be closed (must be "issued")`,
      );
    }
    const used = Number(actualUsedQuantity);
    if (!Number.isFinite(used) || used < 0)
      throw new ProductionValidationError('actualUsedQuantity cannot be negative');
    return this.repository.closeRequest(id, actualUsedQuantity);
  }
}
