import { Injectable, Optional } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { requestContext } from '../../core/request-context/request-context';
import { CatalogService } from '../catalog/catalog.service';
import { FinanceNotFoundError } from '../finance/finance.errors';
import { FinanceService } from '../finance/finance.service';
import { SettingsService } from '../settings/settings.service';
import { letterhead, printFormat, printLog } from './printing.schema';
import { checkTemplate, escapeHtml, renderTemplate } from './template.engine';

export class PrintingNotFoundError extends Error { constructor(m: string) { super(m); this.name = 'PrintingNotFoundError'; } }
export class PrintingValidationError extends Error { constructor(m: string) { super(m); this.name = 'PrintingValidationError'; } }

type Doc = { status?: string; orgNodeId?: string | null } & Record<string, unknown>;

/** Generic printing (plan item 47): letterhead + template, several templates per document, no drafts / cancelled. */
@Injectable()
export class PrintingService {
  constructor(
    private readonly database: DatabaseService,
    @Optional() private readonly finance?: FinanceService,
    @Optional() private readonly settings?: SettingsService,
    @Optional() private readonly catalog?: CatalogService,
  ) {}

  async createLetterhead(input: { orgNodeId: string; name: string; headerHtml?: string; footerHtml?: string; isDefault?: boolean }): Promise<typeof letterhead.$inferSelect> {
    try { checkTemplate(input.headerHtml ?? ''); checkTemplate(input.footerHtml ?? ''); } catch (e) { throw new PrintingValidationError((e as Error).message); }
    if (input.isDefault) await this.database.db.update(letterhead).set({ isDefault: false }).where(eq(letterhead.orgNodeId, input.orgNodeId));
    return (await this.database.db.insert(letterhead).values({ orgNodeId: input.orgNodeId, name: input.name.trim(), headerHtml: input.headerHtml ?? '', footerHtml: input.footerHtml ?? '', isDefault: input.isDefault ?? false }).returning())[0]!;
  }

  async createFormat(input: { code: string; name: string; documentType: string; template: string; css?: string; letterheadId?: string; isDefault?: boolean; allowDraft?: boolean; allowCancelled?: boolean }): Promise<typeof printFormat.$inferSelect> {
    try { checkTemplate(input.template); } catch (e) { throw new PrintingValidationError((e as Error).message); }
    if (input.css && /<\/?style|<script/i.test(input.css)) throw new PrintingValidationError('css must be plain CSS');
    if (input.isDefault) await this.database.db.update(printFormat).set({ isDefault: false }).where(eq(printFormat.documentType, input.documentType));
    return (await this.database.db.insert(printFormat).values({
      code: input.code.trim(), name: input.name.trim(), documentType: input.documentType, template: input.template, css: input.css ?? '',
      letterheadId: input.letterheadId ?? null, isDefault: input.isDefault ?? false, allowDraft: input.allowDraft ?? false, allowCancelled: input.allowCancelled ?? false,
    }).returning())[0]!;
  }

  async listFormats(documentType?: string): Promise<Array<typeof printFormat.$inferSelect>> {
    const q = this.database.db.select().from(printFormat);
    return documentType ? q.where(eq(printFormat.documentType, documentType)).orderBy(asc(printFormat.code)) : q.orderBy(asc(printFormat.code));
  }

  async listLetterheads(orgNodeId?: string): Promise<Array<typeof letterhead.$inferSelect>> {
    const q = this.database.db.select().from(letterhead);
    return orgNodeId ? q.where(eq(letterhead.orgNodeId, orgNodeId)) : q;
  }

