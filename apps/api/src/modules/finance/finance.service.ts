import { randomUUID } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { CrmService } from '../crm/crm.service';
import { InventoryService } from '../inventory/inventory.service';
import { PurchaseAllowanceService } from '../settings/purchase-allowance.service';
import { SalesService } from '../sales/sales.service';
import { AccountingService } from '../accounting/accounting.service';
import { AccountingRepository } from '../accounting/accounting.repository';
import type { JobOrderRecord } from '../sales/sales.types';
import { FinanceNotFoundError, FinanceValidationError } from './finance.errors';
import { FinanceRepository } from './finance.repository';
import type {
  BankReconciliationRecord,
  BankTransferRecord,
  CollectionRecord,
  CreateBankReconciliationInput,
  CreateBankTransferInput,
  CreateCollectionInput,
  CreateCreditDebitNoteInput,
  CreatePaymentInput,
  CreatePurchaseInvoiceInput,
  CreateRetentionInput,
  CreateSalesInvoiceInput,
  CreditDebitNoteRecord,
  PaymentRecord,
  PurchaseInvoiceRecord,
  RetentionRecord,
  SalesInvoiceRecord,
} from './finance.types';

@Injectable()
export class FinanceService {
  constructor(
    private readonly repository: FinanceRepository,
    private readonly salesService: SalesService,
    @Optional() private readonly accountingService?: AccountingService,
    @Optional() private readonly accountingRepo?: AccountingRepository,
    @Optional() private readonly crmService?: CrmService,
    @Optional() private readonly inventoryService?: InventoryService,
    @Optional() private readonly allowances?: PurchaseAllowanceService,
  ) {}

  /**
   * Over-billing allowance (plan item 12): invoice lines that reference a receipt (stock
   * movement) may bill, together with earlier non-cancelled invoices, at most the received
   * value plus the configured %. Guard only — no posting logic changes.
   */
  private async assertBillingWithinReceipts(
    orgNodeId: string, lines: Array<{ itemId: string; quantity: string; unitCost: string; purchaseReceiptId?: string }>,
  ): Promise<void> {
    const byReceipt = new Map<string, { itemId: string; amount: number }>();
    for (const l of lines) {
      if (!l.purchaseReceiptId) continue;
      const prev = byReceipt.get(l.purchaseReceiptId);
      if (prev && prev.itemId !== l.itemId) throw new FinanceValidationError(`receipt ${l.purchaseReceiptId} is referenced for two different items`);
      byReceipt.set(l.purchaseReceiptId, { itemId: l.itemId, amount: (prev?.amount ?? 0) + Number(l.quantity) * Number(l.unitCost) });
    }
    if (byReceipt.size === 0 || !this.inventoryService) return;
    const pct = this.allowances ? (await this.allowances.resolve(orgNodeId)).overBillingPct : 0;
    for (const [receiptId, line] of byReceipt) {
      const receipt = await this.inventoryService.getMovement(receiptId).catch(() => null);
      if (!receipt || receipt.movementType !== 'receipt') throw new FinanceValidationError(`purchase receipt ${receiptId} does not exist`);
      if (receipt.itemId !== line.itemId) throw new FinanceValidationError(`purchase receipt ${receiptId} is for a different item`);
      const received = Number(receipt.totalValue ?? 0);
      const billed = await this.repository.sumBilledForReceipt(receiptId);
      const max = PurchaseAllowanceService.limit(received, pct);
      if (billed + line.amount > max + 1e-6) {
        throw new FinanceValidationError(
          `الفاتورة تتجاوز قيمة الاستلام: قيمة الاستلام ${received.toFixed(2)}، المفوتر سابقاً ${billed.toFixed(2)}، ` +
          `الحالي ${line.amount.toFixed(2)}، والحد ${max.toFixed(2)} (نسبة السماح ${pct}%)`,
        );
      }
    }
  }

  /** Supplier hold (plan item 8): stops invoices / payments for a held supplier. */
  private async assertSupplierNotHeld(supplierId: string | null | undefined, action: 'invoice' | 'payment'): Promise<void> {
    if (!supplierId || !this.crmService) return;
    const blocked = await this.crmService.supplierBlockReason(supplierId, action);
    if (blocked) throw new FinanceValidationError(blocked);
  }

  private async getJobOrderOrThrow(jobOrderReference: string): Promise<JobOrderRecord> {
    const jobOrders = await this.salesService.getJobOrders();
    const found = jobOrders.find((jo) => jo.jobOrderNumber === jobOrderReference);
    if (!found) throw new FinanceNotFoundError(`job order "${jobOrderReference}" does not exist`);
    return found;
  }

