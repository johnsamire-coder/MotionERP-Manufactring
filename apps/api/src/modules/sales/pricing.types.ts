export type PricingAppliesTo = 'selling' | 'buying';
export interface PricingRuleRecord {
  id: string;
  code: string;
  title: string;
  appliesTo: PricingAppliesTo;
  applyOn: 'item' | 'item_category';
  itemId: string | null;
  categoryId: string | null;
  partyId: string | null;
  minQty: string;
  maxQty: string | null;
  validFrom: string | null;
  validUntil: string | null;
  priority: number;
  ruleType: 'price' | 'product';
  discountPercentage: string | null;
  discountAmount: string | null;
  rate: string | null;
  freeItemId: string | null;
  freeQty: string | null;
  recursive: boolean;
  status: 'active' | 'disabled';
}
export type CreatePricingRuleInput = Omit<
  PricingRuleRecord,
  'id' | 'status' | 'minQty' | 'priority' | 'recursive'
> & {
  minQty?: string;
  priority?: number;
  recursive?: boolean;
};

export interface PricingLineInput {
  itemId: string;
  quantity: string;
  unitPrice?: string;
}
export interface PricedLine {
  itemId: string;
  quantity: string;
  baseRate: string;
  rate: string;
  discountPerUnit: string;
  appliedRule: string | null;
}
export interface FreeLine {
  itemId: string;
  quantity: string;
  rate: '0';
  forLine: number;
  appliedRule: string;
}
export interface PricingResult {
  lines: PricedLine[];
  freeLines: FreeLine[];
}
export interface PricingContext {
  appliesTo: PricingAppliesTo;
  partyId?: string;
  date: Date;
}
