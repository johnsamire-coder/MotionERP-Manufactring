CREATE SCHEMA "cost";
--> statement-breakpoint
CREATE TABLE "cost"."component_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "component_type_code_unique" UNIQUE("code"),
	CONSTRAINT "component_type_code_format" CHECK ("cost"."component_type"."code" ~ '^[a-z_][a-z0-9_]*$')
);
--> statement-breakpoint
CREATE TABLE "cost"."entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cost_sheet_id" uuid NOT NULL,
	"component_type_id" uuid NOT NULL,
	"entry_type" text NOT NULL,
	"amount" numeric(12, 4) NOT NULL,
	"currency_code" text NOT NULL,
	"description" text,
	"source_reference" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cost_entry_type_valid" CHECK ("cost"."entry"."entry_type" in ('estimated', 'actual')),
	CONSTRAINT "cost_entry_amount_positive" CHECK ("cost"."entry"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "cost"."job_cost_sheet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_order_reference" text NOT NULL,
	"currency_code" text DEFAULT 'EGP' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_cost_sheet_job_order_reference_unique" UNIQUE("job_order_reference"),
	CONSTRAINT "job_cost_sheet_status_valid" CHECK ("cost"."job_cost_sheet"."status" in ('draft', 'active', 'closed'))
);
--> statement-breakpoint
ALTER TABLE "cost"."entry" ADD CONSTRAINT "entry_cost_sheet_id_job_cost_sheet_id_fk" FOREIGN KEY ("cost_sheet_id") REFERENCES "cost"."job_cost_sheet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost"."entry" ADD CONSTRAINT "entry_component_type_id_component_type_id_fk" FOREIGN KEY ("component_type_id") REFERENCES "cost"."component_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cost_entry_sheet" ON "cost"."entry" USING btree ("cost_sheet_id");--> statement-breakpoint
CREATE INDEX "idx_cost_entry_type" ON "cost"."entry" USING btree ("component_type_id");--> statement-breakpoint
CREATE INDEX "idx_cost_entry_recorded_at" ON "cost"."entry" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "idx_job_cost_sheet_reference" ON "cost"."job_cost_sheet" USING btree ("job_order_reference");
--> statement-breakpoint
-- Seed default cost component types
INSERT INTO "cost"."component_type" ("id", "code", "name", "description") VALUES
  ('00000000-0000-0000-0000-000000000001', 'material', 'Raw Materials', 'Cost of raw materials and components'),
  ('00000000-0000-0000-0000-000000000002', 'labor', 'Direct Labor', 'Cost of direct labor and wages'),
  ('00000000-0000-0000-0000-000000000003', 'overhead', 'Manufacturing Overhead', 'Indirect costs like utilities, maintenance'),
  ('00000000-0000-0000-0000-000000000004', 'accessory', 'Accessories & Parts', 'Small parts and accessories'),
  ('00000000-0000-0000-0000-000000000005', 'consumable', 'Consumables', 'Tools, gloves, cleaning supplies, etc.');
