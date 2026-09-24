CREATE TABLE "hr"."probation_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_date" date NOT NULL,
	"probation_end_date" date,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "probation_event_type_valid" CHECK ("hr"."probation_event"."event_type" in ('started', 'extended', 'confirmed'))
);
--> statement-breakpoint
ALTER TABLE "hr"."employee" ADD COLUMN "date_of_joining" date;--> statement-breakpoint
ALTER TABLE "hr"."employee" ADD COLUMN "probation_end_date" date;--> statement-breakpoint
ALTER TABLE "hr"."employee" ADD COLUMN "confirmation_date" date;--> statement-breakpoint
ALTER TABLE "hr"."probation_event" ADD CONSTRAINT "probation_event_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hr"."employee"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "probation_event_employee_idx" ON "hr"."probation_event" USING btree ("employee_id");--> statement-breakpoint
ALTER TABLE "hr"."employee" ADD CONSTRAINT "employee_probation_after_joining" CHECK ("hr"."employee"."probation_end_date" is null or ("hr"."employee"."date_of_joining" is not null and "hr"."employee"."probation_end_date" >= "hr"."employee"."date_of_joining"));--> statement-breakpoint
ALTER TABLE "hr"."employee" ADD CONSTRAINT "employee_confirmation_after_joining" CHECK ("hr"."employee"."confirmation_date" is null or ("hr"."employee"."date_of_joining" is not null and "hr"."employee"."confirmation_date" >= "hr"."employee"."date_of_joining"));