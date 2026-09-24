import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { journalEntry, journalLine } from '../accounting/accounting.schema';
import { deliveryOrder } from '../delivery/delivery.schema';
import { salesInvoice, salesInvoiceLine } from '../finance/finance.schema';
import { jobOrder, quotation, quotationLine } from './sales.schema';

/**
 * Read-only queries behind the composite credit check (plan item 6). The ledger, invoice
 * and delivery tables belong to other modules; they are only read here, never written (D2).
 */
@Injectable()
export class CustomerCreditRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Customer balance in the general ledger: posted debits − credits on lines tagged with the customer. */
  async ledgerBalance(customerId: string): Promise<number> {
    const rows = await this.database.db
      .select({
        balance: sql<string>`coalesce(sum(${journalLine.debitAmount} - ${journalLine.creditAmount}), 0)`,
      })
      .from(journalLine)
      .innerJoin(journalEntry, eq(journalEntry.id, journalLine.journalEntryId))
      .where(
        and(
          eq(journalLine.partyType, 'customer'),
          eq(journalLine.partyId, customerId),
          eq(journalEntry.status, 'posted'),
        ),
      );
    return Number(rows[0]?.balance ?? 0);
  }

  /** The customer's open (approved / in progress) job orders. */
  async openJobOrders(
    customerId: string,
  ): Promise<Array<{ jobOrderNumber: string; quotationReference: string | null }>> {
    return this.database.db
      .select({
        jobOrderNumber: jobOrder.jobOrderNumber,
        quotationReference: jobOrder.quotationReference,
      })
      .from(jobOrder)
      .where(
        and(
          eq(jobOrder.customerId, customerId),
          inArray(jobOrder.status, ['approved', 'in_progress']),
        ),
      );
  }

  /** Net value of an approved quotation (sum of quantity × unit price), by quotation number. */
  async quotationNetValue(quotationNumber: string): Promise<number> {
    const rows = await this.database.db
      .select({
        total: sql<string>`coalesce(sum(${quotationLine.quantity} * ${quotationLine.unitPrice}), 0)`,
      })
      .from(quotationLine)
      .innerJoin(quotation, eq(quotation.id, quotationLine.quotationId))
      .where(eq(quotation.quotationNumber, quotationNumber));
    return Number(rows[0]?.total ?? 0);
  }

  /** Net amount already invoiced (posted) against a job order. */
  async postedInvoicedNet(jobOrderNumber: string): Promise<number> {
    const rows = await this.database.db
      .select({ total: sql<string>`coalesce(sum(${salesInvoice.netAmount}), 0)` })
      .from(salesInvoice)
      .where(
        and(eq(salesInvoice.jobOrderReference, jobOrderNumber), eq(salesInvoice.status, 'posted')),
      );
    return Number(rows[0]?.total ?? 0);
  }

  /** Delivered delivery orders of these job orders that no invoice line points at. */
  async deliveredNotInvoicedCount(jobOrderNumbers: string[]): Promise<number> {
    if (jobOrderNumbers.length === 0) return 0;
    const invoiced = this.database.db
      .select({ id: salesInvoiceLine.deliveryOrderId })
      .from(salesInvoiceLine)
      .innerJoin(salesInvoice, eq(salesInvoice.id, salesInvoiceLine.salesInvoiceId))
      .where(
        and(isNotNull(salesInvoiceLine.deliveryOrderId), ne(salesInvoice.status, 'cancelled')),
      );
    const rows = await this.database.db
      .select({ count: sql<string>`count(*)` })
      .from(deliveryOrder)
      .where(
        and(
          inArray(deliveryOrder.jobOrderReference, jobOrderNumbers),
          eq(deliveryOrder.status, 'delivered'),
          sql`${deliveryOrder.id} not in (${invoiced})`,
        ),
      );
    return Number(rows[0]?.count ?? 0);
  }
}
