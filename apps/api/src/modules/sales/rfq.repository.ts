import { Injectable } from '@nestjs/common';
import { and, asc, count, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { rfq, rfqLine, rfqSupplier } from './sales.schema';
import type { CreateRfqInput, RfqRecord, RfqStatus, RfqSupplierStatus } from './rfq.types';

@Injectable()
export class RfqRepository {
  constructor(private readonly database: DatabaseService) {}

  async count(): Promise<number> {
    const rows = await this.database.db.select({ n: count() }).from(rfq);
    return Number(rows[0]?.n ?? 0);
  }

  async list(): Promise<RfqRecord[]> {
    const rows = await this.database.db
      .select({ id: rfq.id })
      .from(rfq)
      .orderBy(asc(rfq.createdAt));
    const out: RfqRecord[] = [];
    for (const r of rows) out.push((await this.findById(r.id))!);
    return out;
  }

  async findById(id: string): Promise<RfqRecord | null> {
    const rows = await this.database.db.select().from(rfq).where(eq(rfq.id, id)).limit(1);
    const r = rows[0];
    if (!r) return null;
    const lines = await this.database.db
      .select()
      .from(rfqLine)
      .where(eq(rfqLine.rfqId, id))
      .orderBy(asc(rfqLine.lineNumber));
    const suppliers = await this.database.db
      .select()
      .from(rfqSupplier)
      .where(eq(rfqSupplier.rfqId, id));
    return {
      id: r.id,
      rfqNumber: r.rfqNumber,
      orgNodeId: r.orgNodeId,
      rfqDate: r.rfqDate.toISOString(),
      respondBy: r.respondBy ? r.respondBy.toISOString() : null,
      status: r.status as RfqStatus,
      materialRequestReference: r.materialRequestReference,
      awardedSupplierId: r.awardedSupplierId,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      lines: lines.map((l) => ({
        id: l.id,
        itemId: l.itemId,
        quantity: l.quantity,
        lineNumber: l.lineNumber,
      })),
      suppliers: suppliers.map((s) => ({
        id: s.id,
        supplierId: s.supplierId,
        status: s.status as RfqSupplierStatus,
        quotationId: s.quotationId,
        respondedAt: s.respondedAt ? s.respondedAt.toISOString() : null,
      })),
    };
  }

  async insert(input: CreateRfqInput & { id: string; rfqNumber: string }): Promise<RfqRecord> {
    await this.database.db.insert(rfq).values({
      id: input.id,
      rfqNumber: input.rfqNumber,
      orgNodeId: input.orgNodeId ?? null,
      rfqDate: new Date(),
      respondBy: input.respondBy ? new Date(input.respondBy) : null,
      materialRequestReference: input.materialRequestReference ?? null,
      note: input.note ?? null,
    });
    await this.database.db.insert(rfqLine).values(
      input.lines.map((l, i) => ({
        rfqId: input.id,
        itemId: l.itemId,
        quantity: l.quantity,
        lineNumber: i + 1,
      })),
    );
    await this.database.db
      .insert(rfqSupplier)
      .values(input.supplierIds.map((supplierId) => ({ rfqId: input.id, supplierId })));
    return (await this.findById(input.id))!;
  }

  async setStatus(id: string, status: RfqStatus, awardedSupplierId?: string): Promise<void> {
    await this.database.db
      .update(rfq)
      .set({ status, updatedAt: new Date(), ...(awardedSupplierId ? { awardedSupplierId } : {}) })
      .where(eq(rfq.id, id));
  }

  async setSupplierResponse(
    rfqId: string,
    supplierId: string,
    status: RfqSupplierStatus,
    quotationId?: string,
  ): Promise<void> {
    await this.database.db
      .update(rfqSupplier)
      .set({ status, quotationId: quotationId ?? null, respondedAt: new Date() })
      .where(and(eq(rfqSupplier.rfqId, rfqId), eq(rfqSupplier.supplierId, supplierId)));
  }
}
