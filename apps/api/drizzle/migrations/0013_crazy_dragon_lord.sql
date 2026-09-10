CREATE SCHEMA "delivery";
--> statement-breakpoint
CREATE TABLE "delivery"."delivery_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_order_reference" text NOT NULL,
	"delivery_number" text NOT NULL,
	"scheduled_date" timestamp with time zone NOT NULL,
	"actual_date" timestamp with time zone,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"vehicle_plate" text,
	"driver_name" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_order_delivery_number_unique" UNIQUE("delivery_number"),
	CONSTRAINT "delivery_order_status_valid" CHECK ("delivery"."delivery_order"."status" in ('scheduled', 'in_transit', 'delivered', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "delivery"."delivery_receipt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_order_id" uuid NOT NULL,
	"receipt_number" text NOT NULL,
	"signed_by" text NOT NULL,
	"signature_image" text,
	"received_items" text,
	"notes" text,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_receipt_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE "delivery"."installation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_order_id" uuid NOT NULL,
	"scheduled_date" timestamp with time zone NOT NULL,
	"actual_start_date" timestamp with time zone,
	"actual_end_date" timestamp with time zone,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"technician_names" text,
	"location" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "installation_status_valid" CHECK ("delivery"."installation"."status" in ('scheduled', 'in_progress', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "delivery"."installation_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" uuid NOT NULL,
	"report_number" text NOT NULL,
	"performed_by" text NOT NULL,
	"verified_by" text,
	"completion_notes" text,
	"issues_found" text,
	"corrective_actions" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "installation_report_report_number_unique" UNIQUE("report_number")
);
--> statement-breakpoint
ALTER TABLE "delivery"."delivery_receipt" ADD CONSTRAINT "delivery_receipt_delivery_order_id_delivery_order_id_fk" FOREIGN KEY ("delivery_order_id") REFERENCES "delivery"."delivery_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery"."installation" ADD CONSTRAINT "installation_delivery_order_id_delivery_order_id_fk" FOREIGN KEY ("delivery_order_id") REFERENCES "delivery"."delivery_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery"."installation_report" ADD CONSTRAINT "installation_report_installation_id_installation_id_fk" FOREIGN KEY ("installation_id") REFERENCES "delivery"."installation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_delivery_order_job_order" ON "delivery"."delivery_order" USING btree ("job_order_reference");--> statement-breakpoint
CREATE INDEX "idx_delivery_order_number" ON "delivery"."delivery_order" USING btree ("delivery_number");--> statement-breakpoint
CREATE INDEX "idx_delivery_receipt_delivery_order" ON "delivery"."delivery_receipt" USING btree ("delivery_order_id");--> statement-breakpoint
CREATE INDEX "idx_delivery_receipt_number" ON "delivery"."delivery_receipt" USING btree ("receipt_number");--> statement-breakpoint
CREATE INDEX "idx_installation_delivery_order" ON "delivery"."installation" USING btree ("delivery_order_id");--> statement-breakpoint
CREATE INDEX "idx_installation_report_installation" ON "delivery"."installation_report" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "idx_installation_report_number" ON "delivery"."installation_report" USING btree ("report_number");