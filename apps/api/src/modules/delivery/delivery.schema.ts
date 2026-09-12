import { sql } from 'drizzle-orm';
import { check, index, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { orgNode } from '../organization/organization.schema';

export const deliverySchema = pgSchema('delivery');

export const deliveryOrder = deliverySchema.table('delivery_order', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobOrderReference: text('job_order_reference').notNull(),
  orgNodeId: uuid('org_node_id').references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  deliveryNumber: text('delivery_number').notNull().unique(),
  scheduledDate: timestamp('scheduled_date', { withTimezone: true }).notNull(),
  actualDate: timestamp('actual_date', { withTimezone: true }),
  status: text('status').notNull().default('scheduled'),
  vehiclePlate: text('vehicle_plate'),
  driverName: text('driver_name'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('delivery_order_status_valid', sql`${t.status} in ('scheduled', 'in_transit', 'delivered', 'cancelled')`),
  index('idx_delivery_order_job_order').on(t.jobOrderReference),
  index('idx_delivery_order_number').on(t.deliveryNumber),
  index('idx_delivery_order_org_node').on(t.orgNodeId),
]);

export const installation = deliverySchema.table('installation', {
  id: uuid('id').primaryKey().defaultRandom(),
  deliveryOrderId: uuid('delivery_order_id')
    .notNull()
    .references(() => deliveryOrder.id, { onDelete: 'cascade' }),
  scheduledDate: timestamp('scheduled_date', { withTimezone: true }).notNull(),
  actualStartDate: timestamp('actual_start_date', { withTimezone: true }),
  actualEndDate: timestamp('actual_end_date', { withTimezone: true }),
  status: text('status').notNull().default('scheduled'),
  technicianNames: text('technician_names'),
  location: text('location'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('installation_status_valid', sql`${t.status} in ('scheduled', 'in_progress', 'completed', 'cancelled')`),
  index('idx_installation_delivery_order').on(t.deliveryOrderId),
]);

export const deliveryReceipt = deliverySchema.table('delivery_receipt', {
  id: uuid('id').primaryKey().defaultRandom(),
  deliveryOrderId: uuid('delivery_order_id')
    .notNull()
    .references(() => deliveryOrder.id, { onDelete: 'cascade' }),
  receiptNumber: text('receipt_number').notNull().unique(),
  signedBy: text('signed_by').notNull(),
  signatureImage: text('signature_image'),
  receivedItems: text('received_items'),
  notes: text('notes'),
  signedAt: timestamp('signed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_delivery_receipt_delivery_order').on(t.deliveryOrderId),
  index('idx_delivery_receipt_number').on(t.receiptNumber),
]);

export const installationReport = deliverySchema.table('installation_report', {
  id: uuid('id').primaryKey().defaultRandom(),
  installationId: uuid('installation_id')
    .notNull()
    .references(() => installation.id, { onDelete: 'cascade' }),
  reportNumber: text('report_number').notNull().unique(),
  performedBy: text('performed_by').notNull(),
  verifiedBy: text('verified_by'),
  completionNotes: text('completion_notes'),
  issuesFound: text('issues_found'),
  correctiveActions: text('corrective_actions'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_installation_report_installation').on(t.installationId),
  index('idx_installation_report_number').on(t.reportNumber),
]);

export type DeliveryOrder = typeof deliveryOrder.$inferSelect;
export type Installation = typeof installation.$inferSelect;
export type DeliveryReceipt = typeof deliveryReceipt.$inferSelect;
export type InstallationReport = typeof installationReport.$inferSelect;
export type DeliveryStatus = 'scheduled' | 'in_transit' | 'delivered' | 'cancelled';
export type InstallationStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
