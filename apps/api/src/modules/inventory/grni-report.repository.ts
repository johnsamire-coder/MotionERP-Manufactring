import { Injectable } from '@nestjs/common';
import { and, eq, inArray, ne, notInArray, or, isNull, sql } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { companyAccountingConfig, journalEntry, journalLine } from '../accounting/accounting.schema';
import { purchaseInvoice, purchaseInvoiceLine } from '../finance/finance.schema';
import { stockMovement, warehouse } from './inventory.schema';

export interface ReceivedNotBilledRow {
  movementId: string; movementDate: string; itemId: string; warehouseId: string;
  purchaseOrderId: string | null; quantity: string; receivedValue: string; billedValue: string; outstandingValue: string;
}

/**
 * Read-only queries for the GRNI / "received not billed" report (plan item 14). Invoice lines and
 * ledger rows belong to finance / accounting and are only read here (D2).
 */
@Injectable()
export class GrniReportRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Purchase receipts (not production output) with their billed value from non-cancelled invoices. */
  async receipts(orgNodeIds: string[] | null): Promise<ReceivedNotBilledRow[]> {
    const billed = this.database.db
      .select({
        receiptId: purchaseInvoiceLine.purchaseReceiptId,
        billed: sql<string>`sum(${purchaseInvoiceLine.quantity} * ${purchaseInvoiceLine.unitCost})`.as('billed'),
      })
      .from(purchaseInvoiceLine)
      .innerJoin(purchaseInvoice, eq(purchaseInvoice.id, purchaseInvoiceLine.purchaseInvoiceId))
      .where(ne(purchaseInvoice.status, 'cancelled'))
      .groupBy(purchaseInvoiceLine.purchaseReceiptId)
      .as('billed');
    const conditions = [
      eq(stockMovement.movementType, 'receipt'),
      or(isNull(stockMovement.sourceModule), notInArray(stockMovement.sourceModule, ['production', 'manufacturing', 'inventory'])),
    ];
    if (orgNodeIds) conditions.push(inArray(warehouse.orgNodeId, orgNodeIds.length > 0 ? orgNodeIds : ['00000000-0000-0000-0000-000000000000']));
    const rows = await this.database.db
      .select({
        movementId: stockMovement.id, movementDate: stockMovement.movementDate, itemId: stockMovement.itemId,
        warehouseId: stockMovement.warehouseId, sourceModule: stockMovement.sourceModule, sourceId: stockMovement.sourceId,
        quantity: stockMovement.quantity, received: stockMovement.totalValue, billed: billed.billed,
      })
      .from(stockMovement)
      .innerJoin(warehouse, eq(warehouse.id, stockMovement.warehouseId))
      .leftJoin(billed, eq(billed.receiptId, stockMovement.id))
      .where(and(...conditions))
      .orderBy(stockMovement.movementDate);
    return rows.map((r) => {
      const received = Number(r.received ?? 0);
      const billedValue = Number(r.billed ?? 0);
      return {
        movementId: r.movementId, movementDate: r.movementDate.toISOString(), itemId: r.itemId, warehouseId: r.warehouseId,
        purchaseOrderId: r.sourceModule === 'purchase_order' ? r.sourceId : null, quantity: r.quantity,
        receivedValue: received.toFixed(4), billedValue: billedValue.toFixed(4), outstandingValue: Math.max(0, received - billedValue).toFixed(4),
      };
    });
  }

  /** Posted ledger balance (credit − debit) of the company's default GRNI account, or null if not configured. */
  async ledgerGrniBalance(orgNodeId: string): Promise<{ accountId: string; balance: number } | null> {
    const cfg = await this.database.db.select({ accountId: companyAccountingConfig.defaultGrniAccountId })
      .from(companyAccountingConfig).where(eq(companyAccountingConfig.orgNodeId, orgNodeId)).limit(1);
    const accountId = cfg[0]?.accountId;
    if (!accountId) return null;
    const rows = await this.database.db
      .select({ balance: sql<string>`coalesce(sum(${journalLine.creditAmount} - ${journalLine.debitAmount}), 0)` })
      .from(journalLine)
      .innerJoin(journalEntry, eq(journalEntry.id, journalLine.journalEntryId))
      .where(and(eq(journalLine.accountId, accountId), eq(journalEntry.status, 'posted')));
    return { accountId, balance: Number(rows[0]?.balance ?? 0) };
  }
}
