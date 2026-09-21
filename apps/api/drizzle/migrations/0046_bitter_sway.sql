CREATE TABLE "quality"."inspection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_number" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"inspected_by" uuid,
	"inspected_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inspection_inspection_number_unique" UNIQUE("inspection_number"),
	CONSTRAINT "valid_inspection_status" CHECK ("quality"."inspection"."status" IN ('pending', 'passed', 'failed')),
	CONSTRAINT "valid_reference_type" CHECK ("quality"."inspection"."reference_type" IN ('purchase_receipt', 'production_step', 'delivery_order'))
);
--> statement-breakpoint
CREATE TABLE "quality"."inspection_parameter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_id" uuid NOT NULL,
	"parameter_name" text NOT NULL,
	"target_value" text NOT NULL,
	"actual_value" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valid_parameter_status" CHECK ("quality"."inspection_parameter"."status" IN ('pending', 'pass', 'fail'))
);
--> statement-breakpoint
ALTER TABLE "quality"."inspection" ADD CONSTRAINT "inspection_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quality"."inspection" ADD CONSTRAINT "inspection_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quality"."inspection_parameter" ADD CONSTRAINT "inspection_parameter_inspection_id_inspection_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "quality"."inspection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_inspection_item" ON "quality"."inspection" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_inspection_reference" ON "quality"."inspection" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "idx_parameter_inspection" ON "quality"."inspection_parameter" USING btree ("inspection_id");