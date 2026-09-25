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
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CrmExceptionFilter } from './crm.exception-filter';
import { OpportunityService } from './opportunity.service';
import type { OpportunityRecord } from './opportunity.types';

export class OpportunityItemDto {
  @IsUUID() itemId!: string;
  @IsNumberString() quantity!: string;
  @IsOptional() @IsNumberString() expectedRate?: string;
}
export class CreateOpportunityDto {
  @IsUUID() customerId!: string;
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(100) source?: string;
  @IsOptional() @IsNumberString() expectedAmount?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) probability?: number;
  @IsOptional() @IsString() expectedCloseDate?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpportunityItemDto)
  items?: OpportunityItemDto[];
}
export class MoveOpportunityDto {
  @IsIn(['open', 'qualified', 'lost']) stage!: 'open' | 'qualified' | 'lost';
  @IsOptional() @IsString() @MaxLength(500) lostReason?: string;
}

@Controller({ path: 'crm/opportunities', version: '1' })
@UseFilters(CrmExceptionFilter)
export class OpportunityController {
  constructor(private readonly service: OpportunityService) {}

  @Get()
  async list(
    @Query('customerId') customerId?: string,
  ): Promise<{ opportunities: OpportunityRecord[] }> {
    return { opportunities: await this.service.list(customerId) };
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<{ opportunity: OpportunityRecord }> {
    return { opportunity: await this.service.get(id) };
  }

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateOpportunityDto): Promise<{ opportunity: OpportunityRecord }> {
    return { opportunity: await this.service.create(dto) };
  }

  @Post(':id/stage')
  @HttpCode(200)
  async move(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveOpportunityDto,
  ): Promise<{ opportunity: OpportunityRecord }> {
    return { opportunity: await this.service.moveStage(id, dto.stage, dto.lostReason) };
  }
}
