import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import {
  CreateAccountDeterminationDto,
  CreateCostCenterDto,
  CreateFiscalYearDto,
  CreateFixedAssetDto,
  CreateJournalEntryDto,
  FinancialReportQueryDto,
  PartnerLedgerQueryDto,
  PostDepreciationDto,
  PostVatSettlementDto,
  UpsertCompanyAccountingConfigDto,
} from './accounting.dto';
import { AccountingExceptionFilter } from './accounting.exception-filter';
import { AccountingService } from './accounting.service';
import type {
  AccountBalance,
  AccountDeterminationRecord,
  AccountingPeriodRecord,
  BalanceSheetReport,
  CostCenterRecord,
  FiscalYearRecord,
  FixedAssetRecord,
  JournalEntryRecord,
  PartnerLedgerReport,
  PostDepreciationResult,
  ProfitAndLossReport,
  TrialBalanceReport,
  VatReportSummary,
  VatSettlementResult,
} from './accounting.types';

@Controller({ path: 'accounting', version: '1' })
@UseFilters(AccountingExceptionFilter)
export class AccountingController {
  constructor(private readonly service: AccountingService) {}

  @Get('fiscal-years')
  async fiscalYears(@Query('orgNodeId') orgNodeId?: string): Promise<{ fiscalYears: FiscalYearRecord[] }> {
    return { fiscalYears: await this.service.getFiscalYears(orgNodeId) };
  }

  @Post('fiscal-years')
  @HttpCode(201)
  async createFiscalYear(@Body() dto: CreateFiscalYearDto): Promise<{ fiscalYear: FiscalYearRecord }> {
    const created = await this.service.createFiscalYear(dto);
    return { fiscalYear: created };
  }

  @Post('fiscal-years/:id/close')
  @HttpCode(200)
  async closeFiscalYear(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.service.closeFiscalYear(id);
    return { message: 'fiscal year closed successfully' };
  }

  @Get('fiscal-years/:id/periods')
  async periods(@Param('id', ParseUUIDPipe) id: string): Promise<{ periods: AccountingPeriodRecord[] }> {
    return { periods: await this.service.getPeriods(id) };
  }

