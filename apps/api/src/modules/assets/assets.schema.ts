import { sql } from 'drizzle-orm';
import { check, date, index, integer, jsonb, numeric, pgSchema, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const assetsSchema = pgSchema('assets');

/**
 * Fixed assets (plan item 46): categories with their accounts, CWIP capitalisation, four
 * depreciation methods and a stored schedule that is rebuilt when the value changes. Accounts,
 * company and cost center are UUIDs validated through the accounting service (D2). Entries are
 * posted through AccountingService — the accounting module's code is not changed. The older basic
 * accounting.fixed_asset (straight line only) is left as it is.
 */
export const assetCategory = assetsSchema.table('asset_category', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgNodeId: uuid('org_node_id').notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  fixedAssetAccountId: uuid('fixed_asset_account_id').notNull(),
  accumulatedDepreciationAccountId: uuid('accumulated_depreciation_account_id').notNull(),
  depreciationExpenseAccountId: uuid('depreciation_expense_account_id').notNull(),
  cwipAccountId: uuid('cwip_account_id'),
  defaultMethod: text('default_method').notNull().default('straight_line'),
  defaultPeriods: integer('default_periods').notNull().default(60),
  defaultFrequencyMonths: integer('default_frequency_months').notNull().default(1),
}, (t) => [unique('asset_category_org_code_unique').on(t.orgNodeId, t.code)]);

export const asset = assetsSchema.table('asset', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetCode: text('asset_code').notNull(),
  name: text('name').notNull(),
  orgNodeId: uuid('org_node_id').notNull(),
  categoryId: uuid('category_id').notNull().references(() => assetCategory.id, { onDelete: 'restrict' }),
  status: text('status').notNull().default('draft'),
  isCwip: text('is_cwip').notNull().default('no'),
  cwipAmount: numeric('cwip_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  grossValue: numeric('gross_value', { precision: 18, scale: 2 }).notNull().default('0'),
  salvageValue: numeric('salvage_value', { precision: 18, scale: 2 }).notNull().default('0'),
  openingAccumulated: numeric('opening_accumulated', { precision: 18, scale: 2 }).notNull().default('0'),
  accumulatedDepreciation: numeric('accumulated_depreciation', { precision: 18, scale: 2 }).notNull().default('0'),
  method: text('method').notNull().default('straight_line'),
  periods: integer('periods').notNull().default(60),
  frequencyMonths: integer('frequency_months').notNull().default(1),
  annualRatePercent: numeric('annual_rate_percent', { precision: 6, scale: 2 }),
  manualAmounts: jsonb('manual_amounts').$type<number[]>(),
  availableForUseDate: date('available_for_use_date', { mode: 'string' }),
  costCenterId: uuid('cost_center_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('asset_org_code_unique').on(t.orgNodeId, t.assetCode),
  check('asset_status_valid', sql`${t.status} in ('draft', 'cwip', 'in_use', 'fully_depreciated', 'scrapped')`),
  check('asset_is_cwip_valid', sql`${t.isCwip} in ('yes', 'no')`),
  check('asset_method_valid', sql`${t.method} in ('straight_line', 'double_declining_balance', 'written_down_value', 'manual')`),
  check('asset_frequency_valid', sql`${t.frequencyMonths} in (1, 3, 6, 12)`),
  check('asset_periods_positive', sql`${t.periods} > 0`),
]);

export const depreciationSchedule = assetsSchema.table('depreciation_schedule', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').notNull().references(() => asset.id, { onDelete: 'cascade' }),
  rowNumber: integer('row_number').notNull(),
  scheduleDate: date('schedule_date', { mode: 'string' }).notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  accumulated: numeric('accumulated', { precision: 18, scale: 2 }).notNull(),
  journalEntryId: uuid('journal_entry_id'),
  /** Set when the row is booked (a zero row is booked without an entry). */
  postedAt: timestamp('posted_at', { withTimezone: true }),
}, (t) => [
  unique('depreciation_schedule_row_unique').on(t.assetId, t.rowNumber),
  index('depreciation_schedule_date_idx').on(t.scheduleDate),
]);

/** Every value event of an asset: CWIP costs, capitalisation, value adjustments. */
export const assetValueEvent = assetsSchema.table('asset_value_event', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').notNull().references(() => asset.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  eventDate: date('event_date', { mode: 'string' }).notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  journalEntryId: uuid('journal_entry_id'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check('asset_value_event_type_valid', sql`${t.eventType} in ('cwip_cost', 'capitalisation', 'value_adjustment')`)]);
