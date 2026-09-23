import { Injectable } from '@nestjs/common';
import { CatalogNotFoundError } from '../catalog/catalog.errors';
import { CatalogService } from '../catalog/catalog.service';
import { applyPricingRules } from './pricing.engine';
import { PricingRepository } from './pricing.repository';
import type { CreatePricingRuleInput, PricingAppliesTo, PricingLineInput, PricingResult, PricingRuleRecord } from './pricing.types';
import { SalesNotFoundError, SalesValidationError } from './sales.errors';

/** Pricing rules (plan item 16): price discounts and "buy X get Y free" product discounts. */
@Injectable()
export class PricingService {
  constructor(
    private readonly repository: PricingRepository,
    private readonly catalog: CatalogService,
  ) {}

  async list(): Promise<PricingRuleRecord[]> { return this.repository.list(); }

  async create(input: CreatePricingRuleInput): Promise<PricingRuleRecord> {
    const code = input.code?.trim();
    if (!code || !input.title?.trim()) throw new SalesValidationError('code and title are required');
    if (await this.repository.findByCode(code)) throw new SalesValidationError(`pricing rule "${code}" already exists`);
    if (input.applyOn === 'item') {
      if (!input.itemId) throw new SalesValidationError('itemId is required when applyOn = item');
      await this.itemExists(input.itemId);
    } else if (!input.categoryId) {
      throw new SalesValidationError('categoryId is required when applyOn = item_category');
    }
    if (input.ruleType === 'price') {
      const given = [input.discountPercentage, input.discountAmount, input.rate].filter((v) => v !== null && v !== undefined);
      if (given.length !== 1) throw new SalesValidationError('a price rule needs exactly one of discountPercentage, discountAmount, rate');
      const pct = input.discountPercentage;
      if (pct !== null && pct !== undefined && (Number(pct) <= 0 || Number(pct) > 100)) throw new SalesValidationError('discountPercentage must be in (0, 100]');
    } else {
      if (!input.freeQty || Number(input.freeQty) <= 0) throw new SalesValidationError('a product rule needs a positive freeQty');
      if (input.recursive && !(Number(input.minQty ?? 0) > 0)) throw new SalesValidationError('a recursive product rule needs minQty > 0');
      if (input.freeItemId) await this.itemExists(input.freeItemId);
    }
    if (input.maxQty && Number(input.maxQty) < Number(input.minQty ?? 0)) throw new SalesValidationError('maxQty is below minQty');
    return this.repository.insert({ ...input, code, title: input.title.trim() });
  }

  async setStatus(id: string, status: 'active' | 'disabled'): Promise<PricingRuleRecord> {
    if (!(await this.repository.findById(id))) throw new SalesNotFoundError(`pricing rule ${id} does not exist`);
    return this.repository.setStatus(id, status);
  }

  /** Prices the lines: base = given unitPrice or the price list, then the matching rules. */
  async apply(appliesTo: PricingAppliesTo, lines: PricingLineInput[], partyId?: string, at: Date = new Date()): Promise<PricingResult> {
    const prepared = [];
    for (const l of lines) {
      const item = await this.itemExists(l.itemId);
      let base: number | null = l.unitPrice !== undefined && l.unitPrice !== '' ? Number(l.unitPrice) : null;
      if (base === null) base = await this.repository.listPrice(l.itemId, appliesTo, at);
      if (base === null || !Number.isFinite(base)) throw new SalesValidationError(`no ${appliesTo} price for item ${item.code}; pass unitPrice or add a price list entry`);
      prepared.push({ itemId: l.itemId, categoryId: item.categoryId, quantity: l.quantity, baseRate: base });
    }
    return applyPricingRules(prepared, await this.repository.listActive(appliesTo), { appliesTo, partyId, date: at });
  }

  private async itemExists(itemId: string): Promise<{ code: string; categoryId: string }> {
    try {
      return await this.catalog.getItem(itemId);
    } catch (err) {
      if (err instanceof CatalogNotFoundError) throw new SalesNotFoundError(`item ${itemId} does not exist`);
      throw err;
    }
  }
}
