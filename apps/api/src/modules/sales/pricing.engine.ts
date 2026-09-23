import type { FreeLine, PricedLine, PricingContext, PricingResult, PricingRuleRecord } from './pricing.types';

/** Does the rule apply to this item (directly or through its category), quantity, party and date? */
export function ruleMatches(
  rule: PricingRuleRecord, ctx: PricingContext, itemId: string, categoryId: string | null, qty: number,
): boolean {
  if (rule.status !== 'active' || rule.appliesTo !== ctx.appliesTo) return false;
  if (rule.partyId && rule.partyId !== ctx.partyId) return false;
  if (rule.applyOn === 'item' ? rule.itemId !== itemId : rule.categoryId !== categoryId) return false;
  if (qty < Number(rule.minQty) || (rule.maxQty !== null && qty > Number(rule.maxQty))) return false;
  if (rule.validFrom && new Date(rule.validFrom) > ctx.date) return false;
  if (rule.validUntil && new Date(rule.validUntil) < ctx.date) return false;
  return true;
}

function priceAfter(rule: PricingRuleRecord, base: number): number {
  if (rule.rate !== null) return Number(rule.rate);
  if (rule.discountPercentage !== null) return base * (1 - Number(rule.discountPercentage) / 100);
  return Math.max(0, base - Number(rule.discountAmount ?? 0));
}

/**
 * Applies pricing rules (plan item 16). Per line: the highest-priority matching PRICE rule sets the
 * rate (ties → the cheaper result, i.e. the one most favourable to the buyer); the highest-priority
 * matching PRODUCT rule adds a free line (recursive → for every min_qty).
 */
export function applyPricingRules(
  lines: Array<{ itemId: string; categoryId: string | null; quantity: string; baseRate: number }>,
  rules: PricingRuleRecord[],
  ctx: PricingContext,
): PricingResult {
  const priced: PricedLine[] = [];
  const free: FreeLine[] = [];
  lines.forEach((line, index) => {
    const qty = Number(line.quantity);
    const matching = rules.filter((r) => ruleMatches(r, ctx, line.itemId, line.categoryId, qty));
    const best = (type: 'price' | 'product'): PricingRuleRecord | undefined =>
      matching.filter((r) => r.ruleType === type).sort((a, b) =>
        b.priority - a.priority || (type === 'price' ? priceAfter(a, line.baseRate) - priceAfter(b, line.baseRate) : 0))[0];

    const priceRule = best('price');
    const rate = priceRule ? priceAfter(priceRule, line.baseRate) : line.baseRate;
    priced.push({
      itemId: line.itemId, quantity: line.quantity, baseRate: line.baseRate.toFixed(4), rate: rate.toFixed(4),
      discountPerUnit: (line.baseRate - rate).toFixed(4), appliedRule: priceRule?.code ?? null,
    });

    const productRule = best('product');
    if (productRule) {
      const min = Number(productRule.minQty);
      const times = productRule.recursive && min > 0 ? Math.floor(qty / min) : 1;
      const freeQty = times * Number(productRule.freeQty);
      if (freeQty > 0) {
        free.push({ itemId: productRule.freeItemId ?? line.itemId, quantity: freeQty.toFixed(6), rate: '0', forLine: index, appliedRule: productRule.code });
      }
    }
  });
  return { lines: priced, freeLines: free };
}
