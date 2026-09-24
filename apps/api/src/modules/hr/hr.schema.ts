import { sql } from 'drizzle-orm';
import { type AnyPgColumn, boolean, check, date, index, integer, numeric, pgSchema, text, timestamp, uniqueIndex, uuid, unique } from 'drizzle-orm/pg-core';
import { orgNode } from '../organization/organization.schema';

export const hrSchema = pgSchema('hr');

export const employee = hrSchema.table('employee', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  baseSalary: numeric('base_salary', { precision: 12, scale: 4 }).notNull().default('0'),
  status: text('status').notNull().default('active'),
  /** Direct manager (plan item 10). Same-module self reference. */
  reportsTo: uuid('reports_to').references((): AnyPgColumn => employee.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  /** Last working day, set when the employee leaves (plan items 10/11). */
  relievingDate: timestamp('relieving_date', { withTimezone: true }),
  /** Probation (plan item 29): joining day, last probation day, and the day the employee was confirmed. */
  dateOfJoining: date('date_of_joining', { mode: 'string' }),
  probationEndDate: date('probation_end_date', { mode: 'string' }),
  confirmationDate: date('confirmation_date', { mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('employee_code_unique').on(t.code),
  check('employee_not_own_manager', sql`${t.reportsTo} is null or ${t.reportsTo} <> ${t.id}`),
  index('employee_reports_to_idx').on(t.reportsTo),
  check('employee_probation_after_joining', sql`${t.probationEndDate} is null or (${t.dateOfJoining} is not null and ${t.probationEndDate} >= ${t.dateOfJoining})`),
  check('employee_confirmation_after_joining', sql`${t.confirmationDate} is null or (${t.dateOfJoining} is not null and ${t.confirmationDate} >= ${t.dateOfJoining})`),
  check('employee_code_format', sql`${t.code} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`),
  check('employee_name_not_blank', sql`length(btrim(${t.name})) > 0`),
  check('employee_base_salary_non_negative', sql`${t.baseSalary} >= 0`),
  check('employee_status_valid', sql`${t.status} in ('active', 'inactive', 'terminated')`),
  index('employee_org_node_idx').on(t.orgNodeId),
]);

/**
 * A commission policy: rate applied either to the sale value itself, or to
 * what has actually been collected (owner's explicit requirement: "قد تكون
 * مرتبطة بالتحصيل الفعلي"). This is company/employee-configurable — never
 * hard-coded (D37).
 */
export const commissionRule = hrSchema.table('commission_rule', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employee.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  basis: text('basis').notNull(), // 'sale_value' | 'collected_amount'
  ratePercentage: numeric('rate_percentage', { precision: 6, scale: 3 }).notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('commission_rule_basis_valid', sql`${t.basis} in ('sale_value', 'collected_amount')`),
  check('commission_rule_rate_positive', sql`${t.ratePercentage} > 0`),
  check('commission_rule_status_valid', sql`${t.status} in ('active', 'inactive')`),
  index('commission_rule_employee_idx').on(t.employeeId),
]);

/**
 * Commission actually earned on a specific event (a collection or a sale,
 * per the rule's basis). `sourceReference` is a plain text reference to the
 * originating document (collection number, job order), not a FK (D2/D20).
 */
export const commissionEntry = hrSchema.table('commission_entry', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employee.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  jobOrderReference: text('job_order_reference').notNull(),
  sourceReference: text('source_reference').notNull(),
  baseAmount: numeric('base_amount', { precision: 12, scale: 4 }).notNull(),
  commissionAmount: numeric('commission_amount', { precision: 12, scale: 4 }).notNull(),
  earnedDate: timestamp('earned_date', { withTimezone: true }).notNull().defaultNow(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('commission_entry_base_positive', sql`${t.baseAmount} > 0`),
  check('commission_entry_amount_positive', sql`${t.commissionAmount} > 0`),
  check('commission_entry_status_valid', sql`${t.status} in ('pending', 'paid')`),
  index('commission_entry_employee_idx').on(t.employeeId),
  index('commission_entry_job_order_idx').on(t.jobOrderReference),
]);

/** Commission for an external party (not an employee) who brought a business opportunity. */
export const externalCommission = hrSchema.table('external_commission', {
  id: uuid('id').primaryKey().defaultRandom(),
  beneficiaryName: text('beneficiary_name').notNull(),
  jobOrderReference: text('job_order_reference').notNull(),
  amount: numeric('amount', { precision: 12, scale: 4 }).notNull(),
  basisDescription: text('basis_description').notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('external_commission_amount_positive', sql`${t.amount} > 0`),
  check('external_commission_status_valid', sql`${t.status} in ('pending', 'paid', 'cancelled')`),
  index('external_commission_job_order_idx').on(t.jobOrderReference),
]);

/** One payroll line per employee per period, aggregating base salary + commissions earned in that period. */
export const payrollEntry = hrSchema.table('payroll_entry', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employee.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  periodYear: text('period_year').notNull(),
  periodMonth: text('period_month').notNull(),
  baseSalary: numeric('base_salary', { precision: 12, scale: 4 }).notNull(),
  totalCommissions: numeric('total_commissions', { precision: 12, scale: 4 }).notNull().default('0'),
  totalAmount: numeric('total_amount', { precision: 12, scale: 4 }).notNull(),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('payroll_entry_employee_period_unique').on(t.employeeId, t.periodYear, t.periodMonth),
  check('payroll_entry_status_valid', sql`${t.status} in ('draft', 'approved', 'paid')`),
  index('payroll_entry_employee_idx').on(t.employeeId),
]);

