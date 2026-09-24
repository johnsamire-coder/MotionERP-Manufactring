import { Injectable } from '@nestjs/common';
import { asc, eq, isNotNull } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { HrNotFoundError, HrValidationError } from './hr.errors';
import { employee, probationEvent } from './hr.schema';

/** Egyptian labour law: probation may not exceed three months, once per employer. */
export const MAX_PROBATION_MONTHS = 3;

export type ProbationState = 'not_set' | 'on_probation' | 'overdue' | 'confirmed';
export interface ProbationRecord {
  employeeId: string; employeeCode: string; employeeName: string; status: string;
  dateOfJoining: string | null; probationEndDate: string | null; confirmationDate: string | null;
  state: ProbationState; daysLeft: number | null;
  events: Array<{ eventType: string; eventDate: string; probationEndDate: string | null; reason: string | null }>;
}

const DAY = 86_400_000;
const isoDay = (d: Date): string => d.toISOString().slice(0, 10);
const parseDay = (s: string, field: string): Date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HrValidationError(`${field} must be a date like 2026-01-31`);
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || isoDay(d) !== s) throw new HrValidationError(`${field} is not a valid date`);
  return d;
};

/** Adds whole months; a day that does not exist in the target month falls back to its last day (Jan 31 + 1 → Feb 28/29). */
export function addMonths(day: string, months: number): string {
  const d = parseDay(day, 'date');
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return isoDay(new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last))));
}

/** Probation end = joining + months − 1 day (a 3-month probation from Jan 1 ends Mar 31). */
export function probationEnd(dateOfJoining: string, months: number): string {
  return isoDay(new Date(parseDay(addMonths(dateOfJoining, months), 'date').getTime() - DAY));
}

export function probationState(p: { probationEndDate: string | null; confirmationDate: string | null }, today: string): { state: ProbationState; daysLeft: number | null } {
  if (p.confirmationDate) return { state: 'confirmed', daysLeft: null };
  if (!p.probationEndDate) return { state: 'not_set', daysLeft: null };
  const daysLeft = Math.round((parseDay(p.probationEndDate, 'date').getTime() - parseDay(today, 'date').getTime()) / DAY);
  return { state: daysLeft < 0 ? 'overdue' : 'on_probation', daysLeft };
}

/** Formal probation with a confirmation date for new employees (plan item 29). */
@Injectable()
export class ProbationService {
  constructor(private readonly database: DatabaseService) {}

  async get(employeeId: string, today = isoDay(new Date())): Promise<ProbationRecord> {
    const e = (await this.database.db.select().from(employee).where(eq(employee.id, employeeId)).limit(1))[0];
    if (!e) throw new HrNotFoundError(`employee ${employeeId} does not exist`);
    const events = await this.database.db.select().from(probationEvent).where(eq(probationEvent.employeeId, employeeId)).orderBy(asc(probationEvent.createdAt));
    return {
      employeeId: e.id, employeeCode: e.code, employeeName: e.name, status: e.status,
      dateOfJoining: e.dateOfJoining, probationEndDate: e.probationEndDate, confirmationDate: e.confirmationDate,
      ...probationState(e, today),
      events: events.map((v) => ({ eventType: v.eventType, eventDate: v.eventDate, probationEndDate: v.probationEndDate, reason: v.reason })),
    };
  }

  /** Starts the (single) probation: from the joining day, for 1–3 months, or up to an explicit end date. */
  async start(employeeId: string, input: { dateOfJoining: string; months?: number; probationEndDate?: string }): Promise<ProbationRecord> {
    const p = await this.get(employeeId);
    if (p.status !== 'active') throw new HrValidationError(`employee ${p.employeeCode} is "${p.status}"`);
    if (p.probationEndDate || p.confirmationDate) {
      throw new HrValidationError(`الموظف ${p.employeeCode} عدّى بفترة اختبار قبل كده — فترة الاختبار مرة واحدة بس عند نفس صاحب العمل`);
    }
    parseDay(input.dateOfJoining, 'dateOfJoining');
    const end = input.probationEndDate ?? probationEnd(input.dateOfJoining, input.months ?? MAX_PROBATION_MONTHS);
    this.checkEnd(input.dateOfJoining, end);
    await this.database.db.update(employee).set({ dateOfJoining: input.dateOfJoining, probationEndDate: end, updatedAt: new Date() }).where(eq(employee.id, employeeId));
    await this.log(employeeId, 'started', input.dateOfJoining, end, null);
    return this.get(employeeId);
  }

