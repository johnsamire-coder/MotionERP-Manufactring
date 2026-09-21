CREATE TABLE "accounting"."depreciation_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"period_id" uuid,
	"entry_date" timestamp with time zone NOT NULL,
	"depreciation_amount" numeric(14, 4) NOT NULL,
	"accumulated_amount_after" numeric(14, 4) NOT NULL,
	"journal_entry_id" uuid,
	"status" text DEFAULT 'posted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounting"."fixed_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_code" text NOT NULL,
	"asset_name" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"purchase_date" timestamp with time zone NOT NULL,
	"purchase_cost" numeric(14, 4) NOT NULL,
	"useful_life_months" integer NOT NULL,
	"salvage_value" numeric(14, 4) DEFAULT '0' NOT NULL,
	"depreciation_method" text DEFAULT 'straight_line' NOT NULL,
	"asset_account_id" uuid NOT NULL,
	"accumulated_depreciation_account_id" uuid NOT NULL,
	"depreciation_expense_account_id" uuid NOT NULL,
	"cost_center_id" uuid,
	"total_depreciated" numeric(14, 4) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fixed_asset_org_code_unique" UNIQUE("org_node_id","asset_code"),
	CONSTRAINT "fixed_asset_cost_positive" CHECK ("accounting"."fixed_asset"."purchase_cost" > 0),
	CONSTRAINT "fixed_asset_life_positive" CHECK ("accounting"."fixed_asset"."useful_life_months" > 0),
	CONSTRAINT "fixed_asset_status_valid" CHECK ("accounting"."fixed_asset"."status" in ('active', 'fully_depreciated', 'disposed'))
);
--> statement-breakpoint
ALTER TABLE "accounting"."depreciation_entry" ADD CONSTRAINT "depreciation_entry_asset_id_fixed_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "accounting"."fixed_asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."depreciation_entry" ADD CONSTRAINT "depreciation_entry_period_id_accounting_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "accounting"."accounting_period"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."depreciation_entry" ADD CONSTRAINT "depreciation_entry_journal_entry_id_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "accounting"."journal_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."fixed_asset" ADD CONSTRAINT "fixed_asset_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounting"."fixed_asset" ADD CONSTRAINT "fixed_asset_asset_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("asset_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."fixed_asset" ADD CONSTRAINT "fixed_asset_accumulated_depreciation_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("accumulated_depreciation_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."fixed_asset" ADD CONSTRAINT "fixed_asset_depreciation_expense_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("depreciation_expense_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."fixed_asset" ADD CONSTRAINT "fixed_asset_cost_center_id_cost_center_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "accounting"."cost_center"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_depreciation_asset" ON "accounting"."depreciation_entry" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "idx_depreciation_period" ON "accounting"."depreciation_entry" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "idx_fixed_asset_org" ON "accounting"."fixed_asset" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "idx_fixed_asset_cost_center" ON "accounting"."fixed_asset" USING btree ("cost_center_id");--> statement-breakpoint
ALTER TABLE "accounting"."journal_line" DROP COLUMN "updated_at";