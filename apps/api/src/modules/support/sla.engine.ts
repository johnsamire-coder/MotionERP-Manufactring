/**
 * Working-time arithmetic for SLAs (plan item 43), pure. Working hours are local times in the SLA's
 * time zone (Egypt by default), per weekday; holidays are local dates. No library needed: offsets
 * come from Intl for each day, so daylight saving is handled.
 */
export interface WorkingWindow { weekday: number; start: string; end: string; } // weekday 0 = Sunday, "09:00"
export interface Calendar { timeZone: string; windows: WorkingWindow[]; holidays: string[]; } // holidays "YYYY-MM-DD"

const MIN = 60_000;
const DAY = 86_400_000;

/** Local calendar parts of an instant in a time zone. */
function localParts(at: Date, timeZone: string): { y: number; m: number; d: number; weekday: number } {
  const f = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday!);
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), weekday };
}

/** UTC instant of a local wall-clock time in a zone. */
export function zonedTime(y: number, m: number, d: number, hh: number, mm: number, timeZone: string): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offsetAt = (t: number): number => {
    const f = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute)) - t;
  };
  let t = guess - offsetAt(guess);
  t = guess - offsetAt(t); // second pass settles DST edges
  return new Date(t);
}

const hm = (s: string): [number, number] => { const [h, m] = s.split(':').map(Number); return [h ?? 0, m ?? 0]; };
const iso = (y: number, m: number, d: number): string => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Working intervals (UTC) of the local day that contains `at`. */
function dayIntervals(at: Date, cal: Calendar): Array<[number, number]> {
  const { y, m, d, weekday } = localParts(at, cal.timeZone);
  if (cal.holidays.includes(iso(y, m, d))) return [];
  return cal.windows.filter((w) => w.weekday === weekday).map((w) => {
    const [sh, sm] = hm(w.start); const [eh, em] = hm(w.end);
    return [zonedTime(y, m, d, sh, sm, cal.timeZone).getTime(), zonedTime(y, m, d, eh, em, cal.timeZone).getTime()] as [number, number];
  }).filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
}

/** The instant `minutes` of working time after `start`. */
export function addWorkingMinutes(start: Date, minutes: number, cal: Calendar): Date {
  if (cal.windows.length === 0) throw new Error('the calendar has no working hours');
  let left = minutes * MIN;
  let cursor = start.getTime();
  for (let guard = 0; guard < 3660; guard++) { // at most ~10 years of days
    for (const [s, e] of dayIntervals(new Date(cursor), cal)) {
      if (e <= cursor) continue;
      const from = Math.max(s, cursor);
      if (e - from >= left) return new Date(from + left);
      left -= e - from;
      cursor = e;
    }
    const { y, m, d } = localParts(new Date(cursor), cal.timeZone);
    cursor = zonedTime(y, m, d, 0, 0, cal.timeZone).getTime() + DAY + 60 * MIN; // into the next local day
    const next = localParts(new Date(cursor), cal.timeZone);
    cursor = zonedTime(next.y, next.m, next.d, 0, 0, cal.timeZone).getTime();
    if (left <= 0) return new Date(cursor);
  }
  throw new Error('could not place the deadline within 10 years');
}

/** Working minutes between two instants. */
export function workingMinutesBetween(from: Date, to: Date, cal: Calendar): number {
  if (to <= from) return 0;
  let total = 0;
  let cursor = from.getTime();
  for (let guard = 0; guard < 3660 && cursor < to.getTime(); guard++) {
    for (const [s, e] of dayIntervals(new Date(cursor), cal)) {
      const a = Math.max(s, cursor); const b = Math.min(e, to.getTime());
      if (b > a) total += b - a;
    }
    const { y, m, d } = localParts(new Date(cursor), cal.timeZone);
    const next = localParts(new Date(zonedTime(y, m, d, 0, 0, cal.timeZone).getTime() + DAY + 60 * MIN), cal.timeZone);
    cursor = zonedTime(next.y, next.m, next.d, 0, 0, cal.timeZone).getTime();
  }
  return Math.round(total / MIN);
}
