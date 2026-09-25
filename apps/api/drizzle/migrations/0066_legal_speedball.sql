ALTER TABLE "hr"."employee" ADD COLUMN "reports_to" uuid;--> statement-breakpoint
ALTER TABLE "hr"."employee" ADD COLUMN "relieving_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hr"."employee" ADD CONSTRAINT "employee_reports_to_employee_id_fk" FOREIGN KEY ("reports_to") REFERENCES "hr"."employee"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "employee_reports_to_idx" ON "hr"."employee" USING btree ("reports_to");--> statement-breakpoint
ALTER TABLE "hr"."employee" ADD CONSTRAINT "employee_not_own_manager" CHECK ("hr"."employee"."reports_to" is null or "hr"."employee"."reports_to" <> "hr"."employee"."id");