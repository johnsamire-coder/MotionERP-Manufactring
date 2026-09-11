import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DeliveryNotFoundError, DeliveryValidationError } from './delivery.errors';
import { DeliveryRepository } from './delivery.repository';
import type { CreateDeliveryOrderInput, CreateDeliveryReceiptInput, CreateInstallationInput, CreateInstallationReportInput, DeliveryOrderRecord, DeliveryReceiptRecord, InstallationRecord, InstallationReportRecord, UpdateDeliveryOrderInput, UpdateInstallationInput } from './delivery.types';

@Injectable()
export class DeliveryService {
  constructor(private readonly repository: DeliveryRepository) {}

  async createDeliveryOrder(input: CreateDeliveryOrderInput): Promise<DeliveryOrderRecord> {
    const scheduledDate = new Date(input.scheduledDate);
    if (isNaN(scheduledDate.getTime())) {
      throw new DeliveryValidationError('Invalid scheduled date');
    }

    // Generate delivery number: DO-YYYY-MM-DD-XXXX
    const datePart = scheduledDate.toISOString().slice(0, 10).replace(/-/g, '');
    const existingToday = (await this.repository.findDeliveryOrdersByJobOrder(input.jobOrderReference))
      .filter(order => order.deliveryNumber.startsWith(`DO-${datePart}`));
    const sequence = existingToday.length + 1;
    const deliveryNumber = `DO-${datePart}-${sequence.toString().padStart(4, '0')}`;

    return this.repository.insertDeliveryOrder({
      id: randomUUID(),
      deliveryNumber,
      ...input,
      scheduledDate
    });
  }

  async updateDeliveryOrder(id: string, input: UpdateDeliveryOrderInput): Promise<DeliveryOrderRecord> {
    const existing = await this.repository.findDeliveryOrderById(id);
    if (!existing) throw new DeliveryNotFoundError(`Delivery order ${id} not found`);

    if (input.actualDate) {
      const actualDate = new Date(input.actualDate);
      if (isNaN(actualDate.getTime())) {
        throw new DeliveryValidationError('Invalid actual date');
      }
    }

    return this.repository.updateDeliveryOrder(id, input);
  }

  async getDeliveryOrdersByJobOrder(jobOrderReference: string): Promise<DeliveryOrderRecord[]> {
    return this.repository.findDeliveryOrdersByJobOrder(jobOrderReference);
  }

  async createInstallation(input: CreateInstallationInput): Promise<InstallationRecord> {
    const deliveryOrder = await this.repository.findDeliveryOrderById(input.deliveryOrderId);
    if (!deliveryOrder) throw new DeliveryNotFoundError(`Delivery order ${input.deliveryOrderId} not found`);

    const scheduledDate = new Date(input.scheduledDate);
    if (isNaN(scheduledDate.getTime())) {
      throw new DeliveryValidationError('Invalid scheduled date');
    }

    return this.repository.insertInstallation({
      id: randomUUID(),
      ...input,
      scheduledDate
    });
  }

  async updateInstallation(id: string, input: UpdateInstallationInput): Promise<InstallationRecord> {
    const existing = await this.repository.findInstallationById(id);
    if (!existing) throw new DeliveryNotFoundError(`Installation ${id} not found`);

    if (input.actualStartDate) {
      const actualStartDate = new Date(input.actualStartDate);
      if (isNaN(actualStartDate.getTime())) {
        throw new DeliveryValidationError('Invalid actual start date');
      }
    }

    if (input.actualEndDate) {
      const actualEndDate = new Date(input.actualEndDate);
      if (isNaN(actualEndDate.getTime())) {
        throw new DeliveryValidationError('Invalid actual end date');
      }
    }

    return this.repository.updateInstallation(id, input);
  }

  async getInstallationsByDeliveryOrder(deliveryOrderId: string): Promise<InstallationRecord[]> {
    const deliveryOrder = await this.repository.findDeliveryOrderById(deliveryOrderId);
    if (!deliveryOrder) throw new DeliveryNotFoundError(`Delivery order ${deliveryOrderId} not found`);

    return this.repository.findInstallationsByDeliveryOrder(deliveryOrderId);
  }

  async createDeliveryReceipt(input: CreateDeliveryReceiptInput): Promise<DeliveryReceiptRecord> {
    const deliveryOrder = await this.repository.findDeliveryOrderById(input.deliveryOrderId);
    if (!deliveryOrder) throw new DeliveryNotFoundError(`Delivery order ${input.deliveryOrderId} not found`);

    if (!input.signedBy?.trim()) {
      throw new DeliveryValidationError('Signed by is required');
    }

    // Generate receipt number: DR-YYYY-MM-DD-XXXX
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const sequence = Math.floor(Math.random() * 8999) + 1000; // In real implementation, query existing receipts for today
    const receiptNumber = `DR-${today}-${sequence.toString().padStart(4, '0')}`;

    return this.repository.insertDeliveryReceipt({
      id: randomUUID(),
      receiptNumber,
      ...input
    });
  }

  async createInstallationReport(input: CreateInstallationReportInput): Promise<InstallationReportRecord> {
    const installation = await this.repository.findInstallationById(input.installationId);
    if (!installation) throw new DeliveryNotFoundError(`Installation ${input.installationId} not found`);

    if (!input.performedBy?.trim()) {
      throw new DeliveryValidationError('Performed by is required');
    }

    // Generate report number: IR-YYYY-MM-DD-XXXX
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const sequence = Math.floor(Math.random() * 8999) + 1000; // In real implementation, query existing reports for today
    const reportNumber = `IR-${today}-${sequence.toString().padStart(4, '0')}`;

    return this.repository.insertInstallationReport({
      id: randomUUID(),
      reportNumber,
      ...input
    });
  }
  async getDeliveryReceipts(): Promise<DeliveryReceiptRecord[]> {
    return this.repository.findAllReceipts();
  }
}