import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseFilters } from '@nestjs/common';
import { ApproveQuotationDto, CreateQuotationDto } from './sales.dto';
import { SalesExceptionFilter } from './sales.exception-filter';
import { SalesService } from './sales.service';
import type { QuotationRecord } from './sales.types';

@Controller({ path: 'sales/quotations', version: '1' })
@UseFilters(SalesExceptionFilter)
export class SalesController {
  constructor(private readonly service: SalesService) {}

  @Get()
  async quotations(@Query('direction') direction?: 'outgoing' | 'incoming'): Promise<{ quotations: QuotationRecord[] }> {
    return { quotations: await this.service.getQuotations(direction) };
  }

  @Get(':id')
  async quotationById(@Param('id', ParseUUIDPipe) id: string): Promise<{ quotation: QuotationRecord }> {
    return { quotation: await this.service.getQuotation(id) };
  }

  @Post() @HttpCode(201)
  async createQuotation(@Body() dto: CreateQuotationDto): Promise<{ quotation: QuotationRecord }> {
    const created = await this.service.createQuotation({
      direction: dto.direction, customerId: dto.customerId, supplierId: dto.supplierId,
      quotationDate: dto.quotationDate, validUntil: dto.validUntil, currency: dto.currency,
      note: dto.note, lines: dto.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, unitPrice: l.unitPrice })),
    });
    return { quotation: created };
  }

  @Post(':id/send') @HttpCode(200)
  async sendQuotation(@Param('id', ParseUUIDPipe) id: string): Promise<{ quotation: QuotationRecord }> {
    return { quotation: await this.service.sendQuotation(id) };
  }

  @Post(':id/approve') @HttpCode(200)
  async approveQuotation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveQuotationDto): Promise<{ quotation: QuotationRecord }> {
    return { quotation: await this.service.approveQuotation(id, dto.customerPoReference) };
  }

  @Post(':id/reject') @HttpCode(200)
  async rejectQuotation(@Param('id', ParseUUIDPipe) id: string): Promise<{ quotation: QuotationRecord }> {
    return { quotation: await this.service.rejectQuotation(id) };
  }
}
