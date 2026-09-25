import { Injectable, Optional } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AppConfigService } from '../../../core/config/app-config.service';
import { DatabaseService } from '../../../core/database/database.service';
import { CatalogService } from '../../catalog/catalog.service';
import { FinanceService } from '../../finance/finance.service';
import {
  buildEtaDocument,
  etaDocumentUuid,
  etaProblems,
  type EtaInvoiceInput,
} from './eta.document';
import { etaDocument, etaIssuerConfig, etaItemCode, etaPartyProfile } from './egypt.schema';

export class EgyptNotFoundError extends Error {
  constructor(m: string) {
    super(m);
    this.name = 'EgyptNotFoundError';
  }
}
export class EgyptValidationError extends Error {
  constructor(m: string) {
    super(m);
    this.name = 'EgyptValidationError';
  }
}

type DocRow = typeof etaDocument.$inferSelect;

/** Egyptian e-invoicing regional layer (plan item 48): prepare → sign (external) → submit to ETA. */
@Injectable()
export class EgyptEinvoiceService {
  constructor(
    private readonly database: DatabaseService,
    private readonly finance: FinanceService,
    @Optional() private readonly catalog?: CatalogService,
    @Optional() private readonly config?: AppConfigService,
  ) {}

  async setIssuer(
    input: typeof etaIssuerConfig.$inferInsert,
  ): Promise<typeof etaIssuerConfig.$inferSelect> {
    const values = { ...input, updatedAt: new Date() };
    return (
      await this.database.db
        .insert(etaIssuerConfig)
        .values(values)
        .onConflictDoUpdate({ target: etaIssuerConfig.orgNodeId, set: values })
        .returning()
    )[0]!;
  }

  async setParty(
    customerId: string,
    input: Omit<typeof etaPartyProfile.$inferInsert, 'customerId'>,
  ): Promise<typeof etaPartyProfile.$inferSelect> {
    const values = { ...input, customerId };
    return (
      await this.database.db
        .insert(etaPartyProfile)
        .values(values)
        .onConflictDoUpdate({ target: etaPartyProfile.customerId, set: values })
        .returning()
    )[0]!;
  }

  async setItemCode(
    itemId: string,
    input: Omit<typeof etaItemCode.$inferInsert, 'itemId'>,
  ): Promise<typeof etaItemCode.$inferSelect> {
    if (this.catalog)
      await this.catalog.getItem(itemId).catch(() => {
        throw new EgyptNotFoundError(`item ${itemId} does not exist`);
      });
    const values = { ...input, itemId };
    return (
      await this.database.db
        .insert(etaItemCode)
        .values(values)
        .onConflictDoUpdate({ target: etaItemCode.itemId, set: values })
        .returning()
    )[0]!;
  }

  /** Builds and checks the ETA document for a posted sales invoice. Problems keep it in "draft". */
  async prepare(salesInvoiceId: string): Promise<DocRow> {
    const db = this.database.db;
    const inv = await this.finance.getSalesInvoice(salesInvoiceId).catch(() => {
      throw new EgyptNotFoundError(`sales invoice ${salesInvoiceId} does not exist`);
    });
    if (inv.status !== 'posted')
      throw new EgyptValidationError(
        `الفاتورة ${inv.invoiceNumber} لازم تكون مرحّلة قبل الفاتورة الإلكترونية`,
      );
    const existing = (
      await db
        .select()
        .from(etaDocument)
        .where(eq(etaDocument.salesInvoiceId, salesInvoiceId))
        .limit(1)
    )[0];
    if (existing && existing.status === 'submitted')
      throw new EgyptValidationError('الفاتورة اتبعتت لمصلحة الضرائب بالفعل');
    const issuer = (
      await db
        .select()
        .from(etaIssuerConfig)
        .where(eq(etaIssuerConfig.orgNodeId, inv.orgNodeId))
        .limit(1)
    )[0];
    if (!issuer)
      throw new EgyptValidationError(
        'بيانات الشركة للفاتورة الإلكترونية مش متسجلة (PUT regional/eg/issuer)',
      );
    const party = (
      await db
        .select()
        .from(etaPartyProfile)
        .where(eq(etaPartyProfile.customerId, inv.customerId))
        .limit(1)
    )[0];
    const lines: EtaInvoiceInput['lines'] = [];
    for (const l of inv.lines ?? []) {
      const code = (
        await db.select().from(etaItemCode).where(eq(etaItemCode.itemId, l.itemId)).limit(1)
      )[0];
      const item = this.catalog ? await this.catalog.getItem(l.itemId).catch(() => null) : null;
      lines.push({
        description: item?.name ?? l.itemId,
        itemType: (code?.itemType as 'EGS' | 'GS1') ?? 'EGS',
        itemCode: code?.itemCode ?? '',
        internalCode: item?.code ?? l.itemId,
        unitType: code?.unitType ?? 'EA',
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        taxRate: Number(l.taxRate ?? 0),
        taxSubType: code?.taxSubType ?? 'V009',
      });
    }
    const input: EtaInvoiceInput = {
      documentType: 'I',
      version: issuer.documentVersion as '0.9' | '1.0',
      internalId: inv.invoiceNumber,
      dateTimeIssued: new Date(inv.invoiceDate).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      issuer: {
        rin: issuer.rin,
        name: issuer.name,
        activityCode: issuer.activityCode,
        address: issuer.address,
      },
      receiver: party
        ? {
            type: party.receiverType as 'B' | 'P' | 'F',
            id: party.taxId,
            name: party.name,
            address: party.address ?? null,
          }
        : { type: 'P', id: null, name: 'عميل نقدي', address: null },
      lines,
    };
    const problems = etaProblems(input);
    const payload = buildEtaDocument(input);
    const values = {
      salesInvoiceId,
      payload,
      problems,
      documentUuid: etaDocumentUuid(payload),
      signature: null,
      submissionUuid: null,
      response: null,
      status: problems.length > 0 ? 'draft' : 'ready',
      updatedAt: new Date(),
    };
    return (
      await db
        .insert(etaDocument)
        .values(values)
        .onConflictDoUpdate({ target: etaDocument.salesInvoiceId, set: values })
        .returning()
    )[0]!;
  }

