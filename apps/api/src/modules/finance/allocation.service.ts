import { ConflictException, Injectable, Optional } from '@nestjs/common';
import { and, asc, eq, ne } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { SalesService } from '../sales/sales.service';
import { AdvanceService } from './advance.service';
import { FinanceNotFoundError, FinanceValidationError } from './finance.errors';
import {
  advanceAllocation,
  collection,
  invoiceInstallment,
  payment,
  purchaseInvoice,
  salesInvoice,
} from './finance.schema';

export type InvoiceType = 'sales' | 'purchase';
export interface InstallmentStatus {
  installmentNumber: number;
  dueDate: string;
  amount: string;
  paid: string;
  outstanding: string;
}
export interface InvoiceOutstanding {
  invoiceType: InvoiceType;
  invoiceId: string;
  invoiceNumber: string;
  grandTotal: string;
  paid: string;
  outstanding: string;
  installments: InstallmentStatus[];
}
export interface AllocationLineInput {
  invoiceId: string;
  amount: string;
  expectedOutstanding: string;
  installmentNumber?: number;
}

const r4 = (n: number): number => Number(n.toFixed(4));
const total = (rows: Array<{ v: string | null }>): number =>
  rows.reduce((s, r) => s + Number(r.v ?? 0), 0);

/**
 * Installment status (pure): allocations tagged with an installment pay it; untagged coverage
 * (direct payments, untagged allocations) pays the earliest-due installments first.
 */
export function installmentStatus(
  installments: Array<{ n: number; dueDate: string; amount: number }>,
  tagged: Map<number, number>,
  untagged: number,
): InstallmentStatus[] {
  let pool = untagged;
  return [...installments]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.n - b.n)
    .map((i) => {
      let paid = Math.min(i.amount, tagged.get(i.n) ?? 0);
      const extra = Math.min(i.amount - paid, pool);
      paid += extra;
      pool -= extra;
      return {
        installmentNumber: i.n,
        dueDate: i.dueDate,
        amount: i.amount.toFixed(4),
        paid: r4(paid).toFixed(4),
        outstanding: r4(i.amount - paid).toFixed(4),
      };
    });
}

/** Spreads an amount over installments, earliest due first, or onto one chosen installment (pure). */
export function spreadOverInstallments(
  amount: number,
  status: InstallmentStatus[],
  chosen?: number,
): Array<{ installmentNumber: number | null; amount: number }> {
  if (status.length === 0) return [{ installmentNumber: null, amount }];
  if (chosen !== undefined) {
    const i = status.find((s) => s.installmentNumber === chosen);
    if (!i) throw new FinanceValidationError(`القسط رقم ${chosen} مش موجود`);
    if (amount > Number(i.outstanding) + 0.0001)
      throw new FinanceValidationError(`القسط رقم ${chosen} متبقي منه ${i.outstanding} بس`);
    return [{ installmentNumber: chosen, amount }];
  }
  const out: Array<{ installmentNumber: number | null; amount: number }> = [];
  let left = amount;
  for (const s of status) {
    if (left <= 0) break;
    const take = Math.min(left, Number(s.outstanding));
    if (take > 0) {
      out.push({ installmentNumber: s.installmentNumber, amount: r4(take) });
      left = r4(left - take);
    }
  }
  if (left > 0.0001) out.push({ installmentNumber: null, amount: left });
  return out;
}

/**
 * Plan item 39 — one payment / collection allocated over several invoices and their installments.
 * Every line carries the outstanding the user saw; if any invoice changed since (someone else paid it),
 * the whole request is refused with 409 and nothing is written ("latest data" check at submit time).
 */
@Injectable()
export class AllocationService {
  constructor(
    private readonly database: DatabaseService,
    @Optional() private readonly advances?: AdvanceService,
    @Optional() private readonly sales?: SalesService,
  ) {}

