import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, numeric, pgSchema, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { orgNode } from '../organization/organization.schema';
import { item } from '../catalog/catalog.schema';

export const qualitySchema = pgSchema('quality');

// ==================== 1. نقاط فحص ومواقيت الـ SLA ====================

export const qualityCheckPoint = qualitySchema.table('check_point', {
  id: uuid('id').primaryKey().defaultRandom(),
  relatedEntityType: text('related_entity_type').notNull(),
  relatedEntityId: uuid('related_entity_id').notNull(),
  orgNodeId: uuid('org_node_id').references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  name: text('name').notNull(),
  targetDurationMinutes: integer('target_duration_minutes').notNull(),
  gracePeriodMinutes: integer('grace_period_minutes').notNull().default(0),
  assignedRoleId: uuid('assigned_role_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('valid_related_entity_type', sql`${t.relatedEntityType} IN ('production_step', 'material_request')`),
  index('idx_check_point_related').on(t.relatedEntityType, t.relatedEntityId),
  index('idx_check_point_org_node').on(t.orgNodeId),
]);

export const qualityWorkflow = qualitySchema.table('workflow', {
  id: uuid('id').primaryKey().defaultRandom(),
  checkPointId: uuid('check_point_id')
    .notNull()
    .references(() => qualityCheckPoint.id, { onDelete: 'cascade' }),
  enteredAt: timestamp('entered_at', { withTimezone: true }).notNull().defaultNow(),
  targetAt: timestamp('target_at', { withTimezone: true }).notNull(),
  graceUntil: timestamp('grace_until', { withTimezone: true }).notNull(),
  currentAssigneeId: uuid('current_assignee_id'),
  escalationLevel: integer('escalation_level').notNull().default(0),
  status: text('status').notNull().default('pending'),
  actionTakenAt: timestamp('action_taken_at', { withTimezone: true }),
  actionTakenById: uuid('action_taken_by_id'),
  resultNote: text('result_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('valid_status', sql`${t.status} IN ('pending', 'approved', 'rejected')`),
  index('idx_workflow_checkpoint').on(t.checkPointId),
]);

export const slaRule = qualitySchema.table('sla_rule', {
  id: uuid('id').primaryKey().defaultRandom(),
  checkPointId: uuid('check_point_id')
    .notNull()
    .references(() => qualityCheckPoint.id, { onDelete: 'cascade' }),
  escalationLevel: integer('escalation_level').notNull(),
  delayMinutesAfterTarget: integer('delay_minutes_after_target').notNull(),
  assignToRoleId: uuid('assign_to_role_id').notNull(),
  notificationTemplate: text('notification_template'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ==================== 2. نظام الفحص الطبي والجودة ====================

export const qualityInspection = qualitySchema.table('inspection', {
  id: uuid('id').primaryKey().defaultRandom(),
  inspectionNumber: text('inspection_number').notNull().unique(),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  itemId: uuid('item_id')
    .notNull()
    .references(() => item.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  referenceType: text('reference_type').notNull(),
  referenceId: uuid('reference_id').notNull(),
  
  status: text('status').notNull().default('pending'),
  inspectedBy: uuid('inspected_by'),
  inspectedAt: timestamp('inspected_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('valid_inspection_status', sql`${t.status} IN ('pending', 'passed', 'failed')`),
  check('valid_reference_type', sql`${t.referenceType} IN ('purchase_receipt', 'production_step', 'delivery_order')`),
  index('idx_inspection_item').on(t.itemId),
  index('idx_inspection_reference').on(t.referenceType, t.referenceId),
]);

export const qualityInspectionParameter = qualitySchema.table('inspection_parameter', {
  id: uuid('id').primaryKey().defaultRandom(),
  inspectionId: uuid('inspection_id')
    .notNull()
    .references(() => qualityInspection.id, { onDelete: 'cascade' }),
  parameterName: text('parameter_name').notNull(),
  targetValue: text('target_value').notNull(),
  actualValue: text('actual_value'),
  status: text('status').notNull().default('pending'),
  // Acceptance criteria (plan item 9), copied from the template when the inspection is created.
  isNumeric: boolean('is_numeric').notNull().default(false),
  minValue: numeric('min_value', { precision: 24, scale: 6 }),
  maxValue: numeric('max_value', { precision: 24, scale: 6 }),
  acceptedValue: text('accepted_value'),
  readingsRequired: integer('readings_required').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('valid_parameter_status', sql`${t.status} IN ('pending', 'pass', 'fail')`),
  check('inspection_parameter_readings_required_positive', sql`${t.readingsRequired} >= 1`),
  index('idx_parameter_inspection').on(t.inspectionId),
]);

// ==================== قوالب الفحص والقراءات الفعلية (بند 9) ====================

/** Standard inspection criteria for an item (or generic when item_id is null). */
export const inspectionTemplate = qualitySchema.table('inspection_template', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  itemId: uuid('item_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('inspection_template_code_unique').on(t.code),
  index('idx_inspection_template_item').on(t.itemId),
]);

/**
 * One criterion: numeric → every reading must fall within [min, max] (either bound optional);
 * non-numeric → every reading must equal accepted_value (case-insensitive).
 */
export const inspectionTemplateParameter = qualitySchema.table('inspection_template_parameter', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').notNull().references(() => inspectionTemplate.id, { onDelete: 'cascade' }),
  parameterName: text('parameter_name').notNull(),
  isNumeric: boolean('is_numeric').notNull().default(true),
  minValue: numeric('min_value', { precision: 24, scale: 6 }),
  maxValue: numeric('max_value', { precision: 24, scale: 6 }),
  acceptedValue: text('accepted_value'),
  readingsRequired: integer('readings_required').notNull().default(1),
  position: integer('position').notNull().default(0),
}, (t) => [
  unique('inspection_template_parameter_name_unique').on(t.templateId, t.parameterName),
  check('template_parameter_readings_required_range', sql`${t.readingsRequired} between 1 and 10`),
  check('template_parameter_criteria', sql`(${t.isNumeric} and (${t.minValue} is not null or ${t.maxValue} is not null)) or (not ${t.isNumeric} and ${t.acceptedValue} is not null)`),
  check('template_parameter_min_le_max', sql`${t.minValue} is null or ${t.maxValue} is null or ${t.minValue} <= ${t.maxValue}`),
]);

/** Every individual reading taken for an inspection parameter. */
export const inspectionReading = qualitySchema.table('inspection_reading', {
  id: uuid('id').primaryKey().defaultRandom(),
  parameterId: uuid('parameter_id').notNull().references(() => qualityInspectionParameter.id, { onDelete: 'cascade' }),
  readingNo: integer('reading_no').notNull(),
  value: text('value').notNull(),
  withinSpec: boolean('within_spec').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('inspection_reading_unique').on(t.parameterId, t.readingNo),
  index('idx_inspection_reading_parameter').on(t.parameterId),
]);

export type QualityCheckPoint = typeof qualityCheckPoint.$inferSelect;
export type QualityWorkflow = typeof qualityWorkflow.$inferSelect;
export type SlaRule = typeof slaRule.$inferSelect;
export type QualityInspection = typeof qualityInspection.$inferSelect;
export type QualityInspectionParameter = typeof qualityInspectionParameter.$inferSelect;