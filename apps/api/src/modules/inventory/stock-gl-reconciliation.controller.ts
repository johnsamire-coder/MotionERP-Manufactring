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
import { IsString, MaxLength } from 'class-validator';
import type { JournalEntryRecord } from '../accounting/accounting.types';
import { InventoryExceptionFilter } from './inventory.exception-filter';
import {
  StockGlReconciliationService,
  type StockGlComparison,
} from './stock-gl-reconciliation.service';

export class PostStockGlCorrectionDto {
  @IsString() @MaxLength(500) reason!: string;
}

@Controller({ path: 'inventory/stock-gl-reconciliation', version: '1' })
@UseFilters(InventoryExceptionFilter)
export class StockGlReconciliationController {
  constructor(private readonly service: StockGlReconciliationService) {}

  @Get(':orgNodeId')
  async compare(
    @Param('orgNodeId', ParseUUIDPipe) orgNodeId: string,
  ): Promise<{ comparison: StockGlComparison }> {
    return { comparison: await this.service.compare(orgNodeId) };
  }

  @Post(':orgNodeId/post')
  @HttpCode(200)
  async post(
    @Param('orgNodeId', ParseUUIDPipe) orgNodeId: string,
    @Body() dto: PostStockGlCorrectionDto,
  ): Promise<{ comparison: StockGlComparison; entry: JournalEntryRecord }> {
    return this.service.postCorrection(orgNodeId, dto.reason);
  }
}
