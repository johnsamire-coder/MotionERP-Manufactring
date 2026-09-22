CREATE SCHEMA "tax";
--> statement-breakpoint
CREATE TYPE "tax"."customs_status" AS ENUM('draft', 'cleared', 'capitalized');--> statement-breakpoint
CREATE TYPE "tax"."tax_settlement_status" AS ENUM('draft', 'filed', 'paid');--> statement-breakpoint
CREATE TYPE "tax"."wht_direction" AS ENUM('deducted_by_us', 'deducted_from_us');--> statement-breakpoint
CREATE TYPE "tax"."wht_status" AS ENUM('recorded', 'declared', 'settled');--> statement-breakpoint
CREATE TABLE "tax"."customs_declaration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"declaration_number" text NOT NULL,
	"company_id" uuid NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"declaration_date" date NOT NULL,
	"port_name" text NOT NULL,
	"bill_of_lading" text NOT NULL,
	"supplier_name" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"exchange_rate" numeric(12, 4) NOT NULL,
	"cif_value_foreign" numeric(18, 4) NOT NULL,
	"cif_value_egp" numeric(18, 4) NOT NULL,
	"customs_duty_amount" numeric(18, 4) NOT NULL,
	"development_fee" numeric(18, 4) DEFAULT '0' NOT NULL,
	"vat_paid_at_customs" numeric(18, 4) NOT NULL,
	"clearance_expenses" numeric(18, 4) DEFAULT '0' NOT NULL,
	"total_paid_amount" numeric(18, 4) NOT NULL,
	"status" "tax"."customs_status" DEFAULT 'draft' NOT NULL,
	"landed_cost_voucher_id" uuid,
	"journal_entry_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customs_declaration_declaration_number_unique" UNIQUE("declaration_number")
);
--> statement-breakpoint
CREATE TABLE "tax"."tax_settlement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_number" text NOT NULL,
	"company_id" uuid NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"tax_period" text NOT NULL,
	"total_sales_taxable" numeric(18, 4) NOT NULL,
	"output_vat_amount" numeric(18, 4) NOT NULL,
	"total_purchase_taxable" numeric(18, 4) NOT NULL,
	"input_vat_amount" numeric(18, 4) NOT NULL,
	"net_vat_payable" numeric(18, 4) NOT NULL,
	"status" "tax"."tax_settlement_status" DEFAULT 'draft' NOT NULL,
	"payment_reference" text,
	"payment_date" date,
	"journal_entry_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tax_settlement_settlement_number_unique" UNIQUE("settlement_number")
);
--> statement-breakpoint
CREATE TABLE "tax"."withholding_tax_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_number" text NOT NULL,
	"company_id" uuid NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"quarter" integer NOT NULL,
	"entry_date" date NOT NULL,
	"direction" "tax"."wht_direction" NOT NULL,
	"partner_id" uuid NOT NULL,
	"partner_name" text NOT NULL,
	"tax_registration_num" text NOT NULL,
	"invoice_id" uuid,
	"invoice_number" text NOT NULL,
	"base_amount" numeric(18, 4) NOT NULL,
	"wht_rate" numeric(5, 2) NOT NULL,
	"wht_amount" numeric(18, 4) NOT NULL,
	"status" "tax"."wht_status" DEFAULT 'recorded' NOT NULL,
	"form41_batch_number" text,
	"journal_entry_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "withholding_tax_entry_entry_number_unique" UNIQUE("entry_number")
);
