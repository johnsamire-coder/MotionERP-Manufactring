CREATE SCHEMA "production";
--> statement-breakpoint
CREATE TABLE "production"."material_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_order_reference" text NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"planned_quantity" numeric(24, 6) NOT NULL,
	"requested_quantity" numeric(24, 6) NOT NULL,
	"issued_quantity" numeric(24, 6),
	"actual_used_quantity" numeric(24, 6),
	"status" text DEFAULT 'pending_review' NOT NULL,
	"deviation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_request_planned_non_negative" CHECK ("production"."material_request"."planned_quantity" >= 0),
	CONSTRAINT "material_request_requested_positive" CHECK ("production"."material_request"."requested_quantity" > 0),
	CONSTRAINT "material_request_status_valid" CHECK ("production"."material_request"."status" in ('approved', 'pending_review', 'rejected', 'issued', 'closed'))
);
--> statement-breakpoint
ALTER TABLE "production"."material_request" ADD CONSTRAINT "material_request_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "production"."material_request" ADD CONSTRAINT "material_request_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "material_request_job_order_idx" ON "production"."material_request" USING btree ("job_order_reference");
--> statement-breakpoint
-- PRODUCTION (MATERIAL REQUEST) UPDATED_AT TRIGGER
CREATE TRIGGER "production_material_request_set_updated_at"
    BEFORE UPDATE ON "production"."material_request"
    FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();
