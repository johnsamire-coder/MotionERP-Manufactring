CREATE TABLE "sales"."job_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_order_number" text NOT NULL,
	"source" text NOT NULL,
	"quotation_reference" text,
	"customer_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"financial_review_passed" text DEFAULT 'false' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_order_number_unique" UNIQUE("job_order_number"),
	CONSTRAINT "job_order_source_valid" CHECK ("sales"."job_order"."source" in ('quotation', 'internal')),
	CONSTRAINT "job_order_status_valid" CHECK ("sales"."job_order"."status" in ('draft', 'approved', 'in_progress', 'completed', 'cancelled')),
	CONSTRAINT "job_order_financial_review_valid" CHECK ("sales"."job_order"."financial_review_passed" in ('true', 'false'))
);
--> statement-breakpoint
ALTER TABLE "sales"."job_order" ADD CONSTRAINT "job_order_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "crm"."customer"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "job_order_customer_idx" ON "sales"."job_order" USING btree ("customer_id");
--> statement-breakpoint
-- JOB ORDER UPDATED_AT TRIGGER
CREATE TRIGGER "sales_job_order_set_updated_at"
    BEFORE UPDATE ON "sales"."job_order"
    FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();
