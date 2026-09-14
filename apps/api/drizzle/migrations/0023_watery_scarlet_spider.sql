ALTER TABLE "technical"."bom" DROP CONSTRAINT "bom_job_order_version_unique";--> statement-breakpoint
DROP INDEX "technical"."bom_job_order_idx";--> statement-breakpoint
ALTER TABLE "technical"."bom" ALTER COLUMN "org_node_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "technical"."bom" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "technical"."bom" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "technical"."bom" ADD COLUMN "is_phantom_bom" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "technical"."bom" ADD COLUMN "allow_alternative_item" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "technical"."bom" ADD COLUMN "quality_inspection_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "technical"."bom" ADD COLUMN "consume_components_based_on" text DEFAULT 'bom' NOT NULL;--> statement-breakpoint
ALTER TABLE "technical"."bom" ADD COLUMN "default_source_warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "technical"."bom" ADD COLUMN "default_target_warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "technical"."bom" ADD CONSTRAINT "bom_default_source_warehouse_id_warehouse_id_fk" FOREIGN KEY ("default_source_warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "technical"."bom" ADD CONSTRAINT "bom_default_target_warehouse_id_warehouse_id_fk" FOREIGN KEY ("default_target_warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "bom_item_idx" ON "technical"."bom" USING btree ("product_item_id");--> statement-breakpoint
ALTER TABLE "technical"."bom" DROP COLUMN "job_order_reference";--> statement-breakpoint
ALTER TABLE "technical"."bom" ADD CONSTRAINT "bom_item_version_unique" UNIQUE("product_item_id","version");--> statement-breakpoint
ALTER TABLE "technical"."bom" ADD CONSTRAINT "bom_consume_based_on_valid" CHECK ("technical"."bom"."consume_components_based_on" in ('bom', 'material_transferred_for_manufacture'));