  async setInstallments(
    invoiceType: InvoiceType,
    invoiceId: string,
    rows: Array<{ dueDate: string; amount: string }>,
  ): Promise<InvoiceOutstanding> {
    const inv = await this.invoice(invoiceType, invoiceId);
    if (rows.length === 0) throw new FinanceValidationError('at least one installment is required');
    const amounts = rows.map((r) => Number(r.amount));
    if (amounts.some((a) => !(a > 0)))
      throw new FinanceValidationError('every installment amount must be positive');
    if (Math.abs(amounts.reduce((s, a) => s + a, 0) - inv.grandTotal) > 0.0001) {
      throw new FinanceValidationError(
        `مجموع الأقساط لازم يساوي إجمالي الفاتورة ${inv.grandTotal.toFixed(4)}`,
      );
    }
    for (const r of rows)
      if (Number.isNaN(new Date(r.dueDate).getTime()))
        throw new FinanceValidationError(`dueDate "${r.dueDate}" is not a valid date`);
    const status = await this.outstanding(invoiceType, invoiceId);
    if (Number(status.paid) > 0)
      throw new FinanceValidationError(
        `الفاتورة ${inv.number} اتدفع منها ${status.paid} — مينفعش تغيّر أقساطها`,
      );
    const db = this.database.db;
    const key =
      invoiceType === 'sales'
        ? invoiceInstallment.salesInvoiceId
        : invoiceInstallment.purchaseInvoiceId;
    await db.delete(invoiceInstallment).where(eq(key, invoiceId));
    await db.insert(invoiceInstallment).values(
      rows.map((r, i) => ({
        invoiceType,
        installmentNumber: i + 1,
        dueDate: new Date(r.dueDate),
        amount: Number(r.amount).toFixed(4),
        salesInvoiceId: invoiceType === 'sales' ? invoiceId : null,
        purchaseInvoiceId: invoiceType === 'purchase' ? invoiceId : null,
      })),
    );
    return this.outstanding(invoiceType, invoiceId);
  }

  async outstanding(invoiceType: InvoiceType, invoiceId: string): Promise<InvoiceOutstanding> {
    const db = this.database.db;
    const inv = await this.invoice(invoiceType, invoiceId);
    const allocKey =
      invoiceType === 'sales'
        ? advanceAllocation.salesInvoiceId
        : advanceAllocation.purchaseInvoiceId;
    const allocs = await db
      .select({ v: advanceAllocation.amount, n: advanceAllocation.installmentNumber })
      .from(advanceAllocation)
      .where(eq(allocKey, invoiceId));
    const direct =
      invoiceType === 'purchase'
        ? total(
            await db
              .select({ v: payment.amount })
              .from(payment)
              .where(and(eq(payment.purchaseInvoiceId, invoiceId), eq(payment.status, 'posted'))),
          )
        : 0;
    const paid = direct + total(allocs);
    const instKey =
      invoiceType === 'sales'
        ? invoiceInstallment.salesInvoiceId
        : invoiceInstallment.purchaseInvoiceId;
    const inst = await db
      .select()
      .from(invoiceInstallment)
      .where(eq(instKey, invoiceId))
      .orderBy(asc(invoiceInstallment.installmentNumber));
    const tagged = new Map<number, number>();
    let untagged = direct;
    for (const a of allocs) {
      if (a.n === null) untagged += Number(a.v);
      else tagged.set(a.n, (tagged.get(a.n) ?? 0) + Number(a.v));
    }
    return {
      invoiceType,
      invoiceId,
      invoiceNumber: inv.number,
      grandTotal: inv.grandTotal.toFixed(4),
      paid: r4(paid).toFixed(4),
      outstanding: r4(inv.grandTotal - paid).toFixed(4),
      installments: installmentStatus(
        inst.map((i) => ({
          n: i.installmentNumber,
          dueDate: i.dueDate.toISOString(),
          amount: Number(i.amount),
        })),
        tagged,
        untagged,
      ),
    };
  }

