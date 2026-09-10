CREATE SCHEMA "catalog";
--> statement-breakpoint
CREATE TABLE "catalog"."item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"item_type" text NOT NULL,
	"category_id" uuid NOT NULL,
	"base_unit_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_code_unique" UNIQUE("code"),
	CONSTRAINT "item_code_format" CHECK ("catalog"."item"."code" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
	CONSTRAINT "item_name_not_blank" CHECK (length(btrim("catalog"."item"."name")) > 0),
	CONSTRAINT "item_type_valid" CHECK ("catalog"."item"."item_type" in ('raw_material', 'finished_product', 'semi_finished_product', 'consumable', 'spare_part', 'service')),
	CONSTRAINT "item_status_valid" CHECK ("catalog"."item"."status" in ('active', 'inactive', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "catalog"."item_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_category_code_unique" UNIQUE("code"),
	CONSTRAINT "item_category_code_format" CHECK ("catalog"."item_category"."code" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
	CONSTRAINT "item_category_name_not_blank" CHECK (length(btrim("catalog"."item_category"."name")) > 0),
	CONSTRAINT "item_category_status_valid" CHECK ("catalog"."item_category"."status" in ('active', 'inactive', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "catalog"."item_category_translation" (
	"category_id" uuid NOT NULL,
	"language" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "item_category_translation_pk" PRIMARY KEY("category_id","language"),
	CONSTRAINT "item_category_translation_language_valid" CHECK ("catalog"."item_category_translation"."language" in ('ar', 'en')),
	CONSTRAINT "item_category_translation_name_not_blank" CHECK (length(btrim("catalog"."item_category_translation"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."item_translation" (
	"item_id" uuid NOT NULL,
	"language" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "item_translation_pk" PRIMARY KEY("item_id","language"),
	CONSTRAINT "item_translation_language_valid" CHECK ("catalog"."item_translation"."language" in ('ar', 'en')),
	CONSTRAINT "item_translation_name_not_blank" CHECK (length(btrim("catalog"."item_translation"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."uom" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"symbol" text,
	"class_code" text NOT NULL,
	"decimal_precision" integer DEFAULT 2 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uom_code_unique" UNIQUE("code"),
	CONSTRAINT "uom_code_format" CHECK ("catalog"."uom"."code" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
	CONSTRAINT "uom_name_not_blank" CHECK (length(btrim("catalog"."uom"."name")) > 0),
	CONSTRAINT "uom_precision_range" CHECK ("catalog"."uom"."decimal_precision" >= 0 and "catalog"."uom"."decimal_precision" <= 6),
	CONSTRAINT "uom_status_valid" CHECK ("catalog"."uom"."status" in ('active', 'inactive', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "catalog"."uom_class" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "catalog"."uom_translation" (
	"uom_id" uuid NOT NULL,
	"language" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "uom_translation_pk" PRIMARY KEY("uom_id","language"),
	CONSTRAINT "uom_translation_language_valid" CHECK ("catalog"."uom_translation"."language" in ('ar', 'en')),
	CONSTRAINT "uom_translation_name_not_blank" CHECK (length(btrim("catalog"."uom_translation"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "catalog"."item" ADD CONSTRAINT "item_category_id_item_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "catalog"."item_category"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "catalog"."item" ADD CONSTRAINT "item_base_unit_id_uom_id_fk" FOREIGN KEY ("base_unit_id") REFERENCES "catalog"."uom"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "catalog"."item_category_translation" ADD CONSTRAINT "item_category_translation_category_id_item_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "catalog"."item_category"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "catalog"."item_translation" ADD CONSTRAINT "item_translation_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "catalog"."uom" ADD CONSTRAINT "uom_class_code_uom_class_code_fk" FOREIGN KEY ("class_code") REFERENCES "catalog"."uom_class"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "catalog"."uom_translation" ADD CONSTRAINT "uom_translation_uom_id_uom_id_fk" FOREIGN KEY ("uom_id") REFERENCES "catalog"."uom"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "item_category_idx" ON "catalog"."item" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "item_base_unit_idx" ON "catalog"."item" USING btree ("base_unit_id");--> statement-breakpoint
CREATE INDEX "uom_class_idx" ON "catalog"."uom" USING btree ("class_code");
--> statement-breakpoint
-- CATALOG UPDATED_AT TRIGGERS
CREATE TRIGGER "catalog_uom_set_updated_at"
    BEFORE UPDATE ON "catalog"."uom"
    FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "catalog_item_category_set_updated_at"
    BEFORE UPDATE ON "catalog"."item_category"
    FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "catalog_item_set_updated_at"
    BEFORE UPDATE ON "catalog"."item"
    FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();
--> statement-breakpoint
-- SEED: standard UOM classes and common units
INSERT INTO catalog.uom_class (code, name) VALUES
    ('count', 'Count'),
    ('mass', 'Mass'),
    ('volume', 'Volume'),
    ('length', 'Length'),
    ('area', 'Area'),
    ('service', 'Service');
--> statement-breakpoint
INSERT INTO catalog.uom (code, name, symbol, class_code, decimal_precision) VALUES
    ('piece', 'Piece', 'pc', 'count', 0),
    ('box', 'Box', 'box', 'count', 0),
    ('pack', 'Pack', 'pack', 'count', 0),
    ('kg', 'Kilogram', 'kg', 'mass', 3),
    ('g', 'Gram', 'g', 'mass', 2),
    ('ton', 'Ton', 't', 'mass', 3),
    ('l', 'Liter', 'l', 'volume', 3),
    ('ml', 'Milliliter', 'ml', 'volume', 2),
    ('m', 'Meter', 'm', 'length', 4),
    ('cm', 'Centimeter', 'cm', 'length', 2),
    ('m2', 'Square Meter', 'm2', 'area', 4),
    ('service', 'Service', NULL, 'service', 0);
