CREATE TABLE "finance"."purchase_invoice_hold" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_invoice_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"release_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_invoice_hold_invoice_unique" UNIQUE("purchase_invoice_id"),
	CONSTRAINT "purchase_invoice_hold_reason_not_blank" CHECK (length(btrim("finance"."purchase_invoice_hold"."reason")) > 0)
);
--> statement-breakpoint
ALTER TABLE "finance"."purchase_invoice_hold" ADD CONSTRAINT "purchase_invoice_hold_purchase_invoice_id_purchase_invoice_id_fk" FOREIGN KEY ("purchase_invoice_id") REFERENCES "finance"."purchase_invoice"("id") ON DELETE cascade ON UPDATE no action;