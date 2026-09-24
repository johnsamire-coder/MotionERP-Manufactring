// ============================================================
// Motion ERP — Egyptian Tax Authority & Customs Service
// Step 79 | Complete Service with Landed Cost Capitalization
// ============================================================
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  Optional,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import {
  taxSettlement,
  withholdingTaxEntry,
  customsDeclaration,
  TaxSettlement,
  WithholdingTaxEntry,
  CustomsDeclaration,
} from './tax-customs.schema';
import {
  CreateTaxSettlementDto,
  SettleAndPayVatDto,
  CreateWhtEntryDto,
  CreateCustomsDeclarationDto,
  QueryTaxSettlementsDto,
  QueryWhtEntriesDto,
  QueryCustomsDto,
} from './tax-customs.dto';
import { Form41QuarterSummary } from './tax-customs.types';
import { ModuleRef } from '@nestjs/core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InventoryService } from '../inventory/inventory.service';
import { AccountingService } from './accounting.service';
import type { JournalEntryRecord } from './accounting.types';
import { postManualJournal } from './manual-journal';

@Injectable()
export class TaxAndCustomsService {
  constructor(
    @Inject('DRIZZLE') private readonly db: NodePgDatabase,
    private readonly accounting: AccountingService,
    @Optional() private readonly moduleRef?: ModuleRef,
  ) {}

  /** The company's input and output VAT accounts (company accounting config, plan item 33). */
  private async vatAccounts(companyId: string): Promise<{ input: string; output: string }> {
    const config = await this.accounting.getCompanyConfig(companyId);
    if (!config?.defaultInputTaxAccountId || !config.defaultOutputTaxAccountId)
      throw new BadRequestException(
        'حدّد حساب ضريبة المدخلات وحساب ضريبة المخرجات في إعدادات الشركة المحاسبية الأول',
      );
    return { input: config.defaultInputTaxAccountId, output: config.defaultOutputTaxAccountId };
  }

  // ── 1. VAT Return Settlements ──────────────
  /**
   * Files a VAT return and posts it: Dr output VAT / Cr input VAT, and the net to the tax authority
   * account (credit when due, debit when it is a refund).
   */
  async createTaxSettlement(
    dto: CreateTaxSettlementDto,
    userId: string,
  ): Promise<{ settlement: TaxSettlement; journalEntry: JournalEntryRecord }> {
    const netVat = dto.outputVatAmount - dto.inputVatAmount;
    const settlementNumber = `VAT-SETTLE-${dto.taxPeriod}-${Date.now().toString().slice(-4)}`;
    const vat = await this.vatAccounts(dto.companyId);
    const journal = await postManualJournal(this.accounting, {
      orgNodeId: dto.companyId,
      entryDate: new Date(dto.settlementDate ?? Date.now()).toISOString(),
      description: `تسوية إقرار ضريبة القيمة المضافة ${dto.taxPeriod}`,
      reference: settlementNumber,
      sourceEventType: 'vat_settlement',
      idempotencyKey: `vat-return-${settlementNumber}`,
      lines: [
        { accountId: vat.output, debit: dto.outputVatAmount, credit: 0 },
        { accountId: vat.input, debit: 0, credit: dto.inputVatAmount },
        {
          accountId: dto.vatPayableAccountId,
          debit: netVat < 0 ? -netVat : 0,
          credit: netVat > 0 ? netVat : 0,
        },
      ],
    });

    const [record] = await this.db
      .insert(taxSettlement)
      .values({
        settlementNumber,
        companyId: dto.companyId,
        fiscalYearId: dto.fiscalYearId,
        periodId: dto.periodId,
        taxPeriod: dto.taxPeriod,
        totalSalesTaxable: dto.totalSalesTaxable.toFixed(4),
        outputVatAmount: dto.outputVatAmount.toFixed(4),
        totalPurchaseTaxable: dto.totalPurchaseTaxable.toFixed(4),
        inputVatAmount: dto.inputVatAmount.toFixed(4),
        netVatPayable: netVat.toFixed(4),
        status: 'filed',
        journalEntryId: journal.id,
        vatPayableAccountId: dto.vatPayableAccountId,
        createdBy: userId,
      })
      .returning();

    return { settlement: record!, journalEntry: journal };
  }

