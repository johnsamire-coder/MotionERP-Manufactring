-- Every company gets a default cost center (decision recorded in the status report).
-- Companies = legal_company org nodes plus any org node that already has an accounting config.
-- Each gets a "MAIN" cost center when it has none, set as its default unless one is already chosen.
-- New companies get theirs from AccountControlsService.ensureDefaultCostCenter. Idempotent.
WITH companies AS (
  SELECT id AS org_node_id FROM "platform"."org_node" WHERE node_type = 'legal_company'
  UNION
  SELECT org_node_id FROM "accounting"."company_accounting_config"
)
INSERT INTO "accounting"."cost_center" ("org_node_id", "code", "name")
SELECT c.org_node_id, 'MAIN', 'المركز الرئيسي'
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM "accounting"."company_accounting_config" cfg
  WHERE cfg.org_node_id = c.org_node_id AND cfg.default_cost_center_id IS NOT NULL
)
ON CONFLICT ("org_node_id", "code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "accounting"."company_accounting_config" ("org_node_id", "default_cost_center_id")
SELECT cc.org_node_id, cc.id
FROM "accounting"."cost_center" cc
JOIN "platform"."org_node" o ON o.id = cc.org_node_id
WHERE cc.code = 'MAIN'
  AND (
    o.node_type = 'legal_company'
    OR EXISTS (SELECT 1 FROM "accounting"."company_accounting_config" x WHERE x.org_node_id = cc.org_node_id)
  )
ON CONFLICT ("org_node_id") DO UPDATE
  SET "default_cost_center_id" = EXCLUDED."default_cost_center_id", "updated_at" = now()
  WHERE "accounting"."company_accounting_config"."default_cost_center_id" IS NULL;
