import { addWorkingMinutes, workingMinutesBetween, zonedTime, type Calendar } from './sla.engine';

// Egypt: Sun–Thu 09:00–17:00 local; 2026-10-06 (Tuesday) is a holiday.
const cal: Calendar = {
  timeZone: 'Africa/Cairo',
  windows: [0, 1, 2, 3, 4].map((weekday) => ({ weekday, start: '09:00', end: '17:00' })),
  holidays: ['2026-10-06'],
};
const cairo = (d: string, t: string): Date => {
  const [y, m, dd] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  return zonedTime(y!, m!, dd!, h!, mi!, 'Africa/Cairo');
};

describe('SLA working-time engine (plan item 43)', () => {
  it('1. inside one working day', () => {
    expect(addWorkingMinutes(cairo('2026-10-04', '10:00'), 120, cal)).toEqual(
      cairo('2026-10-04', '12:00'),
    );
  });

  it('2. spills over the evening into the next working morning', () => {
    // Sunday 16:00 + 3h = Sunday 17:00 (1h) + Monday 09:00–11:00
    expect(addWorkingMinutes(cairo('2026-10-04', '16:00'), 180, cal)).toEqual(
      cairo('2026-10-05', '11:00'),
    );
  });

  it('3. skips the weekend (Fri/Sat) and the holiday', () => {
    // Thursday 2026-10-08 16:00 + 2h → Thu 17:00 (1h), Fri/Sat off → Sun 10-11 09:00 + 1h
    expect(addWorkingMinutes(cairo('2026-10-08', '16:00'), 120, cal)).toEqual(
      cairo('2026-10-11', '10:00'),
    );
    // Monday 2026-10-05 16:00 + 2h → Mon 1h, Tue holiday → Wed 09:00 + 1h
    expect(addWorkingMinutes(cairo('2026-10-05', '16:00'), 120, cal)).toEqual(
      cairo('2026-10-07', '10:00'),
    );
  });

  it('4. a start before opening counts from opening', () => {
    expect(addWorkingMinutes(cairo('2026-10-04', '07:30'), 30, cal)).toEqual(
      cairo('2026-10-04', '09:30'),
    );
  });

  it('5. working minutes between two instants ignore nights, weekends and holidays', () => {
    expect(
      workingMinutesBetween(cairo('2026-10-04', '16:00'), cairo('2026-10-05', '11:00'), cal),
    ).toBe(180);
    expect(
      workingMinutesBetween(cairo('2026-10-08', '17:00'), cairo('2026-10-11', '09:00'), cal),
    ).toBe(0);
    expect(
      workingMinutesBetween(cairo('2026-10-05', '09:00'), cairo('2026-10-07', '09:00'), cal),
    ).toBe(480);
  });
});
