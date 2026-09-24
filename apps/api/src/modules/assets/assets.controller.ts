import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AssetLifecycleService } from './asset-lifecycle.service';
import { AssetsNotFoundError, AssetsService, AssetsValidationError } from './assets.service';
import type { DepreciationMethod } from './depreciation.engine';

interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: unknown): void;
}
@Catch(AssetsNotFoundError, AssetsValidationError)
export class AssetsExceptionFilter implements ExceptionFilter {
  catch(e: Error, host: ArgumentsHost): void {
    const status = e instanceof AssetsNotFoundError ? 404 : 400;
    host
      .switchToHttp()
      .getResponse<HttpResponse>()
      .status(status)
      .json({ statusCode: status, message: e.message });
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
  @IsOptional() @IsBoolean() isComposite?: boolean;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
}
export class CwipCostDto {
  @IsNumberString() amount!: string;
  @IsUUID() contraAccountId!: string;
  @IsOptional() @Matches(DAY) date?: string;
  @IsOptional() @IsString() note?: string;
}
export class InUseDto {
  @Matches(DAY) availableForUseDate!: string;
}
export class AdjustDto {
  @IsNumberString() newBookValue!: string;
  @IsUUID() differenceAccountId!: string;
  @IsOptional() @Matches(DAY) date?: string;
  @IsOptional() @IsString() note?: string;
}
export class DueDto {
  @IsOptional() @Matches(DAY) asOf?: string;
}
export class MoveDto {
  @IsIn(['transfer', 'issue', 'receipt']) purpose!: 'transfer' | 'issue' | 'receipt';
  @IsOptional() @IsString() @MaxLength(200) toLocation?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() toCustodianId?: string | null;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
export class InsuranceDto {
  @IsString() @MaxLength(200) insurer!: string;
  @IsString() @MaxLength(100) policyNumber!: string;
  @IsNumberString() insuredValue!: string;
  @IsOptional() @IsNumberString() premium?: string;
  @Matches(DAY) startDate!: string;
  @Matches(DAY) endDate!: string;
}
export class StockComponentDto {
  @IsUUID() itemId!: string;
  @IsUUID() warehouseId!: string;
  @IsNumberString() quantity!: string;
}
export class ComponentsDto {
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) assetIds?: string[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockComponentDto)
  stockItems?: StockComponentDto[];
}

type Svc = AssetsService;

@Controller({ path: 'assets', version: '1' })
@UseFilters(AssetsExceptionFilter)
export class AssetsController {
  constructor(
    private readonly service: AssetsService,
    private readonly lifecycle: AssetLifecycleService,
  ) {}

  @Get('categories')
  async categories(
    @Query('orgNodeId') orgNodeId?: string,
  ): Promise<{ categories: Awaited<ReturnType<Svc['listCategories']>> }> {
    return { categories: await this.service.listCategories(orgNodeId || undefined) };
  }

  @Post('categories')
  @HttpCode(201)
  async category(
    @Body() dto: CategoryDto,
  ): Promise<{ category: Awaited<ReturnType<Svc['createCategory']>> }> {
    return { category: await this.service.createCategory(dto) };
  }

  @Get()
  async list(
    @Query('orgNodeId') orgNodeId?: string,
  ): Promise<{ assets: Awaited<ReturnType<Svc['list']>> }> {
    return { assets: await this.service.list(orgNodeId || undefined) };
  }

  @Post()
  @HttpCode(201)
  async create(@Body() dto: AssetDto): Promise<{ asset: Awaited<ReturnType<Svc['create']>> }> {
    return { asset: await this.service.create(dto) };
  }

  @Get('insurance/alerts')
  async insuranceAlerts(
    @Query('withinDays') withinDays?: string,
  ): Promise<Awaited<ReturnType<AssetLifecycleService['insuranceAlerts']>>> {
    const n = withinDays === undefined ? 30 : Number(withinDays);
    return this.lifecycle.insuranceAlerts(Number.isFinite(n) && n >= 0 ? n : 30);
  }

  @Post('depreciate-due')
  @HttpCode(200)
  async due(@Body() dto: DueDto): Promise<{ posted: Awaited<ReturnType<Svc['depreciateDue']>> }> {
    return { posted: await this.service.depreciateDue(dto.asOf) };
  }

  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ asset: Awaited<ReturnType<Svc['get']>> }> {
    return { asset: await this.service.get(id) };
  }

  @Post(':id/cwip-costs')
  @HttpCode(200)
  async cwip(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CwipCostDto,
  ): Promise<{ asset: Awaited<ReturnType<Svc['addCwipCost']>> }> {
    return { asset: await this.service.addCwipCost(id, dto) };
  }

  @Post(':id/capitalise')
  @HttpCode(200)
  async capitalise(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InUseDto,
  ): Promise<{ asset: Awaited<ReturnType<Svc['capitalise']>> }> {
    return { asset: await this.service.capitalise(id, dto) };
  }

  @Post(':id/submit')
  @HttpCode(200)
  async submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InUseDto,
  ): Promise<{ asset: Awaited<ReturnType<Svc['submit']>> }> {
    return { asset: await this.service.submit(id, dto) };
  }

  @Post(':id/adjust-value')
  @HttpCode(200)
  async adjust(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustDto,
  ): Promise<{ asset: Awaited<ReturnType<Svc['adjustValue']>> }> {
    return { asset: await this.service.adjustValue(id, dto) };
  }

  @Post(':id/move')
  @HttpCode(200)
  async move(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveDto,
  ): Promise<{ asset: Awaited<ReturnType<AssetLifecycleService['move']>> }> {
    return { asset: await this.lifecycle.move(id, dto) };
  }

  @Get(':id/movements')
  async movements(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ movements: Awaited<ReturnType<AssetLifecycleService['movements']>> }> {
    return { movements: await this.lifecycle.movements(id) };
  }

  @Post(':id/insurance')
  @HttpCode(201)
  async insurance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InsuranceDto,
  ): Promise<{ policy: Awaited<ReturnType<AssetLifecycleService['addInsurance']>> }> {
    return { policy: await this.lifecycle.addInsurance(id, dto) };
  }

  @Post(':id/components')
  @HttpCode(200)
  async addComponents(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ComponentsDto,
  ): Promise<{ asset: Awaited<ReturnType<AssetLifecycleService['addComponents']>> }> {
    return { asset: await this.lifecycle.addComponents(id, dto) };
  }

  @Get(':id/components')
  async components(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Awaited<ReturnType<AssetLifecycleService['components']>>> {
    return this.lifecycle.components(id);
  }
}
