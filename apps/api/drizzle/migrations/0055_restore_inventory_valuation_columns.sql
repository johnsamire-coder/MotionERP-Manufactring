ALTER TABLE "inventory"."stock_balance" ADD COLUMN IF NOT EXISTS "average_cost" numeric(18, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory"."stock_balance" ADD COLUMN IF NOT EXISTS "total_value" numeric(18, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory"."stock_balance" ADD COLUMN IF NOT EXISTS "last_purchase_cost" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "inventory"."stock_balance" ADD COLUMN IF NOT EXISTS "last_purchase_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movement" ADD COLUMN IF NOT EXISTS "unit_cost" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "inventory"."stock_movement" ADD COLUMN IF NOT EXISTS "total_value" numeric(18, 4);--> statement-breakpoint
ALTER TABLE "inventory"."stock_movement" ADD COLUMN IF NOT EXISTS "source_module" text;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movement" ADD COLUMN IF NOT EXISTS "source_id" text;
