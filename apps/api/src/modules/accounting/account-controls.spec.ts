import { wrongSide } from './account-controls.service';

describe('Account controls (plan item 41)', () => {
  it('1. balance side: debit accounts may not go credit and vice versa; no rule = anything', () => {
    expect(wrongSide('debit', -5)).toBe(true);
    expect(wrongSide('debit', 0)).toBe(false);
    expect(wrongSide('credit', 5)).toBe(true);
    expect(wrongSide('credit', -5)).toBe(false);
    expect(wrongSide(null, -1e9)).toBe(false);
  });
});
