import { describe, expect, it } from 'vitest';
import {
  assertSameCurrency,
  CurrencyMismatchError,
  InvalidMoneyError,
  isMoney,
  money,
} from './money';

describe('money()', () => {
  it('accepts a decimal string and an ISO 4217 code', () => {
    expect(money('1234.50', 'EGP')).toEqual({ amount: '1234.50', currency: 'EGP' });
    expect(money('-7', 'USD')).toEqual({ amount: '-7', currency: 'USD' });
  });

  it('rejects float amounts', () => {
    // @ts-expect-error deliberately passing a number
    expect(() => money(12.5, 'EGP')).toThrow(InvalidMoneyError);
  });

  it('rejects malformed amounts and currency codes', () => {
    expect(() => money('12,5', 'EGP')).toThrow(InvalidMoneyError);
    expect(() => money('12.5', 'egp')).toThrow(InvalidMoneyError);
    expect(() => money('12.5', 'EGPX')).toThrow(InvalidMoneyError);
  });
});

describe('isMoney()', () => {
  it('recognises valid Money shapes', () => {
    expect(isMoney({ amount: '10.00', currency: 'USD' })).toBe(true);
  });

  it('rejects numbers, nulls and partial shapes', () => {
    expect(isMoney({ amount: 10, currency: 'USD' })).toBe(false);
    expect(isMoney({ amount: '10.00' })).toBe(false);
    expect(isMoney(null)).toBe(false);
    expect(isMoney('10.00 USD')).toBe(false);
  });
});

describe('assertSameCurrency()', () => {
  it('passes for matching currencies', () => {
    expect(() => assertSameCurrency(money('1', 'USD'), money('2', 'USD'))).not.toThrow();
  });

  it('throws for mismatched currencies', () => {
    expect(() => assertSameCurrency(money('1', 'EGP'), money('1', 'USD'))).toThrow(
      CurrencyMismatchError,
    );
  });
});