  /** Supplier payment → several purchase invoices. */
  async allocatePayment(
    paymentId: string,
    lines: AllocationLineInput[],
  ): Promise<{
    allocated: Array<{ invoiceId: string; installmentNumber: number | null; amount: string }>;
    invoices: InvoiceOutstanding[];
  }> {
    const db = this.database.db;
    const p = (await db.select().from(payment).where(eq(payment.id, paymentId)).limit(1))[0];
    if (!p || p.status !== 'posted')
      throw new FinanceNotFoundError(`posted payment ${paymentId} does not exist`);
    const isAdvance = Number(p.advanceAmount) > 0;
    const used = total(
      await db
        .select({ v: advanceAllocation.amount })
        .from(advanceAllocation)
        .where(eq(advanceAllocation.paymentId, p.id)),
    );
    const capacity = isAdvance
      ? Number(p.advanceAmount) - used
      : Number(p.amount) - (p.purchaseInvoiceId ? Number(p.amount) : 0) - used;
    const plan = await this.plan('purchase', lines, capacity, p.paymentNumber, async (inv) => {
      if (inv.partyId !== p.supplierId)
        throw new FinanceValidationError(`الفاتورة ${inv.number} لمورد تاني`);
    });
    const allocated = [];
    for (const piece of plan) {
      if (isAdvance && this.advances) {
        await this.advances.allocatePayment(
          p.id,
          piece.invoiceId,
          piece.amount.toFixed(4),
          piece.installmentNumber,
        );
      } else {
        await db.insert(advanceAllocation).values({
          partyType: 'supplier',
          kind: 'matching',
          paymentId: p.id,
          purchaseInvoiceId: piece.invoiceId,
          amount: piece.amount.toFixed(4),
          installmentNumber: piece.installmentNumber,
        });
      }
      allocated.push({
        invoiceId: piece.invoiceId,
        installmentNumber: piece.installmentNumber,
        amount: piece.amount.toFixed(4),
      });
    }
    return {
      allocated,
      invoices: await Promise.all(
        [...new Set(plan.map((x) => x.invoiceId))].map((id) => this.outstanding('purchase', id)),
      ),
    };
  }

  /** Customer collection → several sales invoices (the settled part first, then the advance part with its reclass entry). */
  async allocateCollection(
    collectionId: string,
    lines: AllocationLineInput[],
  ): Promise<{
    allocated: Array<{ invoiceId: string; installmentNumber: number | null; amount: string }>;
    invoices: InvoiceOutstanding[];
  }> {
    const db = this.database.db;
    const c = (
      await db
        .select()
        .from(collection)
        .where(and(eq(collection.id, collectionId), ne(collection.status, 'cancelled')))
        .limit(1)
    )[0];
    if (!c) throw new FinanceNotFoundError(`collection ${collectionId} does not exist`);
    const matched = total(
      await db
        .select({ v: advanceAllocation.amount })
        .from(advanceAllocation)
        .where(
          and(eq(advanceAllocation.collectionId, c.id), eq(advanceAllocation.kind, 'matching')),
        ),
    );
    const advUsed = total(
      await db
        .select({ v: advanceAllocation.amount })
        .from(advanceAllocation)
        .where(
          and(eq(advanceAllocation.collectionId, c.id), eq(advanceAllocation.kind, 'advance')),
        ),
    );
    let settleLeft = r4(Number(c.amount) - Number(c.advanceAmount) - matched);
    const capacity = settleLeft + Number(c.advanceAmount) - advUsed;
    const jo = this.sales
      ? (await this.sales.getJobOrders()).find((j) => j.jobOrderNumber === c.jobOrderReference)
      : undefined;
    const plan = await this.plan('sales', lines, capacity, c.collectionNumber, async (inv) => {
      if (inv.jobOrderReference !== c.jobOrderReference && (!jo || jo.customerId !== inv.partyId))
        throw new FinanceValidationError(`الفاتورة ${inv.number} لعميل تاني`);
    });
    const allocated = [];
    for (const piece of plan) {
      const fromSettle = Math.min(piece.amount, Math.max(0, settleLeft));
      if (fromSettle > 0) {
        await db.insert(advanceAllocation).values({
          partyType: 'customer',
          kind: 'matching',
          collectionId: c.id,
          salesInvoiceId: piece.invoiceId,
          amount: fromSettle.toFixed(4),
          installmentNumber: piece.installmentNumber,
        });
        settleLeft = r4(settleLeft - fromSettle);
      }
      const fromAdvance = r4(piece.amount - fromSettle);
      if (fromAdvance > 0 && this.advances)
        await this.advances.allocateCollection(
          c.id,
          piece.invoiceId,
          fromAdvance.toFixed(4),
          piece.installmentNumber,
        );
      allocated.push({
        invoiceId: piece.invoiceId,
        installmentNumber: piece.installmentNumber,
        amount: piece.amount.toFixed(4),
      });
    }
    return {
      allocated,
      invoices: await Promise.all(
        [...new Set(plan.map((x) => x.invoiceId))].map((id) => this.outstanding('sales', id)),
      ),
    };
  }

