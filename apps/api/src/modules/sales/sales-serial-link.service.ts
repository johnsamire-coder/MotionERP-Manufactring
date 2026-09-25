// ============================================================
// Motion ERP — Sales Serial Link Service
// Step 69 | Medical Device Warranty & Traceability
// ============================================================
import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { salesLineSerial, SalesLineSerial, NewSalesLineSerial } from './sales-serial-link.schema';
import {
  AllocateSalesSerialsDto,
  ActivateWarrantyInstallationDto,
  QuerySalesSerialsDto,
} from './sales-serial-link.dto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

@Injectable()
export class SalesSerialLinkService {
  constructor(@Inject('DRIZZLE') private readonly db: NodePgDatabase) {}

  // ═════════════════════════════════════════════
  // 1. تخصيص السيريالات عند الفاتورة أو الشحن
  // ═════════════════════════════════════════════
  async allocateSerials(dto: AllocateSalesSerialsDto, userId: string): Promise<SalesLineSerial[]> {
    if (!dto.devices || dto.devices.length === 0) {
      throw new BadRequestException('At least one serial number must be provided');
    }

    const results: SalesLineSerial[] = [];

    for (const dev of dto.devices) {
      // التحقق من عدم تخصيص نفس السيريال مرتين وهو نشط
      const [existing] = await this.db
        .select()
        .from(salesLineSerial)
        .where(
          and(
            eq(salesLineSerial.serialNumber, dev.serialNumber),
            eq(salesLineSerial.itemId, dto.itemId),
          ),
        );

      if (existing && existing.status !== 'returned') {
        throw new BadRequestException(
          `Medical serial '${dev.serialNumber}' is already registered and active`,
        );
      }

      const warrantyMonths = dev.warrantyMonths || 12;

      const record: NewSalesLineSerial = {
        salesInvoiceId: dto.salesInvoiceId,
        salesInvoiceLineId: dto.salesInvoiceLineId,
        deliveryNoteId: dto.deliveryNoteId || null,
        customerId: dto.customerId,
        itemId: dto.itemId,
        serialNumber: dev.serialNumber,
        batchNumber: dev.batchNumber || null,
        warrantyMonths,
        warrantyStartDate: null,
        warrantyEndDate: null,
        hospitalDepartment: dev.hospitalDepartment || null,
        installationDate: null,
        installedBy: null,
        notes: null,
        status: 'allocated',
        createdBy: userId,
      };

      const [inserted] = await this.db.insert(salesLineSerial).values(record).returning();

      results.push(inserted!);
    }

    return results;
  }

  // ═════════════════════════════════════════════
  // 2. إثبات التركيب في المستشفى وتفعيل الضمان آلياً
  // ═════════════════════════════════════════════
  async activateWarranty(
    dto: ActivateWarrantyInstallationDto,
    _userId: string,
  ): Promise<SalesLineSerial> {
    const [serialRecord] = await this.db
      .select()
      .from(salesLineSerial)
      .where(eq(salesLineSerial.id, dto.serialLinkId));

    if (!serialRecord) {
      throw new NotFoundException(`Serial link ID ${dto.serialLinkId} not found`);
    }

    const startDate = new Date(dto.installationDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + serialRecord.warrantyMonths);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const [updated] = await this.db
      .update(salesLineSerial)
      .set({
        installationDate: dto.installationDate,
        installedBy: dto.installedBy,
        hospitalDepartment: dto.hospitalDepartment || serialRecord.hospitalDepartment,
        warrantyStartDate: startDateStr,
        warrantyEndDate: endDateStr,
        notes: dto.notes || serialRecord.notes,
        status: 'warranty_active',
        updatedAt: new Date(),
      })
      .where(eq(salesLineSerial.id, dto.serialLinkId))
      .returning();

    return updated!;
  }

  // ═════════════════════════════════════════════
  // 3. الاستعلام والفلترة
  // ═════════════════════════════════════════════
  async querySerials(query: QuerySalesSerialsDto): Promise<SalesLineSerial[]> {
    const conditions = [];
    if (query.customerId) conditions.push(eq(salesLineSerial.customerId, query.customerId));
    if (query.salesInvoiceId)
      conditions.push(eq(salesLineSerial.salesInvoiceId, query.salesInvoiceId));
    if (query.itemId) conditions.push(eq(salesLineSerial.itemId, query.itemId));
    if (query.serialNumber) conditions.push(eq(salesLineSerial.serialNumber, query.serialNumber));
    if (query.status)
      conditions.push(
        eq(salesLineSerial.status, query.status as (typeof salesLineSerial.$inferSelect)['status']),
      );

    return this.db
      .select()
      .from(salesLineSerial)
      .where(conditions.length ? and(...conditions) : undefined);
  }

  // ═════════════════════════════════════════════
  // 4. التتبع التاريخي للسيريال الطبي بالكامل
  // ═════════════════════════════════════════════
  async traceMedicalDevice(serialNumber: string): Promise<SalesLineSerial | null> {
    const [result] = await this.db
      .select()
      .from(salesLineSerial)
      .where(eq(salesLineSerial.serialNumber, serialNumber));

    return result || null;
  }
}
