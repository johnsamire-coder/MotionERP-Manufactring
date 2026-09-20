import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseFilters,
} from '@nestjs/common';
import {
  CreateAccountDeterminationDto,
  CreateAccountTypeDto,
  CreateChartOfAccountsDto,
  CreateCostCenterDto,
  CreateFiscalYearDto,
  CreateJournalEntryDto,
  SetPeriodStatusDto,
  UpsertCompanyAccountingConfigDto,
} from './accounting.dto';
import { AccountingExceptionFilter } from './accounting.exception-filter';
import { AccountingService } from './accounting.service';
import type {
  AccountBalance,
  AccountDeterminationRecord,
  AccountingPeriodRecord,
  AccountTypeRecord,
  ChartOfAccountsRecord,
  CompanyAccountingConfigRecord,
  CostCenterRecord,
  FiscalYearRecord,
  JournalEntryRecord,
} from './accounting.types';

@Controller({ path: 'accounting', version: '1' })
@UseFilters(AccountingExceptionFilter)
export class AccountingController {
  constructor(private readonly service: AccountingService) {}

  // ==================== Account Types ====================
  @Get('account-types')
  async accountTypes(): Promise<{ accountTypes: AccountTypeRecord[] }> {
    return { accountTypes: await this.service.getAccountTypes() };
  }

  @Post('account-types')
  @HttpCode(201)
  async createAccountType(@Body() dto: CreateAccountTypeDto): Promise<{ accountType: AccountTypeRecord }> {
    return { accountType: await this.service.createAccountType(dto) };
  }

  // ==================== Chart of Accounts ====================
  @Get('accounts')
  async accounts(): Promise<{ accounts: ChartOfAccountsRecord[] }> {
    return { accounts: await this.service.getAccounts() };
  }

  @Post('accounts')
  @HttpCode(201)
  async createAccount(@Body() dto: CreateChartOfAccountsDto): Promise<{ account: ChartOfAccountsRecord }> {
    return {
      account: await this.service.createAccount({
        code: dto.code,
        name: dto.name,
        orgNodeId: dto.orgNodeId,
        accountTypeId: dto.accountTypeId,
        parentId: dto.parentId,
      }),
    };
  }

  // ==================== Fiscal Years ====================
  @Get('fiscal-years')
  async fiscalYears(@Query('orgNodeId') orgNodeId?: string): Promise<{ fiscalYears: FiscalYearRecord[] }> {
    return { fiscalYears: await this.service.getFiscalYears(orgNodeId) };
  }

  @Post('fiscal-years')
  @HttpCode(201)
  async createFiscalYear(@Body() dto: CreateFiscalYearDto): Promise<{ fiscalYear: FiscalYearRecord }> {
    return { fiscalYear: await this.service.createFiscalYear(dto) };
  }

  @Post('fiscal-years/:id/close')
  @HttpCode(200)
  async closeFiscalYear(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: boolean }> {
    await this.service.closeFiscalYear(id);
    return { success: true };
  }

  @Get('fiscal-years/:id/periods')
  async fiscalYearPeriods(@Param('id', ParseUUIDPipe) id: string): Promise<{ periods: AccountingPeriodRecord[] }> {
    return { periods: await this.service.getPeriods(id) };
  }

  // ==================== Accounting Periods ====================
  @Patch('periods/:id/status')
  @HttpCode(200)
  async setPeriodStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPeriodStatusDto,
  ): Promise<{ period: AccountingPeriodRecord }> {
    return { period: await this.service.setPeriodStatus(id, dto.status) };
  }

  // ==================== Cost Centers ====================
  @Get('cost-centers')
  async costCenters(@Query('orgNodeId') orgNodeId?: string): Promise<{ costCenters: CostCenterRecord[] }> {
    return { costCenters: await this.service.getCostCenters(orgNodeId) };
  }

  @Post('cost-centers')
  @HttpCode(201)
  async createCostCenter(@Body() dto: CreateCostCenterDto): Promise<{ costCenter: CostCenterRecord }> {
    return { costCenter: await this.service.createCostCenter(dto) };
  }

  // ==================== Company Accounting Config ====================
  @Get('company-config/:orgNodeId')
  async companyConfig(
    @Param('orgNodeId', ParseUUIDPipe) orgNodeId: string,
  ): Promise<{ config: CompanyAccountingConfigRecord | null }> {
    return { config: await this.service.getCompanyConfig(orgNodeId) };
  }

  @Put('company-config/:orgNodeId')
  @HttpCode(200)
  async upsertCompanyConfig(
    @Param('orgNodeId', ParseUUIDPipe) orgNodeId: string,
    @Body() dto: UpsertCompanyAccountingConfigDto,
  ): Promise<{ config: CompanyAccountingConfigRecord }> {
    return { config: await this.service.upsertCompanyConfig({ orgNodeId, ...dto }) };
  }

  // ==================== Account Determination ====================
  @Get('account-determinations/:orgNodeId')
  async accountDeterminations(
    @Param('orgNodeId', ParseUUIDPipe) orgNodeId: string,
  ): Promise<{ determinations: AccountDeterminationRecord[] }> {
    return { determinations: await this.service.getAccountDeterminations(orgNodeId) };
  }

  @Post('account-determinations')
  @HttpCode(201)
  async createAccountDetermination(
    @Body() dto: CreateAccountDeterminationDto,
  ): Promise<{ determination: AccountDeterminationRecord }> {
    return { determination: await this.service.createAccountDetermination(dto) };
  }

  // ==================== Journal Entries ====================
  @Get('entries')
  async entries(): Promise<{ entries: JournalEntryRecord[] }> {
    return { entries: await this.service.getEntries() };
  }

  @Get('entries/:id')
  async entryById(@Param('id', ParseUUIDPipe) id: string): Promise<{ entry: JournalEntryRecord }> {
    return { entry: await this.service.getEntry(id) };
  }

  @Post('entries')
  @HttpCode(201)
  async createEntry(@Body() dto: CreateJournalEntryDto): Promise<{ entry: JournalEntryRecord }> {
    const created = await this.service.createEntry({
      orgNodeId: dto.orgNodeId,
      description: dto.description,
      reference: dto.reference,
      entryDate: dto.entryDate,
      fiscalYearId: dto.fiscalYearId,
      periodId: dto.periodId,
      isAutoGenerated: dto.isAutoGenerated,
      idempotencyKey: dto.idempotencyKey,
      sourceEventType: dto.sourceEventType,
      lines: dto.lines.map((l) => ({
        accountId: l.accountId,
        debitAmount: l.debitAmount,
        creditAmount: l.creditAmount,
        description: l.description,
        partyType: l.partyType,
        partyId: l.partyId,
        costCenterId: l.costCenterId,
        jobOrderId: l.jobOrderId,
      })),
    });
    return { entry: created };
  }

  @Post('entries/:id/post')
  @HttpCode(200)
  async postEntry(@Param('id', ParseUUIDPipe) id: string): Promise<{ entry: JournalEntryRecord }> {
    return { entry: await this.service.postEntry(id) };
  }

  @Post('entries/:id/cancel')
  @HttpCode(200)
  async cancelEntry(@Param('id', ParseUUIDPipe) id: string): Promise<{ entry: JournalEntryRecord }> {
    return { entry: await this.service.cancelEntry(id) };
  }

  // ==================== Balances ====================
  @Get('balances')
  async balances(): Promise<{ balances: AccountBalance[] }> {
    return { balances: await this.service.getAccountBalances() };
  }
}