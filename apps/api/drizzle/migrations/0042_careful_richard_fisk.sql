CREATE TABLE "inventory"."stock_ledger_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"movement_id" uuid,
	"quantity_change" numeric(24, 6) NOT NULL,
	"balance_qty_after" numeric(24, 6) NOT NULL,
	"incoming_rate" numeric(24, 6) DEFAULT '0' NOT NULL,
	"valuation_rate" numeric(24, 6) DEFAULT '0' NOT NULL,
	"stock_value_change" numeric(24, 6) DEFAULT '0' NOT NULL,
	"stock_value_after" numeric(24, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory"."stock_ledger_entry" ADD CONSTRAINT "stock_ledger_entry_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."stock_ledger_entry" ADD CONSTRAINT "stock_ledger_entry_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."stock_ledger_entry" ADD CONSTRAINT "stock_ledger_entry_movement_id_stock_movement_id_fk" FOREIGN KEY ("movement_id") REFERENCES "inventory"."stock_movement"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_stock_ledger_item_wh" ON "inventory"."stock_ledger_entry" USING btree ("item_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_stock_ledger_created" ON "inventory"."stock_ledger_entry" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "inventory"."stock_reservation" DROP COLUMN "id";