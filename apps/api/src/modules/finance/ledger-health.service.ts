import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { AppConfigService } from '../../core/config/app-config.service';
import { DatabaseService } from '../../core/database/database.service';
import { companyAccountingConfig, journalEntry, journalLine } from '../accounting/accounting.schema';
import { bankTransfer, collection, creditDebitNote, ledgerHealth, payment, purchaseInvoice, salesInvoice } from './finance.schema';

export type LedgerCheck = 'debit_credit_mismatch' | 'missing_gl_entry' | 'orphan_gl_entry';
export interface LedgerIssue {
  issueKey: string; checkType: LedgerCheck; documentType: string | null; documentId: string | null; documentNumber: string | null;
  journalEntryId: string | null; orgNodeId: string | null; details: string;
}
export interface BookedDocument { type: string; id: string; number: string; orgNodeId: string | null; idempotencyKey: string; }
export interface GlEntry { id: string; entryNumber: string; orgNodeId: string | null; idempotencyKey: string | null; sourceEventType: string | null; debit: number; credit: number; }

/** Source events whose entries belong to a finance document (their idempotency key names it). */
const FINANCE_SOURCES = ['sales_invoice', 'purchase_invoice', 'payment', 'credit_note', 'debit_note', 'bank_transfer', 'collection'];

/** The two books compared (pure): every booked document has its posted entry, every such entry its document, and debits = credits. */
export function findLedgerIssues(docs: BookedDocument[], entries: GlEntry[], companiesWithAccounting: Set<string>): LedgerIssue[] {
  const issues: LedgerIssue[] = [];
  const byKey = new Map(entries.filter((e) => e.idempotencyKey).map((e) => [e.idempotencyKey!, e]));
  const docKeys = new Set(docs.map((d) => d.idempotencyKey));
  for (const e of entries) {
    if (Math.abs(e.debit - e.credit) > 0.0001) {
      issues.push({ issueKey: `dc:${e.id}`, checkType: 'debit_credit_mismatch', documentType: null, documentId: null, documentNumber: null,
        journalEntryId: e.id, orgNodeId: e.orgNodeId, details: `القيد ${e.entryNumber} مش متوازن: مدين ${e.debit.toFixed(4)} ≠ دائن ${e.credit.toFixed(4)}` });
    }
    if (e.sourceEventType && FINANCE_SOURCES.includes(e.sourceEventType) && e.idempotencyKey && !docKeys.has(e.idempotencyKey)) {
      issues.push({ issueKey: `orphan:${e.id}`, checkType: 'orphan_gl_entry', documentType: e.sourceEventType, documentId: null, documentNumber: null,
        journalEntryId: e.id, orgNodeId: e.orgNodeId, details: `القيد ${e.entryNumber} (${e.sourceEventType}) ملوش مستند مرحّل مقابل` });
    }
  }
  for (const d of docs) {
    if (!d.orgNodeId || !companiesWithAccounting.has(d.orgNodeId)) continue; // the company does not keep books in Motion
    if (!byKey.has(d.idempotencyKey)) {
      issues.push({ issueKey: `missing:${d.type}:${d.id}`, checkType: 'missing_gl_entry', documentType: d.type, documentId: d.id, documentNumber: d.number,
        journalEntryId: null, orgNodeId: d.orgNodeId, details: `المستند ${d.number} (${d.type}) مرحّل ومفيش له قيد في دفتر الأستاذ` });
    }
  }
  return issues;
}

