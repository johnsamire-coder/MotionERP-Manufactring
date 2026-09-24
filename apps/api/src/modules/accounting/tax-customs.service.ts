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
import { PostingEngineService } from './posting-engine.service';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { manualJournalPoster, type PostedJournal } from './manual-journal';

@Injectable()
export class TaxAndCustomsService {
  constructor(
    @Inject('DRIZZLE') private readonly db: NodePgDatabase,
    @Optional() @Inject(PostingEngineService) private readonly postingEngine?: PostingEngineService,
  ) {}

  // ── 1. VAT Return Settlements ──────────────
  async createTaxSettlement(
    dto: CreateTaxSettlementDto,
    userId: string,
  ): Promise<{ settlement: TaxSettlement; journalEntry: PostedJournal }> {
    const netVat = dto.outputVatAmount - dto.inputVatAmount;
    const settlementNumber = `VAT-SETTLE-${dto.taxPeriod}-${Date.now().toString().slice(-4)}`;

    const journalPayload = {
      companyId: dto.companyId,
      fiscalYearId: dto.fiscalYearId,
      periodId: dto.periodId,
      postingDate: new Date().toISOString().split('T')[0],
      referenceType: 'vat_settlement',
      referenceId: settlementNumber,
      description: `Monthly VAT Settlement for period: ${dto.taxPeriod}`,
      createdBy: userId,
      lines: [
        {
          accountId: '00000000-0000-0000-0000-000000002101',
          debit: dto.outputVatAmount,
          credit: 0,
          description: `Close Output VAT for ${dto.taxPeriod}`,
        },
        {
          accountId: '00000000-0000-0000-0000-000000001105',
          debit: 0,
          credit: dto.inputVatAmount,
          description: `Close Input VAT for ${dto.taxPeriod}`,
        },
        {
          accountId: '00000000-0000-0000-0000-000000002102',
          debit: 0,
          credit: netVat > 0 ? netVat : 0,
          description: `Net VAT Payable to Egyptian Tax Authority`,
        },
      ],
    };

    const poster = manualJournalPoster(this.postingEngine);
    const journalResult: PostedJournal = poster
      ? await poster.createManualJournalEntry(journalPayload)
      : { id: `mock-vat-journal-${Date.now()}`, ...journalPayload };

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
        journalEntryId: journalResult.id,
        createdBy: userId,
      })
      .returning();

    return { settlement: record!, journalEntry: journalResult };
  }

  async payTaxSettlement(
    dto: SettleAndPayVatDto,
    userId: string,
  ): Promise<{ settlement: TaxSettlement; paymentJournal: PostedJournal }> {
    const [settle] = await this.db
      .select()
      .from(taxSettlement)
      .where(eq(taxSettlement.id, dto.settlementId));

    if (!settle) throw new NotFoundException(`VAT Settlement ${dto.settlementId} not found`);
    if (settle.status === 'paid') throw new BadRequestException('Settlement is already paid');

    const netAmount = parseFloat(settle.netVatPayable);
    if (netAmount <= 0) throw new BadRequestException('Net VAT payable is zero or negative');

    const paymentJournalPayload = {
      companyId: settle.companyId,
      fiscalYearId: settle.fiscalYearId,
      periodId: settle.periodId,
      postingDate: dto.paymentDate,
      referenceType: 'vat_payment',
      referenceId: settle.settlementNumber,
      description: `Payment of VAT for ${settle.taxPeriod}`,
      createdBy: userId,
      lines: [
        {
          accountId: '00000000-0000-0000-0000-000000002102',
          debit: netAmount,
          credit: 0,
          description: `Settle VAT liability`,
        },
        {
          accountId: dto.bankAccountId,
          debit: 0,
          credit: netAmount,
          description: `Bank transfer payment`,
        },
      ],
    };

    const poster = manualJournalPoster(this.postingEngine);
    const paymentResult: PostedJournal = poster
      ? await poster.createManualJournalEntry(paymentJournalPayload)
      : { id: `mock-vat-pay-${Date.now()}`, ...paymentJournalPayload };

    const [updated] = await this.db
      .update(taxSettlement)
      .set({
        status: 'paid',
        paymentReference: dto.paymentReference,
        paymentDate: dto.paymentDate,
        updatedAt: new Date(),
      })
      .where(eq(taxSettlement.id, dto.settlementId))
      .returning();

    return { settlement: updated!, paymentJournal: paymentResult };
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
  async createCustomsDeclaration(
    dto: CreateCustomsDeclarationDto,
    userId: string,
  ): Promise<{ declaration: CustomsDeclaration; journalEntry: PostedJournal }> {
    const cifEgp = dto.cifValueForeign * dto.exchangeRate;
    const devFee = dto.developmentFee || 0;
    const clearance = dto.clearanceExpenses || 0;
    const totalPaid = dto.customsDutyAmount + devFee + dto.vatPaidAtCustoms + clearance;

    const customsJournalPayload = {
      companyId: dto.companyId,
      fiscalYearId: dto.fiscalYearId,
      periodId: dto.periodId,
      postingDate: dto.declarationDate,
      referenceType: 'customs_clearance',
      referenceId: dto.declarationNumber,
      description: `Customs clearance: ${dto.declarationNumber}`,
      createdBy: userId,
      lines: [
        {
          accountId: '00000000-0000-0000-0000-000000005108',
          debit: dto.customsDutyAmount + devFee + clearance,
          credit: 0,
          description: `Customs duties & expenses`,
        },
        {
          accountId: '00000000-0000-0000-0000-000000001105',
          debit: dto.vatPaidAtCustoms,
          credit: 0,
          description: `Input VAT paid at customs port`,
        },
        {
          accountId: '00000000-0000-0000-0000-000000001002',
          debit: 0,
          credit: totalPaid,
          description: `Customs payment via bank`,
        },
      ],
    };

    const poster = manualJournalPoster(this.postingEngine);
    const journalResult: PostedJournal = poster
      ? await poster.createManualJournalEntry(customsJournalPayload)
      : { id: `mock-cust-journal-${Date.now()}`, ...customsJournalPayload };

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
        createdBy: userId,
      })
      .returning();

    return { declaration: record!, journalEntry: journalResult };
  }

  async capitalizeCustomsToInventory(
    dto: { declarationId: string; targetWarehouseId: string },
    userId: string,
  ): Promise<CustomsDeclaration> {
    const [decl] = await this.db
      .select()
      .from(customsDeclaration)
      .where(eq(customsDeclaration.id, dto.declarationId));

    if (!decl) throw new NotFoundException(`Customs declaration ${dto.declarationId} not found`);

    const capitalizableDuty =
      parseFloat(decl.customsDutyAmount) +
      parseFloat(decl.developmentFee) +
      parseFloat(decl.clearanceExpenses);

    const capitalizationJournal = {
      companyId: decl.companyId,
      fiscalYearId: decl.fiscalYearId,
      periodId: decl.periodId,
      postingDate: new Date().toISOString().split('T')[0],
      referenceType: 'landed_cost_capitalization',
      referenceId: decl.declarationNumber,
      description: `Capitalize Customs Duties: ${decl.declarationNumber}`,
      createdBy: userId,
      lines: [
        {
          accountId: '00000000-0000-0000-0000-000000001101',
          debit: capitalizableDuty,
          credit: 0,
        },
        {
          accountId: '00000000-0000-0000-0000-000000005108',
          debit: 0,
          credit: capitalizableDuty,
        },
      ],
    };

    const poster = manualJournalPoster(this.postingEngine);
    const journalResult: PostedJournal = poster
      ? await poster.createManualJournalEntry(capitalizationJournal)
      : { id: `mock-cap-journal-${Date.now()}`, ...capitalizationJournal };

    const [updated] = await this.db
      .update(customsDeclaration)
      .set({
        status: 'capitalized',
        landedCostVoucherId: '00000000-0000-0000-0000-000000000001',
        journalEntryId: journalResult.id,
        updatedAt: new Date(),
      })
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
