CREATE TABLE "inventory"."batch_balance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"quantity" numeric(24, 6) DEFAULT '0' NOT NULL,
	"valuation_rate" numeric(24, 6) DEFAULT '0' NOT NULL,
	"total_value" numeric(24, 6) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "batch_balance_batch_warehouse_unique" UNIQUE("batch_id","warehouse_id"),
	CONSTRAINT "batch_balance_quantity_non_negative" CHECK ("inventory"."batch_balance"."quantity" >= 0)
);
--> statement-breakpoint
ALTER TABLE "catalog"."item" ADD COLUMN "has_batch_no" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."item" ADD COLUMN "has_serial_no" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."item" ADD COLUMN "has_expiry_date" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."item" ADD COLUMN "shelf_life_in_days" integer;--> statement-breakpoint
ALTER TABLE "inventory"."stock_ledger_entry" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movement" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory"."batch_balance" ADD CONSTRAINT "batch_balance_batch_id_item_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "inventory"."item_batch"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."batch_balance" ADD CONSTRAINT "batch_balance_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_batch_balance_item_wh" ON "inventory"."batch_balance" USING btree ("item_id","warehouse_id");--> statement-breakpoint
ALTER TABLE "inventory"."stock_ledger_entry" ADD CONSTRAINT "stock_ledger_entry_batch_id_item_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "inventory"."item_batch"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movement" ADD CONSTRAINT "stock_movement_batch_id_item_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "inventory"."item_batch"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "stock_movement_batch_idx" ON "inventory"."stock_movement" USING btree ("batch_id");--> statement-breakpoint
ALTER TABLE "catalog"."item" ADD CONSTRAINT "item_expiry_requires_batch" CHECK (not "catalog"."item"."has_expiry_date" or "catalog"."item"."has_batch_no");--> statement-breakpoint
ALTER TABLE "catalog"."item" ADD CONSTRAINT "item_shelf_life_non_negative" CHECK ("catalog"."item"."shelf_life_in_days" is null or "catalog"."item"."shelf_life_in_days" >= 0);