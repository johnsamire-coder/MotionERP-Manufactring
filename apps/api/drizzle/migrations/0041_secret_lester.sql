CREATE TABLE "accounting"."account_determination" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_node_id" uuid NOT NULL,
	"determination_type" text NOT NULL,
	"reference_id" uuid,
	"account_purpose" text NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_det_type_valid" CHECK ("accounting"."account_determination"."determination_type" in ('item_category', 'warehouse', 'default')),
	CONSTRAINT "account_det_purpose_valid" CHECK ("accounting"."account_determination"."account_purpose" in ('inventory', 'cogs', 'revenue', 'wip', 'purchase', 'scrap', 'stock_adjustment', 'input_tax', 'output_tax', 'payable', 'receivable'))
);
--> statement-breakpoint
CREATE TABLE "accounting"."accounting_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"period_number" integer NOT NULL,
	"name" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounting_period_fy_number_unique" UNIQUE("fiscal_year_id","period_number"),
	CONSTRAINT "accounting_period_status_valid" CHECK ("accounting"."accounting_period"."status" in ('open', 'closed', 'locked')),
	CONSTRAINT "accounting_period_dates_valid" CHECK ("accounting"."accounting_period"."end_date" >= "accounting"."accounting_period"."start_date")
);
--> statement-breakpoint
CREATE TABLE "accounting"."company_accounting_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_node_id" uuid NOT NULL,
	"base_currency" text DEFAULT 'EGP' NOT NULL,
	"inventory_valuation_method" text DEFAULT 'weighted_average' NOT NULL,
	"default_grni_account_id" uuid,
	"default_wip_account_id" uuid,
	"default_cogs_account_id" uuid,
	"default_mfg_variance_account_id" uuid,
	"default_payable_account_id" uuid,
	"default_receivable_account_id" uuid,
	"default_input_tax_account_id" uuid,
	"default_output_tax_account_id" uuid,
	"default_scrap_account_id" uuid,
	"default_stock_adjustment_account_id" uuid,
	"default_oh_applied_account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_accounting_config_org_node_id_unique" UNIQUE("org_node_id"),
	CONSTRAINT "company_config_valuation_valid" CHECK ("accounting"."company_accounting_config"."inventory_valuation_method" in ('weighted_average', 'fifo', 'standard'))
);
--> statement-breakpoint
CREATE TABLE "accounting"."cost_center" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_node_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"is_group" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cost_center_org_code_unique" UNIQUE("org_node_id","code")
);
--> statement-breakpoint
CREATE TABLE "accounting"."fiscal_year" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_node_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fiscal_year_org_name_unique" UNIQUE("org_node_id","name"),
	CONSTRAINT "fiscal_year_dates_valid" CHECK ("accounting"."fiscal_year"."end_date" > "accounting"."fiscal_year"."start_date")
);
--> statement-breakpoint
ALTER TABLE "accounting"."journal_entry" ADD COLUMN "fiscal_year_id" uuid;--> statement-breakpoint
ALTER TABLE "accounting"."journal_entry" ADD COLUMN "period_id" uuid;--> statement-breakpoint
ALTER TABLE "accounting"."journal_entry" ADD COLUMN "is_auto_generated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accounting"."journal_entry" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "accounting"."journal_entry" ADD COLUMN "source_event_type" text;--> statement-breakpoint
ALTER TABLE "accounting"."journal_line" ADD COLUMN "party_type" text;--> statement-breakpoint
ALTER TABLE "accounting"."journal_line" ADD COLUMN "party_id" uuid;--> statement-breakpoint
ALTER TABLE "accounting"."journal_line" ADD COLUMN "cost_center_id" uuid;--> statement-breakpoint
ALTER TABLE "accounting"."journal_line" ADD COLUMN "job_order_id" uuid;--> statement-breakpoint
ALTER TABLE "accounting"."account_determination" ADD CONSTRAINT "account_determination_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounting"."account_determination" ADD CONSTRAINT "account_determination_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."accounting_period" ADD CONSTRAINT "accounting_period_fiscal_year_id_fiscal_year_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "accounting"."fiscal_year"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."company_accounting_config" ADD CONSTRAINT "company_accounting_config_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounting"."company_accounting_config" ADD CONSTRAINT "company_accounting_config_default_grni_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_grni_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."company_accounting_config" ADD CONSTRAINT "company_accounting_config_default_wip_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_wip_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."company_accounting_config" ADD CONSTRAINT "company_accounting_config_default_cogs_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_cogs_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."company_accounting_config" ADD CONSTRAINT "company_accounting_config_default_mfg_variance_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_mfg_variance_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."company_accounting_config" ADD CONSTRAINT "company_accounting_config_default_payable_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_payable_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."company_accounting_config" ADD CONSTRAINT "company_accounting_config_default_receivable_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_receivable_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."company_accounting_config" ADD CONSTRAINT "company_accounting_config_default_input_tax_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_input_tax_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."company_accounting_config" ADD CONSTRAINT "company_accounting_config_default_output_tax_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_output_tax_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."company_accounting_config" ADD CONSTRAINT "company_accounting_config_default_scrap_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_scrap_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."company_accounting_config" ADD CONSTRAINT "company_accounting_config_default_stock_adjustment_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_stock_adjustment_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."company_accounting_config" ADD CONSTRAINT "company_accounting_config_default_oh_applied_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_oh_applied_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."cost_center" ADD CONSTRAINT "cost_center_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounting"."cost_center" ADD CONSTRAINT "cost_center_parent_id_cost_center_id_fk" FOREIGN KEY ("parent_id") REFERENCES "accounting"."cost_center"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."fiscal_year" ADD CONSTRAINT "fiscal_year_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_account_det_org" ON "accounting"."account_determination" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "idx_account_det_type_ref" ON "accounting"."account_determination" USING btree ("determination_type","reference_id");--> statement-breakpoint
CREATE INDEX "idx_accounting_period_fy" ON "accounting"."accounting_period" USING btree ("fiscal_year_id");--> statement-breakpoint
CREATE INDEX "idx_cost_center_org_node" ON "accounting"."cost_center" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "idx_cost_center_parent" ON "accounting"."cost_center" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_fiscal_year_org_node" ON "accounting"."fiscal_year" USING btree ("org_node_id");--> statement-breakpoint
ALTER TABLE "accounting"."journal_entry" ADD CONSTRAINT "journal_entry_fiscal_year_id_fiscal_year_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "accounting"."fiscal_year"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."journal_entry" ADD CONSTRAINT "journal_entry_period_id_accounting_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "accounting"."accounting_period"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."journal_line" ADD CONSTRAINT "journal_line_cost_center_id_cost_center_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "accounting"."cost_center"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_journal_entry_fy" ON "accounting"."journal_entry" USING btree ("fiscal_year_id");--> statement-breakpoint
CREATE INDEX "idx_journal_entry_period" ON "accounting"."journal_entry" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "idx_journal_line_cost_center" ON "accounting"."journal_line" USING btree ("cost_center_id");--> statement-breakpoint
CREATE INDEX "idx_journal_line_party" ON "accounting"."journal_line" USING btree ("party_type","party_id");--> statement-breakpoint
ALTER TABLE "accounting"."journal_entry" ADD CONSTRAINT "journal_entry_idempotency_key_unique" UNIQUE("idempotency_key");--> statement-breakpoint
ALTER TABLE "accounting"."journal_line" ADD CONSTRAINT "journal_line_party_type_valid" CHECK ("accounting"."journal_line"."party_type" is null or "accounting"."journal_line"."party_type" in ('customer', 'supplier'));