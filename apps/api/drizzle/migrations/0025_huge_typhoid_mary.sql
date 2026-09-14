CREATE TABLE "production_ops"."operation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"default_work_center_id" uuid,
	"standard_time_minutes" numeric(12, 4),
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operation_code_unique" UNIQUE("code"),
	CONSTRAINT "operation_code_format" CHECK ("production_ops"."operation"."code" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
	CONSTRAINT "operation_status_valid" CHECK ("production_ops"."operation"."status" in ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "production_ops"."production_step_time_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"production_step_id" uuid NOT NULL,
	"from_time" timestamp with time zone NOT NULL,
	"to_time" timestamp with time zone,
	"time_in_minutes" numeric(12, 4),
	"completed_quantity" numeric(24, 6),
	"process_loss_quantity" numeric(24, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_ops"."workstation_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workstation_type_code_unique" UNIQUE("code"),
	CONSTRAINT "workstation_type_code_format" CHECK ("production_ops"."workstation_type"."code" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
	CONSTRAINT "workstation_type_status_valid" CHECK ("production_ops"."workstation_type"."status" in ('active', 'inactive'))
);
--> statement-breakpoint
ALTER TABLE "production_ops"."production_step" ADD COLUMN "work_order_id" uuid;--> statement-breakpoint
ALTER TABLE "production_ops"."production_step" ADD COLUMN "for_quantity" numeric(24, 6);--> statement-breakpoint
ALTER TABLE "production_ops"."production_step" ADD COLUMN "completed_quantity" numeric(24, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "production_ops"."production_step" ADD COLUMN "process_loss_quantity" numeric(24, 6);--> statement-breakpoint
ALTER TABLE "production_ops"."production_step" ADD COLUMN "allow_overproduction" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "production_ops"."production_step" ADD COLUMN "overproduction_percentage" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "production_ops"."production_step" ADD COLUMN "operator_employee_id" uuid;--> statement-breakpoint
ALTER TABLE "production_ops"."operation" ADD CONSTRAINT "operation_default_work_center_id_work_center_id_fk" FOREIGN KEY ("default_work_center_id") REFERENCES "production_ops"."work_center"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "production_ops"."production_step_time_log" ADD CONSTRAINT "production_step_time_log_production_step_id_production_step_id_fk" FOREIGN KEY ("production_step_id") REFERENCES "production_ops"."production_step"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "production_step_time_log_step_idx" ON "production_ops"."production_step_time_log" USING btree ("production_step_id");--> statement-breakpoint
ALTER TABLE "production_ops"."production_step" ADD CONSTRAINT "production_step_work_order_id_work_order_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "production_ops"."work_order"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "production_ops"."production_step" ADD CONSTRAINT "production_step_operator_employee_id_employee_id_fk" FOREIGN KEY ("operator_employee_id") REFERENCES "hr"."employee"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "production_step_work_order_idx" ON "production_ops"."production_step" USING btree ("work_order_id");--> statement-breakpoint
ALTER TABLE "production_ops"."production_step" ADD CONSTRAINT "production_step_completed_qty_non_negative" CHECK ("production_ops"."production_step"."completed_quantity" >= 0);