  // --- Collections ---
  async getCollections(jobOrderReference?: string): Promise<CollectionRecord[]> {
    return this.repository.listCollections(jobOrderReference);
  }

  async recordCollection(input: CreateCollectionInput): Promise<CollectionRecord> {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new FinanceValidationError('amount must be positive');

    const jobOrder = await this.getJobOrderOrThrow(input.jobOrderReference);
    const sequence = (await this.repository.countCollections()) + 1;
    const year = new Date().getFullYear();
    const collectionNumber = `COL-${year}-${String(sequence).padStart(6, '0')}`;

    const collectionRecord = await this.repository.insertCollection({
      id: randomUUID(),
      collectionNumber,
      orgNodeId: jobOrder.orgNodeId,
      ...input,
    });

    if (this.accountingService && this.accountingRepo && input.receivedInAccountId && jobOrder.orgNodeId) {
      const config = await this.accountingRepo.findCompanyConfig(jobOrder.orgNodeId);
      const determinations = await this.accountingRepo.listAccountDeterminations(jobOrder.orgNodeId);

      const arDet = determinations.find((d) => d.accountPurpose === 'receivable');
      const arAccountId = arDet?.accountId ?? config?.defaultReceivableAccountId;

      if (arAccountId) {
        const draftEntry = await this.accountingService.createEntry({
          orgNodeId: jobOrder.orgNodeId,
          description: `Customer Collection ${collectionNumber} for JO ${input.jobOrderReference}`,
          reference: collectionNumber,
          entryDate: input.collectionDate,
          isAutoGenerated: true,
          idempotencyKey: `collection-${collectionRecord.id}`,
          sourceEventType: 'collection',
          lines: [
            {
              accountId: input.receivedInAccountId,
              debitAmount: Number(input.amount).toFixed(4),
              creditAmount: '0',
              description: `[Auto] Deposit for Collection ${collectionNumber}`,
            },
            {
              accountId: arAccountId,
              debitAmount: '0',
              creditAmount: Number(input.amount).toFixed(4),
              description: `[Auto] AR Clearance for Collection ${collectionNumber}`,
              partyType: 'customer',
              partyId: jobOrder.customerId ?? undefined,
            } as any,
          ],
        });

        await this.accountingService.postEntry(draftEntry.id);
      }
    }

    return collectionRecord;
  }

  // --- Retentions ---
  async getRetentions(jobOrderReference?: string): Promise<RetentionRecord[]> {
    return this.repository.listRetentions(jobOrderReference);
  }

  async createRetention(input: CreateRetentionInput): Promise<RetentionRecord> {
    const amount = Number(input.originalAmount);
    if (!Number.isFinite(amount) || amount <= 0) throw new FinanceValidationError('originalAmount must be positive');
    if (!input.dueDate) throw new FinanceValidationError('dueDate is required');

    const jobOrder = await this.getJobOrderOrThrow(input.jobOrderReference);
    const sequence = (await this.repository.countRetentions()) + 1;
    const year = new Date().getFullYear();
    const retentionNumber = `RET-${year}-${String(sequence).padStart(6, '0')}`;

    return this.repository.insertRetention({ id: randomUUID(), retentionNumber, orgNodeId: jobOrder.orgNodeId, ...input });
  }

  async releaseRetention(id: string, amount: string): Promise<RetentionRecord> {
    const retentionRecord = await this.repository.findRetentionById(id);
    if (!retentionRecord) throw new FinanceNotFoundError(`retention ${id} does not exist`);
    if (retentionRecord.status !== 'active') {
      throw new FinanceValidationError(`retention ${id} is "${retentionRecord.status}" and cannot be released (must be "active")`);
    }

    const releaseAmount = Number(amount);
    if (!Number.isFinite(releaseAmount) || releaseAmount <= 0) throw new FinanceValidationError('release amount must be positive');

    const remaining = Number(retentionRecord.originalAmount) - Number(retentionRecord.releasedAmount);
    if (releaseAmount > remaining) {
      throw new FinanceValidationError(`release amount ${releaseAmount} exceeds remaining retention ${remaining}`);
    }

    const newReleasedTotal = (Number(retentionRecord.releasedAmount) + releaseAmount).toFixed(4);
    const isFullyReleased = Number(newReleasedTotal) >= Number(retentionRecord.originalAmount);
    return this.repository.releaseRetention(id, newReleasedTotal, isFullyReleased ? 'released' : 'active');
  }

