CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE TYPE "inventory"."batch_quarantine_status" AS ENUM('pending_inspection', 'quarantined', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "sales"."serial_device_status" AS ENUM('allocated', 'delivered', 'installed', 'warranty_active', 'warranty_expired', 'returned');--> statement-breakpoint
CREATE TABLE "audit"."audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_name" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"performed_by" uuid,
	"performed_by_name" text,
	"company_id" uuid,
	"ip_address" text,
	"user_agent" text,
	"old_values" text,
	"new_values" text,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."purchase_line_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_invoice_id" uuid NOT NULL,
	"purchase_invoice_line_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"batch_id" uuid,
	"batch_number" text NOT NULL,
	"manufacturing_date" date,
	"expiry_date" date,
	"received_qty" numeric(18, 4) NOT NULL,
	"accepted_qty" numeric(18, 4) DEFAULT '0' NOT NULL,
	"rejected_qty" numeric(18, 4) DEFAULT '0' NOT NULL,
	"supplier_batch_ref" text,
	"certificate_number" text,
	"quarantine_status" "inventory"."batch_quarantine_status" DEFAULT 'pending_inspection' NOT NULL,
	"inspection_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales"."sales_line_serial" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_invoice_id" uuid NOT NULL,
	"sales_invoice_line_id" uuid NOT NULL,
	"delivery_note_id" uuid,
	"customer_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"serial_number" text NOT NULL,
	"batch_number" text,
	"warranty_months" integer DEFAULT 12 NOT NULL,
	"warranty_start_date" date,
	"warranty_end_date" date,
	"hospital_department" text,
	"installation_date" date,
	"installed_by" text,
	"notes" text,
	"status" "sales"."serial_device_status" DEFAULT 'allocated' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
