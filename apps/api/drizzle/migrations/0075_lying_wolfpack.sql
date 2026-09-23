CREATE TABLE "inventory"."item_reorder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"reorder_level" numeric(24, 6) NOT NULL,
	"reorder_qty" numeric(24, 6) NOT NULL,
	"request_type" text DEFAULT 'purchase' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_reorder_item_warehouse_unique" UNIQUE("item_id","warehouse_id"),
	CONSTRAINT "item_reorder_values_valid" CHECK ("inventory"."item_reorder"."reorder_level" >= 0 and "inventory"."item_reorder"."reorder_qty" > 0),
	CONSTRAINT "item_reorder_request_type_valid" CHECK ("inventory"."item_reorder"."request_type" in ('purchase', 'transfer', 'manufacture'))
);
--> statement-breakpoint
ALTER TABLE "inventory"."item_reorder" ADD CONSTRAINT "item_reorder_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE cascade ON UPDATE cascade;