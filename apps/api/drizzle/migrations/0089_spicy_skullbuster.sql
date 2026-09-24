CREATE TABLE "finance"."invoice_installment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_type" text NOT NULL,
	"sales_invoice_id" uuid,
	"purchase_invoice_id" uuid,
	"installment_number" integer NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"amount" numeric(14, 4) NOT NULL,
	CONSTRAINT "invoice_installment_sales_number_unique" UNIQUE("sales_invoice_id","installment_number"),
	CONSTRAINT "invoice_installment_purchase_number_unique" UNIQUE("purchase_invoice_id","installment_number"),
	CONSTRAINT "invoice_installment_type_valid" CHECK ("finance"."invoice_installment"."invoice_type" in ('sales', 'purchase')),
	CONSTRAINT "invoice_installment_shape" CHECK (("finance"."invoice_installment"."invoice_type" = 'sales' and "finance"."invoice_installment"."sales_invoice_id" is not null and "finance"."invoice_installment"."purchase_invoice_id" is null) or ("finance"."invoice_installment"."invoice_type" = 'purchase' and "finance"."invoice_installment"."purchase_invoice_id" is not null and "finance"."invoice_installment"."sales_invoice_id" is null)),
	CONSTRAINT "invoice_installment_amount_positive" CHECK ("finance"."invoice_installment"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "finance"."advance_allocation" ADD COLUMN "kind" text DEFAULT 'advance' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."advance_allocation" ADD COLUMN "installment_number" integer;--> statement-breakpoint
ALTER TABLE "finance"."invoice_installment" ADD CONSTRAINT "invoice_installment_sales_invoice_id_sales_invoice_id_fk" FOREIGN KEY ("sales_invoice_id") REFERENCES "finance"."sales_invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."invoice_installment" ADD CONSTRAINT "invoice_installment_purchase_invoice_id_purchase_invoice_id_fk" FOREIGN KEY ("purchase_invoice_id") REFERENCES "finance"."purchase_invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."advance_allocation" ADD CONSTRAINT "advance_allocation_kind_valid" CHECK ("finance"."advance_allocation"."kind" in ('advance', 'matching'));