CREATE TABLE "finance"."purchase_invoice" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
"invoice_number" text NOT NULL,
"system_number" text NOT NULL,
"org_node_id" uuid NOT NULL,
"supplier_id" uuid NOT NULL,
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
CONSTRAINT "purchase_invoice_system_number_unique" UNIQUE("system_number"),
CONSTRAINT "purchase_invoice_supplier_inv_unique" UNIQUE("supplier_id","invoice_number"),
CONSTRAINT "purchase_invoice_status_valid" CHECK ("finance"."purchase_invoice"."status" in ('draft', 'posted', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "finance"."purchase_invoice_line" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
"purchase_invoice_id" uuid NOT NULL,
"item_id" uuid NOT NULL,
"quantity" numeric(24, 6) NOT NULL,
"unit_cost" numeric(18, 6) NOT NULL,
"tax_rate" numeric(5, 2) DEFAULT '14.00' NOT NULL,
"tax_amount" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
"total_amount" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
"purchase_receipt_id" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance"."purchase_invoice" ADD CONSTRAINT "purchase_invoice_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "finance"."purchase_invoice" ADD CONSTRAINT "purchase_invoice_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "crm"."supplier"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "finance"."purchase_invoice_line" ADD CONSTRAINT "purchase_invoice_line_purchase_invoice_id_purchase_invoice_id_fk" FOREIGN KEY ("purchase_invoice_id") REFERENCES "finance"."purchase_invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."purchase_invoice_line" ADD CONSTRAINT "purchase_invoice_line_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_purchase_invoice_supplier" ON "finance"."purchase_invoice" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_invoice_date" ON "finance"."purchase_invoice" USING btree ("invoice_date");--> statement-breakpoint
CREATE INDEX "idx_purchase_invoice_due" ON "finance"."purchase_invoice" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_purchase_invoice_org" ON "finance"."purchase_invoice" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_invoice_line_inv" ON "finance"."purchase_invoice_line" USING btree ("purchase_invoice_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_invoice_line_item" ON "finance"."purchase_invoice_line" USING btree ("item_id");