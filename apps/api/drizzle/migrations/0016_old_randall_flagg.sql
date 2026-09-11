CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE TABLE "auth"."permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"scope_org_node_id" uuid,
	"value_limit" numeric(14, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permission_action_valid" CHECK ("auth"."permission"."action" in ('create', 'read', 'update', 'delete', 'approve')),
	CONSTRAINT "permission_resource_not_blank" CHECK (length(btrim("auth"."permission"."resource")) > 0),
	CONSTRAINT "permission_value_limit_positive" CHECK ("auth"."permission"."value_limit" is null or "auth"."permission"."value_limit" > 0)
);
--> statement-breakpoint
CREATE TABLE "auth"."role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_code_unique" UNIQUE("code"),
	CONSTRAINT "role_code_format" CHECK ("auth"."role"."code" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
	CONSTRAINT "role_name_not_blank" CHECK (length(btrim("auth"."role"."name")) > 0),
	CONSTRAINT "role_status_valid" CHECK ("auth"."role"."status" in ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "auth"."user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role_id" uuid NOT NULL,
	"employee_reference" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_username_unique" UNIQUE("username"),
	CONSTRAINT "user_username_format" CHECK ("auth"."user"."username" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$'),
	CONSTRAINT "user_status_valid" CHECK ("auth"."user"."status" in ('active', 'inactive', 'locked'))
);
--> statement-breakpoint
ALTER TABLE "auth"."permission" ADD CONSTRAINT "permission_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "auth"."role"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "auth"."permission" ADD CONSTRAINT "permission_scope_org_node_id_org_node_id_fk" FOREIGN KEY ("scope_org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "auth"."user" ADD CONSTRAINT "user_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "auth"."role"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "permission_role_idx" ON "auth"."permission" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "permission_resource_idx" ON "auth"."permission" USING btree ("resource");--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "auth"."user" USING btree ("role_id");
--> statement-breakpoint
-- AUTH UPDATED_AT TRIGGER
CREATE TRIGGER "auth_user_set_updated_at"
    BEFORE UPDATE ON "auth"."user"
    FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();
