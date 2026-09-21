CREATE TABLE "finance"."payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_number" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"supplier_id" uuid,
	"purchase_invoice_id" uuid,
	"payment_date" timestamp with time zone NOT NULL,
	"amount" numeric(12, 4) NOT NULL,
	"currency_code" text DEFAULT 'EGP' NOT NULL,
	"payment_method" text NOT NULL,
	"paid_from_account_id" uuid,
	"reference_number" text,
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_payment_number_unique" UNIQUE("payment_number"),
	CONSTRAINT "payment_method_valid" CHECK ("finance"."payment"."payment_method" in ('cash', 'bank_transfer', 'check', 'credit_card')),
	CONSTRAINT "payment_status_valid" CHECK ("finance"."payment"."status" in ('draft', 'posted', 'cancelled')),
	CONSTRAINT "payment_amount_positive" CHECK ("finance"."payment"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "finance"."collection" ADD COLUMN "received_in_account_id" uuid;--> statement-breakpoint
ALTER TABLE "finance"."payment" ADD CONSTRAINT "payment_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "finance"."payment" ADD CONSTRAINT "payment_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "crm"."supplier"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "finance"."payment" ADD CONSTRAINT "payment_purchase_invoice_id_purchase_invoice_id_fk" FOREIGN KEY ("purchase_invoice_id") REFERENCES "finance"."purchase_invoice"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."payment" ADD CONSTRAINT "payment_paid_from_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("paid_from_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_payment_supplier" ON "finance"."payment" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_payment_date" ON "finance"."payment" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "idx_payment_org_node" ON "finance"."payment" USING btree ("org_node_id");--> statement-breakpoint
ALTER TABLE "finance"."collection" ADD CONSTRAINT "collection_received_in_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("received_in_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;