import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseFilters } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { AccountControlsService } from './account-controls.service';
import { AccountingExceptionFilter } from './accounting.exception-filter';

export class CreateDimensionDto {
  @IsUUID() orgNodeId!: string;
  @IsString() @MaxLength(64) code!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsBoolean() mandatoryForPnl?: boolean;
  @IsOptional() @IsBoolean() mandatoryForBalanceSheet?: boolean;
}
export class DimensionValueDto { @IsString() @MaxLength(64) code!: string; @IsString() @MaxLength(200) name!: string; }
export class AccountControlsDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsIn(['debit', 'credit']) balanceMustBe?: 'debit' | 'credit' | null;
  @IsOptional() @IsBoolean() isFrozen?: boolean;
}

@Controller({ path: 'accounting', version: '1' })
@UseFilters(AccountingExceptionFilter)
export class AccountControlsController {
  constructor(private readonly service: AccountControlsService) {}

  @Get('dimensions')
  async list(@Query('orgNodeId', ParseUUIDPipe) orgNodeId: string): Promise<{ dimensions: Awaited<ReturnType<AccountControlsService['listDimensions']>> }> { return { dimensions: await this.service.listDimensions(orgNodeId) }; }

  @Post('dimensions') @HttpCode(201)
  async create(@Body() dto: CreateDimensionDto): Promise<{ dimension: Awaited<ReturnType<AccountControlsService['createDimension']>> }> { return { dimension: await this.service.createDimension(dto) }; }

  @Post('dimensions/:id/values') @HttpCode(201)
  async addValue(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DimensionValueDto): Promise<{ value: Awaited<ReturnType<AccountControlsService['addDimensionValue']>> }> { return { value: await this.service.addDimensionValue(id, dto) }; }

  @Get('dimensions/:id/report')
  async report(@Param('id', ParseUUIDPipe) id: string, @Query('startDate') from?: string, @Query('endDate') to?: string): Promise<{ report: Awaited<ReturnType<AccountControlsService['dimensionReport']>> }> {
    return { report: await this.service.dimensionReport(id, from, to) };
  }

  @Patch('accounts/:id/controls')
  async controls(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AccountControlsDto): Promise<Awaited<ReturnType<AccountControlsService['setAccountControls']>>> { return this.service.setAccountControls(id, dto); }
}
