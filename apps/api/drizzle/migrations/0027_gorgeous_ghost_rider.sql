CREATE SCHEMA "planning";
--> statement-breakpoint
CREATE TABLE "planning"."sales_forecast" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forecast_number" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"item_category_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"from_date" timestamp with time zone NOT NULL,
	"to_date" timestamp with time zone NOT NULL,
	"based_on" text DEFAULT 'job_order' NOT NULL,
	"forecast_periodicity" text DEFAULT 'monthly' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_forecast_number_unique" UNIQUE("forecast_number"),
	CONSTRAINT "sales_forecast_based_on_valid" CHECK ("planning"."sales_forecast"."based_on" in ('job_order')),
	CONSTRAINT "sales_forecast_periodicity_valid" CHECK ("planning"."sales_forecast"."forecast_periodicity" in ('monthly', 'quarterly', 'half_yearly', 'yearly')),
	CONSTRAINT "sales_forecast_status_valid" CHECK ("planning"."sales_forecast"."status" in ('draft', 'submitted')),
	CONSTRAINT "sales_forecast_dates_valid" CHECK ("planning"."sales_forecast"."to_date" >= "planning"."sales_forecast"."from_date")
);
--> statement-breakpoint
CREATE TABLE "planning"."sales_forecast_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_forecast_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"forecast_quantity" numeric(24, 6) NOT NULL,
	"planned_quantity" numeric(24, 6),
	"line_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sales_forecast_line_forecast_qty_positive" CHECK ("planning"."sales_forecast_line"."forecast_quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "planning"."sales_forecast" ADD CONSTRAINT "sales_forecast_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "planning"."sales_forecast" ADD CONSTRAINT "sales_forecast_item_category_id_item_category_id_fk" FOREIGN KEY ("item_category_id") REFERENCES "catalog"."item_category"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "planning"."sales_forecast" ADD CONSTRAINT "sales_forecast_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "planning"."sales_forecast_line" ADD CONSTRAINT "sales_forecast_line_sales_forecast_id_sales_forecast_id_fk" FOREIGN KEY ("sales_forecast_id") REFERENCES "planning"."sales_forecast"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "planning"."sales_forecast_line" ADD CONSTRAINT "sales_forecast_line_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "planning"."sales_forecast_line" ADD CONSTRAINT "sales_forecast_line_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "sales_forecast_org_node_idx" ON "planning"."sales_forecast" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "sales_forecast_item_category_idx" ON "planning"."sales_forecast" USING btree ("item_category_id");--> statement-breakpoint
CREATE INDEX "sales_forecast_line_forecast_idx" ON "planning"."sales_forecast_line" USING btree ("sales_forecast_id");--> statement-breakpoint
CREATE INDEX "sales_forecast_line_item_idx" ON "planning"."sales_forecast_line" USING btree ("item_id");