import { Injectable, Logger, Optional } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { PrintJobService } from '../printing/print-job.service';
import { ProjectsService } from '../projects/projects.service';
import { WorkflowNotFoundError, WorkflowValidationError } from './workflow.errors';
import {
  workflowDefinition,
  workflowTaskRun,
  workflowTransition,
  workflowTransitionTask,
} from './workflow.schema';

export type TaskType = 'email' | 'webhook' | 'print';
export interface TransitionEvent {
  instanceId: string;
  workflowId: string;
  workflowCode: string;
  documentType: string;
  documentId: string;
  action: string;
  fromState: string;
  toState: string;
  context: Record<string, unknown>;
}

/** {{path}} placeholders for e-mail subjects / bodies (plain text, pure). */
export function fillPlaceholders(text: string, data: Record<string, unknown>): string {
  return text.replace(/{{\s*([\w.]+)\s*}}/g, (_, path: string) => {
    const v = path
      .split('.')
      .reduce<unknown>(
        (cur, k) =>
          cur !== null && typeof cur === 'object' ? (cur as Record<string, unknown>)[k] : undefined,
        data,
      );
    return v === undefined || v === null ? '' : String(v);
  });
}

/** Plan item 50: tasks that run automatically after a workflow transition, without blocking it. */
@Injectable()
export class WorkflowAutomationService {
  private readonly logger = new Logger(WorkflowAutomationService.name);

  constructor(
    private readonly database: DatabaseService,
    @Optional() private readonly projects?: ProjectsService,
    @Optional() private readonly printJobs?: PrintJobService,
  ) {}

  async addTask(
    workflowId: string,
    input: { action: string; taskType: TaskType; config: Record<string, unknown> },
  ): Promise<typeof workflowTransitionTask.$inferSelect> {
    const db = this.database.db;
    if (
      !(
        await db
          .select({ id: workflowDefinition.id })
          .from(workflowDefinition)
          .where(eq(workflowDefinition.id, workflowId))
          .limit(1)
      )[0]
    ) {
      throw new WorkflowNotFoundError(`workflow ${workflowId} does not exist`);
    }
    const t = await db
      .select({ id: workflowTransition.id })
      .from(workflowTransition)
      .where(
        and(
          eq(workflowTransition.workflowId, workflowId),
          eq(workflowTransition.action, input.action),
        ),
      )
      .limit(1);
    if (!t[0])
      throw new WorkflowValidationError(`الإجراء "${input.action}" مش موجود في سير العمل ده`);
    const c = input.config;
    if (
      input.taskType === 'email' &&
      (!Array.isArray(c.recipients) || c.recipients.length === 0 || typeof c.subject !== 'string')
    )
      throw new WorkflowValidationError('email task needs recipients[] and subject');
    if (input.taskType === 'webhook') {
      let url: URL;
      try {
        url = new URL(String(c.url));
      } catch {
        throw new WorkflowValidationError('webhook task needs a valid url');
      }
      if (!['http:', 'https:'].includes(url.protocol))
        throw new WorkflowValidationError('webhook url must be http(s)');
    }
    if (
      input.taskType === 'print' &&
      typeof c.printerId !== 'string' &&
      typeof c.formatId !== 'string'
    )
      throw new WorkflowValidationError('print task needs printerId and/or formatId');
    return (
      await db
        .insert(workflowTransitionTask)
        .values({ workflowId, action: input.action, taskType: input.taskType, config: c })
        .returning()
    )[0]!;
  }

  async tasks(workflowId: string): Promise<Array<typeof workflowTransitionTask.$inferSelect>> {
    return this.database.db
      .select()
      .from(workflowTransitionTask)
      .where(eq(workflowTransitionTask.workflowId, workflowId));
  }

  async runs(instanceId: string): Promise<Array<typeof workflowTaskRun.$inferSelect>> {
    return this.database.db
      .select()
      .from(workflowTaskRun)
      .where(eq(workflowTaskRun.instanceId, instanceId))
      .orderBy(asc(workflowTaskRun.createdAt));
  }

  /** Fire-and-forget: the transition has already happened; failures are logged, never thrown. */
  dispatch(event: TransitionEvent): void {
    setImmediate(() => {
      this.run(event).catch((e: unknown) =>
        this.logger.error(`workflow tasks failed: ${String(e)}`),
      );
    });
  }

  async run(event: TransitionEvent): Promise<void> {
    const db = this.database.db;
    const tasks = await db
      .select()
      .from(workflowTransitionTask)
      .where(
        and(
          eq(workflowTransitionTask.workflowId, event.workflowId),
          eq(workflowTransitionTask.action, event.action),
          eq(workflowTransitionTask.isActive, true),
        ),
      );
    for (const t of tasks) {
      let status: 'ok' | 'failed' = 'ok';
      let detail = '';
      try {
        detail = await this.execute(t.taskType as TaskType, t.config, event);
      } catch (e) {
        status = 'failed';
        detail = (e as Error).message;
      }
      await db
        .insert(workflowTaskRun)
        .values({ taskId: t.id, instanceId: event.instanceId, status, detail });
    }
  }

  private async execute(
    type: TaskType,
    c: Record<string, unknown>,
    e: TransitionEvent,
  ): Promise<string> {
    const data = { ...e, ...e.context, context: e.context };
    if (type === 'email') {
      if (!this.projects) throw new Error('e-mail is not available');
      const m = await this.projects.queueEmail(
        c.recipients as string[],
        fillPlaceholders(String(c.subject), data),
        fillPlaceholders(
          String(
            c.body ?? 'المستند {{documentId}} اتنقل من {{fromState}} إلى {{toState}} ({{action}})',
          ),
          data,
        ),
        'workflow',
        e.instanceId,
      );
      return `email ${m.status}${m.error ? `: ${m.error}` : ''}`;
    }
    if (type === 'webhook') {
      const res = await fetch(String(c.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          workflow: e.workflowCode,
          documentType: e.documentType,
          documentId: e.documentId,
          action: e.action,
          fromState: e.fromState,
          toState: e.toState,
          context: e.context,
        }),
      });
      if (!res.ok) throw new Error(`webhook answered ${res.status}`);
      return `webhook ${res.status}`;
    }
    if (!this.printJobs) throw new Error('printing is not available');
    const job = await this.printJobs.queue({
      documentType: String(c.documentType ?? e.documentType),
      documentIds: [e.documentId],
      formatId: typeof c.formatId === 'string' ? c.formatId : undefined,
      printerId: typeof c.printerId === 'string' ? c.printerId : undefined,
    });
    return `print job ${job.id}`;
  }
}
