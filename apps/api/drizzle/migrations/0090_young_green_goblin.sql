CREATE TABLE "accounting"."budget" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_node_id" uuid NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"cost_center_id" uuid,
	"amount" numeric(18, 4) NOT NULL,
	"monthly_percentages" text,
	"action_if_exceeded" text DEFAULT 'stop' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_fy_account_cc_unique" UNIQUE NULLS NOT DISTINCT("fiscal_year_id","account_id","cost_center_id"),
	CONSTRAINT "budget_amount_non_negative" CHECK ("accounting"."budget"."amount" >= 0),
	CONSTRAINT "budget_action_valid" CHECK ("accounting"."budget"."action_if_exceeded" in ('stop', 'warn', 'ignore'))
);
--> statement-breakpoint
ALTER TABLE "accounting"."budget" ADD CONSTRAINT "budget_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounting"."budget" ADD CONSTRAINT "budget_fiscal_year_id_fiscal_year_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "accounting"."fiscal_year"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."budget" ADD CONSTRAINT "budget_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting"."budget" ADD CONSTRAINT "budget_cost_center_id_cost_center_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "accounting"."cost_center"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_budget_account" ON "accounting"."budget" USING btree ("account_id");