CREATE SCHEMA "support";
--> statement-breakpoint
CREATE TABLE "support"."holiday" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holiday_list_id" uuid NOT NULL,
	"holiday_date" date NOT NULL,
	"description" text,
	CONSTRAINT "holiday_list_date_unique" UNIQUE("holiday_list_id","holiday_date")
);
--> statement-breakpoint
CREATE TABLE "support"."holiday_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "holiday_list_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "support"."service_level_agreement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"time_zone" text DEFAULT 'Africa/Cairo' NOT NULL,
	"working_hours" jsonb NOT NULL,
	"holiday_list_id" uuid,
	"priorities" jsonb NOT NULL,
	"auto_close_after_days" integer DEFAULT 7 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sla_code_unique" UNIQUE("code"),
	CONSTRAINT "sla_auto_close_positive" CHECK ("support"."service_level_agreement"."auto_close_after_days" > 0)
);
--> statement-breakpoint
CREATE TABLE "support"."ticket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" text NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"customer_id" uuid,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"sla_id" uuid,
	"parent_ticket_id" uuid,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"response_by" timestamp with time zone,
	"resolution_by" timestamp with time zone,
	"first_responded_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"on_hold_since" timestamp with time zone,
	"total_hold_minutes" integer DEFAULT 0 NOT NULL,
	"last_agent_reply_at" timestamp with time zone,
	"response_status" text DEFAULT 'pending' NOT NULL,
	"resolution_status" text DEFAULT 'pending' NOT NULL,
	"close_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_number_unique" UNIQUE("ticket_number"),
	CONSTRAINT "ticket_priority_valid" CHECK ("support"."ticket"."priority" in ('low', 'medium', 'high', 'urgent')),
	CONSTRAINT "ticket_status_valid" CHECK ("support"."ticket"."status" in ('open', 'replied', 'on_hold', 'resolved', 'closed')),
	CONSTRAINT "ticket_response_status_valid" CHECK ("support"."ticket"."response_status" in ('pending', 'fulfilled', 'failed')),
	CONSTRAINT "ticket_resolution_status_valid" CHECK ("support"."ticket"."resolution_status" in ('pending', 'fulfilled', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "support"."ticket_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_comment_author_valid" CHECK ("support"."ticket_comment"."author" in ('agent', 'customer'))
);
--> statement-breakpoint
ALTER TABLE "support"."holiday" ADD CONSTRAINT "holiday_holiday_list_id_holiday_list_id_fk" FOREIGN KEY ("holiday_list_id") REFERENCES "support"."holiday_list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support"."service_level_agreement" ADD CONSTRAINT "service_level_agreement_holiday_list_id_holiday_list_id_fk" FOREIGN KEY ("holiday_list_id") REFERENCES "support"."holiday_list"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support"."ticket" ADD CONSTRAINT "ticket_sla_id_service_level_agreement_id_fk" FOREIGN KEY ("sla_id") REFERENCES "support"."service_level_agreement"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support"."ticket" ADD CONSTRAINT "ticket_parent_ticket_id_ticket_id_fk" FOREIGN KEY ("parent_ticket_id") REFERENCES "support"."ticket"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support"."ticket_comment" ADD CONSTRAINT "ticket_comment_ticket_id_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "support"."ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticket_status_idx" ON "support"."ticket" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ticket_customer_idx" ON "support"."ticket" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "ticket_comment_ticket_idx" ON "support"."ticket_comment" USING btree ("ticket_id");