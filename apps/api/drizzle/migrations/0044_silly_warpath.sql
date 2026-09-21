CREATE TABLE "finance"."sales_invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"job_order_reference" text,
	"invoice_date" timestamp with time zone NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"currency_code" text DEFAULT 'EGP' NOT NULL,
	"exchange_rate" numeric(12, 6) DEFAULT '1.000000' NOT NULL,
	"net_amount" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"tax_amount" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"grand_total" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_invoice_invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "sales_invoice_status_valid" CHECK ("finance"."sales_invoice"."status" in ('draft', 'posted', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "finance"."sales_invoice_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_invoice_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(24, 6) NOT NULL,
	"unit_price" numeric(18, 6) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '14.00' NOT NULL,
	"tax_amount" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"total_amount" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"delivery_order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance"."sales_invoice" ADD CONSTRAINT "sales_invoice_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "finance"."sales_invoice" ADD CONSTRAINT "sales_invoice_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "crm"."customer"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "finance"."sales_invoice_line" ADD CONSTRAINT "sales_invoice_line_sales_invoice_id_sales_invoice_id_fk" FOREIGN KEY ("sales_invoice_id") REFERENCES "finance"."sales_invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."sales_invoice_line" ADD CONSTRAINT "sales_invoice_line_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sales_invoice_customer" ON "finance"."sales_invoice" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_sales_invoice_date" ON "finance"."sales_invoice" USING btree ("invoice_date");--> statement-breakpoint
CREATE INDEX "idx_sales_invoice_due" ON "finance"."sales_invoice" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_sales_invoice_org" ON "finance"."sales_invoice" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "idx_sales_invoice_line_inv" ON "finance"."sales_invoice_line" USING btree ("sales_invoice_id");--> statement-breakpoint
CREATE INDEX "idx_sales_invoice_line_item" ON "finance"."sales_invoice_line" USING btree ("item_id");