ALTER TABLE "production"."material_request" ADD COLUMN "issue_movement_id" uuid;--> statement-breakpoint
ALTER TABLE "production"."material_request" ADD COLUMN "issued_value" numeric(24, 4);--> statement-breakpoint
-- Backfill: requests issued before this change are matched to their issue movement by its note.
UPDATE "production"."material_request" mr
SET "issue_movement_id" = sm."id", "issued_value" = sm."total_value"
FROM "inventory"."stock_movement" sm
WHERE mr."issue_movement_id" IS NULL
  AND mr."issued_quantity" IS NOT NULL
  AND sm."movement_type" = 'issue'
  AND sm."note" = 'Material request ' || mr."id"::text || ' (job order ' || mr."job_order_reference" || ')';
