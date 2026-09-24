import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, UseFilters } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsInt, IsNumberString, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import { AllocationService, type InvoiceOutstanding } from './allocation.service';
import { FinanceExceptionFilter } from './finance.exception-filter';

export class InstallmentDto { @IsDateString() dueDate!: string; @IsNumberString() amount!: string; }
export class SetInstallmentsDto { @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => InstallmentDto) installments!: InstallmentDto[]; }
export class AllocationLineDto {
  @IsUUID() invoiceId!: string;
  @IsNumberString() amount!: string;
  /** The outstanding shown to the user when the screen was loaded (latest-data check). */
  @IsNumberString() expectedOutstanding!: string;
  @IsOptional() @IsInt() @Min(1) installmentNumber?: number;
}
export class AllocateDto { @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => AllocationLineDto) lines!: AllocationLineDto[]; }

type Allocated = Awaited<ReturnType<AllocationService['allocatePayment']>>;

@Controller({ path: 'finance', version: '1' })
@UseFilters(FinanceExceptionFilter)
export class AllocationController {
  constructor(private readonly service: AllocationService) {}

  @Get('sales-invoices/:id/outstanding')
  async salesOutstanding(@Param('id', ParseUUIDPipe) id: string): Promise<{ outstanding: InvoiceOutstanding }> { return { outstanding: await this.service.outstanding('sales', id) }; }

  @Get('purchase-invoices/:id/outstanding')
  async purchaseOutstanding(@Param('id', ParseUUIDPipe) id: string): Promise<{ outstanding: InvoiceOutstanding }> { return { outstanding: await this.service.outstanding('purchase', id) }; }

  @Put('sales-invoices/:id/installments')
  async salesInstallments(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetInstallmentsDto): Promise<{ outstanding: InvoiceOutstanding }> {
    return { outstanding: await this.service.setInstallments('sales', id, dto.installments) };
  }

  @Put('purchase-invoices/:id/installments')
  async purchaseInstallments(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetInstallmentsDto): Promise<{ outstanding: InvoiceOutstanding }> {
    return { outstanding: await this.service.setInstallments('purchase', id, dto.installments) };
  }

  @Post('payments/:id/allocations') @HttpCode(200)
  async allocatePayment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AllocateDto): Promise<Allocated> {
    return this.service.allocatePayment(id, dto.lines);
  }

  @Post('collections/:id/allocations') @HttpCode(200)
  async allocateCollection(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AllocateDto): Promise<Allocated> {
    return this.service.allocateCollection(id, dto.lines);
  }
}
