import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { itemPrice } from '../catalog/catalog.schema';
import { pricingRule } from './sales.schema';
import type { CreatePricingRuleInput, PricingAppliesTo, PricingRuleRecord } from './pricing.types';

function toRecord(r: typeof pricingRule.$inferSelect): PricingRuleRecord {
  return {
    id: r.id, code: r.code, title: r.title, appliesTo: r.appliesTo as PricingAppliesTo, applyOn: r.applyOn as PricingRuleRecord['applyOn'],
    itemId: r.itemId, categoryId: r.categoryId, partyId: r.partyId, minQty: r.minQty, maxQty: r.maxQty,
    validFrom: r.validFrom ? r.validFrom.toISOString() : null, validUntil: r.validUntil ? r.validUntil.toISOString() : null,
    priority: r.priority, ruleType: r.ruleType as PricingRuleRecord['ruleType'],
    discountPercentage: r.discountPercentage, discountAmount: r.discountAmount, rate: r.rate,
    freeItemId: r.freeItemId, freeQty: r.freeQty, recursive: r.recursive, status: r.status as PricingRuleRecord['status'],
  };
}

@Injectable()
export class PricingRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(): Promise<PricingRuleRecord[]> {
    return (await this.database.db.select().from(pricingRule).orderBy(desc(pricingRule.priority), asc(pricingRule.code))).map(toRecord);
  }
  async listActive(appliesTo: PricingAppliesTo): Promise<PricingRuleRecord[]> {
    return (await this.database.db.select().from(pricingRule)
      .where(and(eq(pricingRule.appliesTo, appliesTo), eq(pricingRule.status, 'active')))).map(toRecord);
  }
  async findByCode(code: string): Promise<PricingRuleRecord | null> {
    const rows = await this.database.db.select().from(pricingRule).where(eq(pricingRule.code, code)).limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  }
  async findById(id: string): Promise<PricingRuleRecord | null> {
    const rows = await this.database.db.select().from(pricingRule).where(eq(pricingRule.id, id)).limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  }
  async insert(input: CreatePricingRuleInput): Promise<PricingRuleRecord> {
    const rows = await this.database.db.insert(pricingRule).values({
      code: input.code, title: input.title, appliesTo: input.appliesTo, applyOn: input.applyOn,
      itemId: input.itemId, categoryId: input.categoryId, partyId: input.partyId,
      minQty: input.minQty ?? '0', maxQty: input.maxQty, priority: input.priority ?? 0,
      validFrom: input.validFrom ? new Date(input.validFrom) : null, validUntil: input.validUntil ? new Date(input.validUntil) : null,
      ruleType: input.ruleType, discountPercentage: input.discountPercentage, discountAmount: input.discountAmount, rate: input.rate,
      freeItemId: input.freeItemId, freeQty: input.freeQty, recursive: input.recursive ?? false,
    }).returning();
    return toRecord(rows[0]!);
  }
  async setStatus(id: string, status: 'active' | 'disabled'): Promise<PricingRuleRecord> {
    const rows = await this.database.db.update(pricingRule).set({ status }).where(eq(pricingRule.id, id)).returning();
    return toRecord(rows[0]!);
  }

  /** Latest valid price-list price for the item (read-only from the catalog price list). */
  async listPrice(itemId: string, type: PricingAppliesTo, at: Date): Promise<number | null> {
    const rows = await this.database.db.select({ price: itemPrice.price }).from(itemPrice)
      .where(and(
        eq(itemPrice.itemId, itemId), eq(itemPrice.priceListType, type), lte(itemPrice.validFrom, at),
        or(isNull(itemPrice.validUntil), gte(itemPrice.validUntil, at)),
      ))
      .orderBy(desc(itemPrice.validFrom)).limit(1);
    return rows[0] ? Number(rows[0].price) : null;
  }
}
