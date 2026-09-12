import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CrmService } from '../crm/crm.service';
import { SalesNotFoundError, SalesValidationError } from './sales.errors';
import { SalesRepository } from './sales.repository';
import type { CreateJobOrderInput, CreateQuotationInput, JobOrderRecord, QuotationRecord } from './sales.types';

@Injectable()
export class SalesService {
  constructor(
    private readonly repository: SalesRepository,
    private readonly crmService: CrmService,
  ) {}

  async getQuotations(direction?: 'outgoing' | 'incoming'): Promise<QuotationRecord[]> {
    return this.repository.listQuotations(direction);
  }

  async getQuotation(id: string): Promise<QuotationRecord> {
    const found = await this.repository.findQuotationById(id);
    if (!found) throw new SalesNotFoundError(`quotation ${id} does not exist`);
    return found;
  }

  async createQuotation(input: CreateQuotationInput): Promise<QuotationRecord> {
    if (input.direction === 'outgoing' && (!input.customerId || input.supplierId)) {
      throw new SalesValidationError('an outgoing quotation needs exactly a customerId (no supplierId)');
    }
    if (input.direction === 'incoming' && (!input.supplierId || input.customerId)) {
      throw new SalesValidationError('an incoming quotation needs exactly a supplierId (no customerId)');
    }
    if (!input.lines || input.lines.length === 0) {
      throw new SalesValidationError('a quotation must have at least one line');
    }
    for (const line of input.lines) {
      const qty = Number(line.quantity);
      const price = Number(line.unitPrice);
      if (!Number.isFinite(qty) || qty <= 0) throw new SalesValidationError('line quantity must be positive');
      if (!Number.isFinite(price) || price < 0) throw new SalesValidationError('line unit price cannot be negative');
    }
    if (input.customerId) {
      const customer = await this.crmService.getCustomer(input.customerId);
      if (!customer) throw new SalesNotFoundError(`customer ${input.customerId} does not exist`);
    }

    const sequence = (await this.repository.countQuotations()) + 1;
    const year = new Date().getFullYear();
    const prefix = input.direction === 'outgoing' ? 'QO' : 'QI';
    const quotationNumber = `${prefix}-${year}-${String(sequence).padStart(6, '0')}`;

    return this.repository.insertQuotation({
      id: randomUUID(), quotationNumber, direction: input.direction,
      customerId: input.customerId, supplierId: input.supplierId, orgNodeId: input.orgNodeId,
      quotationDate: input.quotationDate, validUntil: input.validUntil,
      currency: input.currency, note: input.note, lines: input.lines,
    });
  }

  async sendQuotation(id: string): Promise<QuotationRecord> {
    const quotation = await this.repository.findQuotationById(id);
    if (!quotation) throw new SalesNotFoundError(`quotation ${id} does not exist`);
    if (quotation.status !== 'draft') {
      throw new SalesValidationError(`quotation ${id} is "${quotation.status}" and cannot be sent (must be "draft")`);
    }
    return this.repository.setQuotationStatus(id, 'sent');
  }

  /**
   * Approving an outgoing quotation: promote lead→active, record the
   * customer's PO reference, AND create the Job Order automatically — this
   * is the exact hinge point the owner described ("موافقة العميل تبدأ مرحلة
   * التصنيع والتسليم"). The job order only carries a reference to the
   * quotation number, never a copy of its lines (D2/D20). The job order also
   * inherits the quotation's org_node_id automatically, so the company/activity
   * it belongs to never has to be re-entered by hand.
   */
  async approveQuotation(id: string, customerPoReference?: string): Promise<{ quotation: QuotationRecord; jobOrder?: JobOrderRecord }> {
    const quotation = await this.repository.findQuotationById(id);
    if (!quotation) throw new SalesNotFoundError(`quotation ${id} does not exist`);
    if (quotation.status !== 'sent' && quotation.status !== 'draft') {
      throw new SalesValidationError(`quotation ${id} is "${quotation.status}" and cannot be approved`);
    }

    let createdJobOrder: JobOrderRecord | undefined;
    if (quotation.direction === 'outgoing') {
      if (quotation.customerId) await this.crmService.promoteToActive(quotation.customerId);
      const updated = await this.repository.setQuotationStatus(id, 'approved', customerPoReference);
      createdJobOrder = await this.createJobOrder({
        source: 'quotation',
        quotationReference: updated.quotationNumber,
        customerId: updated.customerId ?? undefined,
        orgNodeId: updated.orgNodeId ?? undefined,
      });
      return { quotation: updated, jobOrder: createdJobOrder };
    }

    const updated = await this.repository.setQuotationStatus(id, 'approved', customerPoReference);
    return { quotation: updated };
  }

