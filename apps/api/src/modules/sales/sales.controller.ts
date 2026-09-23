import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseFilters } from '@nestjs/common';
import { ApproveQuotationDto, CreateJobOrderDto, CreateQuotationDto, QuotationFromOpportunityDto } from './sales.dto';
import { SalesExceptionFilter } from './sales.exception-filter';
import { SalesService } from './sales.service';
import { CustomerCreditService, type CustomerCreditStatus } from './customer-credit.service';
import type { JobOrderRecord, QuotationRecord } from './sales.types';

@Controller({ path: 'sales', version: '1' })
@UseFilters(SalesExceptionFilter)
export class SalesController {
  constructor(
    private readonly service: SalesService,
    private readonly credit: CustomerCreditService,
  ) {}

  /** Composite credit position of a customer (plan item 6). */
  @Get('customers/:id/credit-status')
  async creditStatus(@Param('id', ParseUUIDPipe) id: string): Promise<{ creditStatus: CustomerCreditStatus }> {
    return { creditStatus: await this.credit.getStatus(id) };
  }

  @Get('quotations')
  async quotations(@Query('direction') direction?: 'outgoing' | 'incoming'): Promise<{ quotations: QuotationRecord[] }> {
    return { quotations: await this.service.getQuotations(direction) };
  }

  @Get('quotations/:id')
  async quotationById(@Param('id', ParseUUIDPipe) id: string): Promise<{ quotation: QuotationRecord }> {
    return { quotation: await this.service.getQuotation(id) };
  }

  @Post('quotations') @HttpCode(201)
  async createQuotation(@Body() dto: CreateQuotationDto): Promise<{ quotation: QuotationRecord }> {
    const created = await this.service.createQuotation({
      direction: dto.direction, customerId: dto.customerId, supplierId: dto.supplierId, orgNodeId: dto.orgNodeId,
      quotationDate: dto.quotationDate, validUntil: dto.validUntil, currency: dto.currency,
      note: dto.note, lines: dto.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, unitPrice: l.unitPrice })),
      applyPricingRules: dto.applyPricingRules,
    });
    return { quotation: created };
  }

  /** Plan item 17: formal quotation from an opportunity. */
  @Post('opportunities/:id/quotation') @HttpCode(201)
  async quotationFromOpportunity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: QuotationFromOpportunityDto,
  ): Promise<{ quotation: QuotationRecord }> {
    return { quotation: await this.service.createQuotationFromOpportunity(id, dto) };
  }

  @Post('quotations/:id/send') @HttpCode(200)
  async sendQuotation(@Param('id', ParseUUIDPipe) id: string): Promise<{ quotation: QuotationRecord }> {
    return { quotation: await this.service.sendQuotation(id) };
  }

  @Post('quotations/:id/approve') @HttpCode(200)
  async approveQuotation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveQuotationDto,
  ): Promise<{ quotation: QuotationRecord; jobOrder?: JobOrderRecord }> {
    return this.service.approveQuotation(id, dto.customerPoReference);
  }

  @Post('quotations/:id/reject') @HttpCode(200)
  async rejectQuotation(@Param('id', ParseUUIDPipe) id: string): Promise<{ quotation: QuotationRecord }> {
    return { quotation: await this.service.rejectQuotation(id) };
  }

  @Get('job-orders')
  async jobOrders(): Promise<{ jobOrders: JobOrderRecord[] }> { return { jobOrders: await this.service.getJobOrders() }; }

  @Get('job-orders/:id')
  async jobOrderById(@Param('id', ParseUUIDPipe) id: string): Promise<{ jobOrder: JobOrderRecord }> {
    return { jobOrder: await this.service.getJobOrder(id) };
  }

  @Post('job-orders') @HttpCode(201)
  async createJobOrder(@Body() dto: CreateJobOrderDto): Promise<{ jobOrder: JobOrderRecord }> {
    const created = await this.service.createJobOrder({
      source: dto.source, quotationReference: dto.quotationReference, customerId: dto.customerId,
      orgNodeId: dto.orgNodeId, note: dto.note,
    });
    return { jobOrder: created };
  }

  @Post('job-orders/:id/financial-review/pass') @HttpCode(200)
  async passFinancialReview(@Param('id', ParseUUIDPipe) id: string): Promise<{ jobOrder: JobOrderRecord }> {
    return { jobOrder: await this.service.passFinancialReview(id) };
  }

  @Post('job-orders/:id/approve') @HttpCode(200)
  async approveJobOrder(@Param('id', ParseUUIDPipe) id: string): Promise<{ jobOrder: JobOrderRecord; creditWarning?: string }> {
    const jobOrder = await this.service.approveJobOrder(id);
    // Owner decision (plan item 6): exceeding the credit limit warns, it never blocks the approval.
    const warning = await this.credit.warningFor(jobOrder.customerId);
    return warning ? { jobOrder, creditWarning: warning.message } : { jobOrder };
  }

  @Post('job-orders/:id/cancel') @HttpCode(200)
  async cancelJobOrder(@Param('id', ParseUUIDPipe) id: string): Promise<{ jobOrder: JobOrderRecord }> {
    return { jobOrder: await this.service.cancelJobOrder(id) };
  }
}
