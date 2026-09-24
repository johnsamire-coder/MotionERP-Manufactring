ALTER TABLE "inventory"."warehouse" ADD COLUMN "parent_warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory"."warehouse" ADD COLUMN "is_group" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory"."warehouse" ADD CONSTRAINT "warehouse_parent_warehouse_id_warehouse_id_fk" FOREIGN KEY ("parent_warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "warehouse_parent_idx" ON "inventory"."warehouse" USING btree ("parent_warehouse_id");--> statement-breakpoint
ALTER TABLE "inventory"."warehouse" ADD CONSTRAINT "warehouse_not_own_parent" CHECK ("inventory"."warehouse"."parent_warehouse_id" is null or "inventory"."warehouse"."parent_warehouse_id" <> "inventory"."warehouse"."id");