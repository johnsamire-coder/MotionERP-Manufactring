import { percentComplete, reportDue } from './progress';

describe('Project percent complete — four methods (plan item 44)', () => {
  const tasks = [
    { status: 'completed', progress: 100, weight: 5 },
    { status: 'working', progress: 50, weight: 3 },
    { status: 'open', progress: 0, weight: 2 },
    { status: 'cancelled', progress: 90, weight: 50 }, // ignored everywhere
  ];
  it('1. manual', () => expect(percentComplete('manual', tasks, 42.5)).toBe(42.5));
  it('2. task completion = completed / live tasks', () =>
    expect(percentComplete('task_completion', tasks, null)).toBe(33.33));
  it('3. task progress = average progress', () =>
    expect(percentComplete('task_progress', tasks, null)).toBe(50));
  it('4. task weight = progress weighted', () =>
    expect(percentComplete('task_weight', tasks, null)).toBe(65)); // (500 + 150 + 0) / 10
  it('5. no tasks → 0; reports due by frequency', () => {
    expect(percentComplete('task_weight', [], null)).toBe(0);
    const now = new Date('2026-09-24T10:00:00Z');
    expect(reportDue('weekly', null, now)).toBe(true);
    expect(reportDue('weekly', new Date('2026-09-20T10:00:00Z'), now)).toBe(false);
    expect(reportDue('daily', new Date('2026-09-23T10:00:00Z'), now)).toBe(true);
    expect(reportDue('none', null, now)).toBe(false);
  });
});