  /** Moves the end date later, never past the legal maximum, with a mandatory reason. */
  async extend(employeeId: string, input: { probationEndDate: string; reason: string }): Promise<ProbationRecord> {
    const p = await this.openProbation(employeeId);
    if (!input.reason?.trim()) throw new HrValidationError('a reason is required to extend a probation');
    if (parseDay(input.probationEndDate, 'probationEndDate') <= parseDay(p.probationEndDate!, 'date')) {
      throw new HrValidationError('the new end date must be after the current one');
    }
    this.checkEnd(p.dateOfJoining!, input.probationEndDate);
    await this.database.db.update(employee).set({ probationEndDate: input.probationEndDate, updatedAt: new Date() }).where(eq(employee.id, employeeId));
    await this.log(employeeId, 'extended', isoDay(new Date()), input.probationEndDate, input.reason.trim());
    return this.get(employeeId);
  }

  /**
   * Confirms (تثبيت) the employee. The day defaults to the day after probation ends, or today
   * when confirming early; a future day is refused.
   */
  async confirm(employeeId: string, input: { confirmationDate?: string; note?: string } = {}, today = isoDay(new Date())): Promise<ProbationRecord> {
    const p = await this.openProbation(employeeId);
    const afterEnd = isoDay(new Date(parseDay(p.probationEndDate!, 'date').getTime() + DAY));
    const day = input.confirmationDate ?? (afterEnd < today ? afterEnd : today);
    if (parseDay(day, 'confirmationDate') < parseDay(p.dateOfJoining!, 'date')) throw new HrValidationError('confirmationDate cannot be before the joining day');
    if (day > today) throw new HrValidationError('confirmationDate cannot be in the future');
    await this.database.db.update(employee).set({ confirmationDate: day, updatedAt: new Date() }).where(eq(employee.id, employeeId));
    await this.log(employeeId, 'confirmed', day, p.probationEndDate, input.note?.trim() || null);
    return this.get(employeeId);
  }

  /** Active employees still on probation whose end date is within `withinDays` (or already passed). */
  async due(withinDays = 14, today = isoDay(new Date())): Promise<ProbationRecord[]> {
    const rows = await this.database.db.select({ id: employee.id }).from(employee).where(isNotNull(employee.probationEndDate));
    const out: ProbationRecord[] = [];
    for (const r of rows) {
      const p = await this.get(r.id, today);
      if (p.status === 'active' && p.daysLeft !== null && p.daysLeft <= withinDays) out.push(p);
    }
    return out.sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  }

  private checkEnd(dateOfJoining: string, end: string): void {
    const max = probationEnd(dateOfJoining, MAX_PROBATION_MONTHS);
    if (parseDay(end, 'probationEndDate') < parseDay(dateOfJoining, 'dateOfJoining')) throw new HrValidationError('probation cannot end before the joining day');
    if (end > max) throw new HrValidationError(`فترة الاختبار متزيدش عن ${MAX_PROBATION_MONTHS} شهور (قانون العمل) — آخر يوم مسموح ${max}`);
  }

  private async openProbation(employeeId: string): Promise<ProbationRecord> {
    const p = await this.get(employeeId);
    if (p.status !== 'active') throw new HrValidationError(`employee ${p.employeeCode} is "${p.status}"`);
    if (p.confirmationDate) throw new HrValidationError(`employee ${p.employeeCode} was already confirmed on ${p.confirmationDate}`);
    if (!p.probationEndDate) throw new HrValidationError(`employee ${p.employeeCode} has no probation — start one first`);
    return p;
  }

  private async log(employeeId: string, eventType: 'started' | 'extended' | 'confirmed', eventDate: string, end: string | null, reason: string | null): Promise<void> {
    await this.database.db.insert(probationEvent).values({ employeeId, eventType, eventDate, probationEndDate: end, reason });
  }
}
