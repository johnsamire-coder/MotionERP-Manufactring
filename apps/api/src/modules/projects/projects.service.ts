import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { AppConfigService } from '../../core/config/app-config.service';
import { DatabaseService } from '../../core/database/database.service';
import { AccountControlsService } from '../accounting/account-controls.service';
import { accountType, chartOfAccounts, journalEntry, journalLine, journalLineDimension } from '../accounting/accounting.schema';
import { CrmNotFoundError } from '../crm/crm.errors';
import { CrmService } from '../crm/crm.service';
import { percentComplete, reportDue, type PercentMethod } from './progress';
import { emailOutbox, project, projectTask } from './projects.schema';
import { sendMail } from './smtp.client';

export class ProjectsNotFoundError extends Error { constructor(m: string) { super(m); this.name = 'ProjectsNotFoundError'; } }
export class ProjectsValidationError extends Error { constructor(m: string) { super(m); this.name = 'ProjectsValidationError'; } }

type ProjectRow = typeof project.$inferSelect;
type TaskRow = typeof projectTask.$inferSelect;
export interface Profitability { revenue: string; costs: string; profit: string; marginPercent: string | null; contractValue: string | null; estimatedCost: string | null; costVsEstimatePercent: string | null; }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Project management (plan item 44): tasks, four percent-complete methods, profitability, periodic e-mailed status reports. */
@Injectable()
export class ProjectsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProjectsService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly database: DatabaseService,
    @Optional() private readonly dimensions?: AccountControlsService,
    @Optional() private readonly crm?: CrmService,
    @Optional() private readonly config?: AppConfigService,
  ) {}

  onModuleInit(): void {
    const minutes = this.config?.projectReportIntervalMinutes ?? 0;
    if (minutes > 0) {
      this.timer = setInterval(() => { this.sendDueReports().catch((e: unknown) => this.logger.error(`project reports failed: ${String(e)}`)); }, minutes * 60_000);
      this.timer.unref();
    }
  }

  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }

  async create(input: {
    code: string; name: string; orgNodeId: string; customerId?: string; startDate?: string; endDate?: string; percentCompleteMethod?: PercentMethod;
    estimatedCost?: string; contractValue?: string; reportFrequency?: string; reportRecipients?: string[];
  }): Promise<ProjectRow> {
    if (!input.code?.trim() || !input.name?.trim()) throw new ProjectsValidationError('code and name are required');
    if (input.customerId && this.crm) {
      await this.crm.getCustomer(input.customerId).catch((e) => { if (e instanceof CrmNotFoundError) throw new ProjectsNotFoundError(`customer ${input.customerId} does not exist`); throw e; });
    }
    this.checkRecipients(input.reportRecipients ?? []);
    if ((await this.database.db.select({ id: project.id }).from(project).where(eq(project.code, input.code.trim())).limit(1))[0]) {
      throw new ProjectsValidationError(`مشروع بالكود ${input.code.trim()} موجود بالفعل`);
    }
    if (input.startDate && input.endDate && input.endDate < input.startDate) throw new ProjectsValidationError('endDate is before startDate');
    // Each project is a value of the company's "PROJECT" accounting dimension, so journal lines can carry it (item 41).
    let dimensionValueId: string | null = null;
    if (this.dimensions) {
      const dims = await this.dimensions.listDimensions(input.orgNodeId);
      const dim = dims.find((d) => d.code === 'PROJECT') ?? await this.dimensions.createDimension({ orgNodeId: input.orgNodeId, code: 'PROJECT', name: 'المشروع' });
      dimensionValueId = (await this.dimensions.addDimensionValue(dim.id, { code: input.code.trim(), name: input.name.trim() })).id;
    }
    return (await this.database.db.insert(project).values({
      code: input.code.trim(), name: input.name.trim(), orgNodeId: input.orgNodeId, customerId: input.customerId ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null, endDate: input.endDate ? new Date(input.endDate) : null,
      percentCompleteMethod: input.percentCompleteMethod ?? 'task_completion', estimatedCost: input.estimatedCost ?? null, contractValue: input.contractValue ?? null,
      reportFrequency: input.reportFrequency ?? 'none', reportRecipients: input.reportRecipients ?? [], dimensionValueId,
    }).returning())[0]!;
  }

  async update(id: string, input: { status?: string; percentCompleteMethod?: PercentMethod; manualPercentComplete?: number; reportFrequency?: string; reportRecipients?: string[] }): Promise<ProjectRow> {
    await this.mustProject(id);
    if (input.reportRecipients) this.checkRecipients(input.reportRecipients);
    const set: Partial<ProjectRow> = { updatedAt: new Date() };
    if (input.status) set.status = input.status;
    if (input.percentCompleteMethod) set.percentCompleteMethod = input.percentCompleteMethod;
    if (input.manualPercentComplete !== undefined) set.manualPercentComplete = input.manualPercentComplete.toFixed(2);
    if (input.reportFrequency) set.reportFrequency = input.reportFrequency;
    if (input.reportRecipients) set.reportRecipients = input.reportRecipients;
    return (await this.database.db.update(project).set(set).where(eq(project.id, id)).returning())[0]!;
  }

  async list(): Promise<Array<ProjectRow & { percentComplete: number }>> {
    const rows = await this.database.db.select().from(project).orderBy(asc(project.code));
    return Promise.all(rows.map(async (p) => ({ ...p, percentComplete: percentComplete(p.percentCompleteMethod as PercentMethod, await this.tasksOf(p.id), p.manualPercentComplete === null ? null : Number(p.manualPercentComplete)) })));
  }

  async get(id: string): Promise<ProjectRow & { percentComplete: number; tasks: TaskRow[]; profitability: Profitability }> {
    const p = await this.mustProject(id);
    const tasks = await this.database.db.select().from(projectTask).where(eq(projectTask.projectId, id)).orderBy(asc(projectTask.createdAt));
    return {
      ...p, tasks, profitability: await this.profitability(p),
      percentComplete: percentComplete(p.percentCompleteMethod as PercentMethod, tasks.map((t) => ({ status: t.status, progress: Number(t.progress), weight: Number(t.weight) })), p.manualPercentComplete === null ? null : Number(p.manualPercentComplete)),
    };
  }

  async addTask(projectId: string, input: { subject: string; weight?: number; expectedEnd?: string }): Promise<TaskRow> {
    const p = await this.mustProject(projectId);
    if (p.status !== 'open') throw new ProjectsValidationError(`المشروع ${p.code} "${p.status}"`);
    if (!input.subject?.trim()) throw new ProjectsValidationError('subject is required');
    return (await this.database.db.insert(projectTask).values({
      projectId, subject: input.subject.trim(), weight: (input.weight ?? 1).toFixed(2), expectedEnd: input.expectedEnd ? new Date(input.expectedEnd) : null,
    }).returning())[0]!;
  }

  async updateTask(taskId: string, input: { status?: string; progress?: number; weight?: number }): Promise<TaskRow> {
    const t = (await this.database.db.select().from(projectTask).where(eq(projectTask.id, taskId)).limit(1))[0];
    if (!t) throw new ProjectsNotFoundError(`task ${taskId} does not exist`);
    const set: Partial<TaskRow> = { updatedAt: new Date() };
    if (input.status) set.status = input.status;
    if (input.progress !== undefined) set.progress = input.progress.toFixed(2);
    if (input.weight !== undefined) set.weight = input.weight.toFixed(2);
    if (input.status === 'completed') set.progress = '100.00';
    return (await this.database.db.update(projectTask).set(set).where(eq(projectTask.id, taskId)).returning())[0]!;
  }

  /** Revenue and costs of the posted journal lines tagged with the project (its dimension value). */
  async profitability(p: ProjectRow): Promise<Profitability> {
    let revenue = 0; let costs = 0;
    if (p.dimensionValueId) {
      const rows = await this.database.db.select({
        typeCode: accountType.code, debit: sql<string>`sum(${journalLine.debitAmount})`, credit: sql<string>`sum(${journalLine.creditAmount})`,
      }).from(journalLineDimension)
        .innerJoin(journalLine, eq(journalLine.id, journalLineDimension.journalLineId))
        .innerJoin(journalEntry, eq(journalEntry.id, journalLine.journalEntryId))
        .innerJoin(chartOfAccounts, eq(chartOfAccounts.id, journalLine.accountId))
        .innerJoin(accountType, eq(accountType.id, chartOfAccounts.accountTypeId))
        .where(and(eq(journalLineDimension.valueId, p.dimensionValueId), eq(journalEntry.status, 'posted')))
        .groupBy(accountType.code);
      for (const r of rows) {
        if (r.typeCode === 'revenue') revenue += Number(r.credit) - Number(r.debit);
        else if (r.typeCode === 'cogs' || r.typeCode === 'expense') costs += Number(r.debit) - Number(r.credit);
      }
    }
    const profit = revenue - costs;
    const est = p.estimatedCost === null ? null : Number(p.estimatedCost);
    return {
      revenue: revenue.toFixed(4), costs: costs.toFixed(4), profit: profit.toFixed(4),
      marginPercent: revenue > 0 ? ((profit / revenue) * 100).toFixed(2) : null,
      contractValue: p.contractValue, estimatedCost: p.estimatedCost,
      costVsEstimatePercent: est && est > 0 ? ((costs / est) * 100).toFixed(2) : null,
    };
  }

  /** Builds the status report, queues it and tries to send it now. */
  async statusReport(id: string, now = new Date()): Promise<typeof emailOutbox.$inferSelect> {
    const p = await this.get(id);
    if (p.reportRecipients.length === 0) throw new ProjectsValidationError(`المشروع ${p.code} ملوش مستلمين للتقرير`);
    const live = p.tasks.filter((t) => t.status !== 'cancelled');
    const overdue = live.filter((t) => t.status !== 'completed' && t.expectedEnd && t.expectedEnd < now);
    const body = [
      `تقرير حالة المشروع ${p.code} — ${p.name}`, `التاريخ: ${now.toISOString().slice(0, 10)}`, '',
      `الحالة: ${p.status}`, `نسبة الإنجاز: ${p.percentComplete}% (الطريقة: ${p.percentCompleteMethod})`,
      `المهام: ${live.filter((t) => t.status === 'completed').length} خلصت من ${live.length}`,
      overdue.length > 0 ? `مهام متأخرة: ${overdue.map((t) => t.subject).join('، ')}` : 'مفيش مهام متأخرة', '',
      `الإيرادات: ${p.profitability.revenue}`, `التكاليف: ${p.profitability.costs}`, `الربح: ${p.profitability.profit}${p.profitability.marginPercent ? ` (هامش ${p.profitability.marginPercent}%)` : ''}`,
      p.profitability.costVsEstimatePercent ? `التكاليف = ${p.profitability.costVsEstimatePercent}% من التقدير` : '',
    ].filter((l) => l !== undefined).join('\n');
    const row = (await this.database.db.insert(emailOutbox).values({
      recipients: p.reportRecipients, subject: `تقرير حالة المشروع ${p.code}`, body, sourceType: 'project_status_report', sourceId: p.id,
    }).returning())[0]!;
    await this.database.db.update(project).set({ lastReportAt: now }).where(eq(project.id, p.id));
    return this.deliver(row.id);
  }

  async sendDueReports(now = new Date()): Promise<string[]> {
    const due = (await this.database.db.select().from(project).where(and(eq(project.status, 'open'), ne(project.reportFrequency, 'none'))))
      .filter((p) => p.reportRecipients.length > 0 && reportDue(p.reportFrequency, p.lastReportAt, now));
    for (const p of due) await this.statusReport(p.id, now);
    return due.map((p) => p.code);
  }

  async outbox(): Promise<Array<typeof emailOutbox.$inferSelect>> {
    return this.database.db.select().from(emailOutbox).orderBy(desc(emailOutbox.createdAt)).limit(100);
  }

  /** Sends one queued e-mail with the configured SMTP transport (or marks it "no_transport"). */
  async deliver(outboxId: string): Promise<typeof emailOutbox.$inferSelect> {
    const db = this.database.db;
    const m = (await db.select().from(emailOutbox).where(eq(emailOutbox.id, outboxId)).limit(1))[0];
    if (!m) throw new ProjectsNotFoundError(`e-mail ${outboxId} does not exist`);
    const url = this.config?.smtpUrl;
    let set: Partial<typeof emailOutbox.$inferSelect>;
    if (!url) set = { status: 'no_transport', error: 'SMTP_URL is not configured' };
    else {
      try {
        await sendMail(url, this.config!.smtpFrom, m.recipients, m.subject, m.body);
        set = { status: 'sent', sentAt: new Date(), error: null };
      } catch (err) {
        set = { status: 'failed', error: (err as Error).message };
      }
    }
    return (await db.update(emailOutbox).set(set).where(eq(emailOutbox.id, outboxId)).returning())[0]!;
  }

  private checkRecipients(list: string[]): void {
    const bad = list.filter((e) => !EMAIL.test(e));
    if (bad.length > 0) throw new ProjectsValidationError(`إيميلات غلط: ${bad.join('، ')}`);
  }

  private async tasksOf(projectId: string): Promise<Array<{ status: string; progress: number; weight: number }>> {
    return (await this.database.db.select().from(projectTask).where(eq(projectTask.projectId, projectId))).map((t) => ({ status: t.status, progress: Number(t.progress), weight: Number(t.weight) }));
  }

  private async mustProject(id: string): Promise<ProjectRow> {
    const p = (await this.database.db.select().from(project).where(eq(project.id, id)).limit(1))[0];
    if (!p) throw new ProjectsNotFoundError(`project ${id} does not exist`);
    return p;
  }
}
