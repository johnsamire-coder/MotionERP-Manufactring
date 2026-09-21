CREATE TABLE "finance"."bank_reconciliation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reconciliation_number" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"statement_date" timestamp with time zone NOT NULL,
	"statement_balance" numeric(14, 4) NOT NULL,
	"cleared_balance" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"difference_amount" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_reconciliation_reconciliation_number_unique" UNIQUE("reconciliation_number"),
	CONSTRAINT "bank_reconciliation_status_valid" CHECK ("finance"."bank_reconciliation"."status" in ('draft', 'reconciled', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "finance"."bank_transfer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_number" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"from_account_id" uuid NOT NULL,
	"to_account_id" uuid NOT NULL,
	"transfer_date" timestamp with time zone NOT NULL,
	"amount" numeric(14, 4) NOT NULL,
	"reference_number" text,
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_transfer_transfer_number_unique" UNIQUE("transfer_number"),
	CONSTRAINT "bank_transfer_amount_positive" CHECK ("finance"."bank_transfer"."amount" > 0),
	CONSTRAINT "bank_transfer_status_valid" CHECK ("finance"."bank_transfer"."status" in ('draft', 'posted', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "finance"."bank_reconciliation" ADD CONSTRAINT "bank_reconciliation_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "finance"."bank_reconciliation" ADD CONSTRAINT "bank_reconciliation_bank_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."bank_transfer" ADD CONSTRAINT "bank_transfer_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "finance"."bank_transfer" ADD CONSTRAINT "bank_transfer_from_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("from_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."bank_transfer" ADD CONSTRAINT "bank_transfer_to_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bank_reconciliation_bank" ON "finance"."bank_reconciliation" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "idx_bank_reconciliation_date" ON "finance"."bank_reconciliation" USING btree ("statement_date");--> statement-breakpoint
CREATE INDEX "idx_bank_transfer_from" ON "finance"."bank_transfer" USING btree ("from_account_id");--> statement-breakpoint
CREATE INDEX "idx_bank_transfer_to" ON "finance"."bank_transfer" USING btree ("to_account_id");--> statement-breakpoint
CREATE INDEX "idx_bank_transfer_date" ON "finance"."bank_transfer" USING btree ("transfer_date");