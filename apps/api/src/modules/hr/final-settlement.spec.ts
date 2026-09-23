import { suggestSettlementLines } from './final-settlement.service';

describe('Final settlement suggestions (plan item 21)', () => {
  const relieving = new Date('2026-09-15T00:00:00Z'); // day 15 of a 30-day month

  it('1. unpaid payroll + prorated last month + earned leave encashment', () => {
    const lines = suggestSettlementLines(
      relieving, 6000,
      [{ periodYear: '2026', periodMonth: '08', totalAmount: '6000' }],
      false,
      // 21 days for the whole of 2026 (365 days); 258 days elapsed by 15 Sep → 14.84 earned days
      [{ days: '21', fromDate: new Date('2026-01-01T00:00:00Z'), toDate: new Date('2026-12-31T00:00:00Z') }],
    );
    expect(lines.map((l) => l.component)).toEqual(['unpaid_salary', 'prorated_salary', 'leave_encashment']);
    expect(lines[0]!.amount).toBe(6000);
    expect(lines[1]!.amount).toBeCloseTo(3000); // 6000 × 15 / 30
    expect(lines[2]!.amount).toBeCloseTo((21 * 258) / 365 * 200, 2); // earned days × (6000 / 30)
  });

  it('2. no prorated line when the last month already has payroll; nothing for zero salary', () => {
    expect(suggestSettlementLines(relieving, 6000, [], true, []).length).toBe(0);
    expect(suggestSettlementLines(relieving, 0, [], false, [{ days: '10', fromDate: relieving, toDate: relieving }]).length).toBe(0);
  });
});
