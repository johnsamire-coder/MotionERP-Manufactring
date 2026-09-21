CREATE TABLE "finance"."credit_debit_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_number" text NOT NULL,
	"note_type" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"party_type" text NOT NULL,
	"party_id" uuid NOT NULL,
	"original_invoice_number" text,
	"sales_invoice_id" uuid,
	"purchase_invoice_id" uuid,
	"posting_date" timestamp with time zone NOT NULL,
	"net_amount" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"tax_amount" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"grand_total" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"reason" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_debit_note_note_number_unique" UNIQUE("note_number"),
	CONSTRAINT "note_type_valid" CHECK ("finance"."credit_debit_note"."note_type" in ('credit_note', 'debit_note')),
	CONSTRAINT "party_type_valid" CHECK ("finance"."credit_debit_note"."party_type" in ('customer', 'supplier')),
	CONSTRAINT "note_status_valid" CHECK ("finance"."credit_debit_note"."status" in ('draft', 'posted', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "finance"."credit_debit_note_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(24, 6) NOT NULL,
	"unit_price" numeric(18, 6) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '14.00' NOT NULL,
	"tax_amount" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"total_amount" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance"."credit_debit_note" ADD CONSTRAINT "credit_debit_note_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "finance"."credit_debit_note" ADD CONSTRAINT "credit_debit_note_sales_invoice_id_sales_invoice_id_fk" FOREIGN KEY ("sales_invoice_id") REFERENCES "finance"."sales_invoice"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."credit_debit_note" ADD CONSTRAINT "credit_debit_note_purchase_invoice_id_purchase_invoice_id_fk" FOREIGN KEY ("purchase_invoice_id") REFERENCES "finance"."purchase_invoice"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."credit_debit_note_line" ADD CONSTRAINT "credit_debit_note_line_note_id_credit_debit_note_id_fk" FOREIGN KEY ("note_id") REFERENCES "finance"."credit_debit_note"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."credit_debit_note_line" ADD CONSTRAINT "credit_debit_note_line_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_note_party" ON "finance"."credit_debit_note" USING btree ("party_type","party_id");--> statement-breakpoint
CREATE INDEX "idx_note_date" ON "finance"."credit_debit_note" USING btree ("posting_date");--> statement-breakpoint
CREATE INDEX "idx_note_org" ON "finance"."credit_debit_note" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "idx_note_line_note" ON "finance"."credit_debit_note_line" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "idx_note_line_item" ON "finance"."credit_debit_note_line" USING btree ("item_id");