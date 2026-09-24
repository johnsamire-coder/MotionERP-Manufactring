import { sql } from 'drizzle-orm';
import { check, index, numeric, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { orgNode } from '../organization/organization.schema';

export const costSchema = pgSchema('cost');

// ═══════════════════════════════════════════════════════════
// EXISTING TABLES (unchanged)
// ═══════════════════════════════════════════════════════════

export const costComponentType = costSchema.table(
  'component_type',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('component_type_code_format', sql`${t.code} ~ '^[a-z_][a-z0-9_]*$'`)],
);

export const jobCostSheet = costSchema.table(
  'job_cost_sheet',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobOrderReference: text('job_order_reference').notNull().unique(),
    orgNodeId: uuid('org_node_id').references(() => orgNode.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    currencyCode: text('currency_code').notNull().default('EGP'),
    status: text('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('job_cost_sheet_status_valid', sql`${t.status} in ('draft', 'active', 'closed')`),
    index('idx_job_cost_sheet_reference').on(t.jobOrderReference),
    index('idx_job_cost_sheet_org_node').on(t.orgNodeId),
  ],
);

export const costEntry = costSchema.table(
  'entry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    costSheetId: uuid('cost_sheet_id')
      .notNull()
      .references(() => jobCostSheet.id, { onDelete: 'cascade' }),
    componentTypeId: uuid('component_type_id')
      .notNull()
      .references(() => costComponentType.id, { onDelete: 'restrict' }),
    entryType: text('entry_type').notNull(),
    amount: numeric('amount', { precision: 12, scale: 4 }).notNull(),
    currencyCode: text('currency_code').notNull(),
    description: text('description'),
    sourceReference: text('source_reference'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('cost_entry_type_valid', sql`${t.entryType} in ('estimated', 'actual')`),
    check('cost_entry_amount_positive', sql`${t.amount} > 0`),
    index('idx_cost_entry_sheet').on(t.costSheetId),
    index('idx_cost_entry_type').on(t.componentTypeId),
    index('idx_cost_entry_recorded_at').on(t.recordedAt),
  ],
);

// ═══════════════════════════════════════════════════════════
// OVERHEAD ALLOCATION ENGINE (new)
// ═══════════════════════════════════════════════════════════

/**
 * Overhead Pool: a bucket that collects indirect costs for a specific period.
 * Example: "January 2026 Factory Rent" = 50,000 EGP, type = manufacturing_overhead.
 */
export const overheadPool = costSchema.table(
  'overhead_pool',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    poolType: text('pool_type').notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    totalAmount: numeric('total_amount', { precision: 14, scale: 4 }).notNull().default('0'),
    currencyCode: text('currency_code').notNull().default('EGP'),
    status: text('status').notNull().default('draft'),
    orgNodeId: uuid('org_node_id').references(() => orgNode.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'overhead_pool_type_valid',
      sql`${t.poolType} in ('manufacturing_overhead', 'administrative', 'selling_marketing')`,
    ),
    check(
      'overhead_pool_status_valid',
      sql`${t.status} in ('draft', 'active', 'allocated', 'closed')`,
    ),
    check('overhead_pool_amount_positive', sql`${t.totalAmount} >= 0`),
    index('idx_overhead_pool_org_node').on(t.orgNodeId),
    index('idx_overhead_pool_period').on(t.periodStart, t.periodEnd),
  ],
);

/**
 * Overhead Pool Entry: individual expense lines that make up the pool total.
 * Example: "Electricity bill Jan" = 15,000 EGP, linked to account 6200.
 * accountId uses D2/D20 pattern — no FK to accounting.chart_of_accounts.
 */
export const overheadPoolEntry = costSchema.table(
  'overhead_pool_entry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    poolId: uuid('pool_id')
      .notNull()
      .references(() => overheadPool.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id'),
    description: text('description').notNull(),
    amount: numeric('amount', { precision: 14, scale: 4 }).notNull(),
    sourceReference: text('source_reference'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('overhead_pool_entry_amount_positive', sql`${t.amount} > 0`),
    index('idx_overhead_pool_entry_pool').on(t.poolId),
  ],
);

/**
 * Allocation Policy: defines HOW a pool's costs are distributed to work orders.
 * A single pool can have multiple policies (composite allocation).
 * Example: Pool "Factory Overhead Jan" → Policy 1: 70% by machine_hours, Policy 2: 30% by units_produced.
 */
export const allocationPolicy = costSchema.table(
  'allocation_policy',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    poolId: uuid('pool_id')
      .notNull()
      .references(() => overheadPool.id, { onDelete: 'cascade' }),
    allocationBase: text('allocation_base').notNull(),
    percentage: numeric('percentage', { precision: 5, scale: 2 }).notNull().default('100'),
    isActive: text('is_active').notNull().default('yes'),
    orgNodeId: uuid('org_node_id').references(() => orgNode.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'allocation_policy_base_valid',
      sql`${t.allocationBase} in ('units_produced', 'direct_labor_hours', 'direct_labor_cost', 'machine_hours', 'direct_material_cost', 'sales_revenue')`,
    ),
    check(
      'allocation_policy_percentage_valid',
      sql`${t.percentage} > 0 AND ${t.percentage} <= 100`,
    ),
    check('allocation_policy_is_active_valid', sql`${t.isActive} in ('yes', 'no')`),
    index('idx_allocation_policy_pool').on(t.poolId),
    index('idx_allocation_policy_org_node').on(t.orgNodeId),
  ],
);

/**
 * Allocation Result: the output of running an allocation policy.
 * One row per work order that received a share of the overhead.
 * workOrderId uses D2/D20 — no FK to production_ops.work_order.
 */
export const allocationResult = costSchema.table(
  'allocation_result',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    policyId: uuid('policy_id')
      .notNull()
      .references(() => allocationPolicy.id, { onDelete: 'cascade' }),
    workOrderId: uuid('work_order_id'),
    jobOrderReference: text('job_order_reference'),
    allocatedAmount: numeric('allocated_amount', { precision: 14, scale: 4 }).notNull(),
    baseQuantity: numeric('base_quantity', { precision: 14, scale: 4 }).notNull(),
    baseRate: numeric('base_rate', { precision: 14, scale: 6 }).notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    allocatedAt: timestamp('allocated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('allocation_result_amount_positive', sql`${t.allocatedAmount} >= 0`),
    index('idx_allocation_result_policy').on(t.policyId),
    index('idx_allocation_result_work_order').on(t.workOrderId),
    index('idx_allocation_result_job_order').on(t.jobOrderReference),
  ],
);

// ═══════════════════════════════════════════════════════════
// DRIZZLE INFERRED TYPES
// ═══════════════════════════════════════════════════════════

export type CostComponentType = typeof costComponentType.$inferSelect;
export type JobCostSheet = typeof jobCostSheet.$inferSelect;
export type CostEntry = typeof costEntry.$inferSelect;
export type CostEntryType = 'estimated' | 'actual';

export type OverheadPool = typeof overheadPool.$inferSelect;
export type OverheadPoolEntry = typeof overheadPoolEntry.$inferSelect;
export type AllocationPolicy = typeof allocationPolicy.$inferSelect;
export type AllocationResult = typeof allocationResult.$inferSelect;

export type PoolType = 'manufacturing_overhead' | 'administrative' | 'selling_marketing';
export type PoolStatus = 'draft' | 'active' | 'allocated' | 'closed';
export type AllocationBase =
  | 'units_produced'
  | 'direct_labor_hours'
  | 'direct_labor_cost'
  | 'machine_hours'
  | 'direct_material_cost'
  | 'sales_revenue';
