CREATE TABLE "cost"."allocation_policy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"pool_id" uuid NOT NULL,
	"allocation_base" text NOT NULL,
	"percentage" numeric(5, 2) DEFAULT '100' NOT NULL,
	"is_active" text DEFAULT 'yes' NOT NULL,
	"org_node_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allocation_policy_code_unique" UNIQUE("code"),
	CONSTRAINT "allocation_policy_base_valid" CHECK ("cost"."allocation_policy"."allocation_base" in ('units_produced', 'direct_labor_hours', 'direct_labor_cost', 'machine_hours', 'direct_material_cost', 'sales_revenue')),
	CONSTRAINT "allocation_policy_percentage_valid" CHECK ("cost"."allocation_policy"."percentage" > 0 AND "cost"."allocation_policy"."percentage" <= 100),
	CONSTRAINT "allocation_policy_is_active_valid" CHECK ("cost"."allocation_policy"."is_active" in ('yes', 'no'))
);
--> statement-breakpoint
CREATE TABLE "cost"."allocation_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"work_order_id" uuid,
	"job_order_reference" text,
	"allocated_amount" numeric(14, 4) NOT NULL,
	"base_quantity" numeric(14, 4) NOT NULL,
	"base_rate" numeric(14, 6) NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"allocated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allocation_result_amount_positive" CHECK ("cost"."allocation_result"."allocated_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cost"."overhead_pool" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"pool_type" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"total_amount" numeric(14, 4) DEFAULT '0' NOT NULL,
	"currency_code" text DEFAULT 'EGP' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"org_node_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "overhead_pool_code_unique" UNIQUE("code"),
	CONSTRAINT "overhead_pool_type_valid" CHECK ("cost"."overhead_pool"."pool_type" in ('manufacturing_overhead', 'administrative', 'selling_marketing')),
	CONSTRAINT "overhead_pool_status_valid" CHECK ("cost"."overhead_pool"."status" in ('draft', 'active', 'allocated', 'closed')),
	CONSTRAINT "overhead_pool_amount_positive" CHECK ("cost"."overhead_pool"."total_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cost"."overhead_pool_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"account_id" uuid,
	"description" text NOT NULL,
	"amount" numeric(14, 4) NOT NULL,
	"source_reference" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "overhead_pool_entry_amount_positive" CHECK ("cost"."overhead_pool_entry"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "cost"."allocation_policy" ADD CONSTRAINT "allocation_policy_pool_id_overhead_pool_id_fk" FOREIGN KEY ("pool_id") REFERENCES "cost"."overhead_pool"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost"."allocation_policy" ADD CONSTRAINT "allocation_policy_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "cost"."allocation_result" ADD CONSTRAINT "allocation_result_policy_id_allocation_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "cost"."allocation_policy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost"."overhead_pool" ADD CONSTRAINT "overhead_pool_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "cost"."overhead_pool_entry" ADD CONSTRAINT "overhead_pool_entry_pool_id_overhead_pool_id_fk" FOREIGN KEY ("pool_id") REFERENCES "cost"."overhead_pool"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_allocation_policy_pool" ON "cost"."allocation_policy" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "idx_allocation_policy_org_node" ON "cost"."allocation_policy" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "idx_allocation_result_policy" ON "cost"."allocation_result" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "idx_allocation_result_work_order" ON "cost"."allocation_result" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "idx_allocation_result_job_order" ON "cost"."allocation_result" USING btree ("job_order_reference");--> statement-breakpoint
CREATE INDEX "idx_overhead_pool_org_node" ON "cost"."overhead_pool" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "idx_overhead_pool_period" ON "cost"."overhead_pool" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_overhead_pool_entry_pool" ON "cost"."overhead_pool_entry" USING btree ("pool_id");