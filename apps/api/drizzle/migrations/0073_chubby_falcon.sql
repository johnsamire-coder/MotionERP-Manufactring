CREATE TABLE "hr"."leave_allocation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"from_date" timestamp with time zone NOT NULL,
	"to_date" timestamp with time zone NOT NULL,
	"days" numeric(6, 2) NOT NULL,
	"batch_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_allocation_days_positive" CHECK ("hr"."leave_allocation"."days" > 0),
	CONSTRAINT "leave_allocation_period_valid" CHECK ("hr"."leave_allocation"."to_date" >= "hr"."leave_allocation"."from_date")
);
--> statement-breakpoint
CREATE TABLE "hr"."leave_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"max_days_per_allocation" numeric(6, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_type_code_unique" UNIQUE("code"),
	CONSTRAINT "leave_type_name_not_blank" CHECK (length(btrim("hr"."leave_type"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "hr"."leave_allocation" ADD CONSTRAINT "leave_allocation_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hr"."employee"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hr"."leave_allocation" ADD CONSTRAINT "leave_allocation_leave_type_id_leave_type_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "hr"."leave_type"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "leave_allocation_employee_idx" ON "hr"."leave_allocation" USING btree ("employee_id","leave_type_id");