  /** Validates every line against the latest data before anything is written. */
  private async plan(
    type: InvoiceType,
    lines: AllocationLineInput[],
    capacity: number,
    sourceNumber: string,
    partyCheck: (inv: {
      number: string;
      partyId: string | null;
      jobOrderReference: string | null;
    }) => Promise<void>,
  ): Promise<Array<{ invoiceId: string; installmentNumber: number | null; amount: number }>> {
    if (lines.length === 0)
      throw new FinanceValidationError('at least one allocation line is required');
    if (
      new Set(lines.map((l) => `${l.invoiceId}|${l.installmentNumber ?? ''}`)).size !== lines.length
    )
      throw new FinanceValidationError('the same invoice / installment appears twice');
    const changed: Array<{ invoiceNumber: string; expected: string; current: string }> = [];
    const pieces: Array<{ invoiceId: string; installmentNumber: number | null; amount: number }> =
      [];
    let sumAmounts = 0;
    for (const l of lines) {
      const amount = Number(l.amount);
      if (!(amount > 0))
        throw new FinanceValidationError('every allocation amount must be positive');
      const inv = await this.invoice(type, l.invoiceId);
      if (inv.status !== 'posted')
        throw new FinanceValidationError(`الفاتورة ${inv.number} مش مرحّلة`);
      await partyCheck(inv);
      const status = await this.outstanding(type, l.invoiceId);
      const current =
        l.installmentNumber !== undefined
          ? (status.installments.find((i) => i.installmentNumber === l.installmentNumber)
              ?.outstanding ?? '0.0000')
          : status.outstanding;
      if (Math.abs(Number(current) - Number(l.expectedOutstanding)) > 0.0001) {
        changed.push({
          invoiceNumber: inv.number,
          expected: Number(l.expectedOutstanding).toFixed(4),
          current,
        });
        continue;
      }
      if (amount > Number(current) + 0.0001)
        throw new FinanceValidationError(`الفاتورة ${inv.number} متبقي منها ${current} بس`);
      sumAmounts += amount;
      for (const s of spreadOverInstallments(amount, status.installments, l.installmentNumber))
        pieces.push({ invoiceId: l.invoiceId, ...s });
    }
    if (changed.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        message: `البيانات اتغيّرت من وقت ما فتحت الشاشة — حدّث وحاول تاني: ${changed.map((c) => `${c.invoiceNumber} (كان ${c.expected}، دلوقتي ${c.current})`).join('، ')}`,
        changed,
      });
    }
    if (sumAmounts > capacity + 0.0001)
      throw new FinanceValidationError(
        `${sourceNumber} متاح منها ${r4(capacity).toFixed(4)} بس للتخصيص`,
      );
    return pieces;
  }

  private async invoice(
    type: InvoiceType,
    id: string,
  ): Promise<{
    number: string;
    grandTotal: number;
    status: string;
    partyId: string | null;
    jobOrderReference: string | null;
  }> {
    const db = this.database.db;
    if (type === 'sales') {
      const r = (await db.select().from(salesInvoice).where(eq(salesInvoice.id, id)).limit(1))[0];
      if (!r) throw new FinanceNotFoundError(`sales invoice ${id} does not exist`);
      return {
        number: r.invoiceNumber,
        grandTotal: Number(r.grandTotal),
        status: r.status,
        partyId: r.customerId,
        jobOrderReference: r.jobOrderReference,
      };
    }
    const r = (
      await db.select().from(purchaseInvoice).where(eq(purchaseInvoice.id, id)).limit(1)
    )[0];
    if (!r) throw new FinanceNotFoundError(`purchase invoice ${id} does not exist`);
    return {
      number: r.systemNumber,
      grandTotal: Number(r.grandTotal),
      status: r.status,
      partyId: r.supplierId,
      jobOrderReference: null,
    };
  }
}
