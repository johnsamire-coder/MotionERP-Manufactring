import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseFilters,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { InventoryExceptionFilter } from './inventory.exception-filter';
import type { PickPlan } from './pick-list.engine';
import { PickListService, type PickListRecord } from './pick-list.service';

export class PickItemDto {
  @IsUUID() itemId!: string;
  @IsNumberString() quantity!: string;
}
export class SuggestPicksDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PickItemDto)
  items!: PickItemDto[];
  @IsOptional() @IsUUID() scopeWarehouseId?: string;
}
export class CreatePickListDto extends SuggestPicksDto {
  @IsOptional() @IsIn(['delivery', 'material_transfer']) purpose?: 'delivery' | 'material_transfer';
  @IsOptional() @IsUUID() targetWarehouseId?: string;
  @IsOptional() @IsString() @MaxLength(200) reference?: string;
  @IsOptional() @IsBoolean() allowPartial?: boolean;
}
export class PickedLineDto {
  @IsUUID() lineId!: string;
  @IsNumberString() pickedQuantity!: string;
}
export class CompletePickListDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PickedLineDto)
  lines?: PickedLineDto[];
}

@Controller({ path: 'inventory/pick-lists', version: '1' })
@UseFilters(InventoryExceptionFilter)
export class PickListController {
  constructor(private readonly service: PickListService) {}

  @Post('suggest')
  @HttpCode(200)
  async suggest(@Body() dto: SuggestPicksDto): Promise<{ plan: PickPlan }> {
    return { plan: await this.service.suggest(dto) };
  }

  @Get()
  async list(): Promise<{ pickLists: PickListRecord[] }> {
    return { pickLists: await this.service.list() };
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<{ pickList: PickListRecord }> {
    return { pickList: await this.service.get(id) };
  }

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreatePickListDto): Promise<{ pickList: PickListRecord }> {
    return { pickList: await this.service.create(dto) };
  }

  @Post(':id/complete')
  @HttpCode(200)
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompletePickListDto,
  ): Promise<{ pickList: PickListRecord }> {
    return { pickList: await this.service.complete(id, dto.lines) };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(@Param('id', ParseUUIDPipe) id: string): Promise<{ pickList: PickListRecord }> {
    return { pickList: await this.service.cancel(id) };
  }
}
