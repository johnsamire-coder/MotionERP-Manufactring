import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { jobOrder, quotation, quotationLine } from './sales.schema';
import type {
  CreateJobOrderInput, CreateQuotationInput, JobOrderRecord, JobOrderSource, JobOrderStatus,
  QuotationDirection, QuotationLineRecord, QuotationRecord, QuotationStatus,
} from './sales.types';

const quotationColumns = {
  id: quotation.id, quotationNumber: quotation.quotationNumber, direction: quotation.direction,
  customerId: quotation.customerId, supplierId: quotation.supplierId, orgNodeId: quotation.orgNodeId,
  quotationDate: quotation.quotationDate, validUntil: quotation.validUntil, status: quotation.status,
  currency: quotation.currency, customerPoReference: quotation.customerPoReference, note: quotation.note,
  createdAt: quotation.createdAt, updatedAt: quotation.updatedAt,
};
const lineColumns = {
  id: quotationLine.id, quotationId: quotationLine.quotationId, itemId: quotationLine.itemId,
  quantity: quotationLine.quantity, unitPrice: quotationLine.unitPrice, lineNumber: quotationLine.lineNumber,
};
const jobOrderColumns = {
  id: jobOrder.id, jobOrderNumber: jobOrder.jobOrderNumber, source: jobOrder.source,
  quotationReference: jobOrder.quotationReference, customerId: jobOrder.customerId, orgNodeId: jobOrder.orgNodeId,
  status: jobOrder.status, financialReviewPassed: jobOrder.financialReviewPassed, note: jobOrder.note,
  createdAt: jobOrder.createdAt, updatedAt: jobOrder.updatedAt,
};

interface QuotationRow {
  id: string; quotationNumber: string; direction: string; customerId: string | null; supplierId: string | null;
  orgNodeId: string | null;
  quotationDate: Date; validUntil: Date | null; status: string; currency: string;
  customerPoReference: string | null; note: string | null; createdAt: Date; updatedAt: Date;
}
interface LineRow { id: string; quotationId: string; itemId: string; quantity: string; unitPrice: string; lineNumber: number; }
interface JobOrderRow {
  id: string; jobOrderNumber: string; source: string; quotationReference: string | null;
  customerId: string | null; orgNodeId: string | null; status: string; financialReviewPassed: string; note: string | null;
  createdAt: Date; updatedAt: Date;
}

