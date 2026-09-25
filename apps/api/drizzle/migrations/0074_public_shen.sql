CREATE TABLE "hr"."final_settlement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_number" text NOT NULL,
	"employee_id" uuid NOT NULL,
	"relieving_date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_payable" numeric(14, 4) DEFAULT '0' NOT NULL,
	"total_receivable" numeric(14, 4) DEFAULT '0' NOT NULL,
	"net_amount" numeric(14, 4) DEFAULT '0' NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "final_settlement_number_unique" UNIQUE("settlement_number"),
	CONSTRAINT "final_settlement_status_valid" CHECK ("hr"."final_settlement"."status" in ('draft', 'submitted', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "hr"."final_settlement_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"component" text NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(14, 4) NOT NULL,
	"is_auto" boolean DEFAULT false NOT NULL,
	CONSTRAINT "final_settlement_line_direction_valid" CHECK ("hr"."final_settlement_line"."direction" in ('payable', 'receivable')),
	CONSTRAINT "final_settlement_line_amount_positive" CHECK ("hr"."final_settlement_line"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "hr"."final_settlement" ADD CONSTRAINT "final_settlement_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hr"."employee"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hr"."final_settlement_line" ADD CONSTRAINT "final_settlement_line_settlement_id_final_settlement_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "hr"."final_settlement"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "final_settlement_one_open_per_employee" ON "hr"."final_settlement" USING btree ("employee_id") WHERE "hr"."final_settlement"."status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "final_settlement_line_settlement_idx" ON "hr"."final_settlement_line" USING btree ("settlement_id");