  // --- Purchase Invoices & AP Accounting ---
  async getPurchaseInvoices(orgNodeId?: string, supplierId?: string): Promise<PurchaseInvoiceRecord[]> {
    return this.repository.listPurchaseInvoices(orgNodeId, supplierId);
  }

  async getPurchaseInvoice(id: string): Promise<PurchaseInvoiceRecord> {
    const found = await this.repository.findPurchaseInvoiceById(id);
    if (!found) throw new FinanceNotFoundError(`purchase invoice ${id} does not exist`);
    return found;
  }

  async createPurchaseInvoice(input: CreatePurchaseInvoiceInput): Promise<PurchaseInvoiceRecord> {
    if (!input.orgNodeId) throw new FinanceValidationError('orgNodeId is required');
    if (!input.supplierId) throw new FinanceValidationError('supplierId is required');
    if (!input.invoiceNumber || input.invoiceNumber.trim().length === 0) {
      throw new FinanceValidationError('supplier invoice number is required');
    }
    if (!input.lines || input.lines.length === 0) {
      throw new FinanceValidationError('purchase invoice must have at least one line');
    }
    await this.assertSupplierNotHeld(input.supplierId, 'invoice');
    await this.assertBillingWithinReceipts(input.orgNodeId, input.lines);

    let netTotal = 0;
    let taxTotal = 0;

    const computedLines = input.lines.map((l) => {
      const qty = Number(l.quantity);
      const cost = Number(l.unitCost);
      const rate = Number(l.taxRate ?? '14.00');

      if (!Number.isFinite(qty) || qty <= 0) throw new FinanceValidationError('line quantity must be positive');
      if (!Number.isFinite(cost) || cost < 0) throw new FinanceValidationError('line unitCost must be non-negative');

      const lineNet = qty * cost;
      const lineTax = (lineNet * rate) / 100;
      const lineGrand = lineNet + lineTax;

      netTotal += lineNet;
      taxTotal += lineTax;

      return {
        id: randomUUID(),
        itemId: l.itemId,
        quantity: l.quantity,
        unitCost: l.unitCost,
        taxRate: rate.toFixed(2),
        taxAmount: lineTax.toFixed(4),
        totalAmount: lineGrand.toFixed(4),
        purchaseReceiptId: l.purchaseReceiptId,
      };
    });

    const grandTotal = netTotal + taxTotal;
    const sequence = (await this.repository.countPurchaseInvoices()) + 1;
    const year = new Date().getFullYear();
    const systemNumber = `PINV-${year}-${String(sequence).padStart(6, '0')}`;

    // Plan item 18: the database already forbids a repeated supplier invoice number for the same
    // supplier (for all years — stricter than per fiscal year); answer 400 with the details instead
    // of letting the unique constraint surface as a 500.
    const duplicate = await this.repository.findPurchaseInvoiceBySupplierNumber(input.supplierId, input.invoiceNumber);
    if (duplicate) {
      throw new FinanceValidationError(
        `رقم فاتورة المورد "${input.invoiceNumber.trim()}" مسجّل بالفعل لنفس المورد في ${duplicate.systemNumber} ` +
        `بتاريخ ${duplicate.invoiceDate.toISOString().slice(0, 10)} (${duplicate.status})`,
      );
    }
    return this.repository.insertPurchaseInvoice({
      ...input,
      id: randomUUID(),
      systemNumber,
      netAmount: netTotal.toFixed(4),
      taxAmount: taxTotal.toFixed(4),
      grandTotal: grandTotal.toFixed(4),
      computedLines,
    });
  }

