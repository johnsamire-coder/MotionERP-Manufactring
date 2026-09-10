CREATE SCHEMA "quality";
--> statement-breakpoint
CREATE TABLE "quality"."check_point" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"related_entity_type" text NOT NULL,
	"related_entity_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_duration_minutes" integer NOT NULL,
	"grace_period_minutes" integer DEFAULT 0 NOT NULL,
	"assigned_role_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valid_related_entity_type" CHECK ("quality"."check_point"."related_entity_type" IN ('production_step', 'material_request'))
);
--> statement-breakpoint
CREATE TABLE "quality"."workflow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"check_point_id" uuid NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"target_at" timestamp with time zone NOT NULL,
	"grace_until" timestamp with time zone NOT NULL,
	"current_assignee_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"action_taken_at" timestamp with time zone,
	"action_taken_by_id" uuid,
	"result_note" text,
	"escalation_level" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valid_status" CHECK ("quality"."workflow"."status" IN ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "quality"."sla_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"check_point_id" uuid NOT NULL,
	"escalation_level" integer NOT NULL,
	"delay_minutes_after_target" integer NOT NULL,
	"assign_to_role_id" uuid NOT NULL,
	"notification_template" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quality"."workflow" ADD CONSTRAINT "workflow_check_point_id_check_point_id_fk" FOREIGN KEY ("check_point_id") REFERENCES "quality"."check_point"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality"."sla_rule" ADD CONSTRAINT "sla_rule_check_point_id_check_point_id_fk" FOREIGN KEY ("check_point_id") REFERENCES "quality"."check_point"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_check_point_related" ON "quality"."check_point" USING btree ("related_entity_type","related_entity_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_checkpoint" ON "quality"."workflow" USING btree ("check_point_id");
--> statement-breakpoint
-- QUALITY UPDATED_AT TRIGGERS
CREATE TRIGGER "quality_check_point_set_updated_at"
    BEFORE UPDATE ON "quality"."check_point"
    FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "quality_workflow_set_updated_at"
    BEFORE UPDATE ON "quality"."workflow"
    FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "quality_sla_rule_set_updated_at"
    BEFORE UPDATE ON "quality"."sla_rule"
    FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();