  @Post('periods/:id/status')
  @HttpCode(200)
  async setPeriodStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: 'open' | 'closed' | 'locked',
  ): Promise<{ period: AccountingPeriodRecord }> {
    return { period: await this.service.setPeriodStatus(id, status) };
  }

  @Get('cost-centers')
  async costCenters(@Query('orgNodeId') orgNodeId?: string): Promise<{ costCenters: CostCenterRecord[] }> {
    return { costCenters: await this.service.getCostCenters(orgNodeId) };
  }

  @Post('cost-centers')
  @HttpCode(201)
  async createCostCenter(@Body() dto: CreateCostCenterDto): Promise<{ costCenter: CostCenterRecord }> {
    const created = await this.service.createCostCenter(dto);
    return { costCenter: created };
  }

  @Get('company-config/:orgNodeId')
  async companyConfig(@Param('orgNodeId', ParseUUIDPipe) orgNodeId: string) {
    return { config: await this.service.getCompanyConfig(orgNodeId) };
  }

  @Post('company-config')
  @HttpCode(200)
  async upsertCompanyConfig(@Body() dto: UpsertCompanyAccountingConfigDto) {
    return { config: await this.service.upsertCompanyConfig(dto) };
  }

  @Get('account-determinations/:orgNodeId')
  async accountDeterminations(@Param('orgNodeId', ParseUUIDPipe) orgNodeId: string): Promise<{ determinations: AccountDeterminationRecord[] }> {
    return { determinations: await this.service.getAccountDeterminations(orgNodeId) };
  }

  @Post('account-determinations')
  @HttpCode(201)
  async createAccountDetermination(@Body() dto: CreateAccountDeterminationDto): Promise<{ determination: AccountDeterminationRecord }> {
    const created = await this.service.createAccountDetermination(dto);
    return { determination: created };
  }

  @Get('journal-entries')
  async journalEntries(): Promise<{ entries: JournalEntryRecord[] }> {
    return { entries: await this.service.getEntries() };
  }

  @Get('journal-entries/:id')
  async journalEntry(@Param('id', ParseUUIDPipe) id: string): Promise<{ entry: JournalEntryRecord }> {
    return { entry: await this.service.getEntry(id) };
  }

  @Post('journal-entries')
  @HttpCode(201)
  async createJournalEntry(@Body() dto: CreateJournalEntryDto): Promise<{ entry: JournalEntryRecord }> {
    const created = await this.service.createEntry(dto);
    return { entry: created };
  }

  @Post('journal-entries/:id/post')
  @HttpCode(200)
  async postJournalEntry(@Param('id', ParseUUIDPipe) id: string): Promise<{ entry: JournalEntryRecord }> {
    return { entry: await this.service.postEntry(id) };
  }

  @Post('journal-entries/:id/cancel')
  @HttpCode(200)
  async cancelJournalEntry(@Param('id', ParseUUIDPipe) id: string): Promise<{ entry: JournalEntryRecord }> {
    return { entry: await this.service.cancelEntry(id) };
  }

  @Get('balances')
  async accountBalances(): Promise<{ balances: AccountBalance[] }> {
    return { balances: await this.service.getAccountBalances() };
  }

  // --- Fixed Assets Endpoints ---
  @Get('fixed-assets')
  async fixedAssets(@Query('orgNodeId') orgNodeId?: string): Promise<{ fixedAssets: FixedAssetRecord[] }> {
    return { fixedAssets: await this.service.getFixedAssets(orgNodeId) };
  }

  @Get('fixed-assets/:id')
  async fixedAsset(@Param('id', ParseUUIDPipe) id: string): Promise<{ fixedAsset: FixedAssetRecord }> {
    return { fixedAsset: await this.service.getFixedAsset(id) };
  }

  @Post('fixed-assets')
  @HttpCode(201)
  async createFixedAsset(@Body() dto: CreateFixedAssetDto): Promise<{ fixedAsset: FixedAssetRecord }> {
    const created = await this.service.createFixedAsset(dto);
    return { fixedAsset: created };
  }

  @Post('fixed-assets/:id/depreciate')
  @HttpCode(200)
  async postDepreciation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PostDepreciationDto,
  ): Promise<PostDepreciationResult> {
    return this.service.postAssetDepreciation(id, dto.periodDate);
  }

  // --- Financial Reports Endpoints ---
  @Get('reports/trial-balance')
  async trialBalance(@Query() query: FinancialReportQueryDto): Promise<TrialBalanceReport> {
    return this.service.getTrialBalance(query.orgNodeId, query.startDate, query.endDate);
  }

  @Get('reports/profit-and-loss')
  async profitAndLoss(@Query() query: FinancialReportQueryDto): Promise<ProfitAndLossReport> {
    return this.service.getProfitAndLoss(query.orgNodeId, query.startDate, query.endDate);
  }

  @Get('reports/balance-sheet')
  async balanceSheet(@Query() query: FinancialReportQueryDto): Promise<BalanceSheetReport> {
    const dateLimit = query.endDate || new Date().toISOString();
    return this.service.getBalanceSheet(query.orgNodeId, dateLimit);
  }

  @Get('reports/partner-ledger')
  async partnerLedger(@Query() query: PartnerLedgerQueryDto): Promise<PartnerLedgerReport> {
    return this.service.getPartnerLedger(query.partyType, query.partyId, query.startDate, query.endDate);
  }

  // --- VAT Return & Tax Settlement Endpoints ---
  @Get('reports/vat-return')
  async vatReport(@Query() query: FinancialReportQueryDto): Promise<VatReportSummary> {
    return this.service.getVatReport(query.orgNodeId, query.startDate, query.endDate);
  }

  @Post('tax/settle-vat')
  @HttpCode(200)
  async settleVat(@Body() dto: PostVatSettlementDto): Promise<VatSettlementResult> {
    return this.service.postVatSettlement(
      dto.orgNodeId,
      dto.settlementDate,
      dto.taxAuthorityPayableAccountId,
      dto.startDate,
      dto.endDate,
    );
  }
}