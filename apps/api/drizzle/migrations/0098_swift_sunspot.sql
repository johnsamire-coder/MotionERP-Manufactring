CREATE TABLE "assets"."asset_insurance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"insurer" text NOT NULL,
	"policy_number" text NOT NULL,
	"insured_value" numeric(18, 2) NOT NULL,
	"premium" numeric(18, 2),
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	CONSTRAINT "asset_insurance_policy_unique" UNIQUE("insurer","policy_number"),
	CONSTRAINT "asset_insurance_dates_valid" CHECK ("assets"."asset_insurance"."end_date" > "assets"."asset_insurance"."start_date"),
	CONSTRAINT "asset_insurance_value_positive" CHECK ("assets"."asset_insurance"."insured_value" > 0)
);
--> statement-breakpoint
CREATE TABLE "assets"."asset_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"movement_date" timestamp with time zone DEFAULT now() NOT NULL,
	"purpose" text NOT NULL,
	"from_location" text,
	"to_location" text,
	"from_custodian_id" uuid,
	"to_custodian_id" uuid,
	"note" text,
	CONSTRAINT "asset_movement_purpose_valid" CHECK ("assets"."asset_movement"."purpose" in ('transfer', 'issue', 'receipt'))
);
--> statement-breakpoint
ALTER TABLE "assets"."asset" DROP CONSTRAINT "asset_status_valid";--> statement-breakpoint
ALTER TABLE "assets"."asset_value_event" DROP CONSTRAINT "asset_value_event_type_valid";--> statement-breakpoint
ALTER TABLE "assets"."asset" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "assets"."asset" ADD COLUMN "custodian_employee_id" uuid;--> statement-breakpoint
ALTER TABLE "assets"."asset" ADD COLUMN "parent_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "assets"."asset" ADD COLUMN "is_composite" text DEFAULT 'no' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets"."asset_insurance" ADD CONSTRAINT "asset_insurance_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets"."asset_movement" ADD CONSTRAINT "asset_movement_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_movement_asset_idx" ON "assets"."asset_movement" USING btree ("asset_id");--> statement-breakpoint
ALTER TABLE "assets"."asset" ADD CONSTRAINT "asset_status_valid" CHECK ("assets"."asset"."status" in ('draft', 'cwip', 'in_use', 'fully_depreciated', 'scrapped', 'merged'));--> statement-breakpoint
ALTER TABLE "assets"."asset_value_event" ADD CONSTRAINT "asset_value_event_type_valid" CHECK ("assets"."asset_value_event"."event_type" in ('cwip_cost', 'capitalisation', 'value_adjustment', 'component_asset', 'component_stock'));