  async postPurchaseInvoice(id: string): Promise<PurchaseInvoiceRecord> {
    const invoice = await this.getPurchaseInvoice(id);
    if (invoice.status !== 'draft') {
      throw new FinanceValidationError(`purchase invoice ${id} is "${invoice.status}" and cannot be posted (must be "draft")`);
    }
    await this.assertSupplierNotHeld(invoice.supplierId, 'invoice');

    if (this.accountingService && this.accountingRepo) {
      const config = await this.accountingRepo.findCompanyConfig(invoice.orgNodeId);
      const determinations = await this.accountingRepo.listAccountDeterminations(invoice.orgNodeId);

      const grniDet = determinations.find((d) => d.accountPurpose === 'purchase' || d.accountPurpose === 'grni');
      const grniAccountId = grniDet?.accountId ?? config?.defaultGrniAccountId;

      const taxDet = determinations.find((d) => d.accountPurpose === 'input_tax');
      const taxAccountId = taxDet?.accountId ?? config?.defaultInputTaxAccountId;

      const apDet = determinations.find((d) => d.accountPurpose === 'payable');
      const apAccountId = apDet?.accountId ?? config?.defaultPayableAccountId;

      if (grniAccountId && apAccountId) {
        const lines = [
          {
            accountId: grniAccountId,
            debitAmount: invoice.netAmount,
            creditAmount: '0',
            description: `[Auto] GRNI Clearance for PINV ${invoice.systemNumber} (Supplier Inv: ${invoice.invoiceNumber})`,
          },
        ];

        if (Number(invoice.taxAmount) > 0 && taxAccountId) {
          lines.push({
            accountId: taxAccountId,
            debitAmount: invoice.taxAmount,
            creditAmount: '0',
            description: `[Auto] Input VAT (14%) for PINV ${invoice.systemNumber}`,
          });
        }

        lines.push({
          accountId: apAccountId,
          debitAmount: '0',
          creditAmount: invoice.grandTotal,
          description: `[Auto] Payable to Supplier for PINV ${invoice.systemNumber}`,
          partyType: 'supplier',
          partyId: invoice.supplierId,
        } as any);

        const draftEntry = await this.accountingService.createEntry({
          orgNodeId: invoice.orgNodeId,
          description: `Purchase Invoice ${invoice.systemNumber} (${invoice.invoiceNumber})`,
          reference: invoice.systemNumber,
          entryDate: invoice.invoiceDate,
          isAutoGenerated: true,
          idempotencyKey: `purchase-invoice-${invoice.id}`,
          sourceEventType: 'purchase_invoice',
          lines,
        });

        await this.accountingService.postEntry(draftEntry.id);
      }
    }

    return this.repository.setPurchaseInvoiceStatus(id, 'posted');
  }

  async cancelPurchaseInvoice(id: string): Promise<PurchaseInvoiceRecord> {
    const invoice = await this.getPurchaseInvoice(id);
    if (invoice.status === 'posted') {
      throw new FinanceValidationError(`purchase invoice ${id} is already posted and cannot be cancelled`);
    }
    return this.repository.setPurchaseInvoiceStatus(id, 'cancelled');
  }

  // --- Sales Invoices & AR / Revenue Accounting ---
  async getSalesInvoices(orgNodeId?: string, customerId?: string): Promise<SalesInvoiceRecord[]> {
    return this.repository.listSalesInvoices(orgNodeId, customerId);
  }

  async getSalesInvoice(id: string): Promise<SalesInvoiceRecord> {
    const found = await this.repository.findSalesInvoiceById(id);
    if (!found) throw new FinanceNotFoundError(`sales invoice ${id} does not exist`);
    return found;
  }

  async createSalesInvoice(input: CreateSalesInvoiceInput): Promise<SalesInvoiceRecord> {
    if (!input.orgNodeId) throw new FinanceValidationError('orgNodeId is required');
    if (!input.customerId) throw new FinanceValidationError('customerId is required');
    if (!input.lines || input.lines.length === 0) {
      throw new FinanceValidationError('sales invoice must have at least one line');
    }

    let netTotal = 0;
    let taxTotal = 0;

    const computedLines = input.lines.map((l) => {
      const qty = Number(l.quantity);
      const price = Number(l.unitPrice);
      const rate = Number(l.taxRate ?? '14.00');

      if (!Number.isFinite(qty) || qty <= 0) throw new FinanceValidationError('line quantity must be positive');
      if (!Number.isFinite(price) || price < 0) throw new FinanceValidationError('line unitPrice must be non-negative');

      const lineNet = qty * price;
      const lineTax = (lineNet * rate) / 100;
      const lineGrand = lineNet + lineTax;

      netTotal += lineNet;
      taxTotal += lineTax;

      return {
        id: randomUUID(),
        itemId: l.itemId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxRate: rate.toFixed(2),
        taxAmount: lineTax.toFixed(4),
        totalAmount: lineGrand.toFixed(4),
        deliveryOrderId: l.deliveryOrderId,
      };
    });

    const grandTotal = netTotal + taxTotal;
    const sequence = (await this.repository.countSalesInvoices()) + 1;
    const year = new Date().getFullYear();
    const invoiceNumber = `SINV-${year}-${String(sequence).padStart(6, '0')}`;

    return this.repository.insertSalesInvoice({
      ...input,
      id: randomUUID(),
      invoiceNumber,
      netAmount: netTotal.toFixed(4),
      taxAmount: taxTotal.toFixed(4),
      grandTotal: grandTotal.toFixed(4),
      computedLines,
    });
  }

