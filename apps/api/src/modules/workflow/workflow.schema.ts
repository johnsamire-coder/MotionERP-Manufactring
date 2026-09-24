import { sql } from 'drizzle-orm';
import { boolean, check, index, jsonb, pgSchema, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const workflowSchema = pgSchema('workflow');

/**
 * Generic workflow engine (plan item 42): states + transitions + roles + dynamic conditions.
 * A foundation for NEW approvals only — the approvals already running are not rebuilt on it
 * without the owner's explicit consent. Documents are referenced by type + UUID (D2).
 */
export const workflowDefinition = workflowSchema.table('workflow_definition', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  documentType: text('document_type').notNull(),
  initialState: text('initial_state').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('workflow_definition_code_unique').on(t.code)]);

export const workflowState = workflowSchema.table('workflow_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id').notNull().references(() => workflowDefinition.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  isFinal: boolean('is_final').notNull().default(false),
}, (t) => [unique('workflow_state_code_unique').on(t.workflowId, t.code)]);

export const workflowTransition = workflowSchema.table('workflow_transition', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id').notNull().references(() => workflowDefinition.id, { onDelete: 'cascade' }),
  fromState: text('from_state').notNull(),
  toState: text('to_state').notNull(),
  action: text('action').notNull(),
  /** Role codes allowed to take this action; empty = anyone signed in. */
  allowedRoles: jsonb('allowed_roles').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  /** Condition on the document data (workflow.condition.ts); NULL = always. */
  condition: jsonb('condition'),
}, (t) => [
  unique('workflow_transition_unique').on(t.workflowId, t.fromState, t.action),
  check('workflow_transition_not_self', sql`${t.fromState} <> ${t.toState}`),
]);

export const workflowInstance = workflowSchema.table('workflow_instance', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id').notNull().references(() => workflowDefinition.id, { onDelete: 'restrict' }),
  documentType: text('document_type').notNull(),
  documentId: uuid('document_id').notNull(),
  currentState: text('current_state').notNull(),
  /** Latest document data the conditions are evaluated against. */
  context: jsonb('context').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('workflow_instance_document_unique').on(t.documentType, t.documentId),
  index('workflow_instance_state_idx').on(t.workflowId, t.currentState),
]);

export const workflowHistory = workflowSchema.table('workflow_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  instanceId: uuid('instance_id').notNull().references(() => workflowInstance.id, { onDelete: 'cascade' }),
  fromState: text('from_state'),
  toState: text('to_state').notNull(),
  action: text('action').notNull(),
  userId: uuid('user_id'),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('workflow_history_instance_idx').on(t.instanceId)]);

/** Plan item 50: automatic tasks run when a transition is taken (e-mail, webhook, print). */
export const workflowTransitionTask = workflowSchema.table('transition_task', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id').notNull().references(() => workflowDefinition.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  taskType: text('task_type').notNull(),
  config: jsonb('config').$type<Record<string, unknown>>().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('transition_task_type_valid', sql`${t.taskType} in ('email', 'webhook', 'print')`),
  index('transition_task_workflow_idx').on(t.workflowId, t.action),
]);

export const workflowTaskRun = workflowSchema.table('task_run', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => workflowTransitionTask.id, { onDelete: 'cascade' }),
  instanceId: uuid('instance_id').notNull().references(() => workflowInstance.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  detail: text('detail'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('task_run_status_valid', sql`${t.status} in ('ok', 'failed')`),
  index('task_run_instance_idx').on(t.instanceId),
]);
