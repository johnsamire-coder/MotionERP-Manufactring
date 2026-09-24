CREATE SCHEMA "assets";
--> statement-breakpoint
CREATE TABLE "assets"."asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_code" text NOT NULL,
	"name" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_cwip" text DEFAULT 'no' NOT NULL,
	"cwip_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"gross_value" numeric(18, 2) DEFAULT '0' NOT NULL,
	"salvage_value" numeric(18, 2) DEFAULT '0' NOT NULL,
	"opening_accumulated" numeric(18, 2) DEFAULT '0' NOT NULL,
	"accumulated_depreciation" numeric(18, 2) DEFAULT '0' NOT NULL,
	"method" text DEFAULT 'straight_line' NOT NULL,
	"periods" integer DEFAULT 60 NOT NULL,
	"frequency_months" integer DEFAULT 1 NOT NULL,
	"annual_rate_percent" numeric(6, 2),
	"manual_amounts" jsonb,
	"available_for_use_date" date,
	"cost_center_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_org_code_unique" UNIQUE("org_node_id","asset_code"),
	CONSTRAINT "asset_status_valid" CHECK ("assets"."asset"."status" in ('draft', 'cwip', 'in_use', 'fully_depreciated', 'scrapped')),
	CONSTRAINT "asset_is_cwip_valid" CHECK ("assets"."asset"."is_cwip" in ('yes', 'no')),
	CONSTRAINT "asset_method_valid" CHECK ("assets"."asset"."method" in ('straight_line', 'double_declining_balance', 'written_down_value', 'manual')),
	CONSTRAINT "asset_frequency_valid" CHECK ("assets"."asset"."frequency_months" in (1, 3, 6, 12)),
	CONSTRAINT "asset_periods_positive" CHECK ("assets"."asset"."periods" > 0)
);
--> statement-breakpoint
CREATE TABLE "assets"."asset_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_node_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"fixed_asset_account_id" uuid NOT NULL,
	"accumulated_depreciation_account_id" uuid NOT NULL,
	"depreciation_expense_account_id" uuid NOT NULL,
	"cwip_account_id" uuid,
	"default_method" text DEFAULT 'straight_line' NOT NULL,
	"default_periods" integer DEFAULT 60 NOT NULL,
	"default_frequency_months" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "asset_category_org_code_unique" UNIQUE("org_node_id","code")
);
--> statement-breakpoint
CREATE TABLE "assets"."asset_value_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_date" date NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"journal_entry_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_value_event_type_valid" CHECK ("assets"."asset_value_event"."event_type" in ('cwip_cost', 'capitalisation', 'value_adjustment'))
);
--> statement-breakpoint
CREATE TABLE "assets"."depreciation_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"schedule_date" date NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"accumulated" numeric(18, 2) NOT NULL,
	"journal_entry_id" uuid,
	"posted_at" timestamp with time zone,
	CONSTRAINT "depreciation_schedule_row_unique" UNIQUE("asset_id","row_number")
);
--> statement-breakpoint
ALTER TABLE "assets"."asset" ADD CONSTRAINT "asset_category_id_asset_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "assets"."asset_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets"."asset_value_event" ADD CONSTRAINT "asset_value_event_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets"."depreciation_schedule" ADD CONSTRAINT "depreciation_schedule_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "depreciation_schedule_date_idx" ON "assets"."depreciation_schedule" USING btree ("schedule_date");