  /** Renders a printable HTML page. The document comes from a built-in source (by id) or is passed as `data`. */
  async render(input: { documentType: string; documentId?: string; data?: Doc; formatId?: string; letterheadId?: string | null }): Promise<string> {
    const db = this.database.db;
    const format = input.formatId
      ? (await db.select().from(printFormat).where(eq(printFormat.id, input.formatId)).limit(1))[0]
      : (await db.select().from(printFormat).where(and(eq(printFormat.documentType, input.documentType), eq(printFormat.isDefault, true))).limit(1))[0];
    if (!format) throw new PrintingNotFoundError(`no print format for "${input.documentType}"`);
    if (format.documentType !== input.documentType) throw new PrintingValidationError(`format ${format.code} is for "${format.documentType}"`);
    const doc = input.documentId ? await this.load(input.documentType, input.documentId) : input.data;
    if (!doc) throw new PrintingValidationError('documentId or data is required');
    if (doc.status === 'draft' && !format.allowDraft) throw new PrintingValidationError('مينفعش طباعة مستند مسودة — رحّله الأول');
    if (doc.status === 'cancelled' && !format.allowCancelled) throw new PrintingValidationError('مينفعش طباعة مستند ملغي');

    const company = doc.orgNodeId && this.settings ? await this.settings.getCompanyProfile(doc.orgNodeId).catch(() => null) : null;
    const companyData = { name: company?.displayName ?? '', logoUrl: company?.logoUrl ?? '' };
    // letterhead: explicit (null = none) → the format's → the company's default
    let lh: typeof letterhead.$inferSelect | undefined;
    if (input.letterheadId !== null) {
      const lhId = input.letterheadId ?? format.letterheadId;
      lh = lhId
        ? (await db.select().from(letterhead).where(eq(letterhead.id, lhId)).limit(1))[0]
        : doc.orgNodeId ? (await db.select().from(letterhead).where(and(eq(letterhead.orgNodeId, doc.orgNodeId), eq(letterhead.isDefault, true))).limit(1))[0] : undefined;
    }
    const data = { ...doc, company: companyData };
    const body = renderTemplate(format.template, data);
    const header = lh ? renderTemplate(lh.headerHtml, data) : '';
    const footer = lh ? renderTemplate(lh.footerHtml, data) : '';
    await db.insert(printLog).values({ documentType: input.documentType, documentId: input.documentId ?? null, printFormatId: format.id, userId: requestContext.currentUserId() ?? null });
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(format.name)}</title>
<style>@page{size:A4;margin:18mm 14mm}body{font-family:Tahoma,Arial,sans-serif;font-size:12px}header,footer{width:100%}footer{position:fixed;bottom:0}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px}${format.css}</style></head>
<body>${header ? `<header>${header}</header>` : ''}<main>${body}</main>${footer ? `<footer>${footer}</footer>` : ''}</body></html>`;
  }

  /** Adds itemCode / itemName to every line so templates can print names instead of ids. */
  private async withItemNames(doc: Doc): Promise<Doc> {
    const lines = Array.isArray(doc['lines']) ? (doc['lines'] as Array<Record<string, unknown>>) : [];
    if (!this.catalog || lines.length === 0) return doc;
    const out = [];
    for (const l of lines) {
      const item = typeof l['itemId'] === 'string' ? await this.catalog.getItem(l['itemId']).catch(() => null) : null;
      out.push({ ...l, itemCode: item?.code ?? '', itemName: item?.name ?? '' });
    }
    return { ...doc, lines: out };
  }

  /** Built-in document sources. */
  private async load(documentType: string, id: string): Promise<Doc> {
    if (!this.finance) throw new PrintingValidationError('document sources are not available — pass data instead');
    try {
      if (documentType === 'sales_invoice') return this.withItemNames((await this.finance.getSalesInvoice(id)) as unknown as Doc);
      if (documentType === 'purchase_invoice') return this.withItemNames((await this.finance.getPurchaseInvoice(id)) as unknown as Doc);
      if (documentType === 'payment') return (await this.finance.getPayment(id)) as unknown as Doc;
    } catch (e) {
      if (e instanceof FinanceNotFoundError) throw new PrintingNotFoundError(e.message);
      throw e;
    }
    throw new PrintingValidationError(`no built-in source for "${documentType}" — pass the document as data`);
  }
}
