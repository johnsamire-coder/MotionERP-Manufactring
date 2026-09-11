CREATE SCHEMA "hr";
--> statement-breakpoint
CREATE TABLE "hr"."commission_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"job_order_reference" text NOT NULL,
	"source_reference" text NOT NULL,
	"base_amount" numeric(12, 4) NOT NULL,
	"commission_amount" numeric(12, 4) NOT NULL,
	"earned_date" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_entry_base_positive" CHECK ("hr"."commission_entry"."base_amount" > 0),
	CONSTRAINT "commission_entry_amount_positive" CHECK ("hr"."commission_entry"."commission_amount" > 0),
	CONSTRAINT "commission_entry_status_valid" CHECK ("hr"."commission_entry"."status" in ('pending', 'paid'))
);
--> statement-breakpoint
CREATE TABLE "hr"."commission_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"basis" text NOT NULL,
	"rate_percentage" numeric(6, 3) NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_rule_basis_valid" CHECK ("hr"."commission_rule"."basis" in ('sale_value', 'collected_amount')),
	CONSTRAINT "commission_rule_rate_positive" CHECK ("hr"."commission_rule"."rate_percentage" > 0),
	CONSTRAINT "commission_rule_status_valid" CHECK ("hr"."commission_rule"."status" in ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "hr"."employee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"base_salary" numeric(12, 4) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_code_unique" UNIQUE("code"),
	CONSTRAINT "employee_code_format" CHECK ("hr"."employee"."code" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
	CONSTRAINT "employee_name_not_blank" CHECK (length(btrim("hr"."employee"."name")) > 0),
	CONSTRAINT "employee_base_salary_non_negative" CHECK ("hr"."employee"."base_salary" >= 0),
	CONSTRAINT "employee_status_valid" CHECK ("hr"."employee"."status" in ('active', 'inactive', 'terminated'))
);
--> statement-breakpoint
CREATE TABLE "hr"."external_commission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"beneficiary_name" text NOT NULL,
	"job_order_reference" text NOT NULL,
	"amount" numeric(12, 4) NOT NULL,
	"basis_description" text NOT NULL,
	"due_date" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_commission_amount_positive" CHECK ("hr"."external_commission"."amount" > 0),
	CONSTRAINT "external_commission_status_valid" CHECK ("hr"."external_commission"."status" in ('pending', 'paid', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "hr"."payroll_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"period_year" text NOT NULL,
	"period_month" text NOT NULL,
	"base_salary" numeric(12, 4) NOT NULL,
	"total_commissions" numeric(12, 4) DEFAULT '0' NOT NULL,
	"total_amount" numeric(12, 4) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_entry_employee_period_unique" UNIQUE("employee_id","period_year","period_month"),
	CONSTRAINT "payroll_entry_status_valid" CHECK ("hr"."payroll_entry"."status" in ('draft', 'approved', 'paid'))
);
--> statement-breakpoint
ALTER TABLE "hr"."commission_entry" ADD CONSTRAINT "commission_entry_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hr"."employee"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hr"."commission_rule" ADD CONSTRAINT "commission_rule_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hr"."employee"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hr"."employee" ADD CONSTRAINT "employee_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hr"."payroll_entry" ADD CONSTRAINT "payroll_entry_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hr"."employee"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "commission_entry_employee_idx" ON "hr"."commission_entry" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "commission_entry_job_order_idx" ON "hr"."commission_entry" USING btree ("job_order_reference");--> statement-breakpoint
CREATE INDEX "commission_rule_employee_idx" ON "hr"."commission_rule" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_org_node_idx" ON "hr"."employee" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "external_commission_job_order_idx" ON "hr"."external_commission" USING btree ("job_order_reference");--> statement-breakpoint
CREATE INDEX "payroll_entry_employee_idx" ON "hr"."payroll_entry" USING btree ("employee_id");
--> statement-breakpoint
-- HR UPDATED_AT TRIGGER
CREATE TRIGGER "hr_employee_set_updated_at"
    BEFORE UPDATE ON "hr"."employee"
    FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();
