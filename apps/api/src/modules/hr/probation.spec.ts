import { addMonths, probationEnd, probationState } from './probation.service';

describe('Probation dates (plan item 29)', () => {
  it('1. adds months and clamps to the month end', () => {
    expect(addMonths('2026-01-15', 3)).toBe('2026-04-15');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
  });

  it('2. a 3-month probation from Jan 1 ends on Mar 31', () => {
    expect(probationEnd('2026-01-01', 3)).toBe('2026-03-31');
    expect(probationEnd('2026-09-24', 3)).toBe('2026-12-23');
    expect(() => probationEnd('2026-02-30', 3)).toThrow(/not a valid date/);
  });

  it('3. state: on probation, overdue, confirmed, not set', () => {
    expect(probationState({ probationEndDate: '2026-10-01', confirmationDate: null }, '2026-09-24')).toEqual({ state: 'on_probation', daysLeft: 7 });
    expect(probationState({ probationEndDate: '2026-09-20', confirmationDate: null }, '2026-09-24')).toEqual({ state: 'overdue', daysLeft: -4 });
    expect(probationState({ probationEndDate: '2026-09-20', confirmationDate: '2026-09-21' }, '2026-09-24').state).toBe('confirmed');
    expect(probationState({ probationEndDate: null, confirmationDate: null }, '2026-09-24').state).toBe('not_set');
  });
});