  /** Pays the net VAT due: Dr tax authority account / Cr the bank account. */
  async payTaxSettlement(
    dto: SettleAndPayVatDto,
    _userId: string,
  ): Promise<{ settlement: TaxSettlement; paymentJournal: JournalEntryRecord }> {
    const [settle] = await this.db
      .select()
      .from(taxSettlement)
      .where(eq(taxSettlement.id, dto.settlementId));

    if (!settle) throw new NotFoundException(`VAT Settlement ${dto.settlementId} not found`);
    if (settle.status === 'paid') throw new BadRequestException('Settlement is already paid');
    if (settle.status !== 'filed')
      throw new BadRequestException(`Settlement is "${settle.status}" — file it before paying`);
    if (!settle.vatPayableAccountId)
      throw new BadRequestException(
        'This settlement was filed before posting was enabled and has no tax authority account',
      );

    const netAmount = parseFloat(settle.netVatPayable);
    if (netAmount <= 0) throw new BadRequestException('Net VAT payable is zero or negative');

    const journal = await postManualJournal(this.accounting, {
      orgNodeId: settle.companyId,
      entryDate: new Date(dto.paymentDate).toISOString(),
      description: `سداد ضريبة القيمة المضافة ${settle.taxPeriod} (${dto.paymentReference})`,
      reference: settle.settlementNumber,
      sourceEventType: 'vat_payment',
      idempotencyKey: `vat-payment-${settle.id}`,
      lines: [
        { accountId: settle.vatPayableAccountId, debit: netAmount, credit: 0 },
        { accountId: dto.bankAccountId, debit: 0, credit: netAmount },
      ],
    });

    const [updated] = await this.db
      .update(taxSettlement)
      .set({
        status: 'paid',
        paymentReference: dto.paymentReference,
        paymentDate: dto.paymentDate,
        paymentJournalEntryId: journal.id,
        updatedAt: new Date(),
      })
      .where(eq(taxSettlement.id, dto.settlementId))
      .returning();

    return { settlement: updated!, paymentJournal: journal };
  }

  async listTaxSettlements(query: QueryTaxSettlementsDto): Promise<TaxSettlement[]> {
    const conditions = [];
    if (query.companyId) conditions.push(eq(taxSettlement.companyId, query.companyId));
    if (query.taxPeriod) conditions.push(eq(taxSettlement.taxPeriod, query.taxPeriod));
    if (query.status)
      conditions.push(
        eq(taxSettlement.status, query.status as (typeof taxSettlement.$inferSelect)['status']),
      );

    return this.db
      .select()
      .from(taxSettlement)
      .where(conditions.length ? and(...conditions) : undefined);
  }

  // ── 2. Withholding Tax (Form 41) ────────────
  async createWhtEntry(dto: CreateWhtEntryDto, userId: string): Promise<WithholdingTaxEntry> {
    const calculatedAmount = (dto.baseAmount * dto.whtRate) / 100;
    const entryNumber = `WHT-${Date.now().toString().slice(-6)}`;

    const [result] = await this.db
      .insert(withholdingTaxEntry)
      .values({
        entryNumber,
        companyId: dto.companyId,
        fiscalYearId: dto.fiscalYearId,
        quarter: dto.quarter,
        entryDate: dto.entryDate,
        direction: dto.direction,
        partnerId: dto.partnerId,
        partnerName: dto.partnerName,
        taxRegistrationNum: dto.taxRegistrationNum,
        invoiceId: dto.invoiceId || null,
        invoiceNumber: dto.invoiceNumber,
        baseAmount: dto.baseAmount.toFixed(4),
        whtRate: dto.whtRate.toFixed(2),
        whtAmount: calculatedAmount.toFixed(4),
        status: 'recorded',
        createdBy: userId,
      })
      .returning();

    return result!;
  }

