import { Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { deliveryOrder, deliveryReceipt, installation, installationReport } from './delivery.schema';
import type { CreateDeliveryOrderInput, CreateDeliveryReceiptInput, CreateInstallationInput, CreateInstallationReportInput, DeliveryOrderRecord, DeliveryReceiptRecord, InstallationRecord, InstallationReportRecord, UpdateDeliveryOrderInput, UpdateInstallationInput } from './delivery.types';

const doColumns = {
  id: deliveryOrder.id, jobOrderReference: deliveryOrder.jobOrderReference, orgNodeId: deliveryOrder.orgNodeId, deliveryNumber: deliveryOrder.deliveryNumber,
  scheduledDate: deliveryOrder.scheduledDate, actualDate: deliveryOrder.actualDate, status: deliveryOrder.status,
  vehiclePlate: deliveryOrder.vehiclePlate, driverName: deliveryOrder.driverName, notes: deliveryOrder.notes
};

const instColumns = {
  id: installation.id, deliveryOrderId: installation.deliveryOrderId, scheduledDate: installation.scheduledDate,
  actualStartDate: installation.actualStartDate, actualEndDate: installation.actualEndDate, status: installation.status,
  technicianNames: installation.technicianNames, location: installation.location, notes: installation.notes
};

const drColumns = {
  id: deliveryReceipt.id, deliveryOrderId: deliveryReceipt.deliveryOrderId, receiptNumber: deliveryReceipt.receiptNumber,
  signedBy: deliveryReceipt.signedBy, signatureImage: deliveryReceipt.signatureImage, receivedItems: deliveryReceipt.receivedItems,
  notes: deliveryReceipt.notes, signedAt: deliveryReceipt.signedAt
};

const irColumns = {
  id: installationReport.id, installationId: installationReport.installationId, reportNumber: installationReport.reportNumber,
  performedBy: installationReport.performedBy, verifiedBy: installationReport.verifiedBy, completionNotes: installationReport.completionNotes,
  issuesFound: installationReport.issuesFound, correctiveActions: installationReport.correctiveActions, verifiedAt: installationReport.verifiedAt
};

interface DoRow { id: string; jobOrderReference: string; orgNodeId: string | null; deliveryNumber: string; scheduledDate: Date; actualDate: Date | null; status: string; vehiclePlate: string | null; driverName: string | null; notes: string | null; }
interface InstRow { id: string; deliveryOrderId: string; scheduledDate: Date; actualStartDate: Date | null; actualEndDate: Date | null; status: string; technicianNames: string | null; location: string | null; notes: string | null; }
interface DrRow { id: string; deliveryOrderId: string; receiptNumber: string; signedBy: string; signatureImage: string | null; receivedItems: string | null; notes: string | null; signedAt: Date; }
interface IrRow { id: string; installationId: string; reportNumber: string; performedBy: string; verifiedBy: string | null; completionNotes: string | null; issuesFound: string | null; correctiveActions: string | null; verifiedAt: Date | null; }

function toDoRecord(row: DoRow): DeliveryOrderRecord { return { ...row, status: row.status as any }; }
function toInstRecord(row: InstRow): InstallationRecord { return { ...row, status: row.status as any }; }
function toDrRecord(row: DrRow): DeliveryReceiptRecord { return row; }
function toIrRecord(row: IrRow): InstallationReportRecord { return row; }

@Injectable()
export class DeliveryRepository {
  constructor(private readonly database: DatabaseService) {}

  async findDeliveryOrderById(id: string): Promise<DeliveryOrderRecord | null> {
    const rows = await this.database.db.select(doColumns).from(deliveryOrder).where(eq(deliveryOrder.id, id)).limit(1);
    return rows[0] ? toDoRecord(rows[0]) : null;
  }

  async findDeliveryOrderByNumber(deliveryNumber: string): Promise<DeliveryOrderRecord | null> {
    const rows = await this.database.db.select(doColumns).from(deliveryOrder).where(eq(deliveryOrder.deliveryNumber, deliveryNumber)).limit(1);
    return rows[0] ? toDoRecord(rows[0]) : null;
  }

  async findDeliveryOrdersByJobOrder(jobOrderReference: string): Promise<DeliveryOrderRecord[]> {
    const rows = await this.database.db.select(doColumns).from(deliveryOrder).where(eq(deliveryOrder.jobOrderReference, jobOrderReference)).orderBy(asc(deliveryOrder.scheduledDate));
    return rows.map(toDoRecord);
  }

  async insertDeliveryOrder(input: CreateDeliveryOrderInput & { id: string; deliveryNumber: string; orgNodeId: string | null }): Promise<DeliveryOrderRecord> {
    const rows = await this.database.db.insert(deliveryOrder).values({
      id: input.id, jobOrderReference: input.jobOrderReference, orgNodeId: input.orgNodeId, deliveryNumber: input.deliveryNumber,
      scheduledDate: input.scheduledDate, vehiclePlate: input.vehiclePlate, driverName: input.driverName, notes: input.notes
    }).returning(doColumns);
    return toDoRecord(rows[0]!);
  }

  async updateDeliveryOrder(id: string, input: UpdateDeliveryOrderInput): Promise<DeliveryOrderRecord> {
    const rows = await this.database.db.update(deliveryOrder).set(input).where(eq(deliveryOrder.id, id)).returning(doColumns);
    return toDoRecord(rows[0]!);
  }

  async findInstallationById(id: string): Promise<InstallationRecord | null> {
    const rows = await this.database.db.select(instColumns).from(installation).where(eq(installation.id, id)).limit(1);
    return rows[0] ? toInstRecord(rows[0]) : null;
  }

  async findInstallationsByDeliveryOrder(deliveryOrderId: string): Promise<InstallationRecord[]> {
    const rows = await this.database.db.select(instColumns).from(installation).where(eq(installation.deliveryOrderId, deliveryOrderId)).orderBy(asc(installation.scheduledDate));
    return rows.map(toInstRecord);
  }

  async insertInstallation(input: CreateInstallationInput & { id: string }): Promise<InstallationRecord> {
    const rows = await this.database.db.insert(installation).values({
      id: input.id, deliveryOrderId: input.deliveryOrderId, scheduledDate: input.scheduledDate,
      technicianNames: input.technicianNames, location: input.location, notes: input.notes
    }).returning(instColumns);
    return toInstRecord(rows[0]!);
  }

  async updateInstallation(id: string, input: UpdateInstallationInput): Promise<InstallationRecord> {
    const rows = await this.database.db.update(installation).set(input).where(eq(installation.id, id)).returning(instColumns);
    return toInstRecord(rows[0]!);
  }

  async insertDeliveryReceipt(input: CreateDeliveryReceiptInput & { id: string; receiptNumber: string }): Promise<DeliveryReceiptRecord> {
    const rows = await this.database.db.insert(deliveryReceipt).values({
      id: input.id, deliveryOrderId: input.deliveryOrderId, receiptNumber: input.receiptNumber,
      signedBy: input.signedBy, signatureImage: input.signatureImage, receivedItems: input.receivedItems, notes: input.notes
    }).returning(drColumns);
    return toDrRecord(rows[0]!);
  }

  async insertInstallationReport(input: CreateInstallationReportInput & { id: string; reportNumber: string }): Promise<InstallationReportRecord> {
    const rows = await this.database.db.insert(installationReport).values({
      id: input.id, installationId: input.installationId, reportNumber: input.reportNumber,
      performedBy: input.performedBy, verifiedBy: input.verifiedBy, completionNotes: input.completionNotes,
      issuesFound: input.issuesFound, correctiveActions: input.correctiveActions
    }).returning(irColumns);
    return toIrRecord(rows[0]!);
  }
  async findAllReceipts(): Promise<DeliveryReceiptRecord[]> {
    const rows = await this.database.db.select(drColumns).from(deliveryReceipt);
    return rows.map(toDrRecord);
  }
}
