CREATE TABLE "finance"."advance_allocation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_type" text NOT NULL,
	"collection_id" uuid,
	"payment_id" uuid,
	"sales_invoice_id" uuid,
	"purchase_invoice_id" uuid,
	"amount" numeric(12, 4) NOT NULL,
	"journal_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advance_allocation_party_valid" CHECK ("finance"."advance_allocation"."party_type" in ('customer', 'supplier')),
	CONSTRAINT "advance_allocation_amount_positive" CHECK ("finance"."advance_allocation"."amount" > 0),
	CONSTRAINT "advance_allocation_customer_shape" CHECK ("finance"."advance_allocation"."party_type" <> 'customer' or ("finance"."advance_allocation"."collection_id" is not null and "finance"."advance_allocation"."sales_invoice_id" is not null)),
	CONSTRAINT "advance_allocation_supplier_shape" CHECK ("finance"."advance_allocation"."party_type" <> 'supplier' or ("finance"."advance_allocation"."payment_id" is not null and "finance"."advance_allocation"."purchase_invoice_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "accounting"."company_accounting_config" ADD COLUMN "book_advances_separately" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accounting"."company_accounting_config" ADD COLUMN "default_advance_received_account_id" uuid;--> statement-breakpoint
ALTER TABLE "accounting"."company_accounting_config" ADD COLUMN "default_advance_paid_account_id" uuid;--> statement-breakpoint
ALTER TABLE "finance"."collection" ADD COLUMN "advance_amount" numeric(12, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."payment" ADD COLUMN "advance_amount" numeric(12, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."advance_allocation" ADD CONSTRAINT "advance_allocation_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "finance"."collection"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."advance_allocation" ADD CONSTRAINT "advance_allocation_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "finance"."payment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."advance_allocation" ADD CONSTRAINT "advance_allocation_sales_invoice_id_sales_invoice_id_fk" FOREIGN KEY ("sales_invoice_id") REFERENCES "finance"."sales_invoice"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."advance_allocation" ADD CONSTRAINT "advance_allocation_purchase_invoice_id_purchase_invoice_id_fk" FOREIGN KEY ("purchase_invoice_id") REFERENCES "finance"."purchase_invoice"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advance_allocation_collection_idx" ON "finance"."advance_allocation" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "advance_allocation_payment_idx" ON "finance"."advance_allocation" USING btree ("payment_id");--> statement-breakpoint
ALTER TABLE "accounting"."company_accounting_config" ADD CONSTRAINT "company_accounting_config_default_advance_received_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_advance_received_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."company_accounting_config" ADD CONSTRAINT "company_accounting_config_default_advance_paid_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_advance_paid_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;