CREATE SCHEMA "technical";
--> statement-breakpoint
CREATE TABLE "technical"."bom" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_order_reference" text NOT NULL,
	"product_item_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"output_quantity" numeric(24, 6) DEFAULT '1' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bom_job_order_version_unique" UNIQUE("job_order_reference","version"),
	CONSTRAINT "bom_output_quantity_positive" CHECK ("technical"."bom"."output_quantity" > 0),
	CONSTRAINT "bom_status_valid" CHECK ("technical"."bom"."status" in ('draft', 'approved', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "technical"."bom_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bom_id" uuid NOT NULL,
	"component_item_id" uuid NOT NULL,
	"quantity" numeric(24, 6) NOT NULL,
	"line_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "bom_line_quantity_positive" CHECK ("technical"."bom_line"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "technical"."technical_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_order_reference" text NOT NULL,
	"document_type" text NOT NULL,
	"file_reference" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "technical_document_type_valid" CHECK ("technical"."technical_document"."document_type" in ('shop_drawing', 'cutting_list', 'other'))
);
--> statement-breakpoint
ALTER TABLE "technical"."bom" ADD CONSTRAINT "bom_product_item_id_item_id_fk" FOREIGN KEY ("product_item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "technical"."bom_line" ADD CONSTRAINT "bom_line_bom_id_bom_id_fk" FOREIGN KEY ("bom_id") REFERENCES "technical"."bom"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "technical"."bom_line" ADD CONSTRAINT "bom_line_component_item_id_item_id_fk" FOREIGN KEY ("component_item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "bom_job_order_idx" ON "technical"."bom" USING btree ("job_order_reference");--> statement-breakpoint
CREATE INDEX "bom_line_bom_idx" ON "technical"."bom_line" USING btree ("bom_id");--> statement-breakpoint
CREATE INDEX "bom_line_component_idx" ON "technical"."bom_line" USING btree ("component_item_id");--> statement-breakpoint
CREATE INDEX "technical_document_job_order_idx" ON "technical"."technical_document" USING btree ("job_order_reference");
--> statement-breakpoint
-- TECHNICAL (BOM) UPDATED_AT TRIGGER
CREATE TRIGGER "technical_bom_set_updated_at"
    BEFORE UPDATE ON "technical"."bom"
    FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();
