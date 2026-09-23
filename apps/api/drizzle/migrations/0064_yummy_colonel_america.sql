ALTER TABLE "crm"."supplier" ADD COLUMN "hold_type" text;--> statement-breakpoint
ALTER TABLE "crm"."supplier" ADD COLUMN "hold_reason" text;--> statement-breakpoint
ALTER TABLE "crm"."supplier" ADD COLUMN "hold_release_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "crm"."supplier" ADD CONSTRAINT "supplier_hold_type_valid" CHECK ("crm"."supplier"."hold_type" is null or "crm"."supplier"."hold_type" in ('all', 'invoices', 'payments'));