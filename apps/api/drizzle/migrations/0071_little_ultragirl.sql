CREATE TABLE "crm"."opportunity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_number" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"source" text,
	"expected_amount" numeric(18, 4),
	"probability" integer DEFAULT 10 NOT NULL,
	"expected_close_date" timestamp with time zone,
	"stage" text DEFAULT 'open' NOT NULL,
	"lost_reason" text,
	"quotation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunity_number_unique" UNIQUE("opportunity_number"),
	CONSTRAINT "opportunity_stage_valid" CHECK ("crm"."opportunity"."stage" in ('open', 'qualified', 'quoted', 'won', 'lost')),
	CONSTRAINT "opportunity_probability_range" CHECK ("crm"."opportunity"."probability" between 0 and 100),
	CONSTRAINT "opportunity_lost_needs_reason" CHECK ("crm"."opportunity"."stage" <> 'lost' or "crm"."opportunity"."lost_reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "crm"."opportunity_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(24, 6) NOT NULL,
	"expected_rate" numeric(20, 4),
	CONSTRAINT "opportunity_item_quantity_positive" CHECK ("crm"."opportunity_item"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "crm"."opportunity" ADD CONSTRAINT "opportunity_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "crm"."customer"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm"."opportunity_item" ADD CONSTRAINT "opportunity_item_opportunity_id_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "crm"."opportunity"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "opportunity_customer_idx" ON "crm"."opportunity" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "opportunity_quotation_idx" ON "crm"."opportunity" USING btree ("quotation_id");--> statement-breakpoint
CREATE INDEX "opportunity_item_opportunity_idx" ON "crm"."opportunity_item" USING btree ("opportunity_id");