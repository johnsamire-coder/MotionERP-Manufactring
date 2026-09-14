CREATE TABLE "planning"."material_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_number" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"purpose" text DEFAULT 'manufacture' NOT NULL,
	"transaction_date" timestamp with time zone DEFAULT now() NOT NULL,
	"required_by_date" timestamp with time zone,
	"job_order_reference" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planning_material_request_number_unique" UNIQUE("request_number"),
	CONSTRAINT "planning_material_request_purpose_valid" CHECK ("planning"."material_request"."purpose" in ('purchase', 'material_transfer', 'material_issue', 'manufacture')),
	CONSTRAINT "planning_material_request_status_valid" CHECK ("planning"."material_request"."status" in ('draft', 'submitted', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "planning"."material_request_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_request_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"quantity" numeric(24, 6) NOT NULL,
	"schedule_date" timestamp with time zone,
	"line_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "planning_material_request_line_qty_positive" CHECK ("planning"."material_request_line"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "planning"."material_request" ADD CONSTRAINT "material_request_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "planning"."material_request_line" ADD CONSTRAINT "material_request_line_material_request_id_material_request_id_fk" FOREIGN KEY ("material_request_id") REFERENCES "planning"."material_request"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "planning"."material_request_line" ADD CONSTRAINT "material_request_line_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "planning"."material_request_line" ADD CONSTRAINT "material_request_line_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "planning_material_request_org_node_idx" ON "planning"."material_request" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "planning_material_request_job_order_idx" ON "planning"."material_request" USING btree ("job_order_reference");--> statement-breakpoint
CREATE INDEX "planning_material_request_line_request_idx" ON "planning"."material_request_line" USING btree ("material_request_id");--> statement-breakpoint
CREATE INDEX "planning_material_request_line_item_idx" ON "planning"."material_request_line" USING btree ("item_id");