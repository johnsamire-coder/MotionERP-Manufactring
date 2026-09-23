import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseFilters } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNumberString, IsOptional, IsString, IsUUID, MaxLength, ValidateNested,
} from 'class-validator';
import { PricingService } from './pricing.service';
import type { PricingResult, PricingRuleRecord } from './pricing.types';
import { SalesExceptionFilter } from './sales.exception-filter';

export class CreatePricingRuleDto {
  @IsString() @MaxLength(64) code!: string;
  @IsString() @MaxLength(200) title!: string;
  @IsIn(['selling', 'buying']) appliesTo!: 'selling' | 'buying';
  @IsIn(['item', 'item_category']) applyOn!: 'item' | 'item_category';
  @IsOptional() @IsUUID() itemId?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() partyId?: string;
  @IsOptional() @IsNumberString() minQty?: string;
  @IsOptional() @IsNumberString() maxQty?: string;
  @IsOptional() @IsString() validFrom?: string;
  @IsOptional() @IsString() validUntil?: string;
  @IsOptional() @IsInt() priority?: number;
  @IsIn(['price', 'product']) ruleType!: 'price' | 'product';
  @IsOptional() @IsNumberString() discountPercentage?: string;
  @IsOptional() @IsNumberString() discountAmount?: string;
  @IsOptional() @IsNumberString() rate?: string;
  @IsOptional() @IsUUID() freeItemId?: string;
  @IsOptional() @IsNumberString() freeQty?: string;
  @IsOptional() @IsBoolean() recursive?: boolean;
}

export class PricingLineDto {
  @IsUUID() itemId!: string;
  @IsNumberString() quantity!: string;
  @IsOptional() @IsNumberString() unitPrice?: string;
}

export class ApplyPricingDto {
  @IsIn(['selling', 'buying']) appliesTo!: 'selling' | 'buying';
  @IsOptional() @IsUUID() partyId?: string;
  @IsOptional() @IsString() date?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PricingLineDto) lines!: PricingLineDto[];
}

@Controller({ path: 'sales/pricing-rules', version: '1' })
@UseFilters(SalesExceptionFilter)
export class PricingController {
  constructor(private readonly service: PricingService) {}

  @Get()
  async list(): Promise<{ pricingRules: PricingRuleRecord[] }> { return { pricingRules: await this.service.list() }; }

  @Post() @HttpCode(201)
  async create(@Body() dto: CreatePricingRuleDto): Promise<{ pricingRule: PricingRuleRecord }> {
    return {
      pricingRule: await this.service.create({
        ...dto, itemId: dto.itemId ?? null, categoryId: dto.categoryId ?? null, partyId: dto.partyId ?? null,
        maxQty: dto.maxQty ?? null, validFrom: dto.validFrom ?? null, validUntil: dto.validUntil ?? null,
        discountPercentage: dto.discountPercentage ?? null, discountAmount: dto.discountAmount ?? null, rate: dto.rate ?? null,
        freeItemId: dto.freeItemId ?? null, freeQty: dto.freeQty ?? null,
      }),
    };
  }

  @Post(':id/disable') @HttpCode(200)
  async disable(@Param('id', ParseUUIDPipe) id: string): Promise<{ pricingRule: PricingRuleRecord }> {
    return { pricingRule: await this.service.setStatus(id, 'disabled') };
  }

  @Post(':id/enable') @HttpCode(200)
  async enable(@Param('id', ParseUUIDPipe) id: string): Promise<{ pricingRule: PricingRuleRecord }> {
    return { pricingRule: await this.service.setStatus(id, 'active') };
  }

  /** Prices lines against the active rules without creating any document. */
  @Post('apply') @HttpCode(200)
  async apply(@Body() dto: ApplyPricingDto): Promise<{ pricing: PricingResult }> {
    return { pricing: await this.service.apply(dto.appliesTo, dto.lines, dto.partyId, dto.date ? new Date(dto.date) : new Date()) };
  }
}
