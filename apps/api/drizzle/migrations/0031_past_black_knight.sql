CREATE TABLE "production_ops"."downtime_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_center_id" uuid NOT NULL,
	"operator_employee_id" uuid,
	"stop_reason" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"stop_time" timestamp with time zone,
	"stoppage_minutes" numeric(12, 2),
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "downtime_entry_times_valid" CHECK ("production_ops"."downtime_entry"."stop_time" is null or "production_ops"."downtime_entry"."stop_time" >= "production_ops"."downtime_entry"."start_time")
);
--> statement-breakpoint
ALTER TABLE "production_ops"."downtime_entry" ADD CONSTRAINT "downtime_entry_work_center_id_work_center_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "production_ops"."work_center"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "production_ops"."downtime_entry" ADD CONSTRAINT "downtime_entry_operator_employee_id_employee_id_fk" FOREIGN KEY ("operator_employee_id") REFERENCES "hr"."employee"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "downtime_entry_work_center_idx" ON "production_ops"."downtime_entry" USING btree ("work_center_id");