CREATE SCHEMA "regional_eg";
--> statement-breakpoint
CREATE TABLE "regional_eg"."eta_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_invoice_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"payload" jsonb,
	"document_uuid" text,
	"signature" text,
	"submission_uuid" text,
	"problems" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"response" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eta_document_invoice_unique" UNIQUE("sales_invoice_id"),
	CONSTRAINT "eta_document_status_valid" CHECK ("regional_eg"."eta_document"."status" in ('draft', 'ready', 'signed', 'submitted', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "regional_eg"."eta_issuer_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_node_id" uuid NOT NULL,
	"rin" text NOT NULL,
	"name" text NOT NULL,
	"activity_code" text NOT NULL,
	"address" jsonb NOT NULL,
	"document_version" text DEFAULT '1.0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eta_issuer_org_unique" UNIQUE("org_node_id"),
	CONSTRAINT "eta_issuer_version_valid" CHECK ("regional_eg"."eta_issuer_config"."document_version" in ('0.9', '1.0'))
);
--> statement-breakpoint
CREATE TABLE "regional_eg"."eta_item_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"item_type" text DEFAULT 'EGS' NOT NULL,
	"item_code" text NOT NULL,
	"unit_type" text DEFAULT 'EA' NOT NULL,
	"tax_sub_type" text DEFAULT 'V009' NOT NULL,
	CONSTRAINT "eta_item_code_item_unique" UNIQUE("item_id"),
	CONSTRAINT "eta_item_type_valid" CHECK ("regional_eg"."eta_item_code"."item_type" in ('EGS', 'GS1'))
);
--> statement-breakpoint
CREATE TABLE "regional_eg"."eta_party_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"receiver_type" text NOT NULL,
	"tax_id" text,
	"name" text NOT NULL,
	"address" jsonb,
	CONSTRAINT "eta_party_customer_unique" UNIQUE("customer_id"),
	CONSTRAINT "eta_party_type_valid" CHECK ("regional_eg"."eta_party_profile"."receiver_type" in ('B', 'P', 'F'))
);
