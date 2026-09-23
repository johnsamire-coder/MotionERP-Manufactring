CREATE TABLE "settings"."purchase_allowance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_node_id" uuid,
	"over_order_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"over_receipt_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"over_billing_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_allowance_org_node_unique" UNIQUE NULLS NOT DISTINCT("org_node_id"),
	CONSTRAINT "purchase_allowance_range" CHECK ("settings"."purchase_allowance"."over_order_pct" between 0 and 100 and "settings"."purchase_allowance"."over_receipt_pct" between 0 and 100 and "settings"."purchase_allowance"."over_billing_pct" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "settings"."purchase_allowance" ADD CONSTRAINT "purchase_allowance_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE cascade ON UPDATE cascade;