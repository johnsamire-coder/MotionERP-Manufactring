import { Controller, Get, HttpCode, Post, Query, UseFilters } from '@nestjs/common';
import { FinanceExceptionFilter } from './finance.exception-filter';
import { LedgerHealthService } from './ledger-health.service';

@Controller({ path: 'finance/ledger-health', version: '1' })
@UseFilters(FinanceExceptionFilter)
export class LedgerHealthController {
  constructor(private readonly service: LedgerHealthService) {}

  @Get()
  async list(
    @Query('all') all?: string,
  ): Promise<{ issues: Awaited<ReturnType<LedgerHealthService['list']>> }> {
    return { issues: await this.service.list(all !== 'true') };
  }

  @Post('run')
  @HttpCode(200)
  async run(): Promise<{ result: Awaited<ReturnType<LedgerHealthService['run']>> }> {
    return { result: await this.service.run() };
  }
}
