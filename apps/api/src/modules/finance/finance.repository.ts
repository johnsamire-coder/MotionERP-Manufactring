import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import {
  bankReconciliation,
  bankTransfer,
  collection,
  creditDebitNote,
  creditDebitNoteLine,
  payment,
  purchaseInvoice,
  purchaseInvoiceLine,
  retention,
  salesInvoice,
  salesInvoiceLine,
} from './finance.schema';
import type {
  BankReconciliationRecord,
  BankReconciliationStatus,
  BankTransferRecord,
  BankTransferStatus,
  CollectionRecord,
  CollectionStatus,
  CreateBankReconciliationInput,
  CreateBankTransferInput,
  CreateCollectionInput,
  CreateCreditDebitNoteInput,
  CreatePaymentInput,
  CreatePurchaseInvoiceInput,
  CreateRetentionInput,
  CreateSalesInvoiceInput,
  CreditDebitNoteLineRecord,
  CreditDebitNoteRecord,
  CreditDebitNoteStatus,
  PaymentMethod,
  PaymentRecord,
  PaymentStatus,
  PurchaseInvoiceLineRecord,
  PurchaseInvoiceRecord,
  PurchaseInvoiceStatus,
  RetentionRecord,
  RetentionStatus,
  SalesInvoiceLineRecord,
  SalesInvoiceRecord,
  SalesInvoiceStatus,
} from './finance.types';

const colColumns = {
  id: collection.id, jobOrderReference: collection.jobOrderReference, orgNodeId: collection.orgNodeId,
  collectionNumber: collection.collectionNumber, collectionDate: collection.collectionDate,
  amount: collection.amount, currencyCode: collection.currencyCode, paymentMethod: collection.paymentMethod,
  receivedInAccountId: collection.receivedInAccountId, referenceNumber: collection.referenceNumber,
  notes: collection.notes, status: collection.status,
};

const retColumns = {
  id: retention.id, jobOrderReference: retention.jobOrderReference, orgNodeId: retention.orgNodeId,
  retentionNumber: retention.retentionNumber, originalAmount: retention.originalAmount,
  releasedAmount: retention.releasedAmount, currencyCode: retention.currencyCode,
  startDate: retention.startDate, releaseDate: retention.releaseDate, dueDate: retention.dueDate,
  status: retention.status, notes: retention.notes,
};

const piColumns = {
  id: purchaseInvoice.id, invoiceNumber: purchaseInvoice.invoiceNumber, systemNumber: purchaseInvoice.systemNumber,
  orgNodeId: purchaseInvoice.orgNodeId, supplierId: purchaseInvoice.supplierId, invoiceDate: purchaseInvoice.invoiceDate,
  dueDate: purchaseInvoice.dueDate, currencyCode: purchaseInvoice.currencyCode, exchangeRate: purchaseInvoice.exchangeRate,
  netAmount: purchaseInvoice.netAmount, taxAmount: purchaseInvoice.taxAmount, grandTotal: purchaseInvoice.grandTotal,
  status: purchaseInvoice.status, notes: purchaseInvoice.notes, createdAt: purchaseInvoice.createdAt, updatedAt: purchaseInvoice.updatedAt,
};

const pilColumns = {
  id: purchaseInvoiceLine.id, purchaseInvoiceId: purchaseInvoiceLine.purchaseInvoiceId,
  itemId: purchaseInvoiceLine.itemId, quantity: purchaseInvoiceLine.quantity, unitCost: purchaseInvoiceLine.unitCost,
  taxRate: purchaseInvoiceLine.taxRate, taxAmount: purchaseInvoiceLine.taxAmount, totalAmount: purchaseInvoiceLine.totalAmount,
  purchaseReceiptId: purchaseInvoiceLine.purchaseReceiptId, createdAt: purchaseInvoiceLine.createdAt,
};

const siColumns = {
  id: salesInvoice.id, invoiceNumber: salesInvoice.invoiceNumber, orgNodeId: salesInvoice.orgNodeId,
  customerId: salesInvoice.customerId, jobOrderReference: salesInvoice.jobOrderReference,
  invoiceDate: salesInvoice.invoiceDate, dueDate: salesInvoice.dueDate, currencyCode: salesInvoice.currencyCode,
  exchangeRate: salesInvoice.exchangeRate, netAmount: salesInvoice.netAmount, taxAmount: salesInvoice.taxAmount,
  grandTotal: salesInvoice.grandTotal, status: salesInvoice.status, notes: salesInvoice.notes,
  createdAt: salesInvoice.createdAt, updatedAt: salesInvoice.updatedAt,
};

const silColumns = {
  id: salesInvoiceLine.id, salesInvoiceId: salesInvoiceLine.salesInvoiceId, itemId: salesInvoiceLine.itemId,
  quantity: salesInvoiceLine.quantity, unitPrice: salesInvoiceLine.unitPrice, taxRate: salesInvoiceLine.taxRate,
  taxAmount: salesInvoiceLine.taxAmount, totalAmount: salesInvoiceLine.totalAmount,
  deliveryOrderId: salesInvoiceLine.deliveryOrderId, createdAt: salesInvoiceLine.createdAt,
};

const payColumns = {
  id: payment.id, paymentNumber: payment.paymentNumber, orgNodeId: payment.orgNodeId,
  supplierId: payment.supplierId, purchaseInvoiceId: payment.purchaseInvoiceId, paymentDate: payment.paymentDate,
  amount: payment.amount, currencyCode: payment.currencyCode, paymentMethod: payment.paymentMethod,
  paidFromAccountId: payment.paidFromAccountId, referenceNumber: payment.referenceNumber, notes: payment.notes,
  status: payment.status, createdAt: payment.createdAt, updatedAt: payment.updatedAt,
};

