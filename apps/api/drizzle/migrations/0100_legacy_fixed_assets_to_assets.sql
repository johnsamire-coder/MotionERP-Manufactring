-- Moves the legacy accounting.fixed_asset register into the assets module (the old endpoints are retired).
-- Idempotent: every insert skips rows that already exist. The legacy tables are kept for audit.
--   * one category per company and account triple, with a stable id derived from them;
--   * the asset keeps its legacy id; a code already used in the assets module gets a "-LEGACY" suffix;
--   * every legacy depreciation entry becomes a posted schedule row (same amount and journal entry);
--   * what is left is spread straight-line over the remaining months, one row per month-end.
INSERT INTO "assets"."asset_category" (
  "id", "org_node_id", "code", "name",
  "fixed_asset_account_id", "accumulated_depreciation_account_id", "depreciation_expense_account_id",
  "default_method", "default_periods", "default_frequency_months"
)
SELECT DISTINCT
  md5(fa.org_node_id::text || fa.asset_account_id::text || fa.accumulated_depreciation_account_id::text || fa.depreciation_expense_account_id::text)::uuid,
  fa.org_node_id,
  'LEGACY-' || upper(left(md5(fa.org_node_id::text || fa.asset_account_id::text || fa.accumulated_depreciation_account_id::text || fa.depreciation_expense_account_id::text), 6)),
  'أصول منقولة من السجل القديم',
  fa.asset_account_id,
  fa.accumulated_depreciation_account_id,
  fa.depreciation_expense_account_id,
  'straight_line', 60, 1
FROM "accounting"."fixed_asset" fa
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "assets"."asset" (
  "id", "asset_code", "name", "org_node_id", "category_id", "status", "is_cwip",
  "gross_value", "salvage_value", "opening_accumulated", "accumulated_depreciation",
  "method", "periods", "frequency_months", "available_for_use_date", "cost_center_id",
  "created_at", "updated_at"
)
SELECT
  fa.id,
  CASE WHEN EXISTS (
    SELECT 1 FROM "assets"."asset" x
    WHERE x.org_node_id = fa.org_node_id AND x.asset_code = fa.asset_code AND x.id <> fa.id
  ) THEN fa.asset_code || '-LEGACY' ELSE fa.asset_code END,
  fa.asset_name,
  fa.org_node_id,
  md5(fa.org_node_id::text || fa.asset_account_id::text || fa.accumulated_depreciation_account_id::text || fa.depreciation_expense_account_id::text)::uuid,
  CASE
    WHEN fa.status = 'disposed' THEN 'scrapped'
    WHEN fa.status = 'fully_depreciated' OR fa.total_depreciated >= fa.purchase_cost - fa.salvage_value THEN 'fully_depreciated'
    ELSE 'in_use'
  END,
  'no',
  round(fa.purchase_cost, 2),
  round(fa.salvage_value, 2),
  0,
  round(fa.total_depreciated, 2),
  'straight_line',
  fa.useful_life_months,
  1,
  (fa.purchase_date AT TIME ZONE 'UTC')::date,
  fa.cost_center_id,
  fa.created_at,
  now()
FROM "accounting"."fixed_asset" fa
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "assets"."depreciation_schedule" (
  "asset_id", "row_number", "schedule_date", "amount", "accumulated", "journal_entry_id", "posted_at"
)
SELECT
  de.asset_id,
  row_number() OVER (PARTITION BY de.asset_id ORDER BY de.entry_date, de.created_at, de.id),
  (de.entry_date AT TIME ZONE 'UTC')::date,
  round(de.depreciation_amount, 2),
  round(de.accumulated_amount_after, 2),
  de.journal_entry_id,
  de.created_at
FROM "accounting"."depreciation_entry" de
JOIN "assets"."asset" a ON a.id = de.asset_id
ON CONFLICT DO NOTHING;
--> statement-breakpoint
WITH legacy AS (
  SELECT
    fa.id,
    fa.purchase_date,
    fa.useful_life_months,
    round(fa.total_depreciated, 2) AS done_amount,
    round(fa.purchase_cost - fa.salvage_value - fa.total_depreciated, 2) AS left_amount,
    count(de.id)::int AS posted,
    max(de.entry_date) AS last_posted
  FROM "accounting"."fixed_asset" fa
  JOIN "assets"."asset" a ON a.id = fa.id AND a.status = 'in_use'
  LEFT JOIN "accounting"."depreciation_entry" de ON de.asset_id = fa.id
  WHERE NOT EXISTS (
    SELECT 1 FROM "assets"."depreciation_schedule" s WHERE s.asset_id = fa.id AND s.posted_at IS NULL
  )
  GROUP BY fa.id
),
plan AS (
  SELECT
    l.*,
    greatest(l.useful_life_months - l.posted, 1) AS n,
    round(l.left_amount / greatest(l.useful_life_months - l.posted, 1), 2) AS each_amount
  FROM legacy l
  WHERE l.left_amount > 0
)
INSERT INTO "assets"."depreciation_schedule" ("asset_id", "row_number", "schedule_date", "amount", "accumulated")
SELECT
  p.id,
  p.posted + k,
  (
    date_trunc('month', coalesce(p.last_posted, p.purchase_date) AT TIME ZONE 'UTC')
    + make_interval(months => k + CASE WHEN p.posted > 0 THEN 1 ELSE 0 END)
    - interval '1 day'
  )::date,
  CASE WHEN k = p.n THEN p.left_amount - p.each_amount * (p.n - 1) ELSE p.each_amount END,
  CASE WHEN k = p.n THEN p.done_amount + p.left_amount ELSE p.done_amount + p.each_amount * k END
FROM plan p
CROSS JOIN LATERAL generate_series(1, p.n) AS k
ON CONFLICT DO NOTHING;
