import { sql } from 'drizzle-orm';
import { check, index, numeric, pgSchema, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('employee_code_unique').on(t.code),
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
