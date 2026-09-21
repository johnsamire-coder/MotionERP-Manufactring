CREATE TABLE "catalog"."uom_conversion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"from_unit_id" uuid NOT NULL,
	"to_unit_id" uuid NOT NULL,
	"conversion_factor" numeric(18, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uom_conversion_item_units_unique" UNIQUE("item_id","from_unit_id","to_unit_id"),
	CONSTRAINT "conversion_factor_positive" CHECK ("catalog"."uom_conversion"."conversion_factor" > 0)
);
--> statement-breakpoint
ALTER TABLE "catalog"."uom_conversion" ADD CONSTRAINT "uom_conversion_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "catalog"."uom_conversion" ADD CONSTRAINT "uom_conversion_from_unit_id_uom_id_fk" FOREIGN KEY ("from_unit_id") REFERENCES "catalog"."uom"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "catalog"."uom_conversion" ADD CONSTRAINT "uom_conversion_to_unit_id_uom_id_fk" FOREIGN KEY ("to_unit_id") REFERENCES "catalog"."uom"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_uom_conversion_item" ON "catalog"."uom_conversion" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_uom_conversion_units" ON "catalog"."uom_conversion" USING btree ("from_unit_id","to_unit_id");