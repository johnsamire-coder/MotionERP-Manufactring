CREATE TABLE "platform"."org_node_parent_rule" (
	"child_type" text NOT NULL,
	"parent_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_node_parent_rule_pk" PRIMARY KEY("child_type","parent_type")
);
--> statement-breakpoint
ALTER TABLE "platform"."org_node_type" ADD COLUMN "can_be_root" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "platform"."org_node_parent_rule" ADD CONSTRAINT "org_node_parent_rule_child_type_org_node_type_code_fk" FOREIGN KEY ("child_type") REFERENCES "platform"."org_node_type"("code") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "platform"."org_node_parent_rule" ADD CONSTRAINT "org_node_parent_rule_parent_type_org_node_type_code_fk" FOREIGN KEY ("parent_type") REFERENCES "platform"."org_node_type"("code") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

-- Types allowed at the root of the tree.
UPDATE "platform"."org_node_type" SET "can_be_root" = true WHERE "code" IN ('group', 'legal_company');--> statement-breakpoint

-- Base parent/child rules for the seeded types (D10). Editable as data.
INSERT INTO "platform"."org_node_parent_rule" ("child_type", "parent_type") VALUES
	('legal_company', 'group'),
	('activity', 'group'),
	('activity', 'legal_company'),
	('region', 'legal_company'),
	('region', 'activity'),
	('branch', 'legal_company'),
	('branch', 'activity'),
	('branch', 'region'),
	('site', 'legal_company'),
	('site', 'activity'),
	('site', 'region'),
	('site', 'branch'),
	('factory', 'legal_company'),
	('factory', 'activity'),
	('factory', 'branch'),
	('factory', 'site'),
	('department', 'legal_company'),
	('department', 'activity'),
	('department', 'branch'),
	('department', 'site'),
	('department', 'factory'),
	('section', 'department'),
	('section', 'section'),
	('department', 'department'),
	('operating_unit', 'factory'),
	('operating_unit', 'department'),
	('operating_unit', 'section'),
	('warehouse', 'legal_company'),
	('warehouse', 'branch'),
	('warehouse', 'site'),
	('warehouse', 'factory'),
	('warehouse', 'department'),
	('work_center', 'factory'),
	('work_center', 'department'),
	('work_center', 'section'),
	('work_center', 'operating_unit'),
	('project', 'legal_company'),
	('project', 'activity'),
	('project', 'branch')
ON CONFLICT ("child_type", "parent_type") DO NOTHING;