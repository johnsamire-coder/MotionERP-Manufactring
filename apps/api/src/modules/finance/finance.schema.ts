import { sql } from 'drizzle-orm';
import { check, index, numeric, pgSchema, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { orgNode } from '../organization/organization.schema';
import { supplier, customer } from '../crm/crm.schema';
import { item } from '../catalog/catalog.schema';
import { chartOfAccounts } from '../accounting/accounting.schema';

export const financeSchema = pgSchema('finance');

// ==================== 1. التحصيلات والمقبوضات (Customer Collections) ====================

export const collection = financeSchema.table('collection', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobOrderReference: text('job_order_reference').notNull(),
  orgNodeId: uuid('org_node_id').references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  collectionNumber: text('collection_number').notNull().unique(),
  collectionDate: timestamp('collection_date', { withTimezone: true }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 4 }).notNull(),
  currencyCode: text('currency_code').notNull().default('EGP'),
  paymentMethod: text('payment_method').notNull(),
  receivedInAccountId: uuid('received_in_account_id').references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
  referenceNumber: text('reference_number'),
  notes: text('notes'),
  status: text('status').notNull().default('completed'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('collection_payment_method_valid', sql`${t.paymentMethod} in ('cash', 'bank_transfer', 'check', 'credit_card')`),
  check('collection_status_valid', sql`${t.status} in ('pending', 'completed', 'cancelled')`),
  check('collection_amount_positive', sql`${t.amount} > 0`),
  index('idx_collection_job_order').on(t.jobOrderReference),
  index('idx_collection_number').on(t.collectionNumber),
  index('idx_collection_date').on(t.collectionDate),
  index('idx_collection_org_node').on(t.orgNodeId),
]);

export const retention = financeSchema.table('retention', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobOrderReference: text('job_order_reference').notNull(),
  orgNodeId: uuid('org_node_id').references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  retentionNumber: text('retention_number').notNull().unique(),
  originalAmount: numeric('original_amount', { precision: 12, scale: 4 }).notNull(),
  releasedAmount: numeric('released_amount', { precision: 12, scale: 4 }).notNull().default('0'),
  currencyCode: text('currency_code').notNull().default('EGP'),
  startDate: timestamp('start_date', { withTimezone: true }).notNull().defaultNow(),
  releaseDate: timestamp('release_date', { withTimezone: true }),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('retention_status_valid', sql`${t.status} in ('active', 'released', 'expired', 'cancelled')`),
  check('retention_amounts_valid', sql`${t.originalAmount} > 0 AND ${t.releasedAmount} >= 0 AND ${t.releasedAmount} <= ${t.originalAmount}`),
  index('idx_retention_job_order').on(t.jobOrderReference),
  index('idx_retention_number').on(t.retentionNumber),
  index('idx_retention_due_date').on(t.dueDate),
  index('idx_retention_org_node').on(t.orgNodeId),
]);

// ==================== 2. فواتير المشتريات (Purchase Invoices) ====================

