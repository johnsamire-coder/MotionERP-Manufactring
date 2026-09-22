// ============================================================
// Motion ERP — Period Closing Controller
// Step 90 | REST APIs
// ============================================================
import { Controller, Get, Post, Body, Query, Req, Param } from '@nestjs/common';
import { PeriodClosingService } from './period-closing.service';
import { ClosePeriodDto, ReopenPeriodDto, QueryPeriodStatusDto } from './period-closing.dto';

@Controller('v1/accounting/closing')
export class PeriodClosingController {
  constructor(private readonly closingService: PeriodClosingService) {}

  @Get('pre-check/:periodId')
  async runPreChecks(
    @Param('periodId') periodId: string,
    @Query('companyId') companyId: string,
  ) {
    const targetCompany = companyId || '00000000-0000-0000-0000-000000000001';
    return this.closingService.runPreClosingChecks(periodId, targetCompany);
  }

  @Post('close-period')
  async closePeriod(@Body() dto: ClosePeriodDto, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.closingService.closePeriod(dto, userId);
  }

  @Post('reopen-period')
  async reopenPeriod(@Body() dto: ReopenPeriodDto, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.closingService.reopenPeriod(dto, userId);
  }

  @Get('periods')
  async listPeriods(@Query() query: QueryPeriodStatusDto) {
    return this.closingService.listPeriodStatuses(query);
  }
}