export type Employee = typeof employee.$inferSelect;
export type CommissionRule = typeof commissionRule.$inferSelect;
export type CommissionEntry = typeof commissionEntry.$inferSelect;
export type ExternalCommission = typeof externalCommission.$inferSelect;
export type PayrollEntry = typeof payrollEntry.$inferSelect;

// ==================== الإجازات (بند 20) ====================

export const leaveType = hrSchema.table('leave_type', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  /** Upper bound for one allocation, in days (null = no bound). */
  maxDaysPerAllocation: numeric('max_days_per_allocation', { precision: 6, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('leave_type_code_unique').on(t.code),
  check('leave_type_name_not_blank', sql`length(btrim(${t.name})) > 0`),
]);

/** Days of one leave type granted to one employee for a period (overlaps are refused in the service). */
export const leaveAllocation = hrSchema.table('leave_allocation', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employee.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  leaveTypeId: uuid('leave_type_id').notNull().references(() => leaveType.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  fromDate: timestamp('from_date', { withTimezone: true }).notNull(),
  toDate: timestamp('to_date', { withTimezone: true }).notNull(),
  days: numeric('days', { precision: 6, scale: 2 }).notNull(),
  /** Bulk run that created it, if any. */
  batchReference: text('batch_reference'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('leave_allocation_days_positive', sql`${t.days} > 0`),
  check('leave_allocation_period_valid', sql`${t.toDate} >= ${t.fromDate}`),
  index('leave_allocation_employee_idx').on(t.employeeId, t.leaveTypeId),
]);

// ==================== التسوية النهائية عند ترك الخدمة (بند 21) ====================

/** Full and final settlement of a leaving employee: what the company owes them and what they owe back. */
export const finalSettlement = hrSchema.table('final_settlement', {
  id: uuid('id').primaryKey().defaultRandom(),
  settlementNumber: text('settlement_number').notNull(),
  employeeId: uuid('employee_id').notNull().references(() => employee.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  relievingDate: timestamp('relieving_date', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('draft'),
  totalPayable: numeric('total_payable', { precision: 14, scale: 4 }).notNull().default('0'),
  totalReceivable: numeric('total_receivable', { precision: 14, scale: 4 }).notNull().default('0'),
  netAmount: numeric('net_amount', { precision: 14, scale: 4 }).notNull().default('0'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('final_settlement_number_unique').on(t.settlementNumber),
  check('final_settlement_status_valid', sql`${t.status} in ('draft', 'submitted', 'cancelled')`),
  uniqueIndex('final_settlement_one_open_per_employee').on(t.employeeId).where(sql`${t.status} <> 'cancelled'`),
]);

export const finalSettlementLine = hrSchema.table('final_settlement_line', {
  id: uuid('id').primaryKey().defaultRandom(),
  settlementId: uuid('settlement_id').notNull().references(() => finalSettlement.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  /** payable = the company owes the employee; receivable = the employee owes the company. */
  direction: text('direction').notNull(),
  component: text('component').notNull(),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 14, scale: 4 }).notNull(),
  /** Suggested automatically (true) or added by hand (false). */
  isAuto: boolean('is_auto').notNull().default(false),
}, (t) => [
  check('final_settlement_line_direction_valid', sql`${t.direction} in ('payable', 'receivable')`),
  check('final_settlement_line_amount_positive', sql`${t.amount} > 0`),
  index('final_settlement_line_settlement_idx').on(t.settlementId),
]);

/** Formal probation log (plan item 29): every start, extension and confirmation with its reason. */
export const probationEvent = hrSchema.table('probation_event', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employee.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  eventType: text('event_type').notNull(),
  eventDate: date('event_date', { mode: 'string' }).notNull(),
  probationEndDate: date('probation_end_date', { mode: 'string' }),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('probation_event_type_valid', sql`${t.eventType} in ('started', 'extended', 'confirmed')`),
  index('probation_event_employee_idx').on(t.employeeId),
]);