  async postSalesInvoice(id: string): Promise<SalesInvoiceRecord> {
    const invoice = await this.getSalesInvoice(id);
    if (invoice.status !== 'draft') {
      throw new FinanceValidationError(`sales invoice ${id} is "${invoice.status}" and cannot be posted (must be "draft")`);
    }

    if (this.accountingService && this.accountingRepo) {
      const config = await this.accountingRepo.findCompanyConfig(invoice.orgNodeId);
      const determinations = await this.accountingRepo.listAccountDeterminations(invoice.orgNodeId);

      const arDet = determinations.find((d) => d.accountPurpose === 'receivable');
      const arAccountId = arDet?.accountId ?? config?.defaultReceivableAccountId;

      const revDet = determinations.find((d) => d.accountPurpose === 'revenue');
      const revAccountId = revDet?.accountId;

      const taxDet = determinations.find((d) => d.accountPurpose === 'output_tax');
      const taxAccountId = taxDet?.accountId ?? config?.defaultOutputTaxAccountId;

      if (arAccountId && revAccountId) {
        const lines = [
          {
            accountId: arAccountId,
            debitAmount: invoice.grandTotal,
            creditAmount: '0',
            description: `[Auto] Receivable for Sales Invoice ${invoice.invoiceNumber}`,
            partyType: 'customer',
            partyId: invoice.customerId,
          } as any,
          {
            accountId: revAccountId,
            debitAmount: '0',
            creditAmount: invoice.netAmount,
            description: `[Auto] Revenue for Sales Invoice ${invoice.invoiceNumber}`,
          },
        ];

        if (Number(invoice.taxAmount) > 0 && taxAccountId) {
          lines.push({
            accountId: taxAccountId,
            debitAmount: '0',
            creditAmount: invoice.taxAmount,
            description: `[Auto] Output VAT (14%) for Sales Invoice ${invoice.invoiceNumber}`,
          });
        }

        const draftEntry = await this.accountingService.createEntry({
          orgNodeId: invoice.orgNodeId,
          description: `Sales Invoice ${invoice.invoiceNumber}`,
          reference: invoice.invoiceNumber,
          entryDate: invoice.invoiceDate,
          isAutoGenerated: true,
          idempotencyKey: `sales-invoice-${invoice.id}`,
          sourceEventType: 'sales_invoice',
          lines,
        });

        await this.accountingService.postEntry(draftEntry.id);
      }
    }

    return this.repository.setSalesInvoiceStatus(id, 'posted');
  }

  async cancelSalesInvoice(id: string): Promise<SalesInvoiceRecord> {
    const invoice = await this.getSalesInvoice(id);
    if (invoice.status === 'posted') {
      throw new FinanceValidationError(`sales invoice ${id} is already posted and cannot be cancelled`);
    }
    return this.repository.setSalesInvoiceStatus(id, 'cancelled');
  }

  // --- Payments (Supplier Payments) ---
  async getPayments(orgNodeId?: string, supplierId?: string): Promise<PaymentRecord[]> {
    return this.repository.listPayments(orgNodeId, supplierId);
  }

