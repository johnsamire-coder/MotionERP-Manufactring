CREATE TABLE "accounting"."accounting_dimension" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_node_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"mandatory_for_pnl" boolean DEFAULT false NOT NULL,
	"mandatory_for_balance_sheet" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounting_dimension_org_code_unique" UNIQUE("org_node_id","code")
);
--> statement-breakpoint
CREATE TABLE "accounting"."accounting_dimension_value" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dimension_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "accounting_dimension_value_code_unique" UNIQUE("dimension_id","code")
);
--> statement-breakpoint
CREATE TABLE "accounting"."journal_line_dimension" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_line_id" uuid NOT NULL,
	"dimension_id" uuid NOT NULL,
	"value_id" uuid NOT NULL,
	CONSTRAINT "journal_line_dimension_unique" UNIQUE("journal_line_id","dimension_id")
);
--> statement-breakpoint
ALTER TABLE "accounting"."chart_of_accounts" ADD COLUMN "balance_must_be" text;--> statement-breakpoint
ALTER TABLE "accounting"."chart_of_accounts" ADD COLUMN "is_frozen" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accounting"."company_accounting_config" ADD COLUMN "default_cost_center_id" uuid;--> statement-breakpoint
ALTER TABLE "accounting"."accounting_dimension" ADD CONSTRAINT "accounting_dimension_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounting"."accounting_dimension_value" ADD CONSTRAINT "accounting_dimension_value_dimension_id_accounting_dimension_id_fk" FOREIGN KEY ("dimension_id") REFERENCES "accounting"."accounting_dimension"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."journal_line_dimension" ADD CONSTRAINT "journal_line_dimension_journal_line_id_journal_line_id_fk" FOREIGN KEY ("journal_line_id") REFERENCES "accounting"."journal_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."journal_line_dimension" ADD CONSTRAINT "journal_line_dimension_dimension_id_accounting_dimension_id_fk" FOREIGN KEY ("dimension_id") REFERENCES "accounting"."accounting_dimension"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."journal_line_dimension" ADD CONSTRAINT "journal_line_dimension_value_id_accounting_dimension_value_id_fk" FOREIGN KEY ("value_id") REFERENCES "accounting"."accounting_dimension_value"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_journal_line_dimension_value" ON "accounting"."journal_line_dimension" USING btree ("value_id");--> statement-breakpoint
ALTER TABLE "accounting"."company_accounting_config" ADD CONSTRAINT "company_accounting_config_default_cost_center_id_cost_center_id_fk" FOREIGN KEY ("default_cost_center_id") REFERENCES "accounting"."cost_center"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_balance_must_be_valid" CHECK ("accounting"."chart_of_accounts"."balance_must_be" is null or "accounting"."chart_of_accounts"."balance_must_be" in ('debit', 'credit'));