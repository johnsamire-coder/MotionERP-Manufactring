import { splitReceipt } from './advance.service';

describe('Advances in a separate account (plan item 38)', () => {
  it('1. nothing invoiced yet → the whole receipt is an advance', () => {
    expect(splitReceipt(500, 0, 0)).toEqual({ settle: 0, advance: 500 });
  });
  it('2. invoiced 1000, 700 already covered → 300 settles, the rest is advance', () => {
    expect(splitReceipt(500, 1000, 700)).toEqual({ settle: 300, advance: 200 });
  });
  it('3. fully within what is invoiced → no advance', () => {
    expect(splitReceipt(400, 1000, 0)).toEqual({ settle: 400, advance: 0 });
  });
  it('4. over-covered history never produces a negative settle', () => {
    expect(splitReceipt(100, 500, 900)).toEqual({ settle: 0, advance: 100 });
  });
});