  async getForm41QuarterSummary(
    companyId: string,
    year: string,
    quarter: number,
  ): Promise<Form41QuarterSummary> {
    const entries = await this.db
      .select()
      .from(withholdingTaxEntry)
      .where(
        and(
          eq(withholdingTaxEntry.companyId, companyId),
          eq(withholdingTaxEntry.quarter, quarter),
          eq(withholdingTaxEntry.direction, 'deducted_by_us'),
        ),
      );

    let totalBase = 0;
    let totalWht = 0;
    let goodsTotal = 0;
    let servicesTotal = 0;

    for (const e of entries) {
      const base = parseFloat(e.baseAmount);
      const wht = parseFloat(e.whtAmount);
      const rate = parseFloat(e.whtRate);

      totalBase += base;
      totalWht += wht;

      if (rate <= 1.5) {
        goodsTotal += wht;
      } else {
        servicesTotal += wht;
      }
    }

    const uniqueSuppliers = new Set(entries.map((e) => e.partnerId)).size;

    return {
      quarter,
      year,
      totalSuppliersCount: uniqueSuppliers,
      totalTaxableBase: totalBase.toFixed(4),
      totalWhtDeducted: totalWht.toFixed(4),
      goodsDeductionsTotal: goodsTotal.toFixed(4),
      servicesDeductionsTotal: servicesTotal.toFixed(4),
    };
  }

  async listWhtEntries(query: QueryWhtEntriesDto): Promise<WithholdingTaxEntry[]> {
    const conditions = [];
    if (query.companyId) conditions.push(eq(withholdingTaxEntry.companyId, query.companyId));
    if (query.quarter) conditions.push(eq(withholdingTaxEntry.quarter, query.quarter));
    if (query.direction)
      conditions.push(
        eq(
          withholdingTaxEntry.direction,
          query.direction as (typeof withholdingTaxEntry.$inferSelect)['direction'],
        ),
      );
    if (query.status)
      conditions.push(
        eq(
          withholdingTaxEntry.status,
          query.status as (typeof withholdingTaxEntry.$inferSelect)['status'],
        ),
      );

    return this.db
      .select()
      .from(withholdingTaxEntry)
      .where(conditions.length ? and(...conditions) : undefined);
  }

  // ── 3. Customs Declarations (46 K.M) ────────
  /**
   * Records a customs clearance (form 46) and posts the payment: duties, fees and clearance to the
   * customs clearing account (until capitalized), VAT paid at the port to input VAT, Cr the bank.
   */
  async createCustomsDeclaration(
    dto: CreateCustomsDeclarationDto,
    userId: string,
  ): Promise<{ declaration: CustomsDeclaration; journalEntry: JournalEntryRecord }> {
    const cifEgp = dto.cifValueForeign * dto.exchangeRate;
    const devFee = dto.developmentFee || 0;
    const clearance = dto.clearanceExpenses || 0;
    const duties = dto.customsDutyAmount + devFee + clearance;
    const totalPaid = duties + dto.vatPaidAtCustoms;
    const vat = await this.vatAccounts(dto.companyId);
    const journalResult = await postManualJournal(this.accounting, {
      orgNodeId: dto.companyId,
      entryDate: new Date(dto.declarationDate).toISOString(),
      description: `إفراج جمركي ${dto.declarationNumber} — ${dto.portName}`,
      reference: dto.declarationNumber,
      sourceEventType: 'customs_clearance',
      idempotencyKey: `customs-${dto.companyId}-${dto.declarationNumber}`,
      lines: [
        { accountId: dto.customsClearingAccountId, debit: duties, credit: 0 },
        { accountId: vat.input, debit: dto.vatPaidAtCustoms, credit: 0 },
        { accountId: dto.paidFromAccountId, debit: 0, credit: totalPaid },
      ],
    });

    const [record] = await this.db
      .insert(customsDeclaration)
      .values({
        declarationNumber: dto.declarationNumber,
        companyId: dto.companyId,
        fiscalYearId: dto.fiscalYearId,
        periodId: dto.periodId,
        declarationDate: dto.declarationDate,
        portName: dto.portName,
        billOfLading: dto.billOfLading,
        supplierName: dto.supplierName,
        currency: dto.currency || 'USD',
        exchangeRate: dto.exchangeRate.toFixed(4),
        cifValueForeign: dto.cifValueForeign.toFixed(4),
        cifValueEgp: cifEgp.toFixed(4),
        customsDutyAmount: dto.customsDutyAmount.toFixed(4),
        developmentFee: devFee.toFixed(4),
        vatPaidAtCustoms: dto.vatPaidAtCustoms.toFixed(4),
        clearanceExpenses: clearance.toFixed(4),
        totalPaidAmount: totalPaid.toFixed(4),
        status: 'cleared',
        journalEntryId: journalResult.id,
        clearingAccountId: dto.customsClearingAccountId,
        createdBy: userId,
      })
      .returning();

    return { declaration: record!, journalEntry: journalResult };
  }

