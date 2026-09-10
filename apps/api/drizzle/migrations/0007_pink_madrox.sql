CREATE SCHEMA "planning";
--> statement-breakpoint
CREATE TABLE "planning"."production_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_order_reference" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"execution_mode" text DEFAULT 'internal' NOT NULL,
	"internal_quantity" numeric(24, 6),
	"external_quantity" numeric(24, 6),
	"status" text DEFAULT 'pending' NOT NULL,
	"planned_start_date" timestamp with time zone,
	"planned_end_date" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_plan_job_order_unique" UNIQUE("job_order_reference"),
	CONSTRAINT "production_plan_execution_mode_valid" CHECK ("planning"."production_plan"."execution_mode" in ('internal', 'external', 'mixed')),
	CONSTRAINT "production_plan_status_valid" CHECK ("planning"."production_plan"."status" in ('pending', 'planned', 'locked')),
	CONSTRAINT "production_plan_mixed_quantities" CHECK ("planning"."production_plan"."execution_mode" <> 'mixed' or ("planning"."production_plan"."internal_quantity" > 0 and "planning"."production_plan"."external_quantity" > 0))
);
--> statement-breakpoint
CREATE INDEX "production_plan_priority_idx" ON "planning"."production_plan" USING btree ("priority");
--> statement-breakpoint
-- PLANNING UPDATED_AT TRIGGER
CREATE TRIGGER "planning_production_plan_set_updated_at"
    BEFORE UPDATE ON "planning"."production_plan"
    FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();
