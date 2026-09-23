import { Injectable } from '@nestjs/common';
import { asc, count, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { opportunity, opportunityItem } from './crm.schema';
import type { CreateOpportunityInput, OpportunityRecord, OpportunityStage } from './opportunity.types';

@Injectable()
export class OpportunityRepository {
  constructor(private readonly database: DatabaseService) {}

  async count(): Promise<number> {
    const rows = await this.database.db.select({ n: count() }).from(opportunity);
    return Number(rows[0]?.n ?? 0);
  }

  async list(customerId?: string): Promise<OpportunityRecord[]> {
    const q = this.database.db.select({ id: opportunity.id }).from(opportunity);
    const rows = customerId ? await q.where(eq(opportunity.customerId, customerId)).orderBy(asc(opportunity.createdAt)) : await q.orderBy(asc(opportunity.createdAt));
    const out: OpportunityRecord[] = [];
    for (const r of rows) out.push((await this.findById(r.id))!);
    return out;
  }

  async findById(id: string): Promise<OpportunityRecord | null> {
    const rows = await this.database.db.select().from(opportunity).where(eq(opportunity.id, id)).limit(1);
    const r = rows[0];
    if (!r) return null;
    const items = await this.database.db.select().from(opportunityItem).where(eq(opportunityItem.opportunityId, id));
    return {
      id: r.id, opportunityNumber: r.opportunityNumber, customerId: r.customerId, title: r.title, source: r.source,
      expectedAmount: r.expectedAmount, probability: r.probability,
      expectedCloseDate: r.expectedCloseDate ? r.expectedCloseDate.toISOString() : null, stage: r.stage as OpportunityStage,
      lostReason: r.lostReason, quotationId: r.quotationId, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
      items: items.map((i) => ({ id: i.id, itemId: i.itemId, quantity: i.quantity, expectedRate: i.expectedRate })),
    };
  }

  async findByQuotation(quotationId: string): Promise<OpportunityRecord | null> {
    const rows = await this.database.db.select({ id: opportunity.id }).from(opportunity).where(eq(opportunity.quotationId, quotationId)).limit(1);
    return rows[0] ? this.findById(rows[0].id) : null;
  }

  async insert(input: CreateOpportunityInput & { id: string; opportunityNumber: string }): Promise<OpportunityRecord> {
    await this.database.db.insert(opportunity).values({
      id: input.id, opportunityNumber: input.opportunityNumber, customerId: input.customerId, title: input.title,
      source: input.source ?? null, expectedAmount: input.expectedAmount ?? null, probability: input.probability ?? 10,
      expectedCloseDate: input.expectedCloseDate ? new Date(input.expectedCloseDate) : null,
    });
    if (input.items && input.items.length > 0) {
      await this.database.db.insert(opportunityItem).values(input.items.map((i) => ({
        opportunityId: input.id, itemId: i.itemId, quantity: i.quantity, expectedRate: i.expectedRate ?? null,
      })));
    }
    return (await this.findById(input.id))!;
  }

  async update(id: string, fields: Partial<{ stage: OpportunityStage; lostReason: string | null; quotationId: string | null; probability: number }>): Promise<OpportunityRecord> {
    await this.database.db.update(opportunity).set({ ...fields, updatedAt: new Date() }).where(eq(opportunity.id, id));
    return (await this.findById(id))!;
  }
}
