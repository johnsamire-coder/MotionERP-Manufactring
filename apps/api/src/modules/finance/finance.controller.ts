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
import {
  CreateCollectionDto,
  CreatePaymentDto,
  CreatePurchaseInvoiceDto,
  CreateRetentionDto,
  CreateSalesInvoiceDto,
  ReleaseRetentionDto,
} from './finance.dto';
import { FinanceExceptionFilter } from './finance.exception-filter';
import { FinanceService } from './finance.service';
import type {
  CollectionRecord,
  PaymentRecord,
  PurchaseInvoiceRecord,
  RetentionRecord,
  SalesInvoiceRecord,
} from './finance.types';

@Controller({ path: 'finance', version: '1' })
@UseFilters(FinanceExceptionFilter)
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  // --- Collections ---
  @Get('collections')
  async collections(@Query('jobOrderReference') jobOrderReference?: string): Promise<{ collections: CollectionRecord[] }> {
    return { collections: await this.service.getCollections(jobOrderReference) };
  }

  @Post('collections')
  @HttpCode(201)
  async recordCollection(@Body() dto: CreateCollectionDto): Promise<{ collection: CollectionRecord }> {
    const created = await this.service.recordCollection({
      jobOrderReference: dto.jobOrderReference,
      collectionDate: dto.collectionDate,
      amount: dto.amount,
      currencyCode: dto.currencyCode,
      paymentMethod: dto.paymentMethod,
      receivedInAccountId: dto.receivedInAccountId,
      referenceNumber: dto.referenceNumber,
      notes: dto.notes,
    });
    return { collection: created };
  }

  // --- Retentions ---
  @Get('retentions')
  async retentions(@Query('jobOrderReference') jobOrderReference?: string): Promise<{ retentions: RetentionRecord[] }> {
    return { retentions: await this.service.getRetentions(jobOrderReference) };
  }

  @Post('retentions')
  @HttpCode(201)
  async createRetention(@Body() dto: CreateRetentionDto): Promise<{ retention: RetentionRecord }> {
    const created = await this.service.createRetention({
      jobOrderReference: dto.jobOrderReference,
      originalAmount: dto.originalAmount,
      currencyCode: dto.currencyCode,
      startDate: dto.startDate,
      dueDate: dto.dueDate,
      notes: dto.notes,
    });
    return { retention: created };
  }

  @Post('retentions/:id/release')
  @HttpCode(200)
  async releaseRetention(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReleaseRetentionDto,
  ): Promise<{ retention: RetentionRecord }> {
    return { retention: await this.service.releaseRetention(id, dto.amount) };
  }

  // --- Purchase Invoices ---
  @Get('purchase-invoices')
  async purchaseInvoices(
    @Query('orgNodeId') orgNodeId?: string,
    @Query('supplierId') supplierId?: string,
  ): Promise<{ purchaseInvoices: PurchaseInvoiceRecord[] }> {
    return { purchaseInvoices: await this.service.getPurchaseInvoices(orgNodeId, supplierId) };
  }

  @Get('purchase-invoices/:id')
  async purchaseInvoice(@Param('id', ParseUUIDPipe) id: string): Promise<{ purchaseInvoice: PurchaseInvoiceRecord }> {
    return { purchaseInvoice: await this.service.getPurchaseInvoice(id) };
  }

  @Post('purchase-invoices')
  @HttpCode(201)
  async createPurchaseInvoice(@Body() dto: CreatePurchaseInvoiceDto): Promise<{ purchaseInvoice: PurchaseInvoiceRecord }> {
    const created = await this.service.createPurchaseInvoice(dto);
    return { purchaseInvoice: created };
  }

  @Post('purchase-invoices/:id/post')
  @HttpCode(200)
  async postPurchaseInvoice(@Param('id', ParseUUIDPipe) id: string): Promise<{ purchaseInvoice: PurchaseInvoiceRecord }> {
    return { purchaseInvoice: await this.service.postPurchaseInvoice(id) };
  }

  @Post('purchase-invoices/:id/cancel')
  @HttpCode(200)
  async cancelPurchaseInvoice(@Param('id', ParseUUIDPipe) id: string): Promise<{ purchaseInvoice: PurchaseInvoiceRecord }> {
    return { purchaseInvoice: await this.service.cancelPurchaseInvoice(id) };
  }

  // --- Sales Invoices ---
  @Get('sales-invoices')
  async salesInvoices(
    @Query('orgNodeId') orgNodeId?: string,
    @Query('customerId') customerId?: string,
  ): Promise<{ salesInvoices: SalesInvoiceRecord[] }> {
    return { salesInvoices: await this.service.getSalesInvoices(orgNodeId, customerId) };
  }

  @Get('sales-invoices/:id')
  async salesInvoice(@Param('id', ParseUUIDPipe) id: string): Promise<{ salesInvoice: SalesInvoiceRecord }> {
    return { salesInvoice: await this.service.getSalesInvoice(id) };
  }

  @Post('sales-invoices')
  @HttpCode(201)
  async createSalesInvoice(@Body() dto: CreateSalesInvoiceDto): Promise<{ salesInvoice: SalesInvoiceRecord }> {
    const created = await this.service.createSalesInvoice(dto);
    return { salesInvoice: created };
  }

  @Post('sales-invoices/:id/post')
  @HttpCode(200)
  async postSalesInvoice(@Param('id', ParseUUIDPipe) id: string): Promise<{ salesInvoice: SalesInvoiceRecord }> {
    return { salesInvoice: await this.service.postSalesInvoice(id) };
  }

  @Post('sales-invoices/:id/cancel')
  @HttpCode(200)
  async cancelSalesInvoice(@Param('id', ParseUUIDPipe) id: string): Promise<{ salesInvoice: SalesInvoiceRecord }> {
    return { salesInvoice: await this.service.cancelSalesInvoice(id) };
  }

  // --- Payments (Supplier Payments) ---
  @Get('payments')
  async payments(
    @Query('orgNodeId') orgNodeId?: string,
    @Query('supplierId') supplierId?: string,
  ): Promise<{ payments: PaymentRecord[] }> {
    return { payments: await this.service.getPayments(orgNodeId, supplierId) };
  }

  @Get('payments/:id')
  async payment(@Param('id', ParseUUIDPipe) id: string): Promise<{ payment: PaymentRecord }> {
    return { payment: await this.service.getPayment(id) };
  }

  @Post('payments')
  @HttpCode(201)
  async createPayment(@Body() dto: CreatePaymentDto): Promise<{ payment: PaymentRecord }> {
    const created = await this.service.createPayment(dto);
    return { payment: created };
  }

  @Post('payments/:id/post')
  @HttpCode(200)
  async postPayment(@Param('id', ParseUUIDPipe) id: string): Promise<{ payment: PaymentRecord }> {
    return { payment: await this.service.postPayment(id) };
  }

  @Post('payments/:id/cancel')
  @HttpCode(200)
  async cancelPayment(@Param('id', ParseUUIDPipe) id: string): Promise<{ payment: PaymentRecord }> {
    return { payment: await this.service.cancelPayment(id) };
  }
}