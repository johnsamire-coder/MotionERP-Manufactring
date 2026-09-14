CREATE TABLE "production_ops"."work_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_number" text NOT NULL,
	"product_item_id" uuid NOT NULL,
	"bom_id" uuid NOT NULL,
	"org_node_id" uuid NOT NULL,
	"job_order_reference" text,
	"qty_to_manufacture" numeric(24, 6) NOT NULL,
	"source_warehouse_id" uuid,
	"wip_warehouse_id" uuid,
	"finished_goods_warehouse_id" uuid NOT NULL,
	"planned_start_date" timestamp with time zone,
	"actual_start_date" timestamp with time zone,
	"actual_end_date" timestamp with time zone,
	"status" text DEFAULT 'not_started' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_order_number_unique" UNIQUE("work_order_number"),
	CONSTRAINT "work_order_qty_positive" CHECK ("production_ops"."work_order"."qty_to_manufacture" > 0),
	CONSTRAINT "work_order_status_valid" CHECK ("production_ops"."work_order"."status" in ('not_started', 'in_progress', 'completed', 'stopped', 'closed'))
);
--> statement-breakpoint
ALTER TABLE "production_ops"."work_order" ADD CONSTRAINT "work_order_product_item_id_item_id_fk" FOREIGN KEY ("product_item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "production_ops"."work_order" ADD CONSTRAINT "work_order_bom_id_bom_id_fk" FOREIGN KEY ("bom_id") REFERENCES "technical"."bom"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "production_ops"."work_order" ADD CONSTRAINT "work_order_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "production_ops"."work_order" ADD CONSTRAINT "work_order_source_warehouse_id_warehouse_id_fk" FOREIGN KEY ("source_warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "production_ops"."work_order" ADD CONSTRAINT "work_order_wip_warehouse_id_warehouse_id_fk" FOREIGN KEY ("wip_warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "production_ops"."work_order" ADD CONSTRAINT "work_order_finished_goods_warehouse_id_warehouse_id_fk" FOREIGN KEY ("finished_goods_warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "work_order_product_item_idx" ON "production_ops"."work_order" USING btree ("product_item_id");--> statement-breakpoint
CREATE INDEX "work_order_bom_idx" ON "production_ops"."work_order" USING btree ("bom_id");--> statement-breakpoint
CREATE INDEX "work_order_org_node_idx" ON "production_ops"."work_order" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "work_order_job_order_idx" ON "production_ops"."work_order" USING btree ("job_order_reference");