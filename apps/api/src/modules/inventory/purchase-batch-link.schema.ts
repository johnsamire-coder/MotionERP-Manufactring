// ============================================================
// Motion ERP — Purchase Invoice ↔ Batch Link Schema
// Step 68 | Medical Traceability Module
// ============================================================
import { uuid, text, numeric, date, timestamp } from 'drizzle-orm/pg-core';
import { inventorySchema } from './inventory.schema';

// ── Enum: حالة الحجر الصحي للوط الوارد ──────
export const batchQuarantineStatusEnum = inventorySchema.enum('batch_quarantine_status', [
  'pending_inspection', // في انتظار الفحص
  'quarantined', // حجر صحي (فشل مبدئي)
  'accepted', // مقبول (نجح الفحص)
  'rejected', // مرفوض (فشل نهائي)
]);

// ── جدول ربط سطر فاتورة المشتريات باللوط ────
// كل سطر فاتورة ممكن يكون مرتبط بأكتر من لوط
// مثال: فاتورة فيها 100 وحدة صاج → 60 وحدة لوط A + 40 وحدة لوط B
export const purchaseLineBatch = inventorySchema.table('purchase_line_batch', {
  id: uuid('id').defaultRandom().primaryKey(),

  // ربط بسطر فاتورة المشتريات
  purchaseInvoiceId: uuid('purchase_invoice_id').notNull(),
  purchaseInvoiceLineId: uuid('purchase_invoice_line_id').notNull(),
  itemId: uuid('item_id').notNull(),

  // بيانات اللوط
  batchId: uuid('batch_id'), // رابط بجدول item_batch لو موجود
  batchNumber: text('batch_number').notNull(), // رقم التشغيلة من المورد
  manufacturingDate: date('manufacturing_date'), // تاريخ الإنتاج
  expiryDate: date('expiry_date'), // تاريخ الصلاحية

  // الكميات
  receivedQty: numeric('received_qty', { precision: 18, scale: 4 }).notNull(),
  acceptedQty: numeric('accepted_qty', { precision: 18, scale: 4 }).default('0').notNull(),
  rejectedQty: numeric('rejected_qty', { precision: 18, scale: 4 }).default('0').notNull(),

  // بيانات المورد
  supplierBatchRef: text('supplier_batch_ref'), // مرجع اللوط عند المورد
  certificateNumber: text('certificate_number'), // رقم شهادة المطابقة الطبية

  // الحالة
  quarantineStatus: batchQuarantineStatusEnum('quarantine_status')
    .default('pending_inspection')
    .notNull(),
  inspectionId: uuid('inspection_id'), // رابط بفحص الجودة

  // Audit
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── Type Exports ─────────────────────────────
export type PurchaseLineBatch = typeof purchaseLineBatch.$inferSelect;
export type NewPurchaseLineBatch = typeof purchaseLineBatch.$inferInsert;
