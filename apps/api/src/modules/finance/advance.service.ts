import { Injectable, Optional } from '@nestjs/common';
import { and, eq, ne, sql } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { AccountingRepository } from '../accounting/accounting.repository';
import { AccountingService } from '../accounting/accounting.service';
import { SalesService } from '../sales/sales.service';
import { FinanceNotFoundError, FinanceValidationError } from './finance.errors';
import {
  advanceAllocation,
  collection,
  payment,
  purchaseInvoice,
  salesInvoice,
} from './finance.schema';

export interface AdvanceAccounts {
  receivedAccountId: string | null;
  paidAccountId: string | null;
}
export interface OpenAdvance {
  partyType: 'customer' | 'supplier';
  documentId: string;
  documentNumber: string;
  partyReference: string | null;
  advance: string;
  allocated: string;
  remaining: string;
}

/** How much of a customer receipt settles invoices and how much is an advance (pure). */
export function splitReceipt(
  amount: number,
  invoiced: number,
  alreadyCovered: number,
): { settle: number; advance: number } {
  const capacity = Math.max(0, invoiced - alreadyCovered);
  const settle = Math.min(amount, capacity);
  return { settle: Number(settle.toFixed(4)), advance: Number((amount - settle).toFixed(4)) };
}

const sum = (rows: Array<{ v: string | null }>): number =>
  rows.reduce((s, r) => s + Number(r.v ?? 0), 0);

/**
 * Advances booked in their own party accounts (plan item 38, ERPNext "Book Advance Payments in
 * Separate Party Account"): a receipt beyond what is invoiced sits in a liability account and a
 * payment with no invoice in an asset account, until allocated to an invoice by a reclass entry.
 * Off unless the company turns on bookAdvancesSeparately and sets the account.
 */
@Injectable()
export class AdvanceService {
  constructor(
    private readonly database: DatabaseService,
    @Optional() private readonly accounting?: AccountingService,
    @Optional() private readonly accountingRepo?: AccountingRepository,
    @Optional() private readonly sales?: SalesService,
  ) {}

  async accounts(orgNodeId: string | null): Promise<AdvanceAccounts | null> {
    if (!orgNodeId || !this.accountingRepo) return null;
    const c = await this.accountingRepo.findCompanyConfig(orgNodeId);
    if (!c?.bookAdvancesSeparately) return null;
    return {
      receivedAccountId: c.defaultAdvanceReceivedAccountId ?? null,
      paidAccountId: c.defaultAdvancePaidAccountId ?? null,
    };
  }

  /** Split for a new collection against a job order: what posted invoices still leave open is settled, the rest is advance. */
  async splitCollection(
    jobOrderReference: string,
    amount: number,
  ): Promise<{ settle: number; advance: number }> {
    const db = this.database.db;
    const invoices = await db
      .select({ id: salesInvoice.id, v: salesInvoice.grandTotal })
      .from(salesInvoice)
      .where(
        and(
          eq(salesInvoice.jobOrderReference, jobOrderReference),
          eq(salesInvoice.status, 'posted'),
        ),
      );
    const settledBefore = await db
      .select({ v: sql<string>`${collection.amount} - ${collection.advanceAmount}` })
      .from(collection)
      .where(
        and(
          eq(collection.jobOrderReference, jobOrderReference),
          ne(collection.status, 'cancelled'),
        ),
      );
    let allocated = 0;
    for (const inv of invoices)
      allocated += sum(
        await db
          .select({ v: advanceAllocation.amount })
          .from(advanceAllocation)
          .where(eq(advanceAllocation.salesInvoiceId, inv.id)),
      );
    return splitReceipt(amount, sum(invoices), sum(settledBefore) + allocated);
  }

  async setCollectionAdvance(id: string, advance: number): Promise<void> {
    await this.database.db
      .update(collection)
      .set({ advanceAmount: advance.toFixed(4) })
      .where(eq(collection.id, id));
  }

  async setPaymentAdvance(id: string, advance: number): Promise<void> {
    await this.database.db
      .update(payment)
      .set({ advanceAmount: advance.toFixed(4) })
      .where(eq(payment.id, id));
  }

  async openAdvances(partyType: 'customer' | 'supplier'): Promise<OpenAdvance[]> {
    const db = this.database.db;
    const out: OpenAdvance[] = [];
    if (partyType === 'customer') {
      const rows = await db
        .select()
        .from(collection)
        .where(and(ne(collection.status, 'cancelled'), sql`${collection.advanceAmount} > 0`));
      for (const r of rows) {
        const allocated = sum(
          await db
            .select({ v: advanceAllocation.amount })
            .from(advanceAllocation)
            .where(
              and(eq(advanceAllocation.collectionId, r.id), eq(advanceAllocation.kind, 'advance')),
            ),
        );
        out.push(
          this.open(
            'customer',
            r.id,
            r.collectionNumber,
            r.jobOrderReference,
            Number(r.advanceAmount),
            allocated,
          ),
        );
      }
    } else {
      const rows = await db
        .select()
        .from(payment)
        .where(and(eq(payment.status, 'posted'), sql`${payment.advanceAmount} > 0`));
      for (const r of rows) {
        const allocated = sum(
          await db
            .select({ v: advanceAllocation.amount })
            .from(advanceAllocation)
            .where(
              and(eq(advanceAllocation.paymentId, r.id), eq(advanceAllocation.kind, 'advance')),
            ),
        );
        out.push(
          this.open(
            'supplier',
            r.id,
            r.paymentNumber,
            r.supplierId,
            Number(r.advanceAmount),
            allocated,
          ),
        );
      }
    }
    return out.filter((a) => Number(a.remaining) > 0);
  }

