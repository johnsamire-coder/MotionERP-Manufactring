CREATE SCHEMA "sales";
--> statement-breakpoint
CREATE TABLE "sales"."quotation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_number" text NOT NULL,
	"direction" text NOT NULL,
	"customer_id" uuid,
	"supplier_id" uuid,
	"quotation_date" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"customer_po_reference" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotation_number_unique" UNIQUE("quotation_number"),
	CONSTRAINT "quotation_direction_valid" CHECK ("sales"."quotation"."direction" in ('outgoing', 'incoming')),
	CONSTRAINT "quotation_status_valid" CHECK ("sales"."quotation"."status" in ('draft', 'sent', 'approved', 'rejected', 'expired')),
	CONSTRAINT "quotation_party_matches_direction" CHECK (("sales"."quotation"."direction" = 'outgoing' and "sales"."quotation"."customer_id" is not null and "sales"."quotation"."supplier_id" is null)
     or ("sales"."quotation"."direction" = 'incoming' and "sales"."quotation"."supplier_id" is not null and "sales"."quotation"."customer_id" is null))
);
--> statement-breakpoint
CREATE TABLE "sales"."quotation_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(24, 6) NOT NULL,
	"unit_price" numeric(20, 4) NOT NULL,
	"line_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "quotation_line_quantity_positive" CHECK ("sales"."quotation_line"."quantity" > 0),
	CONSTRAINT "quotation_line_price_non_negative" CHECK ("sales"."quotation_line"."unit_price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sales"."quotation" ADD CONSTRAINT "quotation_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "crm"."customer"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales"."quotation" ADD CONSTRAINT "quotation_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "crm"."supplier"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales"."quotation_line" ADD CONSTRAINT "quotation_line_quotation_id_quotation_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "sales"."quotation"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales"."quotation_line" ADD CONSTRAINT "quotation_line_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "quotation_customer_idx" ON "sales"."quotation" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "quotation_supplier_idx" ON "sales"."quotation" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "quotation_line_quotation_idx" ON "sales"."quotation_line" USING btree ("quotation_id");--> statement-breakpoint
CREATE INDEX "quotation_line_item_idx" ON "sales"."quotation_line" USING btree ("item_id");
--> statement-breakpoint
-- SALES (QUOTATION) UPDATED_AT TRIGGER
CREATE TRIGGER "sales_quotation_set_updated_at"
    BEFORE UPDATE ON "sales"."quotation"
    FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();
