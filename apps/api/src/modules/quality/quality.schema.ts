import { sql } from 'drizzle-orm';
import { check, index, integer, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { productionStep } from '../production_ops/production_ops.schema';
import { materialRequest } from '../production/production.schema';

export const qualitySchema = pgSchema('quality');

// نقطة فحص متعلقة بعملية (مثل خطوة تصنيع أو صرف خامة)
export const qualityCheckPoint = qualitySchema.table('check_point', {
  id: uuid('id').primaryKey().defaultRandom(),
  relatedEntityType: text('related_entity_type').notNull(), // 'production_step' | 'material_request'
  relatedEntityId: uuid('related_entity_id').notNull(), // مثلاً: production_step.id
  name: text('name').notNull(),
  targetDurationMinutes: integer('target_duration_minutes').notNull(),
  gracePeriodMinutes: integer('grace_period_minutes').notNull().default(0),
  assignedRoleId: uuid('assigned_role_id'), // مسؤول أولي
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('valid_related_entity_type', sql`${t.relatedEntityType} IN ('production_step', 'material_request')`),
  index('idx_check_point_related').on(t.relatedEntityType, t.relatedEntityId),
]);

// حالة نقطة الفحص الحالية
export const qualityWorkflow = qualitySchema.table('workflow', {
  id: uuid('id').primaryKey().defaultRandom(),
  checkPointId: uuid('check_point_id')
    .notNull()
    .references(() => qualityCheckPoint.id, { onDelete: 'cascade' }),
  enteredAt: timestamp('entered_at', { withTimezone: true }).notNull().defaultNow(),
  targetAt: timestamp('target_at', { withTimezone: true }).notNull(),
  graceUntil: timestamp('grace_until', { withTimezone: true }).notNull(),
  currentAssigneeId: uuid('current_assignee_id'), // الشخص المسؤول حاليًا
  status: text('status').notNull().default('pending'), // pending, approved, rejected
  actionTakenAt: timestamp('action_taken_at', { withTimezone: true }),
  actionTakenById: uuid('action_taken_by_id'),
  resultNote: text('result_note'),
  escalationLevel: integer('escalation_level').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('valid_status', sql`${t.status} IN ('pending', 'approved', 'rejected')`),
  index('idx_workflow_checkpoint').on(t.checkPointId),
]);

// قاعدة تصعيد تلقائي
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

export type QualityCheckPoint = typeof qualityCheckPoint.$inferSelect;
export type QualityWorkflow = typeof qualityWorkflow.$inferSelect;
export type SlaRule = typeof slaRule.$inferSelect;