  /** Customer advance → sales invoice: Dr advances received / Cr receivable. */
  async allocateCollection(
    collectionId: string,
    salesInvoiceId: string,
    amountRaw: string,
    installmentNumber: number | null = null,
  ): Promise<{ allocationId: string; journalEntryId: string | null }> {
    const db = this.database.db;
    const amount = this.positive(amountRaw);
    const col = (
      await db.select().from(collection).where(eq(collection.id, collectionId)).limit(1)
    )[0];
    if (!col || col.status === 'cancelled')
      throw new FinanceNotFoundError(`collection ${collectionId} does not exist`);
    const inv = (
      await db.select().from(salesInvoice).where(eq(salesInvoice.id, salesInvoiceId)).limit(1)
    )[0];
    if (!inv) throw new FinanceNotFoundError(`sales invoice ${salesInvoiceId} does not exist`);
    if (inv.status !== 'posted')
      throw new FinanceValidationError(
        `sales invoice ${inv.invoiceNumber} is "${inv.status}" — only a posted invoice takes an advance`,
      );
    await this.sameCustomer(col.jobOrderReference, inv.customerId, inv.jobOrderReference);
    const remaining =
      Number(col.advanceAmount) -
      sum(
        await db
          .select({ v: advanceAllocation.amount })
          .from(advanceAllocation)
          .where(
            and(eq(advanceAllocation.collectionId, col.id), eq(advanceAllocation.kind, 'advance')),
          ),
      );
    if (amount > remaining + 0.0001)
      throw new FinanceValidationError(
        `المتبقي من دفعة ${col.collectionNumber} المقدمة ${remaining.toFixed(4)} بس`,
      );
    const covered = sum(
      await db
        .select({ v: advanceAllocation.amount })
        .from(advanceAllocation)
        .where(eq(advanceAllocation.salesInvoiceId, inv.id)),
    );
    if (amount > Number(inv.grandTotal) - covered + 0.0001)
      throw new FinanceValidationError(
        `الفاتورة ${inv.invoiceNumber} متبقي منها ${(Number(inv.grandTotal) - covered).toFixed(4)} بس`,
      );

    const acc = await this.accounts(col.orgNodeId);
    const ar = await this.partyAccount(col.orgNodeId, 'receivable');
    let journalEntryId: string | null = null;
    if (acc?.receivedAccountId && ar && col.orgNodeId && this.accounting) {
      const e = await this.accounting.createEntry({
        orgNodeId: col.orgNodeId,
        description: `[Auto] تسوية دفعة مقدمة ${col.collectionNumber} على الفاتورة ${inv.invoiceNumber}`,
        reference: col.collectionNumber,
        isAutoGenerated: true,
        sourceEventType: 'advance_allocation',
        idempotencyKey: `advance-alloc-${col.id}-${inv.id}-${Date.now()}`,
        lines: [
          {
            accountId: acc.receivedAccountId,
            debitAmount: amount.toFixed(4),
            creditAmount: '0',
            partyType: 'customer',
            partyId: inv.customerId ?? undefined,
            description: '[Auto] Advance applied',
          },
          {
            accountId: ar,
            debitAmount: '0',
            creditAmount: amount.toFixed(4),
            partyType: 'customer',
            partyId: inv.customerId ?? undefined,
            description: '[Auto] AR settled by advance',
          },
        ],
      });
      journalEntryId = (await this.accounting.postEntry(e.id)).id;
    }
    const row = await db
      .insert(advanceAllocation)
      .values({
        partyType: 'customer',
        collectionId: col.id,
        salesInvoiceId: inv.id,
        amount: amount.toFixed(4),
        journalEntryId,
        installmentNumber,
      })
      .returning({ id: advanceAllocation.id });
    return { allocationId: row[0]!.id, journalEntryId };
  }

