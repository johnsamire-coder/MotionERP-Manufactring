import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { quotation, quotationLine } from './sales.schema';
import type {
  CreateQuotationInput, QuotationDirection, QuotationLineRecord, QuotationRecord, QuotationStatus,
} from './sales.types';

const quotationColumns = {
  id: quotation.id, quotationNumber: quotation.quotationNumber, direction: quotation.direction,
  customerId: quotation.customerId, supplierId: quotation.supplierId,
  quotationDate: quotation.quotationDate, validUntil: quotation.validUntil, status: quotation.status,
  currency: quotation.currency, customerPoReference: quotation.customerPoReference, note: quotation.note,
  createdAt: quotation.createdAt, updatedAt: quotation.updatedAt,
};
const lineColumns = {
  id: quotationLine.id, quotationId: quotationLine.quotationId, itemId: quotationLine.itemId,
  quantity: quotationLine.quantity, unitPrice: quotationLine.unitPrice, lineNumber: quotationLine.lineNumber,
};

interface QuotationRow {
  id: string; quotationNumber: string; direction: string; customerId: string | null; supplierId: string | null;
  quotationDate: Date; validUntil: Date | null; status: string; currency: string;
  customerPoReference: string | null; note: string | null; createdAt: Date; updatedAt: Date;
}
interface LineRow { id: string; quotationId: string; itemId: string; quantity: string; unitPrice: string; lineNumber: number; }

function toLineRecord(row: LineRow): QuotationLineRecord {
  return { id: row.id, quotationId: row.quotationId, itemId: row.itemId, quantity: row.quantity, unitPrice: row.unitPrice, lineNumber: row.lineNumber };
}
function toQuotationRecord(row: QuotationRow, lines: QuotationLineRecord[]): QuotationRecord {
  return {
    id: row.id, quotationNumber: row.quotationNumber, direction: row.direction as QuotationDirection,
    customerId: row.customerId, supplierId: row.supplierId,
    quotationDate: row.quotationDate.toISOString(), validUntil: row.validUntil ? row.validUntil.toISOString() : null,
    status: row.status as QuotationStatus, currency: row.currency, customerPoReference: row.customerPoReference,
    note: row.note, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), lines,
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
      customerId: input.customerId ?? null, supplierId: input.supplierId ?? null,
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
}
