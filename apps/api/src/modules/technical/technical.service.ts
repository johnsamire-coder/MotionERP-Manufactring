import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { SalesService } from '../sales/sales.service';
import type { JobOrderRecord } from '../sales/sales.types';
import { TechnicalNotFoundError, TechnicalValidationError } from './technical.errors';
import { TechnicalRepository } from './technical.repository';
import type { BomRecord, CreateBomInput, CreateTechnicalDocumentInput, TechnicalDocumentRecord } from './technical.types';
@Injectable()
export class TechnicalService {
  constructor(
    private readonly repository: TechnicalRepository,
    private readonly salesService: SalesService,
  ) {}
  private async getJobOrderOrThrow(jobOrderReference: string): Promise<JobOrderRecord> {
    const jobOrders = await this.salesService.getJobOrders();
    const found = jobOrders.find((jo) => jo.jobOrderNumber === jobOrderReference);
    if (!found) throw new TechnicalNotFoundError(`job order "${jobOrderReference}" does not exist`);
    return found;
  }
  async getDocuments(jobOrderReference?: string): Promise<TechnicalDocumentRecord[]> {
    return this.repository.listDocuments(jobOrderReference);
  }
  async addDocument(input: CreateTechnicalDocumentInput): Promise<TechnicalDocumentRecord> {
    const jobOrder = await this.getJobOrderOrThrow(input.jobOrderReference);
    if (!input.fileReference || input.fileReference.trim().length === 0) {
      throw new TechnicalValidationError('fileReference is required');
    }
    return this.repository.insertDocument({ id: randomUUID(), orgNodeId: jobOrder.orgNodeId, ...input });
  }
  async getBoms(productItemId?: string): Promise<BomRecord[]> { return this.repository.listBoms(productItemId); }
  async getBom(id: string): Promise<BomRecord> {
    const found = await this.repository.findBomById(id);
    if (!found) throw new TechnicalNotFoundError(`BOM ${id} does not exist`);
    return found;
  }
  /**
   * BOM parity redesign (13 Sep 2026): scoped to the product ITEM, matching
   * ERPNext's real "Item to Manufacture" master exactly — not a job order.
   * Multiple BOMs can exist per item (versions), but only one may be
   * "Default" at a time, matching ERPNext's real behavior: setting a new
   * BOM as default automatically un-defaults every other BOM for that item.
   */
  async createBom(input: CreateBomInput): Promise<BomRecord> {
    if (!input.lines || input.lines.length === 0) {
      throw new TechnicalValidationError('a BOM must have at least one component line');
    }
    for (const line of input.lines) {
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) throw new TechnicalValidationError('every BOM line quantity must be positive');
      if (line.componentItemId === input.productItemId) throw new TechnicalValidationError('a product cannot be a component of its own BOM');
    }
    const outputQty = Number(input.outputQuantity ?? '1');
    if (!Number.isFinite(outputQty) || outputQty <= 0) throw new TechnicalValidationError('output quantity must be positive');
    let version = 1;
    // eslint-disable-next-line no-constant-condition
    while (await this.repository.findBomByItemAndVersion(input.productItemId, version)) version += 1;
    if (input.isDefault) {
      await this.repository.clearDefaultForItem(input.productItemId);
    }
    return this.repository.insertBom({ id: randomUUID(), version, ...input });
  }
  async approveBom(id: string): Promise<BomRecord> {
    const found = await this.repository.findBomById(id);
    if (!found) throw new TechnicalNotFoundError(`BOM ${id} does not exist`);
    if (found.status !== 'draft') throw new TechnicalValidationError(`BOM ${id} is "${found.status}" and cannot be approved (must be "draft")`);
    return this.repository.setBomStatus(id, 'approved');
  }
}
