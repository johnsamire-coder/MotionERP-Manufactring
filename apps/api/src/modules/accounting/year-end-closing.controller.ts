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
import { IsUUID } from 'class-validator';
import { AccountingExceptionFilter } from './accounting.exception-filter';
import type { JournalEntryRecord } from './accounting.types';
import { YearEndClosingService, type YearEndPreview } from './year-end-closing.service';

export class CloseYearDto {
  @IsUUID() retainedEarningsAccountId!: string;
}

@Controller({ path: 'accounting/year-end', version: '1' })
@UseFilters(AccountingExceptionFilter)
export class YearEndClosingController {
  constructor(private readonly service: YearEndClosingService) {}

  @Get(':fiscalYearId/preview')
  async preview(
    @Param('fiscalYearId', ParseUUIDPipe) id: string,
    @Query('retainedEarningsAccountId') retained?: string,
  ): Promise<{ preview: YearEndPreview }> {
    return { preview: await this.service.preview(id, retained || undefined) };
  }

  @Post(':fiscalYearId/close')
  @HttpCode(200)
  async close(
    @Param('fiscalYearId', ParseUUIDPipe) id: string,
    @Body() dto: CloseYearDto,
  ): Promise<{ preview: YearEndPreview; closingEntry: JournalEntryRecord | null }> {
    return this.service.close(id, dto.retainedEarningsAccountId);
  }
}