/** Ledger health (plan item 37): compares the document books with the general ledger and logs every discrepancy. */
@Injectable()
export class LedgerHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LedgerHealthService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly database: DatabaseService, @Optional() private readonly config?: AppConfigService) {}

  onModuleInit(): void {
    const minutes = this.config?.ledgerHealthIntervalMinutes ?? 0;
    if (minutes > 0) {
      this.timer = setInterval(() => {
        this.run().catch((err: unknown) => this.logger.error(`ledger health run failed: ${String(err)}`));
      }, minutes * 60_000);
      this.timer.unref();
      this.logger.log(`ledger health runs every ${minutes} minute(s)`);
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<{ checkedDocuments: number; checkedEntries: number; open: number; newlyFound: number; resolved: number }> {
    const db = this.database.db;
    const docs: BookedDocument[] = [
      ...(await db.select({ id: salesInvoice.id, n: salesInvoice.invoiceNumber, o: salesInvoice.orgNodeId }).from(salesInvoice).where(eq(salesInvoice.status, 'posted')))
        .map((r) => ({ type: 'sales_invoice', id: r.id, number: r.n, orgNodeId: r.o, idempotencyKey: `sales-invoice-${r.id}` })),
      ...(await db.select({ id: purchaseInvoice.id, n: purchaseInvoice.systemNumber, o: purchaseInvoice.orgNodeId }).from(purchaseInvoice).where(eq(purchaseInvoice.status, 'posted')))
        .map((r) => ({ type: 'purchase_invoice', id: r.id, number: r.n, orgNodeId: r.o, idempotencyKey: `purchase-invoice-${r.id}` })),
      ...(await db.select({ id: payment.id, n: payment.paymentNumber, o: payment.orgNodeId }).from(payment).where(eq(payment.status, 'posted')))
        .map((r) => ({ type: 'payment', id: r.id, number: r.n, orgNodeId: r.o, idempotencyKey: `payment-${r.id}` })),
      ...(await db.select({ id: creditDebitNote.id, n: creditDebitNote.noteNumber, o: creditDebitNote.orgNodeId, t: creditDebitNote.noteType }).from(creditDebitNote).where(eq(creditDebitNote.status, 'posted')))
        .map((r) => ({ type: r.t, id: r.id, number: r.n, orgNodeId: r.o, idempotencyKey: `${r.t === 'credit_note' ? 'credit-note' : 'debit-note'}-${r.id}` })),
      ...(await db.select({ id: bankTransfer.id, n: bankTransfer.transferNumber, o: bankTransfer.orgNodeId }).from(bankTransfer).where(eq(bankTransfer.status, 'posted')))
        .map((r) => ({ type: 'bank_transfer', id: r.id, number: r.n, orgNodeId: r.o, idempotencyKey: `bank-transfer-${r.id}` })),
      ...(await db.select({ id: collection.id, n: collection.collectionNumber, o: collection.orgNodeId, s: collection.status }).from(collection))
        .filter((r) => r.s !== 'cancelled')
        .map((r) => ({ type: 'collection', id: r.id, number: r.n, orgNodeId: r.o, idempotencyKey: `collection-${r.id}` })),
    ];
    const totals = await db.select({
      id: journalEntry.id, entryNumber: journalEntry.entryNumber, orgNodeId: journalEntry.orgNodeId, idempotencyKey: journalEntry.idempotencyKey,
      sourceEventType: journalEntry.sourceEventType,
      debit: sql<string>`coalesce(sum(${journalLine.debitAmount}), 0)`, credit: sql<string>`coalesce(sum(${journalLine.creditAmount}), 0)`,
    }).from(journalEntry).leftJoin(journalLine, eq(journalLine.journalEntryId, journalEntry.id))
      .where(eq(journalEntry.status, 'posted'))
      .groupBy(journalEntry.id, journalEntry.entryNumber, journalEntry.orgNodeId, journalEntry.idempotencyKey, journalEntry.sourceEventType);
    const entries: GlEntry[] = totals.map((t) => ({ ...t, debit: Number(t.debit), credit: Number(t.credit) }));
    const companies = new Set((await db.select({ o: companyAccountingConfig.orgNodeId }).from(companyAccountingConfig)).map((r) => r.o));

    const found = findLedgerIssues(docs, entries, companies);
    const foundKeys = new Set(found.map((i) => i.issueKey));
    const open = await db.select({ id: ledgerHealth.id, issueKey: ledgerHealth.issueKey }).from(ledgerHealth).where(isNull(ledgerHealth.resolvedAt));
    const openKeys = new Set(open.map((o) => o.issueKey));
    const now = new Date();

    const toResolve = open.filter((o) => !foundKeys.has(o.issueKey)).map((o) => o.id);
    if (toResolve.length > 0) await db.update(ledgerHealth).set({ resolvedAt: now }).where(inArray(ledgerHealth.id, toResolve));
    const fresh = found.filter((i) => !openKeys.has(i.issueKey));
    if (fresh.length > 0) await db.insert(ledgerHealth).values(fresh.map((i) => ({ ...i, detectedAt: now, lastSeenAt: now })));
    const still = open.filter((o) => foundKeys.has(o.issueKey)).map((o) => o.id);
    if (still.length > 0) await db.update(ledgerHealth).set({ lastSeenAt: now }).where(inArray(ledgerHealth.id, still));

    if (fresh.length > 0) this.logger.warn(`ledger health: ${fresh.length} new discrepancy(ies)`);
    return { checkedDocuments: docs.length, checkedEntries: entries.length, open: found.length, newlyFound: fresh.length, resolved: toResolve.length };
  }

  async list(onlyOpen = true): Promise<Array<typeof ledgerHealth.$inferSelect>> {
    if (onlyOpen) return this.database.db.select().from(ledgerHealth).where(isNull(ledgerHealth.resolvedAt)).orderBy(desc(ledgerHealth.detectedAt));
    return this.database.db.select().from(ledgerHealth).orderBy(desc(ledgerHealth.detectedAt));
  }
}
