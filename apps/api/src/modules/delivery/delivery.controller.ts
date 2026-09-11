import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, UseFilters } from '@nestjs/common';
import { CreateDeliveryOrderDto, CreateDeliveryReceiptDto, CreateInstallationDto, CreateInstallationReportDto, UpdateDeliveryOrderDto, UpdateInstallationDto } from './delivery.dto';
import { DeliveryExceptionFilter } from './delivery.exception-filter';
import { DeliveryService } from './delivery.service';
import type { DeliveryOrderRecord, DeliveryReceiptRecord, InstallationRecord, InstallationReportRecord } from './delivery.types';

@Controller({ path: 'delivery', version: '1' })
@UseFilters(DeliveryExceptionFilter)
export class DeliveryController {
  constructor(private readonly service: DeliveryService) {}

  @Post('orders') @HttpCode(201)
  async createDeliveryOrder(@Body() dto: CreateDeliveryOrderDto): Promise<{ deliveryOrder: DeliveryOrderRecord }> {
    const deliveryOrder = await this.service.createDeliveryOrder({
      jobOrderReference: dto.jobOrderReference,
      scheduledDate: new Date(dto.scheduledDate),
      vehiclePlate: dto.vehiclePlate,
      driverName: dto.driverName,
      notes: dto.notes
    });
    return { deliveryOrder };
  }

  @Put('orders/:id') @HttpCode(200)
  async updateDeliveryOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryOrderDto
  ): Promise<{ deliveryOrder: DeliveryOrderRecord }> {
    const updateInput: any = {};
    if (dto.actualDate !== undefined) updateInput.actualDate = new Date(dto.actualDate);
    if (dto.status !== undefined) updateInput.status = dto.status;
    if (dto.vehiclePlate !== undefined) updateInput.vehiclePlate = dto.vehiclePlate;
    if (dto.driverName !== undefined) updateInput.driverName = dto.driverName;
    if (dto.notes !== undefined) updateInput.notes = dto.notes;

    const deliveryOrder = await this.service.updateDeliveryOrder(id, updateInput);
    return { deliveryOrder };
  }

  @Get('orders/job/:jobOrderReference')
  async getDeliveryOrdersByJobOrder(@Param('jobOrderReference') jobOrderReference: string): Promise<{ deliveryOrders: DeliveryOrderRecord[] }> {
    const deliveryOrders = await this.service.getDeliveryOrdersByJobOrder(jobOrderReference);
    return { deliveryOrders };
  }

  @Post('installations') @HttpCode(201)
  async createInstallation(@Body() dto: CreateInstallationDto): Promise<{ installation: InstallationRecord }> {
    const installation = await this.service.createInstallation({
      deliveryOrderId: dto.deliveryOrderId,
      scheduledDate: new Date(dto.scheduledDate),
      technicianNames: dto.technicianNames,
      location: dto.location,
      notes: dto.notes
    });
    return { installation };
  }

  @Put('installations/:id') @HttpCode(200)
  async updateInstallation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInstallationDto
  ): Promise<{ installation: InstallationRecord }> {
    const updateInput: any = {};
    if (dto.actualStartDate !== undefined) updateInput.actualStartDate = new Date(dto.actualStartDate);
    if (dto.actualEndDate !== undefined) updateInput.actualEndDate = new Date(dto.actualEndDate);
    if (dto.status !== undefined) updateInput.status = dto.status;
    if (dto.technicianNames !== undefined) updateInput.technicianNames = dto.technicianNames;
    if (dto.location !== undefined) updateInput.location = dto.location;
    if (dto.notes !== undefined) updateInput.notes = dto.notes;

    const installation = await this.service.updateInstallation(id, updateInput);
    return { installation };
  }

  @Get('installations/delivery/:deliveryOrderId')
  async getInstallationsByDeliveryOrder(@Param('deliveryOrderId', ParseUUIDPipe) deliveryOrderId: string): Promise<{ installations: InstallationRecord[] }> {
    const installations = await this.service.getInstallationsByDeliveryOrder(deliveryOrderId);
    return { installations };
  }

  @Post('receipts') @HttpCode(201)
  async createDeliveryReceipt(@Body() dto: CreateDeliveryReceiptDto): Promise<{ deliveryReceipt: DeliveryReceiptRecord }> {
    const deliveryReceipt = await this.service.createDeliveryReceipt({
      deliveryOrderId: dto.deliveryOrderId,
      signedBy: dto.signedBy,
      signatureImage: dto.signatureImage,
      receivedItems: dto.receivedItems,
      notes: dto.notes
    });
    return { deliveryReceipt };
  }

  @Post('reports') @HttpCode(201)
  async createInstallationReport(@Body() dto: CreateInstallationReportDto): Promise<{ installationReport: InstallationReportRecord }> {
    const installationReport = await this.service.createInstallationReport({
      installationId: dto.installationId,
      performedBy: dto.performedBy,
      verifiedBy: dto.verifiedBy,
      completionNotes: dto.completionNotes,
      issuesFound: dto.issuesFound,
      correctiveActions: dto.correctiveActions
    });
    return { installationReport };
  }
  @Get('receipts')
  async getDeliveryReceipts(): Promise<{ deliveryReceipts: DeliveryReceiptRecord[] }> {
    return { deliveryReceipts: await this.service.getDeliveryReceipts() };
  }
}