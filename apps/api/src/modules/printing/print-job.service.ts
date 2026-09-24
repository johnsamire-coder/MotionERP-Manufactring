import { Injectable, Logger } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { requestContext } from '../../core/request-context/request-context';
import { printer, printJob } from './printing.schema';
import {
  PrintingNotFoundError,
  PrintingService,
  PrintingValidationError,
} from './printing.service';
import { htmlToText, sendRaw } from './raw-printer';

const MAX_DOCS = 500;

/** Plan item 50: bulk printing in the background and network printers. */
@Injectable()
export class PrintJobService {
  private readonly logger = new Logger(PrintJobService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly printing: PrintingService,
  ) {}

  async addPrinter(input: {
    name: string;
    host: string;
    port?: number;
  }): Promise<typeof printer.$inferSelect> {
    if (!/^[A-Za-z0-9.\-:]+$/.test(input.host))
      throw new PrintingValidationError('host must be an IP address or host name');
    return (
      await this.database.db
        .insert(printer)
        .values({ name: input.name.trim(), host: input.host, port: input.port ?? 9100 })
        .returning()
    )[0]!;
  }

  async printers(): Promise<Array<typeof printer.$inferSelect>> {
    return this.database.db.select().from(printer);
  }

  /** Queues a job and returns at once; the rendering happens in the background. */
  async queue(input: {
    documentType: string;
    documentIds: string[];
    formatId?: string;
    printerId?: string;
  }): Promise<typeof printJob.$inferSelect> {
    const ids = [...new Set(input.documentIds)];
    if (ids.length === 0) throw new PrintingValidationError('at least one document is required');
    if (ids.length > MAX_DOCS)
      throw new PrintingValidationError(`at most ${MAX_DOCS} documents per job`);
    if (input.printerId) {
      const p = (
        await this.database.db
          .select()
          .from(printer)
          .where(eq(printer.id, input.printerId))
          .limit(1)
      )[0];
      if (!p || !p.isActive)
        throw new PrintingNotFoundError(`printer ${input.printerId} does not exist or is inactive`);
    }
    const job = (
      await this.database.db
        .insert(printJob)
        .values({
          documentType: input.documentType,
          documentIds: ids,
          printFormatId: input.formatId ?? null,
          printerId: input.printerId ?? null,
          userId: requestContext.currentUserId() ?? null,
        })
        .returning()
    )[0]!;
    setImmediate(() => {
      this.run(job.id).catch((e: unknown) =>
        this.logger.error(`print job ${job.id} failed: ${String(e)}`),
      );
    });
    return job;
  }

  async get(
    id: string,
  ): Promise<Omit<typeof printJob.$inferSelect, 'output'> & { hasOutput: boolean }> {
    const j = await this.mustJob(id);
    const { output, ...rest } = j;
    return { ...rest, hasOutput: Boolean(output) };
  }

  async output(id: string): Promise<string> {
    const j = await this.mustJob(id);
    if (j.status !== 'done' || !j.output)
      throw new PrintingValidationError(`الطلب لسه "${j.status}"`);
    return j.output;
  }

  async list(): Promise<Array<Omit<typeof printJob.$inferSelect, 'output'>>> {
    const rows = await this.database.db
      .select()
      .from(printJob)
      .orderBy(desc(printJob.createdAt))
      .limit(50);
    return rows.map(({ output: _o, ...r }) => {
      void _o;
      return r;
    });
  }

  /** Renders every document (drafts / cancelled are skipped with the reason), joins them page by page, and prints. */
  async run(id: string): Promise<void> {
    const db = this.database.db;
    const job = await this.mustJob(id);
    await db.update(printJob).set({ status: 'running' }).where(eq(printJob.id, id));
    const pages: string[] = [];
    const skipped: Array<{ documentId: string; reason: string }> = [];
    let done = 0;
    for (const documentId of job.documentIds) {
      try {
        const html = await this.printing.render({
          documentType: job.documentType,
          documentId,
          formatId: job.printFormatId ?? undefined,
        });
        pages.push(html.replace(/^[\s\S]*?<body>/, '').replace(/<\/body>[\s\S]*$/, ''));
      } catch (e) {
        skipped.push({ documentId, reason: (e as Error).message });
      }
      done++;
      if (done % 10 === 0)
        await db.update(printJob).set({ done, skipped }).where(eq(printJob.id, id));
    }
    const output = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>.page{page-break-after:always}.page:last-child{page-break-after:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px}</style></head><body>${pages.map((p) => `<section class="page">${p}</section>`).join('')}</body></html>`;
    let status: 'done' | 'failed' = pages.length > 0 ? 'done' : 'failed';
    let error: string | null = pages.length > 0 ? null : 'لا مستند اتطبع';
    if (pages.length > 0 && job.printerId) {
      const p = (await db.select().from(printer).where(eq(printer.id, job.printerId)).limit(1))[0];
      if (p) {
        try {
          const text = pages.map((pg) => htmlToText(pg)).join('\n\f');
          await sendRaw(p.host, p.port, Buffer.from(`${text}\n\f`, 'utf8'));
        } catch (e) {
          status = 'failed';
          error = (e as Error).message;
        }
      }
    }
    await db
      .update(printJob)
      .set({
        status,
        done,
        skipped,
        output: pages.length > 0 ? output : null,
        error,
        finishedAt: new Date(),
      })
      .where(eq(printJob.id, id));
  }

  private async mustJob(id: string): Promise<typeof printJob.$inferSelect> {
    const j = (
      await this.database.db.select().from(printJob).where(eq(printJob.id, id)).limit(1)
    )[0];
    if (!j) throw new PrintingNotFoundError(`print job ${id} does not exist`);
    return j;
  }
}
