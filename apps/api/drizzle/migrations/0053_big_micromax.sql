CREATE TABLE "production_ops"."subcontracting_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subcontracting_order_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"quantity" numeric(24, 6) NOT NULL,
	"raw_material_cost" numeric(14, 4) DEFAULT '0.0000' NOT NULL,
	"service_rate" numeric(14, 4) NOT NULL,
	"new_valuation_rate" numeric(18, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_ops"."subcontracting_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_number" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"work_order_id" uuid,
	"posting_date" timestamp with time zone NOT NULL,
	"total_service_cost" numeric(14, 4) NOT NULL,
	"service_account_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subcontracting_order_voucher_number_unique" UNIQUE("voucher_number"),
	CONSTRAINT "subcontracting_order_status_valid" CHECK ("production_ops"."subcontracting_order"."status" in ('draft', 'posted', 'cancelled')),
	CONSTRAINT "subcontracting_service_cost_positive" CHECK ("production_ops"."subcontracting_order"."total_service_cost" > 0)
);
--> statement-breakpoint
ALTER TABLE "production_ops"."subcontracting_item" ADD CONSTRAINT "subcontracting_item_subcontracting_order_id_subcontracting_order_id_fk" FOREIGN KEY ("subcontracting_order_id") REFERENCES "production_ops"."subcontracting_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_ops"."subcontracting_item" ADD CONSTRAINT "subcontracting_item_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_ops"."subcontracting_item" ADD CONSTRAINT "subcontracting_item_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_ops"."subcontracting_order" ADD CONSTRAINT "subcontracting_order_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "production_ops"."subcontracting_order" ADD CONSTRAINT "subcontracting_order_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "crm"."supplier"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "production_ops"."subcontracting_order" ADD CONSTRAINT "subcontracting_order_work_order_id_work_order_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "production_ops"."work_order"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "production_ops"."subcontracting_order" ADD CONSTRAINT "subcontracting_order_service_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("service_account_id") REFERENCES "accounting"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_subcontract_item_order" ON "production_ops"."subcontracting_item" USING btree ("subcontracting_order_id");--> statement-breakpoint
CREATE INDEX "idx_subcontract_item_item" ON "production_ops"."subcontracting_item" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_subcontract_supplier" ON "production_ops"."subcontracting_order" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_subcontract_wo" ON "production_ops"."subcontracting_order" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "idx_subcontract_date" ON "production_ops"."subcontracting_order" USING btree ("posting_date");