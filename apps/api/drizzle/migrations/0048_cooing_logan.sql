CREATE TABLE "inventory"."item_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_number" text NOT NULL,
	"item_id" uuid NOT NULL,
	"org_node_id" uuid NOT NULL,
	"manufacturing_date" timestamp with time zone,
	"expiry_date" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_batch_item_batch_unique" UNIQUE("item_id","batch_number"),
	CONSTRAINT "item_batch_status_valid" CHECK ("inventory"."item_batch"."status" in ('active', 'expired', 'quarantined', 'recalled'))
);
--> statement-breakpoint
CREATE TABLE "inventory"."serial_number" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"serial_no" text NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"batch_id" uuid,
	"org_node_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"purchase_receipt_id" uuid,
	"delivery_order_id" uuid,
	"work_order_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "serial_number_item_unique" UNIQUE("item_id","serial_no"),
	CONSTRAINT "serial_number_status_valid" CHECK ("inventory"."serial_number"."status" in ('active', 'delivered', 'under_maintenance', 'decommissioned'))
);
--> statement-breakpoint
ALTER TABLE "inventory"."item_batch" ADD CONSTRAINT "item_batch_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."item_batch" ADD CONSTRAINT "item_batch_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."serial_number" ADD CONSTRAINT "serial_number_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."serial_number" ADD CONSTRAINT "serial_number_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."serial_number" ADD CONSTRAINT "serial_number_batch_id_item_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "inventory"."item_batch"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."serial_number" ADD CONSTRAINT "serial_number_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_item_batch_item" ON "inventory"."item_batch" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_item_batch_expiry" ON "inventory"."item_batch" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "idx_item_batch_org" ON "inventory"."item_batch" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "idx_serial_number_item" ON "inventory"."serial_number" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_serial_number_wh" ON "inventory"."serial_number" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_serial_number_batch" ON "inventory"."serial_number" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_serial_number_org" ON "inventory"."serial_number" USING btree ("org_node_id");