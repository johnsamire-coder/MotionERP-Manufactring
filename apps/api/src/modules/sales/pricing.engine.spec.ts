import { applyPricingRules } from './pricing.engine';
import type { PricingContext, PricingRuleRecord } from './pricing.types';

const base: PricingRuleRecord = {
  id: 'r',
  code: 'R',
  title: 't',
  appliesTo: 'selling',
  applyOn: 'item',
  itemId: 'steel',
  categoryId: null,
  partyId: null,
  minQty: '0',
  maxQty: null,
  validFrom: null,
  validUntil: null,
  priority: 0,
  ruleType: 'price',
  discountPercentage: null,
  discountAmount: null,
  rate: null,
  freeItemId: null,
  freeQty: null,
  recursive: false,
  status: 'active',
};
const rule = (o: Partial<PricingRuleRecord>): PricingRuleRecord => ({ ...base, ...o });
const ctx: PricingContext = {
  appliesTo: 'selling',
  partyId: 'cust-1',
  date: new Date('2026-09-23'),
};
const line = (qty: string, itemId = 'steel', categoryId: string | null = 'metals') => ({
  itemId,
  categoryId,
  quantity: qty,
  baseRate: 100,
});

describe('Pricing rules engine (plan item 16)', () => {
  it('1. percentage / amount / fixed-rate price discounts', () => {
    expect(
      applyPricingRules([line('1')], [rule({ code: 'P10', discountPercentage: '10' })], ctx)
        .lines[0],
    ).toMatchObject({ rate: '90.0000', discountPerUnit: '10.0000', appliedRule: 'P10' });
    expect(
      applyPricingRules([line('1')], [rule({ code: 'A15', discountAmount: '15' })], ctx).lines[0]!
        .rate,
    ).toBe('85.0000');
    expect(
      applyPricingRules([line('1')], [rule({ code: 'F70', rate: '70' })], ctx).lines[0]!.rate,
    ).toBe('70.0000');
  });

  it('2. matching: category, quantity range, party, validity window, status, buying vs selling', () => {
    const cat = rule({
      code: 'CAT',
      applyOn: 'item_category',
      itemId: null,
      categoryId: 'metals',
      discountPercentage: '5',
    });
    expect(applyPricingRules([line('1')], [cat], ctx).lines[0]!.appliedRule).toBe('CAT');
    const qty = rule({ code: 'Q', discountPercentage: '5', minQty: '10', maxQty: '20' });
    expect(
      applyPricingRules([line('9'), line('10'), line('21')], [qty], ctx).lines.map(
        (l) => l.appliedRule,
      ),
    ).toEqual([null, 'Q', null]);
    expect(
      applyPricingRules(
        [line('1')],
        [rule({ code: 'X', discountPercentage: '5', partyId: 'other' })],
        ctx,
      ).lines[0]!.appliedRule,
    ).toBeNull();
    expect(
      applyPricingRules(
        [line('1')],
        [rule({ code: 'X', discountPercentage: '5', validUntil: '2026-01-01T00:00:00Z' })],
        ctx,
      ).lines[0]!.appliedRule,
    ).toBeNull();
    expect(
      applyPricingRules(
        [line('1')],
        [rule({ code: 'X', discountPercentage: '5', status: 'disabled' })],
        ctx,
      ).lines[0]!.appliedRule,
    ).toBeNull();
    expect(
      applyPricingRules(
        [line('1')],
        [rule({ code: 'X', discountPercentage: '5', appliesTo: 'buying' })],
        ctx,
      ).lines[0]!.appliedRule,
    ).toBeNull();
  });

  it('3. highest priority wins; equal priority → the cheaper price for the buyer', () => {
    const r = applyPricingRules(
      [line('1')],
      [
        rule({ code: 'LOW', discountPercentage: '50', priority: 1 }),
        rule({ code: 'HIGH', discountPercentage: '5', priority: 9 }),
      ],
      ctx,
    );
    expect(r.lines[0]!.appliedRule).toBe('HIGH');
    const tie = applyPricingRules(
      [line('1')],
      [rule({ code: 'A', discountPercentage: '5' }), rule({ code: 'B', discountAmount: '20' })],
      ctx,
    );
    expect(tie.lines[0]!.appliedRule).toBe('B');
  });

  it('4. product discount: buy 10 get 1 free, recursive, other free item, alongside a price rule', () => {
    const buy10get1 = rule({
      code: 'B10G1',
      ruleType: 'product',
      minQty: '10',
      freeQty: '1',
      recursive: true,
    });
    const r = applyPricingRules(
      [line('25')],
      [buy10get1, rule({ code: 'P5', discountPercentage: '5' })],
      ctx,
    );
    expect(r.lines[0]!.appliedRule).toBe('P5');
    expect(r.freeLines).toEqual([
      { itemId: 'steel', quantity: '2.000000', rate: '0', forLine: 0, appliedRule: 'B10G1' },
    ]);
    const gift = rule({
      code: 'GIFT',
      ruleType: 'product',
      minQty: '5',
      freeQty: '3',
      freeItemId: 'paint',
    });
    expect(applyPricingRules([line('50')], [gift], ctx).freeLines[0]).toMatchObject({
      itemId: 'paint',
      quantity: '3.000000',
    });
    expect(applyPricingRules([line('4')], [gift], ctx).freeLines).toHaveLength(0);
  });
});
