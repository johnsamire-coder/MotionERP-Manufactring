import { sql } from 'drizzle-orm';
import { check, index, jsonb, numeric, pgSchema, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const projectsSchema = pgSchema('projects');

/**
 * Project management (plan item 44). Customer / company / accounting-dimension value are plain UUIDs
 * validated in the service (D2). Profitability reads the journal lines tagged with the project's
 * accounting-dimension value (plan item 41).
 */
export const project = projectsSchema.table('project', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  orgNodeId: uuid('org_node_id').notNull(),
  customerId: uuid('customer_id'),
  status: text('status').notNull().default('open'),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  percentCompleteMethod: text('percent_complete_method').notNull().default('task_completion'),
  manualPercentComplete: numeric('manual_percent_complete', { precision: 5, scale: 2 }),
  estimatedCost: numeric('estimated_cost', { precision: 18, scale: 4 }),
  contractValue: numeric('contract_value', { precision: 18, scale: 4 }),
  dimensionValueId: uuid('dimension_value_id'),
  reportFrequency: text('report_frequency').notNull().default('none'),
  reportRecipients: jsonb('report_recipients').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  lastReportAt: timestamp('last_report_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('project_code_unique').on(t.code),
  check('project_status_valid', sql`${t.status} in ('open', 'completed', 'cancelled')`),
  check('project_method_valid', sql`${t.percentCompleteMethod} in ('manual', 'task_completion', 'task_progress', 'task_weight')`),
  check('project_frequency_valid', sql`${t.reportFrequency} in ('none', 'daily', 'weekly', 'monthly')`),
  check('project_manual_range', sql`${t.manualPercentComplete} is null or (${t.manualPercentComplete} >= 0 and ${t.manualPercentComplete} <= 100)`),
]);

export const projectTask = projectsSchema.table('task', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  status: text('status').notNull().default('open'),
  progress: numeric('progress', { precision: 5, scale: 2 }).notNull().default('0'),
  weight: numeric('weight', { precision: 10, scale: 2 }).notNull().default('1'),
  expectedEnd: timestamp('expected_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('task_status_valid', sql`${t.status} in ('open', 'working', 'completed', 'cancelled')`),
  check('task_progress_range', sql`${t.progress} >= 0 and ${t.progress} <= 100`),
  check('task_weight_non_negative', sql`${t.weight} >= 0`),
  index('task_project_idx').on(t.projectId),
]);

/** Outgoing e-mail queue (status reports now; any module later). Sent by the configured transport. */
export const emailOutbox = projectsSchema.table('email_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipients: jsonb('recipients').$type<string[]>().notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull().default('queued'),
  error: text('error'),
  sourceType: text('source_type'),
  sourceId: uuid('source_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
}, (t) => [
  check('email_outbox_status_valid', sql`${t.status} in ('queued', 'sent', 'failed', 'no_transport')`),
  index('email_outbox_status_idx').on(t.status),
]);