  async rejectQuotation(id: string): Promise<QuotationRecord> {
    const quotation = await this.repository.findQuotationById(id);
    if (!quotation) throw new SalesNotFoundError(`quotation ${id} does not exist`);
    if (quotation.status === 'approved') {
      throw new SalesValidationError(`quotation ${id} is already approved and cannot be rejected`);
    }
    return this.repository.setQuotationStatus(id, 'rejected');
  }

  // ---- Job Order ----

  async getJobOrders(): Promise<JobOrderRecord[]> { return this.repository.listJobOrders(); }

  async getJobOrder(id: string): Promise<JobOrderRecord> {
    const found = await this.repository.findJobOrderById(id);
    if (!found) throw new SalesNotFoundError(`job order ${id} does not exist`);
    return found;
  }

  async createJobOrder(input: CreateJobOrderInput): Promise<JobOrderRecord> {
    if (input.source === 'internal' && input.customerId) {
      throw new SalesValidationError('an internal job order (company stock) must not have a customerId');
    }
    const sequence = (await this.repository.countJobOrders()) + 1;
    const year = new Date().getFullYear();
    const jobOrderNumber = `JO-${year}-${String(sequence).padStart(6, '0')}`;
    return this.repository.insertJobOrder({
      id: randomUUID(), jobOrderNumber, source: input.source,
      quotationReference: input.quotationReference, customerId: input.customerId,
      orgNodeId: input.orgNodeId, note: input.note,
    });
  }

  /** Step ٦-٣: financial review must explicitly pass before the job order can move past draft. */
  async passFinancialReview(id: string): Promise<JobOrderRecord> {
    const found = await this.repository.findJobOrderById(id);
    if (!found) throw new SalesNotFoundError(`job order ${id} does not exist`);
    if (found.status !== 'draft') {
      throw new SalesValidationError(`job order ${id} is "${found.status}"; financial review only applies to a "draft" order`);
    }
    return this.repository.setJobOrderFinancialReview(id, true);
  }

  /** Moves the job order from draft to approved — only allowed once financial review has passed. */
  async approveJobOrder(id: string): Promise<JobOrderRecord> {
    const found = await this.repository.findJobOrderById(id);
    if (!found) throw new SalesNotFoundError(`job order ${id} does not exist`);
    if (found.status !== 'draft') {
      throw new SalesValidationError(`job order ${id} is "${found.status}" and cannot be approved (must be "draft")`);
    }
    if (!found.financialReviewPassed) {
      throw new SalesValidationError(`job order ${id} cannot be approved before financial review passes`);
    }
    return this.repository.setJobOrderStatus(id, 'approved');
  }

  async cancelJobOrder(id: string): Promise<JobOrderRecord> {
    const found = await this.repository.findJobOrderById(id);
    if (!found) throw new SalesNotFoundError(`job order ${id} does not exist`);
    if (found.status === 'completed') {
      throw new SalesValidationError(`job order ${id} is already completed and cannot be cancelled`);
    }
    return this.repository.setJobOrderStatus(id, 'cancelled');
  }
}
