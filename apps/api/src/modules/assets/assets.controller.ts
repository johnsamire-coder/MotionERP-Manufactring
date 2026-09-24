import { ArgumentsHost, Body, Catch, Controller, ExceptionFilter, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseFilters } from '@nestjs/common';
import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsNumberString, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';
import { AssetsNotFoundError, AssetsService, AssetsValidationError } from './assets.service';
import type { DepreciationMethod } from './depreciation.engine';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }
@Catch(AssetsNotFoundError, AssetsValidationError)
export class AssetsExceptionFilter implements ExceptionFilter {
  catch(e: Error, host: ArgumentsHost): void {
    const status = e instanceof AssetsNotFoundError ? 404 : 400;
    host.switchToHttp().getResponse<HttpResponse>().status(status).json({ statusCode: status, message: e.message });
  }
}

const METHODS = ['straight_line', 'double_declining_balance', 'written_down_value', 'manual'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export class CategoryDto {
  @IsUUID() orgNodeId!: string;
  @IsString() @MaxLength(64) code!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsUUID() fixedAssetAccountId!: string;
  @IsUUID() accumulatedDepreciationAccountId!: string;
  @IsUUID() depreciationExpenseAccountId!: string;
  @IsOptional() @IsUUID() cwipAccountId?: string;
  @IsOptional() @IsIn(METHODS) defaultMethod?: DepreciationMethod;
  @IsOptional() @IsInt() @Min(1) defaultPeriods?: number;
  @IsOptional() @IsIn([1, 3, 6, 12]) defaultFrequencyMonths?: number;
}
export class AssetDto {
  @IsString() @MaxLength(64) assetCode!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsUUID() categoryId!: string;
  @IsOptional() @IsBoolean() isCwip?: boolean;
  @IsOptional() @IsNumberString() grossValue?: string;
  @IsOptional() @IsNumberString() salvageValue?: string;
  @IsOptional() @IsNumberString() openingAccumulated?: string;
  @IsOptional() @IsIn(METHODS) method?: DepreciationMethod;
  @IsOptional() @IsInt() @Min(1) periods?: number;
  @IsOptional() @IsIn([1, 3, 6, 12]) frequencyMonths?: number;
  @IsOptional() @IsNumberString() annualRatePercent?: string;
  @IsOptional() @IsArray() @IsNumber({}, { each: true }) manualAmounts?: number[];
  @IsOptional() @IsUUID() costCenterId?: string;
}
export class CwipCostDto { @IsNumberString() amount!: string; @IsUUID() contraAccountId!: string; @IsOptional() @Matches(DAY) date?: string; @IsOptional() @IsString() note?: string; }
export class InUseDto { @Matches(DAY) availableForUseDate!: string; }
export class AdjustDto { @IsNumberString() newBookValue!: string; @IsUUID() differenceAccountId!: string; @IsOptional() @Matches(DAY) date?: string; @IsOptional() @IsString() note?: string; }
export class DueDto { @IsOptional() @Matches(DAY) asOf?: string; }

type Svc = AssetsService;

@Controller({ path: 'assets', version: '1' })
@UseFilters(AssetsExceptionFilter)
export class AssetsController {
  constructor(private readonly service: AssetsService) {}

  @Get('categories')
  async categories(@Query('orgNodeId') orgNodeId?: string): Promise<{ categories: Awaited<ReturnType<Svc['listCategories']>> }> { return { categories: await this.service.listCategories(orgNodeId || undefined) }; }

  @Post('categories') @HttpCode(201)
  async category(@Body() dto: CategoryDto): Promise<{ category: Awaited<ReturnType<Svc['createCategory']>> }> { return { category: await this.service.createCategory(dto) }; }

  @Get()
  async list(@Query('orgNodeId') orgNodeId?: string): Promise<{ assets: Awaited<ReturnType<Svc['list']>> }> { return { assets: await this.service.list(orgNodeId || undefined) }; }

  @Post() @HttpCode(201)
  async create(@Body() dto: AssetDto): Promise<{ asset: Awaited<ReturnType<Svc['create']>> }> { return { asset: await this.service.create(dto) }; }

  @Post('depreciate-due') @HttpCode(200)
  async due(@Body() dto: DueDto): Promise<{ posted: Awaited<ReturnType<Svc['depreciateDue']>> }> { return { posted: await this.service.depreciateDue(dto.asOf) }; }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<{ asset: Awaited<ReturnType<Svc['get']>> }> { return { asset: await this.service.get(id) }; }

  @Post(':id/cwip-costs') @HttpCode(200)
  async cwip(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CwipCostDto): Promise<{ asset: Awaited<ReturnType<Svc['addCwipCost']>> }> { return { asset: await this.service.addCwipCost(id, dto) }; }

  @Post(':id/capitalise') @HttpCode(200)
  async capitalise(@Param('id', ParseUUIDPipe) id: string, @Body() dto: InUseDto): Promise<{ asset: Awaited<ReturnType<Svc['capitalise']>> }> { return { asset: await this.service.capitalise(id, dto) }; }

  @Post(':id/submit') @HttpCode(200)
  async submit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: InUseDto): Promise<{ asset: Awaited<ReturnType<Svc['submit']>> }> { return { asset: await this.service.submit(id, dto) }; }

  @Post(':id/adjust-value') @HttpCode(200)
  async adjust(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdjustDto): Promise<{ asset: Awaited<ReturnType<Svc['adjustValue']>> }> { return { asset: await this.service.adjustValue(id, dto) }; }
}