  /** The CAdES-BES signature comes from the taxpayer's signing token (outside the ERP). */
  async attachSignature(salesInvoiceId: string, signature: string): Promise<DocRow> {
    const d = await this.doc(salesInvoiceId);
    if (d.status !== 'ready')
      throw new EgyptValidationError(`المستند "${d.status}" — لازم يبقى جاهز (ready) الأول`);
    if (!signature?.trim()) throw new EgyptValidationError('signature is required');
    return (
      await this.database.db
        .update(etaDocument)
        .set({ signature: signature.trim(), status: 'signed', updatedAt: new Date() })
        .where(eq(etaDocument.id, d.id))
        .returning()
    )[0]!;
  }

  /** Submits to ETA (token → documentsubmissions). v1.0 needs a signature; v0.9 (pre-production) does not. */
  async submit(salesInvoiceId: string): Promise<DocRow> {
    const d = await this.doc(salesInvoiceId);
    const version = (d.payload?.documentTypeVersion as string) ?? '1.0';
    if (d.status === 'draft')
      throw new EgyptValidationError(`المستند فيه مشاكل: ${d.problems.join('، ')}`);
    if (version === '1.0' && d.status !== 'signed')
      throw new EgyptValidationError('نسخة 1.0 لازم تتوقّع قبل الإرسال');
    if (d.status === 'submitted') throw new EgyptValidationError('اتبعتت بالفعل');
    const eta = this.config?.eta;
    if (!eta)
      throw new EgyptValidationError(
        'بيانات الربط مع مصلحة الضرائب (ETA_ID_SRV_URL / ETA_API_URL / ETA_CLIENT_ID / ETA_CLIENT_SECRET) مش متحددة',
      );
    const doc = d.signature
      ? { ...d.payload, signatures: [{ signatureType: 'I', value: d.signature }] }
      : d.payload;
    let response: unknown;
    try {
      const tokenRes = await fetch(`${eta.idSrvUrl.replace(/\/$/, '')}/connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: eta.clientId,
          client_secret: eta.clientSecret,
          scope: 'InvoicingAPI',
        }),
      });
      const token = (await tokenRes.json()) as { access_token?: string };
      if (!token.access_token) throw new Error(`login failed (${tokenRes.status})`);
      const res = await fetch(`${eta.apiUrl.replace(/\/$/, '')}/api/v1/documentsubmissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.access_token}`,
        },
        body: JSON.stringify({ documents: [doc] }),
      });
      response = await res.json().catch(() => ({ status: res.status }));
      const accepted =
        (response as { acceptedDocuments?: Array<{ uuid: string }>; submissionId?: string })
          .acceptedDocuments ?? [];
      const status = res.ok && accepted.length > 0 ? 'submitted' : 'rejected';
      return (
        await this.database.db
          .update(etaDocument)
          .set({
            status,
            response,
            submissionUuid: (response as { submissionId?: string }).submissionId ?? null,
            updatedAt: new Date(),
          })
          .where(eq(etaDocument.id, d.id))
          .returning()
      )[0]!;
    } catch (err) {
      throw new EgyptValidationError(`الإرسال لمصلحة الضرائب فشل: ${(err as Error).message}`);
    }
  }

  async list(): Promise<DocRow[]> {
    return this.database.db.select().from(etaDocument);
  }

  private async doc(salesInvoiceId: string): Promise<DocRow> {
    const d = (
      await this.database.db
        .select()
        .from(etaDocument)
        .where(eq(etaDocument.salesInvoiceId, salesInvoiceId))
        .limit(1)
    )[0];
    if (!d) throw new EgyptNotFoundError('الفاتورة الإلكترونية لسه ماتجهزتش (prepare)');
    return d;
  }
}
