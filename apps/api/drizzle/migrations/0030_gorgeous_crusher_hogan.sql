CREATE TABLE "planning"."item_lead_time" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"org_node_id" uuid NOT NULL,
	"manufacturing_time_hours" numeric(12, 4),
	"is_manufacturing_lead_time" boolean DEFAULT false NOT NULL,
	"manufacturing_buffer_days" numeric(8, 2),
	"purchase_time_days" numeric(8, 2),
	"is_purchase_lead_time" boolean DEFAULT false NOT NULL,
	"purchase_buffer_days" numeric(8, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_lead_time_item_unique" UNIQUE("item_id")
);
--> statement-breakpoint
CREATE TABLE "planning"."supplier_lead_time" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_lead_time_id" uuid NOT NULL,
	"supplier_name" text NOT NULL,
	"lead_time_days" numeric(8, 2) NOT NULL,
	CONSTRAINT "supplier_lead_time_days_positive" CHECK ("planning"."supplier_lead_time"."lead_time_days" > 0)
);
--> statement-breakpoint
ALTER TABLE "planning"."item_lead_time" ADD CONSTRAINT "item_lead_time_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "planning"."item_lead_time" ADD CONSTRAINT "item_lead_time_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "planning"."supplier_lead_time" ADD CONSTRAINT "supplier_lead_time_item_lead_time_id_item_lead_time_id_fk" FOREIGN KEY ("item_lead_time_id") REFERENCES "planning"."item_lead_time"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "item_lead_time_org_node_idx" ON "planning"."item_lead_time" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "supplier_lead_time_item_lead_time_idx" ON "planning"."supplier_lead_time" USING btree ("item_lead_time_id");