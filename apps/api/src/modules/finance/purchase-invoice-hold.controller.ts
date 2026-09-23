import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Put, UseFilters } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { FinanceExceptionFilter } from './finance.exception-filter';
import { PurchaseInvoiceHoldService, type PurchaseInvoiceHoldRecord } from './purchase-invoice-hold.service';

export class HoldPurchaseInvoiceDto {
  @IsString() @MaxLength(500) reason!: string;
  @IsOptional() @IsString() releaseDate?: string;
}

/** Hold / release one purchase invoice for payment (plan item 19). */
@Controller({ path: 'finance/purchase-invoices/:id/hold', version: '1' })
@UseFilters(FinanceExceptionFilter)
export class PurchaseInvoiceHoldController {
  constructor(private readonly service: PurchaseInvoiceHoldService) {}

  @Get()
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<{ hold: PurchaseInvoiceHoldRecord | null }> {
    return { hold: await this.service.get(id) };
  }

  @Put()
  async hold(@Param('id', ParseUUIDPipe) id: string, @Body() dto: HoldPurchaseInvoiceDto): Promise<{ hold: PurchaseInvoiceHoldRecord }> {
    return { hold: await this.service.hold(id, dto.reason, dto.releaseDate) };
  }

  @Delete() @HttpCode(204)
  async release(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.release(id);
  }
}
