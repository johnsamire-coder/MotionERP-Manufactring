import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { AppConfigService } from '../../core/config/app-config.service';
import { DatabaseService } from '../../core/database/database.service';
import { CrmNotFoundError } from '../crm/crm.errors';
import { CrmService } from '../crm/crm.service';
import { addWorkingMinutes, workingMinutesBetween, type Calendar } from './sla.engine';
import { SupportNotFoundError, SupportValidationError } from './support.errors';
import { holiday, holidayList, serviceLevelAgreement, ticket, ticketComment } from './support.schema';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'replied' | 'on_hold' | 'resolved' | 'closed';
type TicketRow = typeof ticket.$inferSelect;
type SlaRow = typeof serviceLevelAgreement.$inferSelect;
const PRIORITIES: readonly Priority[] = ['low', 'medium', 'high', 'urgent'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface SlaInput {
  code: string; name: string; timeZone?: string; workingHours: Array<{ weekday: number; start: string; end: string }>;
  holidayListId?: string | null; priorities: Record<string, { responseMinutes: number; resolutionMinutes: number }>;
  autoCloseAfterDays?: number; isDefault?: boolean;
}

/** Helpdesk with SLA on working hours and holidays, ticket split and auto-close (plan item 43). */
@Injectable()
export class SupportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SupportService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly database: DatabaseService,
    @Optional() private readonly crm?: CrmService,
    @Optional() private readonly config?: AppConfigService,
  ) {}

  onModuleInit(): void {
    const minutes = this.config?.supportSweepIntervalMinutes ?? 0;
    if (minutes > 0) {
      this.timer = setInterval(() => { this.sweep().catch((e: unknown) => this.logger.error(`support sweep failed: ${String(e)}`)); }, minutes * 60_000);
      this.timer.unref();
    }
  }

  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }

  // --- holidays & SLAs ---
  async createHolidayList(name: string, dates: Array<{ date: string; description?: string }>): Promise<{ id: string }> {
    if (!name?.trim()) throw new SupportValidationError('name is required');
    const list = (await this.database.db.insert(holidayList).values({ name: name.trim() }).returning())[0]!;
    if (dates.length > 0) await this.database.db.insert(holiday).values(dates.map((d) => ({ holidayListId: list.id, holidayDate: d.date, description: d.description ?? null })));
    return { id: list.id };
  }

  async createSla(input: SlaInput): Promise<SlaRow> {
    if (input.workingHours.length === 0) throw new SupportValidationError('working hours are required');
    for (const w of input.workingHours) {
      if (!Number.isInteger(w.weekday) || w.weekday < 0 || w.weekday > 6) throw new SupportValidationError('weekday must be 0 (Sunday) … 6 (Saturday)');
      if (!HHMM.test(w.start) || !HHMM.test(w.end) || w.end <= w.start) throw new SupportValidationError(`working window ${w.start}–${w.end} is not valid`);
    }
    for (const p of PRIORITIES) {
      const v = input.priorities[p];
      if (!v || !(v.responseMinutes > 0) || !(v.resolutionMinutes > 0)) throw new SupportValidationError(`priority "${p}" needs positive responseMinutes and resolutionMinutes`);
      if (v.responseMinutes > v.resolutionMinutes) throw new SupportValidationError(`priority "${p}": response time cannot exceed resolution time`);
    }
    try { new Intl.DateTimeFormat('en-US', { timeZone: input.timeZone ?? 'Africa/Cairo' }); } catch { throw new SupportValidationError(`unknown time zone "${input.timeZone}"`); }
    if (input.isDefault) await this.database.db.update(serviceLevelAgreement).set({ isDefault: false });
    return (await this.database.db.insert(serviceLevelAgreement).values({
      code: input.code.trim(), name: input.name.trim(), timeZone: input.timeZone ?? 'Africa/Cairo', workingHours: input.workingHours,
      holidayListId: input.holidayListId ?? null, priorities: input.priorities, autoCloseAfterDays: input.autoCloseAfterDays ?? 7, isDefault: input.isDefault ?? false,
    }).returning())[0]!;
  }

  async listSlas(): Promise<SlaRow[]> { return this.database.db.select().from(serviceLevelAgreement).orderBy(asc(serviceLevelAgreement.code)); }

  // --- tickets ---
  async createTicket(input: { subject: string; description?: string; customerId?: string; priority?: Priority; slaId?: string }, now = new Date()): Promise<TicketRow> {
    if (!input.subject?.trim()) throw new SupportValidationError('subject is required');
    const priority = input.priority ?? 'medium';
    if (input.customerId && this.crm) {
      await this.crm.getCustomer(input.customerId).catch((e) => { if (e instanceof CrmNotFoundError) throw new SupportNotFoundError(`customer ${input.customerId} does not exist`); throw e; });
    }
    const sla = await this.slaFor(input.slaId);
    const deadlines = sla ? await this.deadlines(sla, priority, now) : { responseBy: null, resolutionBy: null };
    const n = Number((await this.database.db.select({ n: count() }).from(ticket))[0]?.n ?? 0) + 1;
    return (await this.database.db.insert(ticket).values({
      ticketNumber: `TKT-${now.getFullYear()}-${String(n).padStart(6, '0')}`, subject: input.subject.trim(), description: input.description?.trim() || null,
      customerId: input.customerId ?? null, priority, slaId: sla?.id ?? null, openedAt: now, ...deadlines,
    }).returning())[0]!;
  }

  async getTicket(id: string): Promise<TicketRow & { comments: Array<typeof ticketComment.$inferSelect>; children: string[] }> {
    const t = await this.mustTicket(id);
    const comments = await this.database.db.select().from(ticketComment).where(eq(ticketComment.ticketId, id)).orderBy(asc(ticketComment.createdAt));
    const children = (await this.database.db.select({ n: ticket.ticketNumber }).from(ticket).where(eq(ticket.parentTicketId, id))).map((r) => r.n);
    return { ...t, comments, children };
  }

  async listTickets(status?: TicketStatus): Promise<TicketRow[]> {
    const q = this.database.db.select().from(ticket);
    return status ? q.where(eq(ticket.status, status)).orderBy(desc(ticket.openedAt)) : q.orderBy(desc(ticket.openedAt));
  }

  /** An agent reply is the first response (SLA) and waits on the customer; a customer reply reopens the ticket. */
  async comment(id: string, author: 'agent' | 'customer', body: string, now = new Date()): Promise<TicketRow> {
    const t = await this.mustTicket(id);
    if (!body?.trim()) throw new SupportValidationError('body is required');
    if (t.status === 'closed') throw new SupportValidationError(`التذكرة ${t.ticketNumber} مقفولة`);
    await this.database.db.insert(ticketComment).values({ ticketId: id, author, body: body.trim(), createdAt: now });
    const set: Partial<TicketRow> = { updatedAt: now };
    if (author === 'agent') {
      if (!t.firstRespondedAt) {
        set.firstRespondedAt = now;
        if (t.responseBy) set.responseStatus = now <= t.responseBy ? 'fulfilled' : 'failed';
      }
      set.lastAgentReplyAt = now;
      if (t.status === 'open') set.status = 'replied';
    } else if (t.status === 'replied' || t.status === 'resolved') {
      set.status = 'open';
      if (t.status === 'resolved') { set.resolvedAt = null; set.resolutionStatus = 'pending'; }
    }
    return this.update(id, set);
  }

  async setStatus(id: string, status: TicketStatus, reason?: string, now = new Date()): Promise<TicketRow> {
    const t = await this.mustTicket(id);
    if (t.status === status) return t;
    if (t.status === 'closed' && status !== 'open') throw new SupportValidationError(`التذكرة ${t.ticketNumber} مقفولة — افتحها الأول`);
    const set: Partial<TicketRow> = { status, updatedAt: now };
    // leaving "on hold": the SLA clock was paused — push the pending deadlines by the working time spent on hold
    if (t.status === 'on_hold' && t.onHoldSince) {
      const cal = await this.calendarOf(t.slaId);
      const held = cal ? workingMinutesBetween(t.onHoldSince, now, cal) : 0;
      if (cal && held > 0) {
        if (t.resolutionBy && !t.resolvedAt) set.resolutionBy = addWorkingMinutes(t.resolutionBy, held, cal);
        if (t.responseBy && !t.firstRespondedAt) set.responseBy = addWorkingMinutes(t.responseBy, held, cal);
      }
      set.totalHoldMinutes = t.totalHoldMinutes + held;
      set.onHoldSince = null;
    }
    if (status === 'on_hold') {
      if (!['open', 'replied'].includes(t.status)) throw new SupportValidationError('only an open or replied ticket can go on hold');
      set.onHoldSince = now;
    } else if (status === 'resolved') {
      set.resolvedAt = now;
      const by = set.resolutionBy ?? t.resolutionBy;
      if (by) set.resolutionStatus = now <= by ? 'fulfilled' : 'failed';
    } else if (status === 'closed') {
      set.closedAt = now;
      set.closeReason = reason?.trim() || null;
      if (!t.resolvedAt) { set.resolvedAt = now; const by = set.resolutionBy ?? t.resolutionBy; if (by) set.resolutionStatus = now <= by ? 'fulfilled' : 'failed'; }
    } else if (status === 'open' && (t.status === 'resolved' || t.status === 'closed')) {
      set.resolvedAt = null; set.closedAt = null; set.closeReason = null; set.resolutionStatus = 'pending';
    }
    return this.update(id, set);
  }

  /** Splits a ticket: the chosen comments move to a new ticket linked to the original, with its own SLA clock. */
  async split(id: string, input: { subject: string; commentIds: string[] }, now = new Date()): Promise<{ parent: string; child: TicketRow }> {
    const t = await this.mustTicket(id);
    if (t.status === 'closed') throw new SupportValidationError(`التذكرة ${t.ticketNumber} مقفولة`);
    const ids = [...new Set(input.commentIds)];
    if (ids.length === 0) throw new SupportValidationError('choose at least one comment to move');
    const comments = await this.database.db.select().from(ticketComment).where(and(eq(ticketComment.ticketId, id), inArray(ticketComment.id, ids)));
    if (comments.length !== ids.length) throw new SupportValidationError('every comment must belong to this ticket');
    const child = await this.createTicket({
      subject: input.subject, description: comments.map((c) => c.body).join('\n---\n'), customerId: t.customerId ?? undefined,
      priority: t.priority as Priority, slaId: t.slaId ?? undefined,
    }, now);
    await this.database.db.update(ticketComment).set({ ticketId: child.id }).where(inArray(ticketComment.id, ids));
    return { parent: t.ticketNumber, child: await this.update(child.id, { parentTicketId: t.id }) };
  }

  /** Marks missed deadlines and closes tickets whose customer went silent. Safe to run any time. */
  async sweep(now = new Date()): Promise<{ responseFailed: number; resolutionFailed: number; autoClosed: string[] }> {
    const db = this.database.db;
    const r1 = await db.update(ticket).set({ responseStatus: 'failed', updatedAt: now })
      .where(and(eq(ticket.responseStatus, 'pending'), isNull(ticket.firstRespondedAt), isNull(ticket.onHoldSince), lt(ticket.responseBy, now))).returning({ id: ticket.id });
    const r2 = await db.update(ticket).set({ resolutionStatus: 'failed', updatedAt: now })
      .where(and(eq(ticket.resolutionStatus, 'pending'), isNull(ticket.resolvedAt), isNull(ticket.onHoldSince), lt(ticket.resolutionBy, now))).returning({ id: ticket.id });
    const autoClosed: string[] = [];
    const waiting = await db.select().from(ticket).where(inArray(ticket.status, ['replied', 'resolved']));
    for (const t of waiting) {
      const sla = t.slaId ? (await db.select().from(serviceLevelAgreement).where(eq(serviceLevelAgreement.id, t.slaId)).limit(1))[0] : undefined;
      const days = sla?.autoCloseAfterDays ?? 7;
      const since = t.status === 'replied' ? t.lastAgentReplyAt : t.resolvedAt;
      if (since && now.getTime() - since.getTime() >= days * 86_400_000) {
        await this.setStatus(t.id, 'closed', `تلقائي: مفيش رد من العميل ${days} يوم`, now);
        autoClosed.push(t.ticketNumber);
      }
    }
    return { responseFailed: r1.length, resolutionFailed: r2.length, autoClosed };
  }

  async slaReport(): Promise<Array<{ priority: string; tickets: number; responseFulfilled: number; responseFailed: number; resolutionFulfilled: number; resolutionFailed: number }>> {
    const rows = await this.database.db.select({
      priority: ticket.priority, tickets: count(),
      responseFulfilled: sql<number>`count(*) filter (where ${ticket.responseStatus} = 'fulfilled')`,
      responseFailed: sql<number>`count(*) filter (where ${ticket.responseStatus} = 'failed')`,
      resolutionFulfilled: sql<number>`count(*) filter (where ${ticket.resolutionStatus} = 'fulfilled')`,
      resolutionFailed: sql<number>`count(*) filter (where ${ticket.resolutionStatus} = 'failed')`,
    }).from(ticket).groupBy(ticket.priority);
    return rows.map((r) => ({ priority: r.priority, tickets: Number(r.tickets), responseFulfilled: Number(r.responseFulfilled), responseFailed: Number(r.responseFailed), resolutionFulfilled: Number(r.resolutionFulfilled), resolutionFailed: Number(r.resolutionFailed) }));
  }

  // --- helpers ---
  private async slaFor(slaId?: string): Promise<SlaRow | null> {
    const db = this.database.db;
    if (slaId) {
      const s = (await db.select().from(serviceLevelAgreement).where(eq(serviceLevelAgreement.id, slaId)).limit(1))[0];
      if (!s) throw new SupportNotFoundError(`SLA ${slaId} does not exist`);
      return s;
    }
    return (await db.select().from(serviceLevelAgreement).where(eq(serviceLevelAgreement.isDefault, true)).limit(1))[0] ?? null;
  }

  private async deadlines(sla: SlaRow, priority: Priority, from: Date): Promise<{ responseBy: Date; resolutionBy: Date }> {
    const cal = await this.calendar(sla);
    const p = sla.priorities[priority]!;
    return { responseBy: addWorkingMinutes(from, p.responseMinutes, cal), resolutionBy: addWorkingMinutes(from, p.resolutionMinutes, cal) };
  }

  private async calendarOf(slaId: string | null): Promise<Calendar | null> {
    if (!slaId) return null;
    const sla = (await this.database.db.select().from(serviceLevelAgreement).where(eq(serviceLevelAgreement.id, slaId)).limit(1))[0];
    return sla ? this.calendar(sla) : null;
  }

  private async calendar(sla: SlaRow): Promise<Calendar> {
    const holidays = sla.holidayListId
      ? (await this.database.db.select({ d: holiday.holidayDate }).from(holiday).where(eq(holiday.holidayListId, sla.holidayListId))).map((h) => h.d)
      : [];
    return { timeZone: sla.timeZone, windows: sla.workingHours, holidays };
  }

  private async mustTicket(id: string): Promise<TicketRow> {
    const t = (await this.database.db.select().from(ticket).where(eq(ticket.id, id)).limit(1))[0];
    if (!t) throw new SupportNotFoundError(`ticket ${id} does not exist`);
    return t;
  }

  private async update(id: string, set: Partial<TicketRow>): Promise<TicketRow> {
    return (await this.database.db.update(ticket).set(set).where(eq(ticket.id, id)).returning())[0]!;
  }
}
