-- Owner decision: every material issue is actual material cost on its job order's cost sheet.
-- Backfill for requests issued before the automatic recording; keyed by source_reference so it
-- never duplicates an entry the service records.
INSERT INTO "cost"."job_cost_sheet" ("job_order_reference", "org_node_id")
SELECT DISTINCT mr."job_order_reference", jo."org_node_id"
FROM "production"."material_request" mr
JOIN "sales"."job_order" jo ON jo."job_order_number" = mr."job_order_reference"
WHERE mr."issued_value" > 0
ON CONFLICT ("job_order_reference") DO NOTHING;
--> statement-breakpoint
INSERT INTO "cost"."entry" ("cost_sheet_id", "component_type_id", "entry_type", "amount", "currency_code", "description", "source_reference")
SELECT s."id", ct."id", 'actual', mr."issued_value", s."currency_code",
       'صرف خامات — طلب ' || left(mr."id"::text, 8), 'material-request:' || mr."id"::text
FROM "production"."material_request" mr
JOIN "cost"."job_cost_sheet" s ON s."job_order_reference" = mr."job_order_reference"
JOIN "cost"."component_type" ct ON ct."code" = 'material'
WHERE mr."issued_value" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "cost"."entry" e
    WHERE e."cost_sheet_id" = s."id" AND e."source_reference" = 'material-request:' || mr."id"::text
  );
