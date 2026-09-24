import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, jsonb, pgSchema, text, timestamp, unique, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';

export const supportSchema = pgSchema('support');

/** Helpdesk (plan item 43). Customers are referenced by UUID and validated in the service (D2). */
export const holidayList = supportSchema.table('holiday_list', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
}, (t) => [unique('holiday_list_name_unique').on(t.name)]);

export const holiday = supportSchema.table('holiday', {
  id: uuid('id').primaryKey().defaultRandom(),
  holidayListId: uuid('holiday_list_id').notNull().references(() => holidayList.id, { onDelete: 'cascade' }),
  holidayDate: date('holiday_date', { mode: 'string' }).notNull(),
  description: text('description'),
}, (t) => [unique('holiday_list_date_unique').on(t.holidayListId, t.holidayDate)]);

export const serviceLevelAgreement = supportSchema.table('service_level_agreement', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  timeZone: text('time_zone').notNull().default('Africa/Cairo'),
  /** [{ weekday: 0-6 (0 = Sunday), start: "09:00", end: "17:00" }] */
  workingHours: jsonb('working_hours').$type<Array<{ weekday: number; start: string; end: string }>>().notNull(),
  holidayListId: uuid('holiday_list_id').references(() => holidayList.id, { onDelete: 'set null' }),
  /** { low|medium|high|urgent: { responseMinutes, resolutionMinutes } } — working minutes. */
  priorities: jsonb('priorities').$type<Record<string, { responseMinutes: number; resolutionMinutes: number }>>().notNull(),
  /** A ticket waiting on the customer ("replied") closes after this many days of silence. */
  autoCloseAfterDays: integer('auto_close_after_days').notNull().default(7),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('sla_code_unique').on(t.code),
  check('sla_auto_close_positive', sql`${t.autoCloseAfterDays} > 0`),
]);

export const ticket = supportSchema.table('ticket', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketNumber: text('ticket_number').notNull(),
  subject: text('subject').notNull(),
  description: text('description'),
  customerId: uuid('customer_id'),
  priority: text('priority').notNull().default('medium'),
  status: text('status').notNull().default('open'),
  slaId: uuid('sla_id').references(() => serviceLevelAgreement.id, { onDelete: 'set null' }),
  parentTicketId: uuid('parent_ticket_id').references((): AnyPgColumn => ticket.id, { onDelete: 'set null' }),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  responseBy: timestamp('response_by', { withTimezone: true }),
  resolutionBy: timestamp('resolution_by', { withTimezone: true }),
  firstRespondedAt: timestamp('first_responded_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  onHoldSince: timestamp('on_hold_since', { withTimezone: true }),
  totalHoldMinutes: integer('total_hold_minutes').notNull().default(0),
  lastAgentReplyAt: timestamp('last_agent_reply_at', { withTimezone: true }),
  responseStatus: text('response_status').notNull().default('pending'),
  resolutionStatus: text('resolution_status').notNull().default('pending'),
  closeReason: text('close_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('ticket_number_unique').on(t.ticketNumber),
  check('ticket_priority_valid', sql`${t.priority} in ('low', 'medium', 'high', 'urgent')`),
  check('ticket_status_valid', sql`${t.status} in ('open', 'replied', 'on_hold', 'resolved', 'closed')`),
  check('ticket_response_status_valid', sql`${t.responseStatus} in ('pending', 'fulfilled', 'failed')`),
  check('ticket_resolution_status_valid', sql`${t.resolutionStatus} in ('pending', 'fulfilled', 'failed')`),
  index('ticket_status_idx').on(t.status),
  index('ticket_customer_idx').on(t.customerId),
]);

export const ticketComment = supportSchema.table('ticket_comment', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => ticket.id, { onDelete: 'cascade' }),
  author: text('author').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('ticket_comment_author_valid', sql`${t.author} in ('agent', 'customer')`),
  index('ticket_comment_ticket_idx').on(t.ticketId),
]);
