/** Depreciation schedules (plan item 46), pure. Four methods as in ERPNext. */
export type DepreciationMethod = 'straight_line' | 'double_declining_balance' | 'written_down_value' | 'manual';
export interface ScheduleRow { rowNumber: number; date: string; amount: number; accumulated: number; bookValueAfter: number; }
export interface ScheduleInput {
  method: DepreciationMethod;
  /** Book value the schedule starts from (cost − depreciation already booked). */
  startValue: number;
  salvage: number;
  periods: number;
  frequencyMonths: number;
  /** First depreciation date (YYYY-MM-DD); later rows fall on the same month-end cadence. */
  firstDate: string;
  /** Accumulated depreciation already booked before this schedule. */
  openingAccumulated?: number;
  /** written_down_value: yearly rate in percent. */
  annualRatePercent?: number;
  /** manual: the amount of every row. */
  manualAmounts?: number[];
  /** Row numbering continues after already-posted rows. */
  firstRowNumber?: number;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Month-end date `k` periods after the first date. */
export function periodDate(firstDate: string, k: number, frequencyMonths: number): string {
  const [y, m] = firstDate.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + k * frequencyMonths + 1, 0));
  return d.toISOString().slice(0, 10);
}

export function buildSchedule(i: ScheduleInput): ScheduleRow[] {
  if (!(i.periods > 0) || !Number.isInteger(i.periods)) throw new Error('number of depreciations must be a positive whole number');
  if (i.salvage < 0 || i.salvage > i.startValue) throw new Error('salvage value must be between 0 and the asset value');
  const depreciable = r2(i.startValue - i.salvage);
  const amounts: number[] = [];
  let book = i.startValue;
  if (i.method === 'straight_line') {
    const each = r2(depreciable / i.periods);
    for (let k = 0; k < i.periods; k++) amounts.push(each);
  } else if (i.method === 'double_declining_balance' || i.method === 'written_down_value') {
    const rate = i.method === 'double_declining_balance'
      ? 2 / i.periods
      : ((i.annualRatePercent ?? 0) / 100) * (i.frequencyMonths / 12);
    if (!(rate > 0) || rate >= 1) throw new Error('the depreciation rate must be between 0 and 100%');
    for (let k = 0; k < i.periods; k++) {
      const a = r2(Math.min(book * rate, book - i.salvage));
      amounts.push(Math.max(0, a));
      book = r2(book - Math.max(0, a));
    }
  } else {
    const list = i.manualAmounts ?? [];
    if (list.length !== i.periods) throw new Error(`manual schedule needs exactly ${i.periods} amounts`);
    if (list.some((a) => a < 0)) throw new Error('manual amounts cannot be negative');
    if (Math.abs(r2(list.reduce((s, a) => s + a, 0)) - depreciable) > 0.01) throw new Error(`manual amounts must add up to ${depreciable.toFixed(2)}`);
    amounts.push(...list.map(r2));
  }
  // the last row absorbs rounding so the asset ends exactly at its salvage value
  const total = r2(amounts.reduce((s, a) => s + a, 0));
  amounts[amounts.length - 1] = r2(amounts[amounts.length - 1]! + (depreciable - total));
  let acc = i.openingAccumulated ?? 0;
  book = i.startValue;
  return amounts.map((amount, k) => {
    acc = r2(acc + amount);
    book = r2(book - amount);
    return { rowNumber: (i.firstRowNumber ?? 1) + k, date: periodDate(i.firstDate, k, i.frequencyMonths), amount, accumulated: acc, bookValueAfter: book };
  });
}
