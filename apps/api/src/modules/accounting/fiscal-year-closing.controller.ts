// ============================================================
// Motion ERP — Fiscal Year Closing Controller
// Step 91 | REST APIs
// ============================================================
import { Controller, Get, Post, Body, Query, Req, Param } from '@nestjs/common';
import { FiscalYearClosingService } from './fiscal-year-closing.service';
import { CloseFiscalYearDto } from './fiscal-year-closing.dto';

@Controller({ path: 'accounting/fiscal-year-closing', version: '1' })
export class FiscalYearClosingController {
  constructor(private readonly fiscalYearClosingService: FiscalYearClosingService) {}

  @Get('preview/:fiscalYearId')
  async previewClosing(
    @Param('fiscalYearId') fiscalYearId: string,
    @Query('companyId') companyId: string,
  ) {
    const targetCompany = companyId || '00000000-0000-0000-0000-000000000001';
    return this.fiscalYearClosingService.previewFiscalYearClosing(fiscalYearId, targetCompany);
  }

  @Post('close')
  async closeFiscalYear(@Body() dto: CloseFiscalYearDto, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.fiscalYearClosingService.executeFiscalYearClosing(dto, userId);
  }
}