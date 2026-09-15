CREATE TABLE "planning"."master_production_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mps_number" text NOT NULL,
	"item_id" uuid NOT NULL,
	"org_node_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"from_date" timestamp with time zone NOT NULL,
	"to_date" timestamp with time zone NOT NULL,
	"total_forecast_quantity" numeric(24, 6),
	"projected_quantity" numeric(24, 6),
	"planned_quantity" numeric(24, 6),
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mps_number_unique" UNIQUE("mps_number"),
	CONSTRAINT "mps_periodicity_status_valid" CHECK ("planning"."master_production_schedule"."status" in ('draft', 'submitted')),
	CONSTRAINT "mps_dates_valid" CHECK ("planning"."master_production_schedule"."to_date" >= "planning"."master_production_schedule"."from_date")
);
--> statement-breakpoint
CREATE TABLE "planning"."mps_schedule_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"master_production_schedule_id" uuid NOT NULL,
	"period" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"forecast_quantity" numeric(24, 6) NOT NULL,
	"planned_quantity" numeric(24, 6),
	"line_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "mps_schedule_line_period_valid" CHECK ("planning"."mps_schedule_line"."period" in ('week', 'month', 'quarter', 'year')),
	CONSTRAINT "mps_schedule_line_forecast_qty_positive" CHECK ("planning"."mps_schedule_line"."forecast_quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "planning"."master_production_schedule" ADD CONSTRAINT "master_production_schedule_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "planning"."master_production_schedule" ADD CONSTRAINT "master_production_schedule_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "planning"."master_production_schedule" ADD CONSTRAINT "master_production_schedule_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "planning"."mps_schedule_line" ADD CONSTRAINT "mps_schedule_line_master_production_schedule_id_master_production_schedule_id_fk" FOREIGN KEY ("master_production_schedule_id") REFERENCES "planning"."master_production_schedule"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "mps_org_node_idx" ON "planning"."master_production_schedule" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "mps_item_idx" ON "planning"."master_production_schedule" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "mps_schedule_line_mps_idx" ON "planning"."mps_schedule_line" USING btree ("master_production_schedule_id");