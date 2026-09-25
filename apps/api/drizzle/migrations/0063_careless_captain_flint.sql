CREATE TABLE "sales"."rfq" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_number" text NOT NULL,
	"org_node_id" uuid,
	"rfq_date" timestamp with time zone NOT NULL,
	"respond_by" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"material_request_reference" text,
	"awarded_supplier_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rfq_number_unique" UNIQUE("rfq_number"),
	CONSTRAINT "rfq_status_valid" CHECK ("sales"."rfq"."status" in ('draft', 'sent', 'closed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "sales"."rfq_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(24, 6) NOT NULL,
	"line_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rfq_line_item_unique" UNIQUE("rfq_id","item_id"),
	CONSTRAINT "rfq_line_quantity_positive" CHECK ("sales"."rfq_line"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "sales"."rfq_supplier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"quotation_id" uuid,
	"responded_at" timestamp with time zone,
	CONSTRAINT "rfq_supplier_unique" UNIQUE("rfq_id","supplier_id"),
	CONSTRAINT "rfq_supplier_status_valid" CHECK ("sales"."rfq_supplier"."status" in ('pending', 'received', 'declined'))
);
--> statement-breakpoint
ALTER TABLE "sales"."rfq_line" ADD CONSTRAINT "rfq_line_rfq_id_rfq_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "sales"."rfq"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales"."rfq_supplier" ADD CONSTRAINT "rfq_supplier_rfq_id_rfq_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "sales"."rfq"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales"."rfq_supplier" ADD CONSTRAINT "rfq_supplier_quotation_id_quotation_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "sales"."quotation"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "rfq_line_rfq_idx" ON "sales"."rfq_line" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX "rfq_supplier_rfq_idx" ON "sales"."rfq_supplier" USING btree ("rfq_id");