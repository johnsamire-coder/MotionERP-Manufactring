import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseFilters,
} from '@nestjs/common';
import { IsIn, IsNumberString, IsOptional, IsUUID } from 'class-validator';
import { InventoryExceptionFilter } from './inventory.exception-filter';
import { ReorderService, type ItemReorderRecord, type ReorderSuggestion } from './reorder.service';

export class UpsertReorderDto {
  @IsUUID() itemId!: string;
  @IsUUID() warehouseId!: string;
  @IsNumberString() reorderLevel!: string;
  @IsNumberString() reorderQty!: string;
  @IsOptional() @IsIn(['purchase', 'transfer', 'manufacture']) requestType?:
    'purchase' | 'transfer' | 'manufacture';
}

@Controller({ path: 'inventory/reorder', version: '1' })
@UseFilters(InventoryExceptionFilter)
export class ReorderController {
  constructor(private readonly service: ReorderService) {}

  @Get('rules')
  async rules(): Promise<{ rules: ItemReorderRecord[] }> {
    return { rules: await this.service.list() };
  }

  @Put('rules')
  async upsert(@Body() dto: UpsertReorderDto): Promise<{ rule: ItemReorderRecord }> {
    return { rule: await this.service.upsert(dto) };
  }

  @Delete('rules/:id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.remove(id);
  }

  @Get('suggestions')
  async suggestions(): Promise<{ suggestions: ReorderSuggestion[] }> {
    return { suggestions: await this.service.suggestions() };
  }

  @Post('raise')
  @HttpCode(200)
  async raise(): Promise<{ raised: Awaited<ReturnType<ReorderService['raise']>> }> {
    return { raised: await this.service.raise() };
  }
}
