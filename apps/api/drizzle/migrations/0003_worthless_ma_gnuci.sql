CREATE SCHEMA "inventory";
--> statement-breakpoint
CREATE TABLE "inventory"."stock_balance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"on_hand" numeric(24, 6) DEFAULT '0' NOT NULL,
	"reserved" numeric(24, 6) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_balance_item_warehouse_unique" UNIQUE("item_id","warehouse_id"),
	CONSTRAINT "stock_balance_on_hand_non_negative" CHECK ("inventory"."stock_balance"."on_hand" >= 0),
	CONSTRAINT "stock_balance_reserved_non_negative" CHECK ("inventory"."stock_balance"."reserved" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"movement_type" text NOT NULL,
	"quantity" numeric(24, 6) NOT NULL,
	"movement_date" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "stock_movement_type_valid" CHECK ("inventory"."stock_movement"."movement_type" in ('receipt', 'issue', 'transfer_in', 'transfer_out', 'adjustment')),
	CONSTRAINT "stock_movement_quantity_not_zero" CHECK ("inventory"."stock_movement"."quantity" <> 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_reservation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"quantity" numeric(24, 6) NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	CONSTRAINT "stock_reservation_quantity_positive" CHECK ("inventory"."stock_reservation"."quantity" > 0),
	CONSTRAINT "stock_reservation_status_valid" CHECK ("inventory"."stock_reservation"."status" in ('active', 'released'))
);
--> statement-breakpoint
CREATE TABLE "inventory"."warehouse" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warehouse_code_unique" UNIQUE("code"),
	CONSTRAINT "warehouse_code_format" CHECK ("inventory"."warehouse"."code" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
	CONSTRAINT "warehouse_name_not_blank" CHECK (length(btrim("inventory"."warehouse"."name")) > 0),
	CONSTRAINT "warehouse_status_valid" CHECK ("inventory"."warehouse"."status" in ('active', 'inactive', 'archived'))
);
--> statement-breakpoint
ALTER TABLE "inventory"."stock_balance" ADD CONSTRAINT "stock_balance_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."stock_balance" ADD CONSTRAINT "stock_balance_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movement" ADD CONSTRAINT "stock_movement_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movement" ADD CONSTRAINT "stock_movement_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."stock_reservation" ADD CONSTRAINT "stock_reservation_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."stock_reservation" ADD CONSTRAINT "stock_reservation_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."warehouse" ADD CONSTRAINT "warehouse_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "stock_balance_item_idx" ON "inventory"."stock_balance" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "stock_balance_warehouse_idx" ON "inventory"."stock_balance" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_movement_item_warehouse_idx" ON "inventory"."stock_movement" USING btree ("item_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_movement_date_idx" ON "inventory"."stock_movement" USING btree ("movement_date");--> statement-breakpoint
CREATE INDEX "stock_reservation_item_warehouse_idx" ON "inventory"."stock_reservation" USING btree ("item_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "warehouse_org_node_idx" ON "inventory"."warehouse" USING btree ("org_node_id");
--> statement-breakpoint
-- INVENTORY UPDATED_AT TRIGGERS
CREATE TRIGGER "inventory_warehouse_set_updated_at"
    BEFORE UPDATE ON "inventory"."warehouse"
    FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "inventory_stock_balance_set_updated_at"
    BEFORE UPDATE ON "inventory"."stock_balance"
    FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();
