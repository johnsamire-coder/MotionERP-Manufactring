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
import { IsNumberString, IsUUID } from 'class-validator';
import { AdvanceService, type OpenAdvance } from './advance.service';
import { FinanceExceptionFilter } from './finance.exception-filter';

export class AllocateToSalesInvoiceDto {
  @IsUUID() salesInvoiceId!: string;
  @IsNumberString() amount!: string;
}
export class AllocateToPurchaseInvoiceDto {
  @IsUUID() purchaseInvoiceId!: string;
  @IsNumberString() amount!: string;
}

@Controller({ path: 'finance', version: '1' })
@UseFilters(FinanceExceptionFilter)
export class AdvanceController {
  constructor(private readonly service: AdvanceService) {}

  @Get('advances')
  async open(@Query('partyType') partyType?: string): Promise<{ advances: OpenAdvance[] }> {
    return {
      advances: await this.service.openAdvances(partyType === 'supplier' ? 'supplier' : 'customer'),
    };
  }

  @Post('collections/:id/allocate')
  @HttpCode(200)
  async allocateCollection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AllocateToSalesInvoiceDto,
  ): Promise<{ allocationId: string; journalEntryId: string | null }> {
    return this.service.allocateCollection(id, dto.salesInvoiceId, dto.amount);
  }

  @Post('payments/:id/allocate')
  @HttpCode(200)
  async allocatePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AllocateToPurchaseInvoiceDto,
  ): Promise<{ allocationId: string; journalEntryId: string | null }> {
    return this.service.allocatePayment(id, dto.purchaseInvoiceId, dto.amount);
  }
}
