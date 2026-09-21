// ============================================================
// Motion ERP — Purchase Batch Link Service
// Step 68 | Medical Traceability
// ============================================================
import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { eq, and, like } from 'drizzle-orm';
import { purchaseLineBatch, PurchaseLineBatch, NewPurchaseLineBatch } from './purchase-batch-link.schema';
import {
  RegisterPurchaseBatchesDto,
  UpdateBatchStatusDto,
  QueryPurchaseBatchesDto,
  TraceabilitySearchDto,
} from './purchase-batch-link.dto';

@Injectable()
export class PurchaseBatchLinkService {
  constructor(@Inject('DRIZZLE') private readonly db: any) {}

  // ═════════════════════════════════════════════
  // 1. تسجيل اللوطات عند استلام فاتورة مشتريات
  // ═════════════════════════════════════════════
  async registerBatches(dto: RegisterPurchaseBatchesDto, userId: string): Promise<PurchaseLineBatch[]> {
    if (!dto.batches || dto.batches.length === 0) {
      throw new BadRequestException('At least one batch must be registered for medical items');
    }

    // التحقق من أن مجموع كميات اللوطات منطقي
    const totalBatchQty = dto.batches.reduce((sum, b) => sum + b.receivedQty, 0);
    if (totalBatchQty <= 0) {
      throw new BadRequestException('Total batch quantity must be greater than zero');
    }

    const results: PurchaseLineBatch[] = [];

    for (const batch of dto.batches) {
      // التحقق من عدم تكرار رقم اللوط لنفس الصنف
      const [existing] = await this.db
        .select()
        .from(purchaseLineBatch)
        .where(
          and(
            eq(purchaseLineBatch.itemId, dto.itemId),
            eq(purchaseLineBatch.batchNumber, batch.batchNumber),
          ),
        );

      if (existing) {
        throw new BadRequestException(
          `Batch number '${batch.batchNumber}' already registered for this item`,
        );
      }

      const record: NewPurchaseLineBatch = {
        purchaseInvoiceId: dto.purchaseInvoiceId,
        purchaseInvoiceLineId: dto.purchaseInvoiceLineId,
        itemId: dto.itemId,
        batchId: null,
        batchNumber: batch.batchNumber,
        manufacturingDate: batch.manufacturingDate || null,
        expiryDate: batch.expiryDate || null,
        receivedQty: batch.receivedQty.toFixed(4),
        acceptedQty: '0.0000',
        rejectedQty: '0.0000',
        supplierBatchRef: batch.supplierBatchRef || null,
        certificateNumber: batch.certificateNumber || null,
        quarantineStatus: 'pending_inspection',
        inspectionId: null,
        createdBy: userId,
      };

      const [inserted] = await this.db
        .insert(purchaseLineBatch)
        .values(record)
        .returning();

      results.push(inserted);
    }

    return results;
  }

  // ═════════════════════════════════════════════
  // 2. تحديث حالة الحجر الصحي للوط
  // ═════════════════════════════════════════════
  async updateBatchStatus(dto: UpdateBatchStatusDto, userId: string): Promise<PurchaseLineBatch> {
    const [batch] = await this.db
      .select()
      .from(purchaseLineBatch)
      .where(eq(purchaseLineBatch.id, dto.batchLinkId));

    if (!batch) {
      throw new NotFoundException(`Batch link ${dto.batchLinkId} not found`);
    }

    if (batch.quarantineStatus === 'rejected') {
      throw new BadRequestException('Cannot update a permanently rejected batch');
    }

    const updateData: any = {
      quarantineStatus: dto.action,
      updatedAt: new Date(),
    };

    if (dto.acceptedQty !== undefined) updateData.acceptedQty = dto.acceptedQty.toFixed(4);
    if (dto.rejectedQty !== undefined) updateData.rejectedQty = dto.rejectedQty.toFixed(4);
    if (dto.inspectionId) updateData.inspectionId = dto.inspectionId;

    const [updated] = await this.db
      .update(purchaseLineBatch)
      .set(updateData)
      .where(eq(purchaseLineBatch.id, dto.batchLinkId))
      .returning();

    return updated;
  }

  // ═════════════════════════════════════════════
  // 3. الاستعلام عن اللوطات
  // ═════════════════════════════════════════════
  async queryBatches(query: QueryPurchaseBatchesDto): Promise<PurchaseLineBatch[]> {
    const conditions = [];
    if (query.purchaseInvoiceId) conditions.push(eq(purchaseLineBatch.purchaseInvoiceId, query.purchaseInvoiceId));
    if (query.itemId) conditions.push(eq(purchaseLineBatch.itemId, query.itemId));
    if (query.batchNumber) conditions.push(eq(purchaseLineBatch.batchNumber, query.batchNumber));
    if (query.quarantineStatus) conditions.push(eq(purchaseLineBatch.quarantineStatus, query.quarantineStatus as any));

    return this.db
      .select()
      .from(purchaseLineBatch)
      .where(conditions.length ? and(...conditions) : undefined);
  }

  // ═════════════════════════════════════════════
  // 4. التتبع الطبي (Traceability Search)
  // ═════════════════════════════════════════════
  async traceabilitySearch(query: TraceabilitySearchDto): Promise<PurchaseLineBatch[]> {
    const conditions = [];
    if (query.batchNumber) conditions.push(eq(purchaseLineBatch.batchNumber, query.batchNumber));
    if (query.itemId) conditions.push(eq(purchaseLineBatch.itemId, query.itemId));

    return this.db
      .select()
      .from(purchaseLineBatch)
      .where(conditions.length ? and(...conditions) : undefined);
  }
}