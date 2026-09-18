CREATE TABLE "catalog"."item_price" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"price_list_type" text NOT NULL,
	"price" numeric(20, 4) NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_price_type_valid" CHECK ("catalog"."item_price"."price_list_type" in ('buying', 'selling')),
	CONSTRAINT "item_price_non_negative" CHECK ("catalog"."item_price"."price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "catalog"."item_price" ADD CONSTRAINT "item_price_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "item_price_item_idx" ON "catalog"."item_price" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "item_price_type_idx" ON "catalog"."item_price" USING btree ("price_list_type");