CREATE SCHEMA "accounting";
--> statement-breakpoint
CREATE SCHEMA "finance";
--> statement-breakpoint
CREATE TABLE "accounting"."account_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"normal_balance" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_type_code_unique" UNIQUE("code"),
	CONSTRAINT "account_type_normal_balance_valid" CHECK ("accounting"."account_type"."normal_balance" in ('debit', 'credit'))
);
--> statement-breakpoint
CREATE TABLE "accounting"."chart_of_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"account_type_id" uuid NOT NULL,
	"parent_id" uuid,
	"is_leaf" text DEFAULT 'yes' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chart_of_accounts_code_unique" UNIQUE("code"),
	CONSTRAINT "chart_of_accounts_is_leaf_valid" CHECK ("accounting"."chart_of_accounts"."is_leaf" in ('yes', 'no')),
	CONSTRAINT "chart_of_accounts_status_valid" CHECK ("accounting"."chart_of_accounts"."status" in ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "accounting"."journal_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_number" text NOT NULL,
	"reference" text,
	"description" text NOT NULL,
	"entry_date" timestamp with time zone NOT NULL,
	"posted_at" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_entry_entry_number_unique" UNIQUE("entry_number"),
	CONSTRAINT "journal_entry_status_valid" CHECK ("accounting"."journal_entry"."status" in ('draft', 'posted', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "accounting"."journal_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"debit_amount" numeric(12, 4) DEFAULT '0' NOT NULL,
	"credit_amount" numeric(12, 4) DEFAULT '0' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_line_amounts_valid" CHECK ("accounting"."journal_line"."debit_amount" >= 0 AND "accounting"."journal_line"."credit_amount" >= 0 AND ("accounting"."journal_line"."debit_amount" > 0 OR "accounting"."journal_line"."credit_amount" > 0))
);
--> statement-breakpoint
CREATE TABLE "finance"."collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_order_reference" text NOT NULL,
	"collection_number" text NOT NULL,
	"collection_date" timestamp with time zone NOT NULL,
	"amount" numeric(12, 4) NOT NULL,
	"currency_code" text DEFAULT 'EGP' NOT NULL,
	"payment_method" text NOT NULL,
	"reference_number" text,
	"notes" text,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_collection_number_unique" UNIQUE("collection_number"),
	CONSTRAINT "collection_payment_method_valid" CHECK ("finance"."collection"."payment_method" in ('cash', 'bank_transfer', 'check', 'credit_card')),
	CONSTRAINT "collection_status_valid" CHECK ("finance"."collection"."status" in ('pending', 'completed', 'cancelled')),
	CONSTRAINT "collection_amount_positive" CHECK ("finance"."collection"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "finance"."retention" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_order_reference" text NOT NULL,
	"retention_number" text NOT NULL,
	"original_amount" numeric(12, 4) NOT NULL,
	"released_amount" numeric(12, 4) DEFAULT '0' NOT NULL,
	"currency_code" text DEFAULT 'EGP' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"release_date" timestamp with time zone,
	"due_date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retention_retention_number_unique" UNIQUE("retention_number"),
	CONSTRAINT "retention_status_valid" CHECK ("finance"."retention"."status" in ('active', 'released', 'expired', 'cancelled')),
	CONSTRAINT "retention_amounts_valid" CHECK ("finance"."retention"."original_amount" > 0 AND "finance"."retention"."released_amount" >= 0 AND "finance"."retention"."released_amount" <= "finance"."retention"."original_amount")
);
--> statement-breakpoint
ALTER TABLE "accounting"."chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_account_type_id_account_type_id_fk" FOREIGN KEY ("account_type_id") REFERENCES "accounting"."account_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_parent_id_chart_of_accounts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."journal_line" ADD CONSTRAINT "journal_line_journal_entry_id_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "accounting"."journal_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."journal_line" ADD CONSTRAINT "journal_line_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chart_of_accounts_parent" ON "accounting"."chart_of_accounts" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_chart_of_accounts_type" ON "accounting"."chart_of_accounts" USING btree ("account_type_id");--> statement-breakpoint
CREATE INDEX "idx_journal_entry_reference" ON "accounting"."journal_entry" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "idx_journal_entry_date" ON "accounting"."journal_entry" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "idx_journal_line_entry" ON "accounting"."journal_line" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "idx_journal_line_account" ON "accounting"."journal_line" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_collection_job_order" ON "finance"."collection" USING btree ("job_order_reference");--> statement-breakpoint
CREATE INDEX "idx_collection_number" ON "finance"."collection" USING btree ("collection_number");--> statement-breakpoint
CREATE INDEX "idx_collection_date" ON "finance"."collection" USING btree ("collection_date");--> statement-breakpoint
CREATE INDEX "idx_retention_job_order" ON "finance"."retention" USING btree ("job_order_reference");--> statement-breakpoint
CREATE INDEX "idx_retention_number" ON "finance"."retention" USING btree ("retention_number");--> statement-breakpoint
CREATE INDEX "idx_retention_due_date" ON "finance"."retention" USING btree ("due_date");