import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query, UseFilters } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNumber, IsNumberString, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { AccountingExceptionFilter } from './accounting.exception-filter';
import { BudgetService, type BudgetAction, type BudgetRecord } from './budget.service';

export class UpsertBudgetDto {
  @IsUUID() fiscalYearId!: string;
  @IsUUID() accountId!: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() costCenterId?: string | null;
  @IsNumberString() amount!: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsArray() @ArrayMinSize(12) @ArrayMaxSize(12) @IsNumber({}, { each: true }) monthlyPercentages?: number[] | null;
  @IsOptional() @IsIn(['stop', 'warn', 'ignore']) actionIfExceeded?: BudgetAction;
}

@Controller({ path: 'accounting/budgets', version: '1' })
@UseFilters(AccountingExceptionFilter)
export class BudgetController {
  constructor(private readonly service: BudgetService) {}

  @Get()
  async list(@Query('fiscalYearId') fiscalYearId?: string): Promise<{ budgets: BudgetRecord[] }> { return { budgets: await this.service.list(fiscalYearId || undefined) }; }

  @Put()
  async upsert(@Body() dto: UpsertBudgetDto): Promise<{ budget: BudgetRecord }> { return { budget: await this.service.upsert(dto) }; }

  @Get('variance/:fiscalYearId')
  async variance(@Param('fiscalYearId', ParseUUIDPipe) id: string): Promise<{ variance: Awaited<ReturnType<BudgetService['variance']>> }> {
    return { variance: await this.service.variance(id) };
  }
}
