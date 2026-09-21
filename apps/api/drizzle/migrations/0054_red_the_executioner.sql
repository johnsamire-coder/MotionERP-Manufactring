CREATE SCHEMA "accrual";
--> statement-breakpoint
CREATE TABLE "accrual"."accrued_expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_number" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"expense_account_id" uuid NOT NULL,
	"accrued_liability_account_id" uuid NOT NULL,
	"accrual_date" timestamp with time zone NOT NULL,
	"reversal_date" timestamp with time zone,
	"amount" numeric(14, 4) NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'accrued' NOT NULL,
	"journal_entry_id" uuid,
	"reversal_journal_entry_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accrued_expense_voucher_number_unique" UNIQUE("voucher_number"),
	CONSTRAINT "accrued_expense_status_valid" CHECK ("accrual"."accrued_expense"."status" in ('accrued', 'reversed', 'cancelled')),
	CONSTRAINT "accrued_expense_amount_positive" CHECK ("accrual"."accrued_expense"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "accrual"."prepaid_expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_number" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"prepaid_asset_account_id" uuid NOT NULL,
	"expense_account_id" uuid NOT NULL,
	"payment_date" timestamp with time zone NOT NULL,
	"coverage_start_date" timestamp with time zone NOT NULL,
	"coverage_end_date" timestamp with time zone NOT NULL,
	"total_amount" numeric(14, 4) NOT NULL,
	"monthly_amortization" numeric(14, 4) NOT NULL,
	"consumed_amount" numeric(14, 4) DEFAULT '0' NOT NULL,
	"remaining_amount" numeric(14, 4) NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"description" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prepaid_expense_voucher_number_unique" UNIQUE("voucher_number"),
	CONSTRAINT "prepaid_expense_status_valid" CHECK ("accrual"."prepaid_expense"."status" in ('active', 'fully_consumed', 'cancelled')),
	CONSTRAINT "prepaid_expense_amount_positive" CHECK ("accrual"."prepaid_expense"."total_amount" > 0),
	CONSTRAINT "prepaid_expense_dates_valid" CHECK ("accrual"."prepaid_expense"."coverage_end_date" > "accrual"."prepaid_expense"."coverage_start_date")
);
--> statement-breakpoint
CREATE TABLE "accrual"."warranty_provision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provision_number" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"warranty_expense_account_id" uuid NOT NULL,
	"provision_liability_account_id" uuid NOT NULL,
	"provision_date" timestamp with time zone NOT NULL,
	"sales_invoice_id" uuid,
	"base_amount" numeric(14, 4) NOT NULL,
	"provision_rate" numeric(5, 2) NOT NULL,
	"provision_amount" numeric(14, 4) NOT NULL,
	"utilized_amount" numeric(14, 4) DEFAULT '0' NOT NULL,
	"remaining_amount" numeric(14, 4) NOT NULL,
	"warranty_expiry_date" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"description" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warranty_provision_provision_number_unique" UNIQUE("provision_number"),
	CONSTRAINT "warranty_provision_status_valid" CHECK ("accrual"."warranty_provision"."status" in ('active', 'fully_utilized', 'expired', 'cancelled')),
	CONSTRAINT "warranty_provision_rate_valid" CHECK ("accrual"."warranty_provision"."provision_rate" > 0 AND "accrual"."warranty_provision"."provision_rate" <= 100),
	CONSTRAINT "warranty_provision_amount_positive" CHECK ("accrual"."warranty_provision"."provision_amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "accrual"."accrued_expense" ADD CONSTRAINT "accrued_expense_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accrual"."accrued_expense" ADD CONSTRAINT "accrued_expense_expense_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accrual"."accrued_expense" ADD CONSTRAINT "accrued_expense_accrued_liability_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("accrued_liability_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accrual"."prepaid_expense" ADD CONSTRAINT "prepaid_expense_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accrual"."prepaid_expense" ADD CONSTRAINT "prepaid_expense_prepaid_asset_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("prepaid_asset_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accrual"."prepaid_expense" ADD CONSTRAINT "prepaid_expense_expense_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accrual"."warranty_provision" ADD CONSTRAINT "warranty_provision_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accrual"."warranty_provision" ADD CONSTRAINT "warranty_provision_warranty_expense_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("warranty_expense_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accrual"."warranty_provision" ADD CONSTRAINT "warranty_provision_provision_liability_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("provision_liability_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accrued_expense_org" ON "accrual"."accrued_expense" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "idx_accrued_expense_date" ON "accrual"."accrued_expense" USING btree ("accrual_date");--> statement-breakpoint
CREATE INDEX "idx_prepaid_expense_org" ON "accrual"."prepaid_expense" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "idx_prepaid_expense_dates" ON "accrual"."prepaid_expense" USING btree ("coverage_start_date","coverage_end_date");--> statement-breakpoint
CREATE INDEX "idx_warranty_provision_org" ON "accrual"."warranty_provision" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "idx_warranty_provision_date" ON "accrual"."warranty_provision" USING btree ("provision_date");