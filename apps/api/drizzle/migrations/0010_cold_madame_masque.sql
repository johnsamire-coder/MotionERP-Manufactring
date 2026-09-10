CREATE SCHEMA "production_ops";
--> statement-breakpoint
CREATE TABLE "production_ops"."production_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_order_reference" text NOT NULL,
	"work_center_id" uuid NOT NULL,
	"operation_name" text NOT NULL,
	"standard_time_minutes" numeric(12, 4) NOT NULL,
	"actual_time_minutes" numeric(12, 4),
	"sequence" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_step_standard_time_positive" CHECK ("production_ops"."production_step"."standard_time_minutes" > 0),
	CONSTRAINT "production_step_status_valid" CHECK ("production_ops"."production_step"."status" in ('pending', 'in_progress', 'done'))
);
--> statement-breakpoint
CREATE TABLE "production_ops"."work_center" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"rate_per_minute" numeric(12, 4) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_center_code_unique" UNIQUE("code"),
	CONSTRAINT "work_center_code_format" CHECK ("production_ops"."work_center"."code" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
	CONSTRAINT "work_center_rate_non_negative" CHECK ("production_ops"."work_center"."rate_per_minute" >= 0),
	CONSTRAINT "work_center_status_valid" CHECK ("production_ops"."work_center"."status" in ('active', 'inactive', 'archived'))
);
--> statement-breakpoint
ALTER TABLE "production_ops"."production_step" ADD CONSTRAINT "production_step_work_center_id_work_center_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "production_ops"."work_center"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "production_ops"."work_center" ADD CONSTRAINT "work_center_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "production_step_job_order_idx" ON "production_ops"."production_step" USING btree ("job_order_reference");--> statement-breakpoint
CREATE INDEX "production_step_work_center_idx" ON "production_ops"."production_step" USING btree ("work_center_id");--> statement-breakpoint
CREATE INDEX "work_center_org_node_idx" ON "production_ops"."work_center" USING btree ("org_node_id");
--> statement-breakpoint
-- PRODUCTION_OPS UPDATED_AT TRIGGERS
CREATE TRIGGER "production_ops_work_center_set_updated_at"
    BEFORE UPDATE ON "production_ops"."work_center"
    FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "production_ops_production_step_set_updated_at"
    BEFORE UPDATE ON "production_ops"."production_step"
    FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();
