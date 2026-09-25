import { evaluateBudget, monthIndex } from './budget.service';

describe('Budget engine (plan item 40)', () => {
  it('1. month index counts from the fiscal-year start', () => {
    expect(monthIndex(new Date('2026-01-01T00:00:00Z'), new Date('2026-03-15T00:00:00Z'))).toBe(2);
    expect(monthIndex(new Date('2025-07-01T00:00:00Z'), new Date('2026-01-10T00:00:00Z'))).toBe(6);
  });

  it('2. annual check', () => {
    expect(
      evaluateBudget({ amount: 1000, monthlyPercentages: null }, 5, 900, 0, 50).annualOver,
    ).toBe(-50);
    expect(
      evaluateBudget({ amount: 1000, monthlyPercentages: null }, 5, 900, 0, 150).annualOver,
    ).toBe(50);
  });

  it('3. accumulated monthly check uses the distribution up to the entry month', () => {
    const even = Array(12).fill(100 / 12) as number[];
    const v = evaluateBudget({ amount: 1200, monthlyPercentages: even }, 2, 250, 250, 100); // 3 months → 300 allowed
    expect(v.monthlyLimit).toBeCloseTo(300, 6);
    expect(v.monthlyOver).toBeCloseTo(50, 6);
    expect(v.annualOver).toBeLessThan(0);
  });
});
