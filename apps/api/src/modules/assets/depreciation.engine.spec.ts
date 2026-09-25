import { buildSchedule, periodDate } from './depreciation.engine';

describe('Depreciation schedules — four methods (plan item 46)', () => {
  const base = {
    startValue: 12000,
    salvage: 2000,
    periods: 5,
    frequencyMonths: 12,
    firstDate: '2026-12-31',
  };
  const sum = (rows: Array<{ amount: number }>): number =>
    Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;

  it('1. straight line: equal rows, ends at salvage', () => {
    const s = buildSchedule({ ...base, method: 'straight_line' });
    expect(s.map((r) => r.amount)).toEqual([2000, 2000, 2000, 2000, 2000]);
    expect(s.at(-1)).toMatchObject({
      bookValueAfter: 2000,
      accumulated: 10000,
      date: '2030-12-31',
    });
  });

  it('2. double declining: 40% of book value each year, never below salvage', () => {
    const s = buildSchedule({ ...base, method: 'double_declining_balance' });
    expect(s[0]!.amount).toBe(4800); // 12000 × 40%
    expect(s[1]!.amount).toBe(2880); // 7200 × 40%
    expect(sum(s)).toBe(10000);
    expect(s.at(-1)!.bookValueAfter).toBe(2000);
  });

  it('3. written down value: yearly rate, per period for quarterly', () => {
    const s = buildSchedule({
      ...base,
      method: 'written_down_value',
      annualRatePercent: 20,
      frequencyMonths: 3,
      periods: 8,
    });
    expect(s[0]!.amount).toBe(600); // 12000 × 5%
    expect(s[0]!.date).toBe('2026-12-31');
    expect(s[1]!.date).toBe('2027-03-31');
    expect(s.at(-1)!.bookValueAfter).toBe(2000);
  });

  it('4. manual amounts must add up to the depreciable value', () => {
    expect(() =>
      buildSchedule({ ...base, method: 'manual', manualAmounts: [1000, 1000, 1000, 1000, 1000] }),
    ).toThrow(/10000/);
    const s = buildSchedule({
      ...base,
      method: 'manual',
      manualAmounts: [4000, 3000, 1500, 1000, 500],
    });
    expect(s.map((r) => r.accumulated)).toEqual([4000, 7000, 8500, 9500, 10000]);
  });

  it('5. month-end cadence and continued numbering (recalculation)', () => {
    expect(periodDate('2026-01-31', 1, 1)).toBe('2026-02-28');
    const s = buildSchedule({
      ...base,
      method: 'straight_line',
      startValue: 8000,
      periods: 3,
      openingAccumulated: 4000,
      firstRowNumber: 3,
    });
    expect(s.map((r) => [r.rowNumber, r.amount, r.accumulated])).toEqual([
      [3, 2000, 6000],
      [4, 2000, 8000],
      [5, 2000, 10000],
    ]);
  });
});