  /** Supplier advance → purchase invoice: Dr payable / Cr advances paid. */
  async allocatePayment(
    paymentId: string,
    purchaseInvoiceId: string,
    amountRaw: string,
    installmentNumber: number | null = null,
  ): Promise<{ allocationId: string; journalEntryId: string | null }> {
    const db = this.database.db;
    const amount = this.positive(amountRaw);
    const p = (await db.select().from(payment).where(eq(payment.id, paymentId)).limit(1))[0];
    if (!p || p.status !== 'posted')
      throw new FinanceNotFoundError(`posted payment ${paymentId} does not exist`);
    const inv = (
      await db
        .select()
        .from(purchaseInvoice)
        .where(eq(purchaseInvoice.id, purchaseInvoiceId))
        .limit(1)
    )[0];
    if (!inv)
      throw new FinanceNotFoundError(`purchase invoice ${purchaseInvoiceId} does not exist`);
    if (inv.status !== 'posted')
      throw new FinanceValidationError(
        `purchase invoice ${inv.systemNumber} is "${inv.status}" — only a posted invoice takes an advance`,
      );
    if (p.supplierId !== inv.supplierId)
      throw new FinanceValidationError('الدفعة والفاتورة لموردين مختلفين');
    const remaining =
      Number(p.advanceAmount) -
      sum(
        await db
          .select({ v: advanceAllocation.amount })
          .from(advanceAllocation)
          .where(and(eq(advanceAllocation.paymentId, p.id), eq(advanceAllocation.kind, 'advance'))),
      );
    if (amount > remaining + 0.0001)
      throw new FinanceValidationError(
        `المتبقي من دفعة ${p.paymentNumber} المقدمة ${remaining.toFixed(4)} بس`,
      );
    const paidDirect = sum(
      await db
        .select({ v: payment.amount })
        .from(payment)
        .where(and(eq(payment.purchaseInvoiceId, inv.id), eq(payment.status, 'posted'))),
    );
    const covered =
      paidDirect +
      sum(
        await db
          .select({ v: advanceAllocation.amount })
          .from(advanceAllocation)
          .where(eq(advanceAllocation.purchaseInvoiceId, inv.id)),
      );
    if (amount > Number(inv.grandTotal) - covered + 0.0001)
      throw new FinanceValidationError(
        `الفاتورة ${inv.systemNumber} متبقي منها ${(Number(inv.grandTotal) - covered).toFixed(4)} بس`,
      );

    const acc = await this.accounts(p.orgNodeId);
    const ap = await this.partyAccount(p.orgNodeId, 'payable');
    let journalEntryId: string | null = null;
    if (acc?.paidAccountId && ap && this.accounting) {
      const e = await this.accounting.createEntry({
        orgNodeId: p.orgNodeId,
        description: `[Auto] تسوية دفعة مقدمة ${p.paymentNumber} على الفاتورة ${inv.systemNumber}`,
        reference: p.paymentNumber,
        isAutoGenerated: true,
        sourceEventType: 'advance_allocation',
        idempotencyKey: `advance-alloc-${p.id}-${inv.id}-${Date.now()}`,
        lines: [
          {
            accountId: ap,
            debitAmount: amount.toFixed(4),
            creditAmount: '0',
            partyType: 'supplier',
            partyId: inv.supplierId ?? undefined,
            description: '[Auto] AP settled by advance',
          },
          {
            accountId: acc.paidAccountId,
            debitAmount: '0',
            creditAmount: amount.toFixed(4),
            partyType: 'supplier',
            partyId: inv.supplierId ?? undefined,
            description: '[Auto] Advance applied',
          },
        ],
      });
      journalEntryId = (await this.accounting.postEntry(e.id)).id;
    }
    const row = await db
      .insert(advanceAllocation)
      .values({
        partyType: 'supplier',
        paymentId: p.id,
        purchaseInvoiceId: inv.id,
        amount: amount.toFixed(4),
        journalEntryId,
        installmentNumber,
      })
      .returning({ id: advanceAllocation.id });
    return { allocationId: row[0]!.id, journalEntryId };
  }

  private open(
    partyType: 'customer' | 'supplier',
    id: string,
    number: string,
    ref: string | null,
    advance: number,
    allocated: number,
  ): OpenAdvance {
    return {
      partyType,
      documentId: id,
      documentNumber: number,
      partyReference: ref,
      advance: advance.toFixed(4),
      allocated: allocated.toFixed(4),
      remaining: (advance - allocated).toFixed(4),
    };
  }

  private positive(raw: string): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) throw new FinanceValidationError('amount must be positive');
    return n;
  }

  private async partyAccount(
    orgNodeId: string | null,
    purpose: 'receivable' | 'payable',
  ): Promise<string | null> {
    if (!orgNodeId || !this.accountingRepo) return null;
    const det = (await this.accountingRepo.listAccountDeterminations(orgNodeId)).find(
      (d) => d.accountPurpose === purpose,
    );
    const c = await this.accountingRepo.findCompanyConfig(orgNodeId);
    return (
      det?.accountId ??
      (purpose === 'receivable' ? c?.defaultReceivableAccountId : c?.defaultPayableAccountId) ??
      null
    );
  }

  private async sameCustomer(
    collectionJo: string,
    invoiceCustomerId: string | null,
    invoiceJo: string | null,
  ): Promise<void> {
    if (invoiceJo && invoiceJo === collectionJo) return;
    const jo = this.sales
      ? (await this.sales.getJobOrders()).find((j) => j.jobOrderNumber === collectionJo)
      : undefined;
    if (!jo || jo.customerId !== invoiceCustomerId)
      throw new FinanceValidationError('الدفعة المقدمة والفاتورة لعملاء مختلفين');
  }
}
