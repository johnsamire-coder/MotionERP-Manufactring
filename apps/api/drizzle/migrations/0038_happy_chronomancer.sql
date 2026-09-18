CREATE TABLE "production_ops"."production_step_material" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"production_step_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"required_quantity" numeric(24, 6) NOT NULL,
	"consumed_quantity" numeric(24, 6) DEFAULT '0' NOT NULL,
	"warehouse_id" uuid,
	"line_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "production_ops"."production_step_material" ADD CONSTRAINT "production_step_material_production_step_id_production_step_id_fk" FOREIGN KEY ("production_step_id") REFERENCES "production_ops"."production_step"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "production_ops"."production_step_material" ADD CONSTRAINT "production_step_material_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "production_ops"."production_step_material" ADD CONSTRAINT "production_step_material_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "production_step_material_step_idx" ON "production_ops"."production_step_material" USING btree ("production_step_id");--> statement-breakpoint
CREATE INDEX "production_step_material_item_idx" ON "production_ops"."production_step_material" USING btree ("item_id");