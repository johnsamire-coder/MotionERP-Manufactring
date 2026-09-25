import { Body, Controller, Get, Put, Query, UseFilters } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { SettingsExceptionFilter } from './settings.exception-filter';
import { PurchaseAllowanceService, type PurchaseAllowances } from './purchase-allowance.service';

export class SetPurchaseAllowancesDto {
  /** Omit for the global default. */
  @IsOptional() @IsUUID() orgNodeId?: string;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) overOrderPct!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) overReceiptPct!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) overBillingPct!: number;
}

@Controller({ path: 'settings/purchase-allowances', version: '1' })
@UseFilters(SettingsExceptionFilter)
export class PurchaseAllowanceController {
  constructor(private readonly service: PurchaseAllowanceService) {}

  /** Effective allowances for an org node (nearest configured ancestor, else global, else 0). */
  @Get()
  async get(@Query('orgNodeId') orgNodeId?: string): Promise<{ allowances: PurchaseAllowances }> {
    return { allowances: await this.service.resolve(orgNodeId) };
  }

  @Put()
  async set(@Body() dto: SetPurchaseAllowancesDto): Promise<{ allowances: PurchaseAllowances }> {
    return { allowances: await this.service.set(dto.orgNodeId ?? null, dto) };
  }
}
