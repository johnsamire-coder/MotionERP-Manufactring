CREATE TABLE "planning"."production_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_number" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"plan_by" text DEFAULT 'job_order' NOT NULL,
	"from_date" timestamp with time zone NOT NULL,
	"to_date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_plan_number_unique" UNIQUE("plan_number"),
	CONSTRAINT "production_plan_by_valid" CHECK ("planning"."production_plan"."plan_by" in ('job_order', 'material_request', 'sales_forecast')),
	CONSTRAINT "production_plan_status_valid" CHECK ("planning"."production_plan"."status" in ('draft', 'submitted', 'completed', 'closed')),
	CONSTRAINT "production_plan_dates_valid" CHECK ("planning"."production_plan"."to_date" >= "planning"."production_plan"."from_date")
);
--> statement-breakpoint
CREATE TABLE "planning"."production_plan_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"production_plan_id" uuid NOT NULL,
	"product_item_id" uuid NOT NULL,
	"bom_id" uuid NOT NULL,
	"qty_to_plan" numeric(24, 6) NOT NULL,
	"warehouse_id" uuid,
	"work_order_id" uuid,
	"line_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "production_plan_item_qty_positive" CHECK ("planning"."production_plan_item"."qty_to_plan" > 0)
);
--> statement-breakpoint
ALTER TABLE "planning"."production_plan" ADD CONSTRAINT "production_plan_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "planning"."production_plan_item" ADD CONSTRAINT "production_plan_item_production_plan_id_production_plan_id_fk" FOREIGN KEY ("production_plan_id") REFERENCES "planning"."production_plan"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "planning"."production_plan_item" ADD CONSTRAINT "production_plan_item_product_item_id_item_id_fk" FOREIGN KEY ("product_item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "planning"."production_plan_item" ADD CONSTRAINT "production_plan_item_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "production_plan_org_node_idx" ON "planning"."production_plan" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "production_plan_item_plan_idx" ON "planning"."production_plan_item" USING btree ("production_plan_id");--> statement-breakpoint
CREATE INDEX "production_plan_item_product_idx" ON "planning"."production_plan_item" USING btree ("product_item_id");