function toLineRecord(row: LineRow): QuotationLineRecord {
  return { id: row.id, quotationId: row.quotationId, itemId: row.itemId, quantity: row.quantity, unitPrice: row.unitPrice, lineNumber: row.lineNumber };
}
function toQuotationRecord(row: QuotationRow, lines: QuotationLineRecord[]): QuotationRecord {
  return {
    id: row.id, quotationNumber: row.quotationNumber, direction: row.direction as QuotationDirection,
    customerId: row.customerId, supplierId: row.supplierId, orgNodeId: row.orgNodeId,
    quotationDate: row.quotationDate.toISOString(), validUntil: row.validUntil ? row.validUntil.toISOString() : null,
    status: row.status as QuotationStatus, currency: row.currency, customerPoReference: row.customerPoReference,
    note: row.note, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), lines,
  };
}
function toJobOrderRecord(row: JobOrderRow): JobOrderRecord {
  return {
    id: row.id, jobOrderNumber: row.jobOrderNumber, source: row.source as JobOrderSource,
    quotationReference: row.quotationReference, customerId: row.customerId, orgNodeId: row.orgNodeId,
    status: row.status as JobOrderStatus, financialReviewPassed: row.financialReviewPassed === 'true',
    note: row.note, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class SalesRepository {
  constructor(private readonly database: DatabaseService) {}

  async listQuotations(direction?: 'outgoing' | 'incoming'): Promise<QuotationRecord[]> {
    const quotations = direction
      ? await this.database.db.select(quotationColumns).from(quotation).where(eq(quotation.direction, direction)).orderBy(asc(quotation.quotationNumber))
      : await this.database.db.select(quotationColumns).from(quotation).orderBy(asc(quotation.quotationNumber));
    const allLines = await this.database.db.select(lineColumns).from(quotationLine).orderBy(asc(quotationLine.lineNumber));
    return quotations.map((q) => toQuotationRecord(q, allLines.filter((l) => l.quotationId === q.id).map(toLineRecord)));
  }

  async findQuotationById(id: string): Promise<QuotationRecord | null> {
    const rows = await this.database.db.select(quotationColumns).from(quotation).where(eq(quotation.id, id)).limit(1);
    if (!rows[0]) return null;
    const lines = await this.database.db.select(lineColumns).from(quotationLine)
      .where(eq(quotationLine.quotationId, id)).orderBy(asc(quotationLine.lineNumber));
    return toQuotationRecord(rows[0], lines.map(toLineRecord));
  }

  async insertQuotation(input: CreateQuotationInput & { id: string; quotationNumber: string }): Promise<QuotationRecord> {
    const rows = await this.database.db.insert(quotation).values({
      id: input.id, quotationNumber: input.quotationNumber, direction: input.direction,
      customerId: input.customerId ?? null, supplierId: input.supplierId ?? null, orgNodeId: input.orgNodeId ?? null,
      quotationDate: input.quotationDate ? new Date(input.quotationDate) : new Date(),
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      currency: input.currency ?? 'EGP', note: input.note ?? null,
    }).returning(quotationColumns);
    const inserted = rows[0]!;

    const lines: QuotationLineRecord[] = [];
    let lineNumber = 1;
    for (const line of input.lines) {
      const lineRows = await this.database.db.insert(quotationLine).values({
        quotationId: inserted.id, itemId: line.itemId, quantity: line.quantity, unitPrice: line.unitPrice, lineNumber,
      }).returning(lineColumns);
      lines.push(toLineRecord(lineRows[0]!));
      lineNumber += 1;
    }
    return toQuotationRecord(inserted, lines);
  }

  async setQuotationStatus(id: string, status: QuotationStatus, customerPoReference?: string): Promise<QuotationRecord> {
    const fields: { status: QuotationStatus; customerPoReference?: string } = { status };
    if (customerPoReference !== undefined) fields.customerPoReference = customerPoReference;
    const rows = await this.database.db.update(quotation).set(fields).where(eq(quotation.id, id)).returning(quotationColumns);
    const lines = await this.database.db.select(lineColumns).from(quotationLine)
      .where(eq(quotationLine.quotationId, id)).orderBy(asc(quotationLine.lineNumber));
    return toQuotationRecord(rows[0]!, lines.map(toLineRecord));
  }

  async countQuotations(): Promise<number> {
    const rows = await this.database.db.select({ id: quotation.id }).from(quotation);
    return rows.length;
  }

  // ---- Job Order ----

  async listJobOrders(): Promise<JobOrderRecord[]> {
    const rows = await this.database.db.select(jobOrderColumns).from(jobOrder).orderBy(asc(jobOrder.jobOrderNumber));
    return rows.map(toJobOrderRecord);
  }

  async findJobOrderById(id: string): Promise<JobOrderRecord | null> {
    const rows = await this.database.db.select(jobOrderColumns).from(jobOrder).where(eq(jobOrder.id, id)).limit(1);
    return rows[0] ? toJobOrderRecord(rows[0]) : null;
  }

  async insertJobOrder(input: CreateJobOrderInput & { id: string; jobOrderNumber: string }): Promise<JobOrderRecord> {
    const rows = await this.database.db.insert(jobOrder).values({
      id: input.id, jobOrderNumber: input.jobOrderNumber, source: input.source,
      quotationReference: input.quotationReference ?? null, customerId: input.customerId ?? null,
      orgNodeId: input.orgNodeId ?? null, note: input.note ?? null,
    }).returning(jobOrderColumns);
    return toJobOrderRecord(rows[0]!);
  }

  async setJobOrderStatus(id: string, status: JobOrderStatus): Promise<JobOrderRecord> {
    const rows = await this.database.db.update(jobOrder).set({ status }).where(eq(jobOrder.id, id)).returning(jobOrderColumns);
    return toJobOrderRecord(rows[0]!);
  }

  async setJobOrderFinancialReview(id: string, passed: boolean): Promise<JobOrderRecord> {
    const rows = await this.database.db.update(jobOrder).set({ financialReviewPassed: passed ? 'true' : 'false' })
      .where(eq(jobOrder.id, id)).returning(jobOrderColumns);
    return toJobOrderRecord(rows[0]!);
  }

  async countJobOrders(): Promise<number> {
    const rows = await this.database.db.select({ id: jobOrder.id }).from(jobOrder);
    return rows.length;
  }
}