const noteColumns = {
  id: creditDebitNote.id, noteNumber: creditDebitNote.noteNumber, noteType: creditDebitNote.noteType,
  orgNodeId: creditDebitNote.orgNodeId, partyType: creditDebitNote.partyType, partyId: creditDebitNote.partyId,
  originalInvoiceNumber: creditDebitNote.originalInvoiceNumber, salesInvoiceId: creditDebitNote.salesInvoiceId,
  purchaseInvoiceId: creditDebitNote.purchaseInvoiceId, postingDate: creditDebitNote.postingDate,
  netAmount: creditDebitNote.netAmount, taxAmount: creditDebitNote.taxAmount, grandTotal: creditDebitNote.grandTotal,
  reason: creditDebitNote.reason, status: creditDebitNote.status, createdAt: creditDebitNote.createdAt, updatedAt: creditDebitNote.updatedAt,
};

const noteLineColumns = {
  id: creditDebitNoteLine.id, noteId: creditDebitNoteLine.noteId, itemId: creditDebitNoteLine.itemId,
  quantity: creditDebitNoteLine.quantity, unitPrice: creditDebitNoteLine.unitPrice, taxRate: creditDebitNoteLine.taxRate,
  taxAmount: creditDebitNoteLine.taxAmount, totalAmount: creditDebitNoteLine.totalAmount, createdAt: creditDebitNoteLine.createdAt,
};

const transferColumns = {
  id: bankTransfer.id, transferNumber: bankTransfer.transferNumber, orgNodeId: bankTransfer.orgNodeId,
  fromAccountId: bankTransfer.fromAccountId, toAccountId: bankTransfer.toAccountId, transferDate: bankTransfer.transferDate,
  amount: bankTransfer.amount, referenceNumber: bankTransfer.referenceNumber, notes: bankTransfer.notes,
  status: bankTransfer.status, createdAt: bankTransfer.createdAt, updatedAt: bankTransfer.updatedAt,
};

const reconColumns = {
  id: bankReconciliation.id, reconciliationNumber: bankReconciliation.reconciliationNumber, orgNodeId: bankReconciliation.orgNodeId,
  bankAccountId: bankReconciliation.bankAccountId, statementDate: bankReconciliation.statementDate,
  statementBalance: bankReconciliation.statementBalance, clearedBalance: bankReconciliation.clearedBalance,
  differenceAmount: bankReconciliation.differenceAmount, status: bankReconciliation.status, notes: bankReconciliation.notes,
  createdAt: bankReconciliation.createdAt, updatedAt: bankReconciliation.updatedAt,
};

@Injectable()
export class FinanceRepository {
  constructor(private readonly database: DatabaseService) {}

  // --- Collections ---
  async listCollections(jobOrderReference?: string): Promise<CollectionRecord[]> {
    const rows = jobOrderReference
      ? await this.database.db.select(colColumns).from(collection).where(eq(collection.jobOrderReference, jobOrderReference)).orderBy(asc(collection.collectionDate))
      : await this.database.db.select(colColumns).from(collection).orderBy(asc(collection.collectionDate));
    return rows.map((r) => ({
      id: r.id, jobOrderReference: r.jobOrderReference, orgNodeId: r.orgNodeId, collectionNumber: r.collectionNumber,
      collectionDate: r.collectionDate.toISOString(), amount: r.amount, currencyCode: r.currencyCode,
      paymentMethod: r.paymentMethod as PaymentMethod, receivedInAccountId: r.receivedInAccountId,
      referenceNumber: r.referenceNumber, notes: r.notes, status: r.status as CollectionStatus,
    }));
  }

  async countCollections(): Promise<number> {
    const rows = await this.database.db.select({ id: collection.id }).from(collection);
    return rows.length;
  }

  async insertCollection(input: CreateCollectionInput & { id: string; collectionNumber: string; orgNodeId: string | null }): Promise<CollectionRecord> {
    const rows = await this.database.db.insert(collection).values({
      id: input.id, jobOrderReference: input.jobOrderReference, orgNodeId: input.orgNodeId, collectionNumber: input.collectionNumber,
      collectionDate: input.collectionDate ? new Date(input.collectionDate) : new Date(),
      amount: input.amount, currencyCode: input.currencyCode ?? 'EGP', paymentMethod: input.paymentMethod,
      receivedInAccountId: input.receivedInAccountId ?? null,
      referenceNumber: input.referenceNumber ?? null, notes: input.notes ?? null,
    }).returning(colColumns);
    const r = rows[0]!;
    return {
      id: r.id, jobOrderReference: r.jobOrderReference, orgNodeId: r.orgNodeId, collectionNumber: r.collectionNumber,
      collectionDate: r.collectionDate.toISOString(), amount: r.amount, currencyCode: r.currencyCode,
      paymentMethod: r.paymentMethod as PaymentMethod, receivedInAccountId: r.receivedInAccountId,
      referenceNumber: r.referenceNumber, notes: r.notes, status: r.status as CollectionStatus,
    };
  }

  // --- Retentions ---
  async listRetentions(jobOrderReference?: string): Promise<RetentionRecord[]> {
    const rows = jobOrderReference
      ? await this.database.db.select(retColumns).from(retention).where(eq(retention.jobOrderReference, jobOrderReference)).orderBy(asc(retention.dueDate))
      : await this.database.db.select(retColumns).from(retention).orderBy(asc(retention.dueDate));
    return rows.map((r) => ({
      id: r.id, jobOrderReference: r.jobOrderReference, orgNodeId: r.orgNodeId, retentionNumber: r.retentionNumber,
      originalAmount: r.originalAmount, releasedAmount: r.releasedAmount, currencyCode: r.currencyCode,
      startDate: r.startDate.toISOString(), releaseDate: r.releaseDate ? r.releaseDate.toISOString() : null,
      dueDate: r.dueDate.toISOString(), status: r.status as RetentionStatus, notes: r.notes,
    }));
  }

