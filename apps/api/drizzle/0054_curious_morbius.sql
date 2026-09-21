-- Migration number: 0054_curious_morbius
-- Created at: September 2026
-- Step 65: Accruals, Prepaids & Provisions Tables

-- Create Custom Enums
CREATE TYPE "public"."accrual_status" AS ENUM('draft', 'posted', 'reversed');
CREATE TYPE "public"."prepaid_status" AS ENUM('active', 'fully_amortized', 'cancelled');
CREATE TYPE "public"."provision_type" AS ENUM('warranty', 'bad_debt', 'legal', 'other');
CREATE TYPE "public"."provision_status" AS ENUM('draft', 'posted', 'utilized', 'reversed');

-- 1. Accrual Entry Table
CREATE TABLE IF NOT EXISTS "accrual_entry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entry_number" text NOT NULL,
  "company_id" uuid NOT NULL,
  "fiscal_year_id" uuid NOT NULL,
  "period_id" uuid NOT NULL,
  "accrual_date" date NOT NULL,
  "description" text NOT NULL,
  "expense_account_id" uuid NOT NULL,
  "liability_account_id" uuid NOT NULL,
  "cost_center_id" uuid,
  "amount" numeric(18, 4) NOT NULL,
  "status" "accrual_status" DEFAULT 'draft' NOT NULL,
  "journal_entry_id" uuid,
  "created_by" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "accrual_entry_entry_number_unique" UNIQUE("entry_number")
);

-- 2. Prepaid Expense Table
CREATE TABLE IF NOT EXISTS "prepaid_expense" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entry_number" text NOT NULL,
  "company_id" uuid NOT NULL,
  "fiscal_year_id" uuid NOT NULL,
  "period_id" uuid NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "description" text NOT NULL,
  "prepaid_account_id" uuid NOT NULL,
  "expense_account_id" uuid NOT NULL,
  "cost_center_id" uuid,
  "total_amount" numeric(18, 4) NOT NULL,
  "monthly_amount" numeric(18, 4) NOT NULL,
  "months_count" integer NOT NULL,
  "amortized_amount" numeric(18, 4) DEFAULT '0' NOT NULL,
  "remaining_amount" numeric(18, 4) NOT NULL,
  "status" "prepaid_status" DEFAULT 'active' NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "prepaid_expense_entry_number_unique" UNIQUE("entry_number")
);

-- 3. Provision Table
CREATE TABLE IF NOT EXISTS "provision" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provision_number" text NOT NULL,
  "company_id" uuid NOT NULL,
  "fiscal_year_id" uuid NOT NULL,
  "period_id" uuid NOT NULL,
  "provision_date" date NOT NULL,
  "provision_type" "provision_type" NOT NULL,
  "description" text NOT NULL,
  "expense_account_id" uuid NOT NULL,
  "provision_account_id" uuid NOT NULL,
  "cost_center_id" uuid,
  "base_amount" numeric(18, 4) NOT NULL,
  "rate_percentage" numeric(8, 4) NOT NULL,
  "provision_amount" numeric(18, 4) NOT NULL,
  "related_invoice_id" uuid,
  "warranty_months" integer,
  "status" "provision_status" DEFAULT 'draft' NOT NULL,
  "journal_entry_id" uuid,
  "created_by" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "provision_provision_number_unique" UNIQUE("provision_number")
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_accrual_company" ON "accrual_entry" ("company_id");
CREATE INDEX IF NOT EXISTS "idx_accrual_period" ON "accrual_entry" ("period_id");
CREATE INDEX IF NOT EXISTS "idx_prepaid_company" ON "prepaid_expense" ("company_id");
CREATE INDEX IF NOT EXISTS "idx_provision_company" ON "provision" ("company_id");
CREATE INDEX IF NOT EXISTS "idx_provision_type" ON "provision" ("provision_type");