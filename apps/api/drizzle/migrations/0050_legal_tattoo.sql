CREATE TABLE "inventory"."landed_cost_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_id" uuid NOT NULL,
	"receipt_movement_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"quantity" numeric(24, 6) NOT NULL,
	"original_rate" numeric(18, 6) NOT NULL,
	"allocated_expense" numeric(14, 4) NOT NULL,
	"new_valuation_rate" numeric(18, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."landed_cost_voucher" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_number" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"posting_date" timestamp with time zone NOT NULL,
	"total_expense_amount" numeric(14, 4) NOT NULL,
	"distribute_method" text DEFAULT 'by_amount' NOT NULL,
	"expense_account_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "landed_cost_voucher_voucher_number_unique" UNIQUE("voucher_number"),
	CONSTRAINT "landed_cost_voucher_status_valid" CHECK ("inventory"."landed_cost_voucher"."status" in ('draft', 'posted', 'cancelled')),
	CONSTRAINT "landed_cost_distribute_valid" CHECK ("inventory"."landed_cost_voucher"."distribute_method" in ('by_amount', 'by_quantity')),
	CONSTRAINT "landed_cost_expense_positive" CHECK ("inventory"."landed_cost_voucher"."total_expense_amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "inventory"."landed_cost_item" ADD CONSTRAINT "landed_cost_item_voucher_id_landed_cost_voucher_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "inventory"."landed_cost_voucher"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."landed_cost_item" ADD CONSTRAINT "landed_cost_item_receipt_movement_id_stock_movement_id_fk" FOREIGN KEY ("receipt_movement_id") REFERENCES "inventory"."stock_movement"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."landed_cost_item" ADD CONSTRAINT "landed_cost_item_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."landed_cost_item" ADD CONSTRAINT "landed_cost_item_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."landed_cost_voucher" ADD CONSTRAINT "landed_cost_voucher_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."landed_cost_voucher" ADD CONSTRAINT "landed_cost_voucher_expense_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_landed_cost_item_voucher" ON "inventory"."landed_cost_item" USING btree ("voucher_id");--> statement-breakpoint
CREATE INDEX "idx_landed_cost_item_movement" ON "inventory"."landed_cost_item" USING btree ("receipt_movement_id");--> statement-breakpoint
CREATE INDEX "idx_landed_cost_org" ON "inventory"."landed_cost_voucher" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "idx_landed_cost_date" ON "inventory"."landed_cost_voucher" USING btree ("posting_date");