  /**
   * Capitalizes the duties onto the imported goods through a real landed cost voucher: the voucher
   * spreads them over the given stock receipts by value and posts Dr inventory / Cr the customs
   * clearing account, so the stock valuation and the books move together.
   */
  async capitalizeCustomsToInventory(
    dto: { declarationId: string; receiptMovementIds: string[] },
    _userId: string,
  ): Promise<CustomsDeclaration> {
    const [decl] = await this.db
      .select()
      .from(customsDeclaration)
      .where(eq(customsDeclaration.id, dto.declarationId));

    if (!decl) throw new NotFoundException(`Customs declaration ${dto.declarationId} not found`);
    if (decl.status !== 'cleared')
      throw new BadRequestException(`Declaration ${decl.declarationNumber} is "${decl.status}"`);
    if (!decl.clearingAccountId)
      throw new BadRequestException(
        'This declaration was recorded before posting was enabled and has no clearing account',
      );
    const inventory = this.moduleRef?.get(InventoryService, { strict: false });
    if (!inventory) throw new BadRequestException('inventory module is not available');

    const capitalizableDuty =
      parseFloat(decl.customsDutyAmount) +
      parseFloat(decl.developmentFee) +
      parseFloat(decl.clearanceExpenses);
    if (!(capitalizableDuty > 0))
      throw new BadRequestException('Nothing to capitalize on this declaration');

    const items = [];
    for (const movementId of dto.receiptMovementIds) {
      const m = await inventory.getMovement(movementId);
      if (m.movementType !== 'receipt')
        throw new BadRequestException(`movement ${movementId} is not a stock receipt`);
      items.push({
        receiptMovementId: m.id,
        itemId: m.itemId,
        warehouseId: m.warehouseId,
        quantity: String(Math.abs(Number(m.quantity))),
        originalRate: m.unitCost ?? '0',
      });
    }
    const voucher = await inventory.createLandedCostVoucher({
      orgNodeId: decl.companyId,
      totalExpenseAmount: capitalizableDuty.toFixed(4),
      distributeMethod: 'by_amount',
      expenseAccountId: decl.clearingAccountId,
      notes: `رسملة جمارك الإفراج ${decl.declarationNumber}`,
      items,
    });
    await inventory.postLandedCostVoucher(voucher.id);

    const [updated] = await this.db
      .update(customsDeclaration)
      .set({ status: 'capitalized', landedCostVoucherId: voucher.id, updatedAt: new Date() })
      .where(eq(customsDeclaration.id, dto.declarationId))
      .returning();

    return updated!;
  }

  async listCustomsDeclarations(query: QueryCustomsDto): Promise<CustomsDeclaration[]> {
    const conditions = [];
    if (query.companyId) conditions.push(eq(customsDeclaration.companyId, query.companyId));
    if (query.declarationNumber)
      conditions.push(eq(customsDeclaration.declarationNumber, query.declarationNumber));
    if (query.status)
      conditions.push(
        eq(
          customsDeclaration.status,
          query.status as (typeof customsDeclaration.$inferSelect)['status'],
        ),
      );

    return this.db
      .select()
      .from(customsDeclaration)
      .where(conditions.length ? and(...conditions) : undefined);
  }
}
