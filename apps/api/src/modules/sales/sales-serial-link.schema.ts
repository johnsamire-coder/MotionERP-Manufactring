// ============================================================
// Motion ERP — Sales Invoice & Delivery ↔ Serial Link Schema
// Step 69 | Medical Device Traceability & Warranty
// ============================================================
import { uuid, text, integer, date, timestamp } from 'drizzle-orm/pg-core';
import { salesSchema } from './sales.schema';

// ── Enum: حالة السيريال نمبر للجهاز الطبي ─────
export const serialDeviceStatusEnum = salesSchema.enum('serial_device_status', [
  'allocated', // مخصص لأمر بيع / فاتورة
  'delivered', // تم التسليم للعميل
  'installed', // تم التركيب في المستشفى
  'warranty_active', // الضمان ساري
  'warranty_expired', // انتهاء فترة الضمان
  'returned', // مرتجع من العميل
]);

// ── جدول ربط الفاتورة وأذن التسليم بالسيريال ─
export const salesLineSerial = salesSchema.table('sales_line_serial', {
  id: uuid('id').defaultRandom().primaryKey(),

  // المراجع
  salesInvoiceId: uuid('sales_invoice_id').notNull(),
  salesInvoiceLineId: uuid('sales_invoice_line_id').notNull(),
  deliveryNoteId: uuid('delivery_note_id'),
  customerId: uuid('customer_id').notNull(),
  itemId: uuid('item_id').notNull(),

  // بيانات التتبع
  serialNumber: text('serial_number').notNull(),
  batchNumber: text('batch_number'), // لوط الصاج/المكونات الأصلي

  // الضمان الطبي
  warrantyMonths: integer('warranty_months').default(12).notNull(),
  warrantyStartDate: date('warranty_start_date'),
  warrantyEndDate: date('warranty_end_date'),

  // التركيب والمستشفى
  hospitalDepartment: text('hospital_department'), // مثلا: رعاية مركزة - سرير 4
  installationDate: date('installation_date'),
  installedBy: text('installed_by'), // اسم المهندس/الفني
  notes: text('notes'),

  // الحالة
  status: serialDeviceStatusEnum('status').default('allocated').notNull(),

  // Audit
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── Type Exports ─────────────────────────────
export type SalesLineSerial = typeof salesLineSerial.$inferSelect;
export type NewSalesLineSerial = typeof salesLineSerial.$inferInsert;
