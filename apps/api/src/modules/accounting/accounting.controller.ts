import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseFilters } from '@nestjs/common';
import { CreateAccountTypeDto, CreateChartOfAccountsDto, CreateJournalEntryDto } from './accounting.dto';
import { AccountingExceptionFilter } from './accounting.exception-filter';
import { AccountingService } from './accounting.service';
import type { AccountBalance, AccountTypeRecord, ChartOfAccountsRecord, JournalEntryRecord } from './accounting.types';

@Controller({ path: 'accounting', version: '1' })
@UseFilters(AccountingExceptionFilter)
export class AccountingController {
  constructor(private readonly service: AccountingService) {}

  @Get('account-types')
  async accountTypes(): Promise<{ accountTypes: AccountTypeRecord[] }> { return { accountTypes: await this.service.getAccountTypes() }; }

  @Post('account-types') @HttpCode(201)
  async createAccountType(@Body() dto: CreateAccountTypeDto): Promise<{ accountType: AccountTypeRecord }> {
    return { accountType: await this.service.createAccountType(dto) };
  }

  @Get('accounts')
  async accounts(): Promise<{ accounts: ChartOfAccountsRecord[] }> { return { accounts: await this.service.getAccounts() }; }

  @Post('accounts') @HttpCode(201)
  async createAccount(@Body() dto: CreateChartOfAccountsDto): Promise<{ account: ChartOfAccountsRecord }> {
    return { account: await this.service.createAccount({ code: dto.code, name: dto.name, orgNodeId: dto.orgNodeId, accountTypeId: dto.accountTypeId, parentId: dto.parentId }) };
  }

  @Get('entries')
  async entries(): Promise<{ entries: JournalEntryRecord[] }> { return { entries: await this.service.getEntries() }; }

  @Get('entries/:id')
  async entryById(@Param('id', ParseUUIDPipe) id: string): Promise<{ entry: JournalEntryRecord }> { return { entry: await this.service.getEntry(id) }; }

  @Post('entries') @HttpCode(201)
  async createEntry(@Body() dto: CreateJournalEntryDto): Promise<{ entry: JournalEntryRecord }> {
    const created = await this.service.createEntry({
      orgNodeId: dto.orgNodeId, description: dto.description, reference: dto.reference, entryDate: dto.entryDate,
      lines: dto.lines.map((l) => ({ accountId: l.accountId, debitAmount: l.debitAmount, creditAmount: l.creditAmount, description: l.description })),
    });
    return { entry: created };
  }

  @Post('entries/:id/post') @HttpCode(200)
  async postEntry(@Param('id', ParseUUIDPipe) id: string): Promise<{ entry: JournalEntryRecord }> { return { entry: await this.service.postEntry(id) }; }

  @Post('entries/:id/cancel') @HttpCode(200)
  async cancelEntry(@Param('id', ParseUUIDPipe) id: string): Promise<{ entry: JournalEntryRecord }> { return { entry: await this.service.cancelEntry(id) }; }

  @Get('balances')
  async balances(): Promise<{ balances: AccountBalance[] }> { return { balances: await this.service.getAccountBalances() }; }
}