  async findRetentionById(id: string): Promise<RetentionRecord | null> {
    const rows = await this.database.db.select(retColumns).from(retention).where(eq(retention.id, id)).limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id, jobOrderReference: r.jobOrderReference, orgNodeId: r.orgNodeId, retentionNumber: r.retentionNumber,
      originalAmount: r.originalAmount, releasedAmount: r.releasedAmount, currencyCode: r.currencyCode,
      startDate: r.startDate.toISOString(), releaseDate: r.releaseDate ? r.releaseDate.toISOString() : null,
      dueDate: r.dueDate.toISOString(), status: r.status as RetentionStatus, notes: r.notes,
    };
  }

  async countRetentions(): Promise<number> {
    const rows = await this.database.db.select({ id: retention.id }).from(retention);
    return rows.length;
  }

  async insertRetention(input: CreateRetentionInput & { id: string; retentionNumber: string; orgNodeId: string | null }): Promise<RetentionRecord> {
    const rows = await this.database.db.insert(retention).values({
      id: input.id, jobOrderReference: input.jobOrderReference, orgNodeId: input.orgNodeId, retentionNumber: input.retentionNumber,
      originalAmount: input.originalAmount, currencyCode: input.currencyCode ?? 'EGP',
      startDate: input.startDate ? new Date(input.startDate) : new Date(), dueDate: new Date(input.dueDate), notes: input.notes ?? null,
    }).returning(retColumns);
    const r = rows[0]!;
    return {
      id: r.id, jobOrderReference: r.jobOrderReference, orgNodeId: r.orgNodeId, retentionNumber: r.retentionNumber,
      originalAmount: r.originalAmount, releasedAmount: r.releasedAmount, currencyCode: r.currencyCode,
      startDate: r.startDate.toISOString(), releaseDate: r.releaseDate ? r.releaseDate.toISOString() : null,
      dueDate: r.dueDate.toISOString(), status: r.status as RetentionStatus, notes: r.notes,
    };
  }

  async releaseRetention(id: string, releasedAmount: string, status: RetentionStatus): Promise<RetentionRecord> {
    const rows = await this.database.db.update(retention).set({
      releasedAmount, releaseDate: new Date(), status,
    }).where(eq(retention.id, id)).returning(retColumns);
    const r = rows[0]!;
    return {
      id: r.id, jobOrderReference: r.jobOrderReference, orgNodeId: r.orgNodeId, retentionNumber: r.retentionNumber,
      originalAmount: r.originalAmount, releasedAmount: r.releasedAmount, currencyCode: r.currencyCode,
      startDate: r.startDate.toISOString(), releaseDate: r.releaseDate ? r.releaseDate.toISOString() : null,
      dueDate: r.dueDate.toISOString(), status: r.status as RetentionStatus, notes: r.notes,
    };
  }

  // --- Purchase Invoices ---
  async listPurchaseInvoices(orgNodeId?: string, supplierId?: string): Promise<PurchaseInvoiceRecord[]> {
    const conditions = [];
    if (orgNodeId) conditions.push(eq(purchaseInvoice.orgNodeId, orgNodeId));
    if (supplierId) conditions.push(eq(purchaseInvoice.supplierId, supplierId));

    const query = this.database.db.select(piColumns).from(purchaseInvoice);
    const rows = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(purchaseInvoice.invoiceDate))
      : await query.orderBy(desc(purchaseInvoice.invoiceDate));

    const results: PurchaseInvoiceRecord[] = [];
    for (const r of rows) {
      const lines = await this.database.db.select(pilColumns).from(purchaseInvoiceLine).where(eq(purchaseInvoiceLine.purchaseInvoiceId, r.id));
      results.push({
        id: r.id, invoiceNumber: r.invoiceNumber, systemNumber: r.systemNumber, orgNodeId: r.orgNodeId,
        supplierId: r.supplierId, invoiceDate: r.invoiceDate.toISOString(), dueDate: r.dueDate.toISOString(),
        currencyCode: r.currencyCode, exchangeRate: r.exchangeRate, netAmount: r.netAmount, taxAmount: r.taxAmount,
        grandTotal: r.grandTotal, status: r.status as PurchaseInvoiceStatus, notes: r.notes,
        createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
        lines: lines.map((l) => ({
          id: l.id, purchaseInvoiceId: l.purchaseInvoiceId, itemId: l.itemId, quantity: l.quantity,
          unitCost: l.unitCost, taxRate: l.taxRate, taxAmount: l.taxAmount, totalAmount: l.totalAmount,
          purchaseReceiptId: l.purchaseReceiptId, createdAt: l.createdAt.toISOString(),
        })),
      });
    }
    return results;
  }

  async findPurchaseInvoiceById(id: string): Promise<PurchaseInvoiceRecord | null> {
    const rows = await this.database.db.select(piColumns).from(purchaseInvoice).where(eq(purchaseInvoice.id, id)).limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    const lines = await this.database.db.select(pilColumns).from(purchaseInvoiceLine).where(eq(purchaseInvoiceLine.purchaseInvoiceId, r.id));
    return {
      id: r.id, invoiceNumber: r.invoiceNumber, systemNumber: r.systemNumber, orgNodeId: r.orgNodeId,
      supplierId: r.supplierId, invoiceDate: r.invoiceDate.toISOString(), dueDate: r.dueDate.toISOString(),
      currencyCode: r.currencyCode, exchangeRate: r.exchangeRate, netAmount: r.netAmount, taxAmount: r.taxAmount,
      grandTotal: r.grandTotal, status: r.status as PurchaseInvoiceStatus, notes: r.notes,
      createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
      lines: lines.map((l) => ({
        id: l.id, purchaseInvoiceId: l.purchaseInvoiceId, itemId: l.itemId, quantity: l.quantity,
        unitCost: l.unitCost, taxRate: l.taxRate, taxAmount: l.taxAmount, totalAmount: l.totalAmount,
        purchaseReceiptId: l.purchaseReceiptId, createdAt: l.createdAt.toISOString(),
      })),
    };
  }

  async countPurchaseInvoices(): Promise<number> {
    const rows = await this.database.db.select({ id: purchaseInvoice.id }).from(purchaseInvoice);
    return rows.length;
  }

  async insertPurchaseInvoice(
    input: CreatePurchaseInvoiceInput & {
      id: string;
      systemNumber: string;
      netAmount: string;
      taxAmount: string;
      grandTotal: string;
      computedLines: Array<{
        id: string;
        itemId: string;
        quantity: string;
        unitCost: string;
        taxRate: string;
        taxAmount: string;
        totalAmount: string;
        purchaseReceiptId?: string;
      }>;
    },
  ): Promise<PurchaseInvoiceRecord> {
    const rows = await this.database.db.insert(purchaseInvoice).values({
      id: input.id,
      invoiceNumber: input.invoiceNumber,
      systemNumber: input.systemNumber,
      orgNodeId: input.orgNodeId,
      supplierId: input.supplierId,
      invoiceDate: new Date(input.invoiceDate),
      dueDate: new Date(input.dueDate),
      currencyCode: input.currencyCode ?? 'EGP',
      exchangeRate: input.exchangeRate ?? '1.000000',
      netAmount: input.netAmount,
      taxAmount: input.taxAmount,
      grandTotal: input.grandTotal,
      status: 'draft',
      notes: input.notes ?? null,
    }).returning(piColumns);

    const insertedPi = rows[0]!;
    const insertedLines: PurchaseInvoiceLineRecord[] = [];

    for (const line of input.computedLines) {
      const lineRows = await this.database.db.insert(purchaseInvoiceLine).values({
        id: line.id,
        purchaseInvoiceId: insertedPi.id,
        itemId: line.itemId,
        quantity: line.quantity,
        unitCost: line.unitCost,
        taxRate: line.taxRate,
        taxAmount: line.taxAmount,
        totalAmount: line.totalAmount,
        purchaseReceiptId: line.purchaseReceiptId ?? null,
      }).returning(pilColumns);

      const l = lineRows[0]!;
      insertedLines.push({
        id: l.id,
        purchaseInvoiceId: l.purchaseInvoiceId,
        itemId: l.itemId,
        quantity: l.quantity,
        unitCost: l.unitCost,
        taxRate: l.taxRate,
        taxAmount: l.taxAmount,
        totalAmount: l.totalAmount,
        purchaseReceiptId: l.purchaseReceiptId,
        createdAt: l.createdAt.toISOString(),
      });
    }

    return {
      id: insertedPi.id,
      invoiceNumber: insertedPi.invoiceNumber,
      systemNumber: insertedPi.systemNumber,
      orgNodeId: insertedPi.orgNodeId,
      supplierId: insertedPi.supplierId,
      invoiceDate: insertedPi.invoiceDate.toISOString(),
      dueDate: insertedPi.dueDate.toISOString(),
      currencyCode: insertedPi.currencyCode,
      exchangeRate: insertedPi.exchangeRate,
      netAmount: insertedPi.netAmount,
      taxAmount: insertedPi.taxAmount,
      grandTotal: insertedPi.grandTotal,
      status: insertedPi.status as PurchaseInvoiceStatus,
      notes: insertedPi.notes,
      createdAt: insertedPi.createdAt.toISOString(),
      updatedAt: insertedPi.updatedAt.toISOString(),
      lines: insertedLines,
    };
  }

  async setPurchaseInvoiceStatus(id: string, status: PurchaseInvoiceStatus): Promise<PurchaseInvoiceRecord> {
    await this.database.db.update(purchaseInvoice).set({ status, updatedAt: new Date() }).where(eq(purchaseInvoice.id, id));
    return (await this.findPurchaseInvoiceById(id))!;
  }

  // --- Sales Invoices ---
  async listSalesInvoices(orgNodeId?: string, customerId?: string): Promise<SalesInvoiceRecord[]> {
    const conditions = [];
    if (orgNodeId) conditions.push(eq(salesInvoice.orgNodeId, orgNodeId));
    if (customerId) conditions.push(eq(salesInvoice.customerId, customerId));

    const query = this.database.db.select(siColumns).from(salesInvoice);
    const rows = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(salesInvoice.invoiceDate))
      : await query.orderBy(desc(salesInvoice.invoiceDate));

    const results: SalesInvoiceRecord[] = [];
    for (const r of rows) {
      const lines = await this.database.db.select(silColumns).from(salesInvoiceLine).where(eq(salesInvoiceLine.salesInvoiceId, r.id));
      results.push({
        id: r.id, invoiceNumber: r.invoiceNumber, orgNodeId: r.orgNodeId, customerId: r.customerId,
        jobOrderReference: r.jobOrderReference, invoiceDate: r.invoiceDate.toISOString(), dueDate: r.dueDate.toISOString(),
        currencyCode: r.currencyCode, exchangeRate: r.exchangeRate, netAmount: r.netAmount, taxAmount: r.taxAmount,
        grandTotal: r.grandTotal, status: r.status as SalesInvoiceStatus, notes: r.notes,
        createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
        lines: lines.map((l) => ({
          id: l.id, salesInvoiceId: l.salesInvoiceId, itemId: l.itemId, quantity: l.quantity,
          unitPrice: l.unitPrice, taxRate: l.taxRate, taxAmount: l.taxAmount, totalAmount: l.totalAmount,
          deliveryOrderId: l.deliveryOrderId, createdAt: l.createdAt.toISOString(),
        })),
      });
    }
    return results;
  }

  async findSalesInvoiceById(id: string): Promise<SalesInvoiceRecord | null> {
    const rows = await this.database.db.select(siColumns).from(salesInvoice).where(eq(salesInvoice.id, id)).limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    const lines = await this.database.db.select(silColumns).from(salesInvoiceLine).where(eq(salesInvoiceLine.salesInvoiceId, r.id));
    return {
      id: r.id, invoiceNumber: r.invoiceNumber, orgNodeId: r.orgNodeId, customerId: r.customerId,
      jobOrderReference: r.jobOrderReference, invoiceDate: r.invoiceDate.toISOString(), dueDate: r.dueDate.toISOString(),
      currencyCode: r.currencyCode, exchangeRate: r.exchangeRate, netAmount: r.netAmount, taxAmount: r.taxAmount,
      grandTotal: r.grandTotal, status: r.status as SalesInvoiceStatus, notes: r.notes,
      createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
      lines: lines.map((l) => ({
        id: l.id, salesInvoiceId: l.salesInvoiceId, itemId: l.itemId, quantity: l.quantity,
        unitPrice: l.unitPrice, taxRate: l.taxRate, taxAmount: l.taxAmount, totalAmount: l.totalAmount,
        deliveryOrderId: l.deliveryOrderId, createdAt: l.createdAt.toISOString(),
      })),
    };
  }

  async countSalesInvoices(): Promise<number> {
    const rows = await this.database.db.select({ id: salesInvoice.id }).from(salesInvoice);
    return rows.length;
  }

  async insertSalesInvoice(
    input: CreateSalesInvoiceInput & {
      id: string;
      invoiceNumber: string;
      netAmount: string;
      taxAmount: string;
      grandTotal: string;
      computedLines: Array<{
        id: string;
        itemId: string;
        quantity: string;
        unitPrice: string;
        taxRate: string;
        taxAmount: string;
        totalAmount: string;
        deliveryOrderId?: string;
      }>;
    },
  ): Promise<SalesInvoiceRecord> {
    const rows = await this.database.db.insert(salesInvoice).values({
      id: input.id,
      invoiceNumber: input.invoiceNumber,
      orgNodeId: input.orgNodeId,
      customerId: input.customerId,
      jobOrderReference: input.jobOrderReference ?? null,
      invoiceDate: new Date(input.invoiceDate),
      dueDate: new Date(input.dueDate),
      currencyCode: input.currencyCode ?? 'EGP',
      exchangeRate: input.exchangeRate ?? '1.000000',
      netAmount: input.netAmount,
      taxAmount: input.taxAmount,
      grandTotal: input.grandTotal,
      status: 'draft',
      notes: input.notes ?? null,
    }).returning(siColumns);

    const insertedSi = rows[0]!;
    const insertedLines: SalesInvoiceLineRecord[] = [];

    for (const line of input.computedLines) {
      const lineRows = await this.database.db.insert(salesInvoiceLine).values({
        id: line.id,
        salesInvoiceId: insertedSi.id,
        itemId: line.itemId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate,
        taxAmount: line.taxAmount,
        totalAmount: line.totalAmount,
        deliveryOrderId: line.deliveryOrderId ?? null,
      }).returning(silColumns);

      const l = lineRows[0]!;
      insertedLines.push({
        id: l.id,
        salesInvoiceId: l.salesInvoiceId,
        itemId: l.itemId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxRate: l.taxRate,
        taxAmount: l.taxAmount,
        totalAmount: l.totalAmount,
        deliveryOrderId: l.deliveryOrderId,
        createdAt: l.createdAt.toISOString(),
      });
    }

    return {
      id: insertedSi.id,
      invoiceNumber: insertedSi.invoiceNumber,
      orgNodeId: insertedSi.orgNodeId,
      customerId: insertedSi.customerId,
      jobOrderReference: insertedSi.jobOrderReference,
      invoiceDate: insertedSi.invoiceDate.toISOString(),
      dueDate: insertedSi.dueDate.toISOString(),
      currencyCode: insertedSi.currencyCode,
      exchangeRate: insertedSi.exchangeRate,
      netAmount: insertedSi.netAmount,
      taxAmount: insertedSi.taxAmount,
      grandTotal: insertedSi.grandTotal,
      status: insertedSi.status as SalesInvoiceStatus,
      notes: insertedSi.notes,
      createdAt: insertedSi.createdAt.toISOString(),
      updatedAt: insertedSi.updatedAt.toISOString(),
      lines: insertedLines,
    };
  }

  async setSalesInvoiceStatus(id: string, status: SalesInvoiceStatus): Promise<SalesInvoiceRecord> {
    await this.database.db.update(salesInvoice).set({ status, updatedAt: new Date() }).where(eq(salesInvoice.id, id));
    return (await this.findSalesInvoiceById(id))!;
  }

  // --- Payments (Supplier Payments) ---
  async listPayments(orgNodeId?: string, supplierId?: string): Promise<PaymentRecord[]> {
    const conditions = [];
    if (orgNodeId) conditions.push(eq(payment.orgNodeId, orgNodeId));
    if (supplierId) conditions.push(eq(payment.supplierId, supplierId));

    const query = this.database.db.select(payColumns).from(payment);
    const rows = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(payment.paymentDate))
      : await query.orderBy(desc(payment.paymentDate));

    return rows.map((r) => ({
      id: r.id, paymentNumber: r.paymentNumber, orgNodeId: r.orgNodeId, supplierId: r.supplierId,
      purchaseInvoiceId: r.purchaseInvoiceId, paymentDate: r.paymentDate.toISOString(), amount: r.amount,
      currencyCode: r.currencyCode, paymentMethod: r.paymentMethod as PaymentMethod,
      paidFromAccountId: r.paidFromAccountId, referenceNumber: r.referenceNumber, notes: r.notes,
      status: r.status as PaymentStatus, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async findPaymentById(id: string): Promise<PaymentRecord | null> {
    const rows = await this.database.db.select(payColumns).from(payment).where(eq(payment.id, id)).limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id, paymentNumber: r.paymentNumber, orgNodeId: r.orgNodeId, supplierId: r.supplierId,
      purchaseInvoiceId: r.purchaseInvoiceId, paymentDate: r.paymentDate.toISOString(), amount: r.amount,
      currencyCode: r.currencyCode, paymentMethod: r.paymentMethod as PaymentMethod,
      paidFromAccountId: r.paidFromAccountId, referenceNumber: r.referenceNumber, notes: r.notes,
      status: r.status as PaymentStatus, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    };
  }

  async countPayments(): Promise<number> {
    const rows = await this.database.db.select({ id: payment.id }).from(payment);
    return rows.length;
  }

  async insertPayment(input: CreatePaymentInput & { id: string; paymentNumber: string }): Promise<PaymentRecord> {
    const rows = await this.database.db.insert(payment).values({
      id: input.id,
      paymentNumber: input.paymentNumber,
      orgNodeId: input.orgNodeId,
      supplierId: input.supplierId ?? null,
      purchaseInvoiceId: input.purchaseInvoiceId ?? null,
      paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
      amount: input.amount,
      currencyCode: input.currencyCode ?? 'EGP',
      paymentMethod: input.paymentMethod,
      paidFromAccountId: input.paidFromAccountId,
      referenceNumber: input.referenceNumber ?? null,
      notes: input.notes ?? null,
      status: 'draft',
    }).returning(payColumns);
    const r = rows[0]!;
    return {
      id: r.id, paymentNumber: r.paymentNumber, orgNodeId: r.orgNodeId, supplierId: r.supplierId,
      purchaseInvoiceId: r.purchaseInvoiceId, paymentDate: r.paymentDate.toISOString(), amount: r.amount,
      currencyCode: r.currencyCode, paymentMethod: r.paymentMethod as PaymentMethod,
      paidFromAccountId: r.paidFromAccountId, referenceNumber: r.referenceNumber, notes: r.notes,
      status: r.status as PaymentStatus, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    };
  }

  async setPaymentStatus(id: string, status: PaymentStatus): Promise<PaymentRecord> {
    await this.database.db.update(payment).set({ status, updatedAt: new Date() }).where(eq(payment.id, id));
    return (await this.findPaymentById(id))!;
  }

  // --- Credit & Debit Notes ---
  async countCreditDebitNotes(): Promise<number> {
    const rows = await this.database.db.select({ id: creditDebitNote.id }).from(creditDebitNote);
    return rows.length;
  }

  async listCreditDebitNotes(orgNodeId?: string, partyType?: 'customer' | 'supplier', partyId?: string): Promise<CreditDebitNoteRecord[]> {
    const conditions = [];
    if (orgNodeId) conditions.push(eq(creditDebitNote.orgNodeId, orgNodeId));
    if (partyType) conditions.push(eq(creditDebitNote.partyType, partyType));
    if (partyId) conditions.push(eq(creditDebitNote.partyId, partyId));

    const query = this.database.db.select(noteColumns).from(creditDebitNote);
    const rows = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(creditDebitNote.postingDate))
      : await query.orderBy(desc(creditDebitNote.postingDate));

    const results: CreditDebitNoteRecord[] = [];
    for (const r of rows) {
      const lines = await this.database.db.select(noteLineColumns).from(creditDebitNoteLine).where(eq(creditDebitNoteLine.noteId, r.id));
      results.push({
        id: r.id,
        noteNumber: r.noteNumber,
        noteType: r.noteType as any,
        orgNodeId: r.orgNodeId,
        partyType: r.partyType as any,
        partyId: r.partyId,
        originalInvoiceNumber: r.originalInvoiceNumber,
        salesInvoiceId: r.salesInvoiceId,
        purchaseInvoiceId: r.purchaseInvoiceId,
        postingDate: r.postingDate.toISOString(),
        netAmount: r.netAmount,
        taxAmount: r.taxAmount,
        grandTotal: r.grandTotal,
        reason: r.reason,
        status: r.status as any,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        lines: lines.map((l) => ({
          id: l.id,
          noteId: l.noteId,
          itemId: l.itemId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
          taxAmount: l.taxAmount,
          totalAmount: l.totalAmount,
          createdAt: l.createdAt.toISOString(),
        })),
      });
    }
    return results;
  }

  async findCreditDebitNoteById(id: string): Promise<CreditDebitNoteRecord | null> {
    const rows = await this.database.db.select(noteColumns).from(creditDebitNote).where(eq(creditDebitNote.id, id)).limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    const lines = await this.database.db.select(noteLineColumns).from(creditDebitNoteLine).where(eq(creditDebitNoteLine.noteId, r.id));
    return {
      id: r.id,
      noteNumber: r.noteNumber,
      noteType: r.noteType as any,
      orgNodeId: r.orgNodeId,
      partyType: r.partyType as any,
      partyId: r.partyId,
      originalInvoiceNumber: r.originalInvoiceNumber,
      salesInvoiceId: r.salesInvoiceId,
      purchaseInvoiceId: r.purchaseInvoiceId,
      postingDate: r.postingDate.toISOString(),
      netAmount: r.netAmount,
      taxAmount: r.taxAmount,
      grandTotal: r.grandTotal,
      reason: r.reason,
      status: r.status as any,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      lines: lines.map((l) => ({
        id: l.id,
        noteId: l.noteId,
        itemId: l.itemId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxRate: l.taxRate,
        taxAmount: l.taxAmount,
        totalAmount: l.totalAmount,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  }

  async insertCreditDebitNote(
    input: CreateCreditDebitNoteInput & {
      id: string;
      noteNumber: string;
      netAmount: string;
      taxAmount: string;
      grandTotal: string;
      computedLines: Array<{
        id: string;
        itemId: string;
        quantity: string;
        unitPrice: string;
        taxRate: string;
        taxAmount: string;
        totalAmount: string;
      }>;
    },
  ): Promise<CreditDebitNoteRecord> {
    const rows = await this.database.db.insert(creditDebitNote).values({
      id: input.id,
      noteNumber: input.noteNumber,
      noteType: input.noteType,
      orgNodeId: input.orgNodeId,
      partyType: input.partyType,
      partyId: input.partyId,
      originalInvoiceNumber: input.originalInvoiceNumber ?? null,
      salesInvoiceId: input.salesInvoiceId ?? null,
      purchaseInvoiceId: input.purchaseInvoiceId ?? null,
      postingDate: input.postingDate ? new Date(input.postingDate) : new Date(),
      netAmount: input.netAmount,
      taxAmount: input.taxAmount,
      grandTotal: input.grandTotal,
      reason: input.reason ?? null,
      status: 'draft',
    }).returning(noteColumns);

    const insertedNote = rows[0]!;
    const insertedLines: CreditDebitNoteLineRecord[] = [];

    for (const line of input.computedLines) {
      const lineRows = await this.database.db.insert(creditDebitNoteLine).values({
        id: line.id,
        noteId: insertedNote.id,
        itemId: line.itemId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate,
        taxAmount: line.taxAmount,
        totalAmount: line.totalAmount,
      }).returning(noteLineColumns);

      const l = lineRows[0]!;
      insertedLines.push({
        id: l.id,
        noteId: l.noteId,
        itemId: l.itemId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxRate: l.taxRate,
        taxAmount: l.taxAmount,
        totalAmount: l.totalAmount,
        createdAt: l.createdAt.toISOString(),
      });
    }

    return {
      id: insertedNote.id,
      noteNumber: insertedNote.noteNumber,
      noteType: insertedNote.noteType as any,
      orgNodeId: insertedNote.orgNodeId,
      partyType: insertedNote.partyType as any,
      partyId: insertedNote.partyId,
      originalInvoiceNumber: insertedNote.originalInvoiceNumber,
      salesInvoiceId: insertedNote.salesInvoiceId,
      purchaseInvoiceId: insertedNote.purchaseInvoiceId,
      postingDate: insertedNote.postingDate.toISOString(),
      netAmount: insertedNote.netAmount,
      taxAmount: insertedNote.taxAmount,
      grandTotal: insertedNote.grandTotal,
      reason: insertedNote.reason,
      status: insertedNote.status as any,
      createdAt: insertedNote.createdAt.toISOString(),
      updatedAt: insertedNote.updatedAt.toISOString(),
      lines: insertedLines,
    };
  }

  async setCreditDebitNoteStatus(id: string, status: CreditDebitNoteStatus): Promise<CreditDebitNoteRecord> {
    await this.database.db.update(creditDebitNote).set({ status, updatedAt: new Date() }).where(eq(creditDebitNote.id, id));
    return (await this.findCreditDebitNoteById(id))!;
  }

  // --- Bank Transfers ---
  async countBankTransfers(): Promise<number> {
    const rows = await this.database.db.select({ id: bankTransfer.id }).from(bankTransfer);
    return rows.length;
  }

  async listBankTransfers(orgNodeId?: string): Promise<BankTransferRecord[]> {
    const query = this.database.db.select(transferColumns).from(bankTransfer);
    const rows = orgNodeId
      ? await query.where(eq(bankTransfer.orgNodeId, orgNodeId)).orderBy(desc(bankTransfer.transferDate))
      : await query.orderBy(desc(bankTransfer.transferDate));

    return rows.map((r) => ({
      id: r.id,
      transferNumber: r.transferNumber,
      orgNodeId: r.orgNodeId,
      fromAccountId: r.fromAccountId,
      toAccountId: r.toAccountId,
      transferDate: r.transferDate.toISOString(),
      amount: r.amount,
      referenceNumber: r.referenceNumber,
      notes: r.notes,
      status: r.status as any,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async findBankTransferById(id: string): Promise<BankTransferRecord | null> {
    const rows = await this.database.db.select(transferColumns).from(bankTransfer).where(eq(bankTransfer.id, id)).limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      transferNumber: r.transferNumber,
      orgNodeId: r.orgNodeId,
      fromAccountId: r.fromAccountId,
      toAccountId: r.toAccountId,
      transferDate: r.transferDate.toISOString(),
      amount: r.amount,
      referenceNumber: r.referenceNumber,
      notes: r.notes,
      status: r.status as any,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async insertBankTransfer(input: CreateBankTransferInput & { id: string; transferNumber: string }): Promise<BankTransferRecord> {
    const rows = await this.database.db.insert(bankTransfer).values({
      id: input.id,
      transferNumber: input.transferNumber,
      orgNodeId: input.orgNodeId,
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      transferDate: input.transferDate ? new Date(input.transferDate) : new Date(),
      amount: input.amount,
      referenceNumber: input.referenceNumber ?? null,
      notes: input.notes ?? null,
      status: 'draft',
    }).returning(transferColumns);
    const r = rows[0]!;
    return {
      id: r.id,
      transferNumber: r.transferNumber,
      orgNodeId: r.orgNodeId,
      fromAccountId: r.fromAccountId,
      toAccountId: r.toAccountId,
      transferDate: r.transferDate.toISOString(),
      amount: r.amount,
      referenceNumber: r.referenceNumber,
      notes: r.notes,
      status: r.status as any,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async setBankTransferStatus(id: string, status: BankTransferStatus): Promise<BankTransferRecord> {
    await this.database.db.update(bankTransfer).set({ status, updatedAt: new Date() }).where(eq(bankTransfer.id, id));
    return (await this.findBankTransferById(id))!;
  }

  // --- Bank Reconciliation ---
  async countBankReconciliations(): Promise<number> {
    const rows = await this.database.db.select({ id: bankReconciliation.id }).from(bankReconciliation);
    return rows.length;
  }

  async listBankReconciliations(orgNodeId?: string, bankAccountId?: string): Promise<BankReconciliationRecord[]> {
    const conditions = [];
    if (orgNodeId) conditions.push(eq(bankReconciliation.orgNodeId, orgNodeId));
    if (bankAccountId) conditions.push(eq(bankReconciliation.bankAccountId, bankAccountId));

    const query = this.database.db.select(reconColumns).from(bankReconciliation);
    const rows = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(bankReconciliation.statementDate))
      : await query.orderBy(desc(bankReconciliation.statementDate));

    return rows.map((r) => ({
      id: r.id,
      reconciliationNumber: r.reconciliationNumber,
      orgNodeId: r.orgNodeId,
      bankAccountId: r.bankAccountId,
      statementDate: r.statementDate.toISOString(),
      statementBalance: r.statementBalance,
      clearedBalance: r.clearedBalance,
      differenceAmount: r.differenceAmount,
      status: r.status as any,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async findBankReconciliationById(id: string): Promise<BankReconciliationRecord | null> {
    const rows = await this.database.db.select(reconColumns).from(bankReconciliation).where(eq(bankReconciliation.id, id)).limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      reconciliationNumber: r.reconciliationNumber,
      orgNodeId: r.orgNodeId,
      bankAccountId: r.bankAccountId,
      statementDate: r.statementDate.toISOString(),
      statementBalance: r.statementBalance,
      clearedBalance: r.clearedBalance,
      differenceAmount: r.differenceAmount,
      status: r.status as any,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async insertBankReconciliation(
    input: CreateBankReconciliationInput & {
      id: string;
      reconciliationNumber: string;
      clearedBalance: string;
      differenceAmount: string;
    },
  ): Promise<BankReconciliationRecord> {
    const rows = await this.database.db.insert(bankReconciliation).values({
      id: input.id,
      reconciliationNumber: input.reconciliationNumber,
      orgNodeId: input.orgNodeId,
      bankAccountId: input.bankAccountId,
      statementDate: new Date(input.statementDate),
      statementBalance: input.statementBalance,
      clearedBalance: input.clearedBalance,
      differenceAmount: input.differenceAmount,
      status: 'reconciled',
      notes: input.notes ?? null,
    }).returning(reconColumns);
    const r = rows[0]!;
    return {
      id: r.id,
      reconciliationNumber: r.reconciliationNumber,
      orgNodeId: r.orgNodeId,
      bankAccountId: r.bankAccountId,
      statementDate: r.statementDate.toISOString(),
      statementBalance: r.statementBalance,
      clearedBalance: r.clearedBalance,
      differenceAmount: r.differenceAmount,
      status: r.status as any,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  /** Net amount already billed (non-cancelled invoices) against a receipt movement (plan item 12). */
  async sumBilledForReceipt(purchaseReceiptId: string): Promise<number> {
    const rows = await this.database.db
      .select({ total: sql<string>`coalesce(sum(${purchaseInvoiceLine.quantity} * ${purchaseInvoiceLine.unitCost}), 0)` })
      .from(purchaseInvoiceLine)
      .innerJoin(purchaseInvoice, eq(purchaseInvoice.id, purchaseInvoiceLine.purchaseInvoiceId))
      .where(and(eq(purchaseInvoiceLine.purchaseReceiptId, purchaseReceiptId), ne(purchaseInvoice.status, 'cancelled')));
    return Number(rows[0]?.total ?? 0);
  }

  /** An existing invoice of this supplier with this supplier invoice number (plan item 18). */
  async findPurchaseInvoiceBySupplierNumber(supplierId: string, invoiceNumber: string): Promise<{ systemNumber: string; invoiceDate: Date; status: string } | null> {
    const rows = await this.database.db
      .select({ systemNumber: purchaseInvoice.systemNumber, invoiceDate: purchaseInvoice.invoiceDate, status: purchaseInvoice.status })
      .from(purchaseInvoice)
      .where(and(eq(purchaseInvoice.supplierId, supplierId), eq(purchaseInvoice.invoiceNumber, invoiceNumber)))
      .limit(1);
    return rows[0] ?? null;
  }
}
