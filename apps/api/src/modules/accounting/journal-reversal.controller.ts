import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseFilters } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AccountingExceptionFilter } from './accounting.exception-filter';
import { JournalReversalService, type ReversalResult } from './journal-reversal.service';

export class ReverseEntryDto {
  @IsString() @MaxLength(500) reason!: string;
  @IsOptional() @IsString() reversalDate?: string;
}

@Controller({ path: 'accounting/journal-entries', version: '1' })
@UseFilters(AccountingExceptionFilter)
export class JournalReversalController {
  constructor(private readonly service: JournalReversalService) {}

  @Post(':id/reverse') @HttpCode(200)
  async reverse(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReverseEntryDto): Promise<ReversalResult> {
    return this.service.reverseManual(id, dto);
  }

  @Get(':id/reversal')
  async links(@Param('id', ParseUUIDPipe) id: string): Promise<{ reversedById: string | null; reversalOfId: string | null; reason: string | null }> {
    return this.service.links(id);
  }
}
