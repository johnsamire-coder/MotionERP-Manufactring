CREATE SCHEMA "settings";
--> statement-breakpoint
CREATE TABLE "settings"."company_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_node_id" uuid NOT NULL,
	"display_name" text,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_profile_org_node_unique" UNIQUE("org_node_id"),
	CONSTRAINT "company_profile_display_name_not_blank" CHECK ("settings"."company_profile"."display_name" is null or length(btrim("settings"."company_profile"."display_name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "settings"."company_profile" ADD CONSTRAINT "company_profile_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE cascade ON UPDATE cascade;