  async getPayment(id: string): Promise<PaymentRecord> {
    const found = await this.repository.findPaymentById(id);
    if (!found) throw new FinanceNotFoundError(`payment ${id} does not exist`);
    return found;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentRecord> {
    if (!input.orgNodeId) throw new FinanceValidationError('orgNodeId is required');
    if (!input.paidFromAccountId) throw new FinanceValidationError('paidFromAccountId (Bank/Cash account) is required');

    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new FinanceValidationError('payment amount must be positive');
    await this.assertSupplierNotHeld(input.supplierId, 'payment');

    const sequence = (await this.repository.countPayments()) + 1;
    const year = new Date().getFullYear();
    const paymentNumber = `PAY-${year}-${String(sequence).padStart(6, '0')}`;

    return this.repository.insertPayment({
      ...input,
      id: randomUUID(),
      paymentNumber,
      amount: amount.toFixed(4),
    });
  }

  async postPayment(id: string): Promise<PaymentRecord> {
    const p = await this.getPayment(id);
    if (p.status !== 'draft') {
      throw new FinanceValidationError(`payment ${id} is "${p.status}" and cannot be posted (must be "draft")`);
    }
    await this.assertSupplierNotHeld(p.supplierId, 'payment');

    if (this.accountingService && this.accountingRepo && p.paidFromAccountId) {
      const config = await this.accountingRepo.findCompanyConfig(p.orgNodeId);
      const determinations = await this.accountingRepo.listAccountDeterminations(p.orgNodeId);

      const apDet = determinations.find((d) => d.accountPurpose === 'payable');
      const apAccountId = apDet?.accountId ?? config?.defaultPayableAccountId;

      if (apAccountId) {
        const draftEntry = await this.accountingService.createEntry({
          orgNodeId: p.orgNodeId,
          description: `Supplier Payment ${p.paymentNumber}`,
          reference: p.paymentNumber,
          entryDate: p.paymentDate,
          isAutoGenerated: true,
          idempotencyKey: `payment-${p.id}`,
          sourceEventType: 'payment',
          lines: [
            {
              accountId: apAccountId,
              debitAmount: p.amount,
              creditAmount: '0',
              description: `[Auto] AP Settlement via Payment ${p.paymentNumber}`,
              partyType: 'supplier',
              partyId: p.supplierId ?? undefined,
            } as any,
            {
              accountId: p.paidFromAccountId,
              debitAmount: '0',
              creditAmount: p.amount,
              description: `[Auto] Bank/Cash Outflow for Payment ${p.paymentNumber}`,
            },
          ],
        });

        await this.accountingService.postEntry(draftEntry.id);
      }
    }

    return this.repository.setPaymentStatus(id, 'posted');
  }

  async cancelPayment(id: string): Promise<PaymentRecord> {
    const p = await this.getPayment(id);
    if (p.status === 'posted') {
      throw new FinanceValidationError(`payment ${id} is already posted and cannot be cancelled`);
    }
    return this.repository.setPaymentStatus(id, 'cancelled');
  }

  // --- Credit & Debit Notes ---
  async getCreditDebitNotes(orgNodeId?: string, partyType?: 'customer' | 'supplier', partyId?: string): Promise<CreditDebitNoteRecord[]> {
    return this.repository.listCreditDebitNotes(orgNodeId, partyType, partyId);
  }

  async getCreditDebitNote(id: string): Promise<CreditDebitNoteRecord> {
    const found = await this.repository.findCreditDebitNoteById(id);
    if (!found) throw new FinanceNotFoundError(`credit/debit note ${id} does not exist`);
    return found;
  }

  async createCreditDebitNote(input: CreateCreditDebitNoteInput): Promise<CreditDebitNoteRecord> {
    if (!input.orgNodeId) throw new FinanceValidationError('orgNodeId is required');
    if (!input.partyId) throw new FinanceValidationError('partyId is required');
    if (!input.lines || input.lines.length === 0) {
      throw new FinanceValidationError('Credit/Debit note must have at least one line');
    }

    let netTotal = 0;
    let taxTotal = 0;

    const computedLines = input.lines.map((l) => {
      const qty = Number(l.quantity);
      const price = Number(l.unitPrice);
      const rate = Number(l.taxRate ?? '14.00');

      if (!Number.isFinite(qty) || qty <= 0) throw new FinanceValidationError('Line quantity must be positive');
      if (!Number.isFinite(price) || price < 0) throw new FinanceValidationError('Line unit price must be non-negative');

      const lineNet = qty * price;
      const lineTax = (lineNet * rate) / 100;
      const lineGrand = lineNet + lineTax;

      netTotal += lineNet;
      taxTotal += lineTax;

      return {
        id: randomUUID(),
        itemId: l.itemId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxRate: rate.toFixed(2),
        taxAmount: lineTax.toFixed(4),
        totalAmount: lineGrand.toFixed(4),
      };
    });

    const grandTotal = netTotal + taxTotal;
    const sequence = (await this.repository.countCreditDebitNotes()) + 1;
    const year = new Date().getFullYear();
    const prefix = input.noteType === 'credit_note' ? 'CRN' : 'DBN';
    const noteNumber = `${prefix}-${year}-${String(sequence).padStart(6, '0')}`;

    return this.repository.insertCreditDebitNote({
      ...input,
      id: randomUUID(),
      noteNumber,
      netAmount: netTotal.toFixed(4),
      taxAmount: taxTotal.toFixed(4),
      grandTotal: grandTotal.toFixed(4),
      computedLines,
    });
  }

  async postCreditDebitNote(id: string): Promise<CreditDebitNoteRecord> {
    const note = await this.getCreditDebitNote(id);
    if (note.status !== 'draft') {
      throw new FinanceValidationError(`Note ${id} is "${note.status}" and cannot be posted`);
    }

    if (this.accountingService && this.accountingRepo) {
      const config = await this.accountingRepo.findCompanyConfig(note.orgNodeId);
      const determinations = await this.accountingRepo.listAccountDeterminations(note.orgNodeId);

      if (note.noteType === 'credit_note') {
        const arDet = determinations.find((d) => d.accountPurpose === 'receivable');
        const arAccountId = arDet?.accountId ?? config?.defaultReceivableAccountId;

        const revDet = determinations.find((d) => d.accountPurpose === 'revenue');
        const revAccountId = revDet?.accountId;

        const taxDet = determinations.find((d) => d.accountPurpose === 'output_tax');
        const taxAccountId = taxDet?.accountId ?? config?.defaultOutputTaxAccountId;

        if (arAccountId && revAccountId) {
          const lines = [
            {
              accountId: revAccountId,
              debitAmount: note.netAmount,
              creditAmount: '0',
              description: `[Auto] Sales Return / Credit Note ${note.noteNumber}`,
            },
          ];

          if (Number(note.taxAmount) > 0 && taxAccountId) {
            lines.push({
              accountId: taxAccountId,
              debitAmount: note.taxAmount,
              creditAmount: '0',
              description: `[Auto] Output VAT Reversal for Credit Note ${note.noteNumber}`,
            });
          }

          lines.push({
            accountId: arAccountId,
            debitAmount: '0',
            creditAmount: note.grandTotal,
            description: `[Auto] AR Reduction via Credit Note ${note.noteNumber}`,
            partyType: 'customer',
            partyId: note.partyId,
          } as any);

          const draftJournal = await this.accountingService.createEntry({
            orgNodeId: note.orgNodeId,
            description: `Customer Credit Note ${note.noteNumber} (${note.reason ?? ''})`,
            reference: note.noteNumber,
            entryDate: note.postingDate,
            isAutoGenerated: true,
            idempotencyKey: `credit-note-${note.id}`,
            sourceEventType: 'credit_note',
            lines,
          });

          await this.accountingService.postEntry(draftJournal.id);
        }
      } else {
        const apDet = determinations.find((d) => d.accountPurpose === 'payable');
        const apAccountId = apDet?.accountId ?? config?.defaultPayableAccountId;

        const invDet = determinations.find((d) => d.accountPurpose === 'inventory');
        const invAccountId = invDet?.accountId;

        const taxDet = determinations.find((d) => d.accountPurpose === 'input_tax');
        const taxAccountId = taxDet?.accountId ?? config?.defaultInputTaxAccountId;

        if (apAccountId && invAccountId) {
          const lines = [
            {
              accountId: apAccountId,
              debitAmount: note.grandTotal,
              creditAmount: '0',
              description: `[Auto] AP Reduction via Debit Note ${note.noteNumber}`,
              partyType: 'supplier',
              partyId: note.partyId,
            } as any,
            {
              accountId: invAccountId,
              debitAmount: '0',
              creditAmount: note.netAmount,
              description: `[Auto] Inventory Return for Debit Note ${note.noteNumber}`,
            },
          ];

          if (Number(note.taxAmount) > 0 && taxAccountId) {
            lines.push({
              accountId: taxAccountId,
              debitAmount: '0',
              creditAmount: note.taxAmount,
              description: `[Auto] Input VAT Reversal for Debit Note ${note.noteNumber}`,
            });
          }

          const draftJournal = await this.accountingService.createEntry({
            orgNodeId: note.orgNodeId,
            description: `Supplier Debit Note ${note.noteNumber} (${note.reason ?? ''})`,
            reference: note.noteNumber,
            entryDate: note.postingDate,
            isAutoGenerated: true,
            idempotencyKey: `debit-note-${note.id}`,
            sourceEventType: 'debit_note',
            lines,
          });

          await this.accountingService.postEntry(draftJournal.id);
        }
      }
    }

    return this.repository.setCreditDebitNoteStatus(id, 'posted');
  }

  async cancelCreditDebitNote(id: string): Promise<CreditDebitNoteRecord> {
    const note = await this.getCreditDebitNote(id);
    if (note.status === 'posted') {
      throw new FinanceValidationError(`Note ${id} is already posted and cannot be cancelled`);
    }
    return this.repository.setCreditDebitNoteStatus(id, 'cancelled');
  }

  // --- Bank Transfers Engine ---
  async getBankTransfers(orgNodeId?: string): Promise<BankTransferRecord[]> {
    return this.repository.listBankTransfers(orgNodeId);
  }

  async getBankTransfer(id: string): Promise<BankTransferRecord> {
    const found = await this.repository.findBankTransferById(id);
    if (!found) throw new FinanceNotFoundError(`Bank transfer ${id} does not exist`);
    return found;
  }

  async createBankTransfer(input: CreateBankTransferInput): Promise<BankTransferRecord> {
    if (!input.orgNodeId) throw new FinanceValidationError('orgNodeId is required');
    if (!input.fromAccountId || !input.toAccountId) {
      throw new FinanceValidationError('fromAccountId and toAccountId are required');
    }
    if (input.fromAccountId === input.toAccountId) {
      throw new FinanceValidationError('Source and destination accounts must be different');
    }

    const amountNum = Number(input.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      throw new FinanceValidationError('Transfer amount must be positive');
    }

    const sequence = (await this.repository.countBankTransfers()) + 1;
    const year = new Date().getFullYear();
    const transferNumber = `BTR-${year}-${String(sequence).padStart(6, '0')}`;

    return this.repository.insertBankTransfer({
      ...input,
      id: randomUUID(),
      transferNumber,
      amount: amountNum.toFixed(4),
    });
  }

  async postBankTransfer(id: string): Promise<BankTransferRecord> {
    const transfer = await this.getBankTransfer(id);
    if (transfer.status !== 'draft') {
      throw new FinanceValidationError(`Transfer ${id} is "${transfer.status}" and cannot be posted`);
    }

    // Automated Double-Entry GL Posting for Bank/Cash Transfer:
    // [Dr: Destination Bank/Cash Account / Cr: Source Bank/Cash Account]
    if (this.accountingService) {
      const draftJournal = await this.accountingService.createEntry({
        orgNodeId: transfer.orgNodeId,
        description: `[Auto] تحويل مالي داخلي: ${transfer.transferNumber}`,
        reference: transfer.transferNumber,
        entryDate: transfer.transferDate,
        isAutoGenerated: true,
        idempotencyKey: `bank-transfer-${transfer.id}`,
        sourceEventType: 'bank_transfer',
        lines: [
          {
            accountId: transfer.toAccountId,
            debitAmount: transfer.amount,
            creditAmount: '0',
            description: `[Auto] إيداع تحويل مالي: ${transfer.transferNumber}`,
          },
          {
            accountId: transfer.fromAccountId,
            debitAmount: '0',
            creditAmount: transfer.amount,
            description: `[Auto] سحب تحويل مالي: ${transfer.transferNumber}`,
          },
        ],
      });

      await this.accountingService.postEntry(draftJournal.id);
    }

    return this.repository.setBankTransferStatus(id, 'posted');
  }

  async cancelBankTransfer(id: string): Promise<BankTransferRecord> {
    const transfer = await this.getBankTransfer(id);
    if (transfer.status === 'posted') {
      throw new FinanceValidationError(`Transfer ${id} is already posted and cannot be cancelled`);
    }
    return this.repository.setBankTransferStatus(id, 'cancelled');
  }

  // --- Bank Reconciliation Engine ---
  async getBankReconciliations(orgNodeId?: string, bankAccountId?: string): Promise<BankReconciliationRecord[]> {
    return this.repository.listBankReconciliations(orgNodeId, bankAccountId);
  }

  async createBankReconciliation(input: CreateBankReconciliationInput): Promise<BankReconciliationRecord> {
    if (!input.orgNodeId) throw new FinanceValidationError('orgNodeId is required');
    if (!input.bankAccountId) throw new FinanceValidationError('bankAccountId is required');

    const statementBal = Number(input.statementBalance);
    if (!Number.isFinite(statementBal)) {
      throw new FinanceValidationError('statementBalance must be a valid number');
    }

    // Calculate cleared balance from GL posted lines up to statement date
    let clearedBal = 0;
    if (this.accountingRepo) {
      const lines = await this.accountingRepo.listAllPostedLinesWithDetails({
        orgNodeId: input.orgNodeId,
        endDate: input.statementDate,
      });

      for (const l of lines) {
        if (l.accountId === input.bankAccountId) {
          clearedBal += Number(l.debit) - Number(l.credit);
        }
      }
    }

    const difference = statementBal - clearedBal;
    const sequence = (await this.repository.countBankReconciliations()) + 1;
    const year = new Date().getFullYear();
    const reconciliationNumber = `BREC-${year}-${String(sequence).padStart(6, '0')}`;

    return this.repository.insertBankReconciliation({
      ...input,
      id: randomUUID(),
      reconciliationNumber,
      statementBalance: statementBal.toFixed(4),
      clearedBalance: clearedBal.toFixed(4),
      differenceAmount: difference.toFixed(4),
    });
  }
}