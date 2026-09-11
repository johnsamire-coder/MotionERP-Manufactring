import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseFilters } from '@nestjs/common';
import { CreateCollectionDto, CreateRetentionDto, ReleaseRetentionDto } from './finance.dto';
import { FinanceExceptionFilter } from './finance.exception-filter';
import { FinanceService } from './finance.service';
import type { CollectionRecord, RetentionRecord } from './finance.types';

@Controller({ path: 'finance', version: '1' })
@UseFilters(FinanceExceptionFilter)
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  @Get('collections')
  async collections(@Query('jobOrderReference') jobOrderReference?: string): Promise<{ collections: CollectionRecord[] }> {
    return { collections: await this.service.getCollections(jobOrderReference) };
  }

  @Post('collections') @HttpCode(201)
  async recordCollection(@Body() dto: CreateCollectionDto): Promise<{ collection: CollectionRecord }> {
    const created = await this.service.recordCollection({
      jobOrderReference: dto.jobOrderReference, collectionDate: dto.collectionDate, amount: dto.amount,
      currencyCode: dto.currencyCode, paymentMethod: dto.paymentMethod, referenceNumber: dto.referenceNumber, notes: dto.notes,
    });
    return { collection: created };
  }

  @Get('retentions')
  async retentions(@Query('jobOrderReference') jobOrderReference?: string): Promise<{ retentions: RetentionRecord[] }> {
    return { retentions: await this.service.getRetentions(jobOrderReference) };
  }

  @Post('retentions') @HttpCode(201)
  async createRetention(@Body() dto: CreateRetentionDto): Promise<{ retention: RetentionRecord }> {
    const created = await this.service.createRetention({
      jobOrderReference: dto.jobOrderReference, originalAmount: dto.originalAmount, currencyCode: dto.currencyCode,
      startDate: dto.startDate, dueDate: dto.dueDate, notes: dto.notes,
    });
    return { retention: created };
  }

  @Post('retentions/:id/release') @HttpCode(200)
  async releaseRetention(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReleaseRetentionDto): Promise<{ retention: RetentionRecord }> {
    return { retention: await this.service.releaseRetention(id, dto.amount) };
  }
}
