import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { SalesService } from '../sales/sales.service';
import type { JobOrderRecord } from '../sales/sales.types';
import { FinanceNotFoundError, FinanceValidationError } from './finance.errors';
import { FinanceRepository } from './finance.repository';
import type { CollectionRecord, CreateCollectionInput, CreateRetentionInput, RetentionRecord } from './finance.types';

@Injectable()
export class FinanceService {
  constructor(
    private readonly repository: FinanceRepository,
    private readonly salesService: SalesService,
  ) {}

  /**
   * Mandatory job order lookup (D2/D20: via SalesService's public surface
   * only, no direct FK between finance and sales). Same pattern applied to
   * production, production_ops, cost, and delivery — a collection or
   * retention can no longer be recorded against a non-existent job order.
   */
  private async getJobOrderOrThrow(jobOrderReference: string): Promise<JobOrderRecord> {
    const jobOrders = await this.salesService.getJobOrders();
    const found = jobOrders.find((jo) => jo.jobOrderNumber === jobOrderReference);
    if (!found) throw new FinanceNotFoundError(`job order "${jobOrderReference}" does not exist`);
    return found;
  }

  async getCollections(jobOrderReference?: string): Promise<CollectionRecord[]> { return this.repository.listCollections(jobOrderReference); }

  async recordCollection(input: CreateCollectionInput): Promise<CollectionRecord> {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new FinanceValidationError('amount must be positive');

    const jobOrder = await this.getJobOrderOrThrow(input.jobOrderReference);
    const sequence = (await this.repository.countCollections()) + 1;
    const year = new Date().getFullYear();
    const collectionNumber = `COL-${year}-${String(sequence).padStart(6, '0')}`;

    return this.repository.insertCollection({ id: randomUUID(), collectionNumber, orgNodeId: jobOrder.orgNodeId, ...input });
  }

  async getRetentions(jobOrderReference?: string): Promise<RetentionRecord[]> { return this.repository.listRetentions(jobOrderReference); }

  async createRetention(input: CreateRetentionInput): Promise<RetentionRecord> {
    const amount = Number(input.originalAmount);
    if (!Number.isFinite(amount) || amount <= 0) throw new FinanceValidationError('originalAmount must be positive');
    if (!input.dueDate) throw new FinanceValidationError('dueDate is required');

    const jobOrder = await this.getJobOrderOrThrow(input.jobOrderReference);
    const sequence = (await this.repository.countRetentions()) + 1;
    const year = new Date().getFullYear();
    const retentionNumber = `RET-${year}-${String(sequence).padStart(6, '0')}`;

    return this.repository.insertRetention({ id: randomUUID(), retentionNumber, orgNodeId: jobOrder.orgNodeId, ...input });
  }

  async releaseRetention(id: string, amount: string): Promise<RetentionRecord> {
    const retentionRecord = await this.repository.findRetentionById(id);
    if (!retentionRecord) throw new FinanceNotFoundError(`retention ${id} does not exist`);
    if (retentionRecord.status !== 'active') {
      throw new FinanceValidationError(`retention ${id} is "${retentionRecord.status}" and cannot be released (must be "active")`);
    }

    const releaseAmount = Number(amount);
    if (!Number.isFinite(releaseAmount) || releaseAmount <= 0) throw new FinanceValidationError('release amount must be positive');

    const remaining = Number(retentionRecord.originalAmount) - Number(retentionRecord.releasedAmount);
    if (releaseAmount > remaining) {
      throw new FinanceValidationError(`release amount ${releaseAmount} exceeds remaining retention ${remaining}`);
    }

    const newReleasedTotal = (Number(retentionRecord.releasedAmount) + releaseAmount).toFixed(4);
    const isFullyReleased = Number(newReleasedTotal) >= Number(retentionRecord.originalAmount);
    return this.repository.releaseRetention(id, newReleasedTotal, isFullyReleased ? 'released' : 'active');
  }
}
