CREATE SCHEMA "platform";
--> statement-breakpoint
CREATE TABLE "platform"."org_node" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_type" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "org_node_no_self_parent" CHECK ("parent_id" is null or "parent_id" <> "id"),
	CONSTRAINT "org_node_status_valid" CHECK ("status" in ('active', 'inactive', 'archived')),
	CONSTRAINT "org_node_name_not_blank" CHECK (length(btrim("name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "platform"."org_node_type" (
	"code" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform"."org_node" ADD CONSTRAINT "org_node_node_type_org_node_type_code_fk" FOREIGN KEY ("node_type") REFERENCES "platform"."org_node_type"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "platform"."org_node" ADD CONSTRAINT "org_node_parent_id_fk" FOREIGN KEY ("parent_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_node_parent_position_idx" ON "platform"."org_node" USING btree ("parent_id","position");--> statement-breakpoint
CREATE INDEX "org_node_node_type_idx" ON "platform"."org_node" USING btree ("node_type");--> statement-breakpoint

-- Seed the generic node-type vocabulary (D10). New types are added later as rows, not DDL.
INSERT INTO "platform"."org_node_type" ("code", "label") VALUES
	('group', 'Group'),
	('legal_company', 'Legal company'),
	('activity', 'Activity'),
	('branch', 'Branch'),
	('region', 'Region'),
	('site', 'Site'),
	('factory', 'Factory'),
	('department', 'Department'),
	('section', 'Section'),
	('operating_unit', 'Operating unit'),
	('warehouse', 'Warehouse'),
	('work_center', 'Work center'),
	('project', 'Project')
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint

-- Keep updated_at accurate for any writer (D22).
CREATE FUNCTION "platform"."set_updated_at"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	NEW."updated_at" = now();
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "org_node_set_updated_at"
	BEFORE UPDATE ON "platform"."org_node"
	FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();--> statement-breakpoint

-- Reject any parent_id that would make a node its own ancestor (D10: no cycles).
-- The self-parent case is also covered by the org_node_no_self_parent CHECK.
CREATE FUNCTION "platform"."org_node_prevent_cycle"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	cycle_found uuid;
BEGIN
	IF NEW."parent_id" IS NULL THEN
		RETURN NEW;
	END IF;

	WITH RECURSIVE ancestors AS (
		SELECT "id", "parent_id"
			FROM "platform"."org_node"
			WHERE "id" = NEW."parent_id"
		UNION ALL
		SELECT n."id", n."parent_id"
			FROM "platform"."org_node" n
			JOIN ancestors a ON n."id" = a."parent_id"
	)
	SELECT "id" INTO cycle_found FROM ancestors WHERE "id" = NEW."id" LIMIT 1;

	IF cycle_found IS NOT NULL THEN
		RAISE EXCEPTION 'org_node % cannot have parent %: that would create a cycle', NEW."id", NEW."parent_id"
			USING ERRCODE = 'check_violation';
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "org_node_prevent_cycle"
	BEFORE INSERT OR UPDATE OF "parent_id" ON "platform"."org_node"
	FOR EACH ROW EXECUTE FUNCTION "platform"."org_node_prevent_cycle"();