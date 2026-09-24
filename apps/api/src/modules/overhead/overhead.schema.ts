import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  numeric,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { orgNode } from '../organization/organization.schema';

export const overheadSchema = pgSchema('overhead');

/**
 * Overhead Pool — collects indirect costs that cannot be traced directly
 * to a single product (factory rent, electricity, admin salaries, marketing, etc.).
 * Each pool groups costs by category and period for later allocation.
 */
export const overheadPool = overheadSchema.table(
  'overhead_pool',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgNodeId: uuid('org_node_id')
      .notNull()
      .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    poolCode: text('pool_code').notNull(),
    poolName: text('pool_name').notNull(),
    category: text('category').notNull(),
    periodYear: integer('period_year').notNull(),
    periodMonth: integer('period_month').notNull(),
    totalAmount: numeric('total_amount', { precision: 16, scale: 4 }).notNull().default('0'),
    currencyCode: text('currency_code').notNull().default('EGP'),
    status: text('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'overhead_pool_category_valid',
      sql`${t.category} in ('manufacturing', 'administrative', 'selling', 'distribution')`,
    ),
    check('overhead_pool_status_valid', sql`${t.status} in ('draft', 'allocated', 'closed')`),
    check('overhead_pool_month_valid', sql`${t.periodMonth} >= 1 AND ${t.periodMonth} <= 12`),
    check('overhead_pool_amount_non_negative', sql`${t.totalAmount} >= 0`),
    index('overhead_pool_org_idx').on(t.orgNodeId),
    index('overhead_pool_period_idx').on(t.periodYear, t.periodMonth),
  ],
);

/**
 * Allocation Policy — defines HOW each overhead pool is distributed
 * to job orders / products. The allocation_base determines the driver.
 */
export const allocationPolicy = overheadSchema.table(
  'allocation_policy',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgNodeId: uuid('org_node_id')
      .notNull()
      .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    poolId: uuid('pool_id')
      .notNull()
      .references(() => overheadPool.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    allocationBase: text('allocation_base').notNull(),
    description: text('description'),
    isActive: text('is_active').notNull().default('yes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'allocation_base_valid',
      sql`${t.allocationBase} in (
    'units_produced',
    'direct_labor_hours',
    'direct_labor_cost',
    'machine_hours',
    'direct_material_cost',
    'sales_revenue'
  )`,
    ),
    check('allocation_policy_active_valid', sql`${t.isActive} in ('yes', 'no')`),
    index('allocation_policy_pool_idx').on(t.poolId),
    index('allocation_policy_org_idx').on(t.orgNodeId),
  ],
);

/**
 * Allocation Result — the computed share of overhead assigned to each
 * job order after running the allocation engine.
 */
export const allocationResult = overheadSchema.table(
  'allocation_result',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    poolId: uuid('pool_id')
      .notNull()
      .references(() => overheadPool.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
    jobOrderReference: text('job_order_reference').notNull(),
    allocatedAmount: numeric('allocated_amount', { precision: 16, scale: 4 }).notNull(),
    allocationRate: numeric('allocation_rate', { precision: 16, scale: 6 }).notNull(),
    baseValue: numeric('base_value', { precision: 24, scale: 6 }).notNull(),
    allocationBase: text('allocation_base').notNull(),
    periodYear: integer('period_year').notNull(),
    periodMonth: integer('period_month').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('allocation_result_amount_non_negative', sql`${t.allocatedAmount} >= 0`),
    index('allocation_result_pool_idx').on(t.poolId),
    index('allocation_result_job_order_idx').on(t.jobOrderReference),
    index('allocation_result_period_idx').on(t.periodYear, t.periodMonth),
  ],
);

export type OverheadPool = typeof overheadPool.$inferSelect;
export type AllocationPolicy = typeof allocationPolicy.$inferSelect;
export type AllocationResult = typeof allocationResult.$inferSelect;
export type OverheadCategory = 'manufacturing' | 'administrative' | 'selling' | 'distribution';
export type AllocationBase =
  | 'units_produced'
  | 'direct_labor_hours'
  | 'direct_labor_cost'
  | 'machine_hours'
  | 'direct_material_cost'
  | 'sales_revenue';
