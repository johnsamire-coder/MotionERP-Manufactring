ALTER TABLE "production_ops"."work_order" ADD COLUMN "use_multi_level_bom" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "production_ops"."work_order" ADD COLUMN "consider_scrap_items" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "production_ops"."work_order" ADD COLUMN "material_consumption_percentage" numeric(6, 2) DEFAULT '100' NOT NULL;--> statement-breakpoint
ALTER TABLE "production_ops"."work_order" ADD COLUMN "material_transfer_mode" text DEFAULT 'transfer' NOT NULL;--> statement-breakpoint
ALTER TABLE "production_ops"."work_order" ADD CONSTRAINT "work_order_material_transfer_mode_valid" CHECK ("production_ops"."work_order"."material_transfer_mode" in ('transfer', 'move'));