export const purchaseInvoice = financeSchema.table('purchase_invoice', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceNumber: text('invoice_number').notNull(),
  systemNumber: text('system_number').notNull().unique(),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  supplierId: uuid('supplier_id')
    .notNull()
    .references(() => supplier.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  invoiceDate: timestamp('invoice_date', { withTimezone: true }).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  currencyCode: text('currency_code').notNull().default('EGP'),
  exchangeRate: numeric('exchange_rate', { precision: 12, scale: 6 }).notNull().default('1.000000'),
  netAmount: numeric('net_amount', { precision: 14, scale: 4 }).notNull().default('0.0000'),
  taxAmount: numeric('tax_amount', { precision: 14, scale: 4 }).notNull().default('0.0000'),
  grandTotal: numeric('grand_total', { precision: 14, scale: 4 }).notNull().default('0.0000'),
  status: text('status').notNull().default('draft'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('purchase_invoice_supplier_inv_unique').on(t.supplierId, t.invoiceNumber),
  check('purchase_invoice_status_valid', sql`${t.status} in ('draft', 'posted', 'cancelled')`),
  index('idx_purchase_invoice_supplier').on(t.supplierId),
  index('idx_purchase_invoice_date').on(t.invoiceDate),
  index('idx_purchase_invoice_due').on(t.dueDate),
  index('idx_purchase_invoice_org').on(t.orgNodeId),
]);

export const purchaseInvoiceLine = financeSchema.table('purchase_invoice_line', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseInvoiceId: uuid('purchase_invoice_id')
    .notNull()
    .references(() => purchaseInvoice.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id')
    .notNull()
    .references(() => item.id, { onDelete: 'restrict' }),
  quantity: numeric('quantity', { precision: 24, scale: 6 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 18, scale: 6 }).notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull().default('14.00'),
  taxAmount: numeric('tax_amount', { precision: 14, scale: 4 }).notNull().default('0.0000'),
  totalAmount: numeric('total_amount', { precision: 14, scale: 4 }).notNull().default('0.0000'),
  purchaseReceiptId: uuid('purchase_receipt_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_purchase_invoice_line_inv').on(t.purchaseInvoiceId),
  index('idx_purchase_invoice_line_item').on(t.itemId),
]);

// ==================== 3. فواتير المبيعات (Sales Invoices) ====================

export const salesInvoice = financeSchema.table('sales_invoice', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customer.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  jobOrderReference: text('job_order_reference'),
  invoiceDate: timestamp('invoice_date', { withTimezone: true }).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  currencyCode: text('currency_code').notNull().default('EGP'),
  exchangeRate: numeric('exchange_rate', { precision: 12, scale: 6 }).notNull().default('1.000000'),
  netAmount: numeric('net_amount', { precision: 14, scale: 4 }).notNull().default('0.0000'),
  taxAmount: numeric('tax_amount', { precision: 14, scale: 4 }).notNull().default('0.0000'),
  grandTotal: numeric('grand_total', { precision: 14, scale: 4 }).notNull().default('0.0000'),
  status: text('status').notNull().default('draft'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('sales_invoice_status_valid', sql`${t.status} in ('draft', 'posted', 'cancelled')`),
  index('idx_sales_invoice_customer').on(t.customerId),
  index('idx_sales_invoice_date').on(t.invoiceDate),
  index('idx_sales_invoice_due').on(t.dueDate),
  index('idx_sales_invoice_org').on(t.orgNodeId),
]);

export const salesInvoiceLine = financeSchema.table('sales_invoice_line', {
  id: uuid('id').primaryKey().defaultRandom(),
  salesInvoiceId: uuid('sales_invoice_id')
    .notNull()
    .references(() => salesInvoice.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id')
    .notNull()
    .references(() => item.id, { onDelete: 'restrict' }),
  quantity: numeric('quantity', { precision: 24, scale: 6 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 18, scale: 6 }).notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull().default('14.00'),
  taxAmount: numeric('tax_amount', { precision: 14, scale: 4 }).notNull().default('0.0000'),
  totalAmount: numeric('total_amount', { precision: 14, scale: 4 }).notNull().default('0.0000'),
  deliveryOrderId: uuid('delivery_order_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_sales_invoice_line_inv').on(t.salesInvoiceId),
  index('idx_sales_invoice_line_item').on(t.itemId),
]);

// ==================== 4. سندات الصرف والمدفوعات (Supplier Payments & Bank Outflow) ====================

export const payment = financeSchema.table('payment', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentNumber: text('payment_number').notNull().unique(), // رقم سند الصرف
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  supplierId: uuid('supplier_id')
    .references(() => supplier.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  purchaseInvoiceId: uuid('purchase_invoice_id')
    .references(() => purchaseInvoice.id, { onDelete: 'set null' }),
  paymentDate: timestamp('payment_date', { withTimezone: true }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 4 }).notNull(),
  currencyCode: text('currency_code').notNull().default('EGP'),
  paymentMethod: text('payment_method').notNull(),
  paidFromAccountId: uuid('paid_from_account_id')
    .references(() => chartOfAccounts.id, { onDelete: 'restrict' }), // حساب البنك أو الخزينة
  referenceNumber: text('reference_number'), // رقم الشيك أو التحويل البنكي
  notes: text('notes'),
  status: text('status').notNull().default('draft'), // draft | posted | cancelled
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('payment_method_valid', sql`${t.paymentMethod} in ('cash', 'bank_transfer', 'check', 'credit_card')`),
  check('payment_status_valid', sql`${t.status} in ('draft', 'posted', 'cancelled')`),
  check('payment_amount_positive', sql`${t.amount} > 0`),
  index('idx_payment_supplier').on(t.supplierId),
  index('idx_payment_date').on(t.paymentDate),
  index('idx_payment_org_node').on(t.orgNodeId),
]);

export type Collection = typeof collection.$inferSelect;
export type Retention = typeof retention.$inferSelect;
export type PurchaseInvoice = typeof purchaseInvoice.$inferSelect;
export type PurchaseInvoiceLine = typeof purchaseInvoiceLine.$inferSelect;
export type SalesInvoice = typeof salesInvoice.$inferSelect;
export type SalesInvoiceLine = typeof salesInvoiceLine.$inferSelect;
export type Payment = typeof payment.$inferSelect;

export type CollectionStatus = 'pending' | 'completed' | 'cancelled';
export type RetentionStatus = 'active' | 'released' | 'expired' | 'cancelled';
export type PurchaseInvoiceStatus = 'draft' | 'posted' | 'cancelled';
export type SalesInvoiceStatus = 'draft' | 'posted' | 'cancelled';
export type PaymentStatus = 'draft' | 'posted' | 'cancelled';