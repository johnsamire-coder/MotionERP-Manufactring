CREATE SCHEMA "projects";
--> statement-breakpoint
CREATE TABLE "projects"."email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipients" jsonb NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"source_type" text,
	"source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "email_outbox_status_valid" CHECK ("projects"."email_outbox"."status" in ('queued', 'sent', 'failed', 'no_transport'))
);
--> statement-breakpoint
CREATE TABLE "projects"."project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"org_node_id" uuid NOT NULL,
	"customer_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"percent_complete_method" text DEFAULT 'task_completion' NOT NULL,
	"manual_percent_complete" numeric(5, 2),
	"estimated_cost" numeric(18, 4),
	"contract_value" numeric(18, 4),
	"dimension_value_id" uuid,
	"report_frequency" text DEFAULT 'none' NOT NULL,
	"report_recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_report_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_code_unique" UNIQUE("code"),
	CONSTRAINT "project_status_valid" CHECK ("projects"."project"."status" in ('open', 'completed', 'cancelled')),
	CONSTRAINT "project_method_valid" CHECK ("projects"."project"."percent_complete_method" in ('manual', 'task_completion', 'task_progress', 'task_weight')),
	CONSTRAINT "project_frequency_valid" CHECK ("projects"."project"."report_frequency" in ('none', 'daily', 'weekly', 'monthly')),
	CONSTRAINT "project_manual_range" CHECK ("projects"."project"."manual_percent_complete" is null or ("projects"."project"."manual_percent_complete" >= 0 and "projects"."project"."manual_percent_complete" <= 100))
);
--> statement-breakpoint
CREATE TABLE "projects"."task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"progress" numeric(5, 2) DEFAULT '0' NOT NULL,
	"weight" numeric(10, 2) DEFAULT '1' NOT NULL,
	"expected_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_status_valid" CHECK ("projects"."task"."status" in ('open', 'working', 'completed', 'cancelled')),
	CONSTRAINT "task_progress_range" CHECK ("projects"."task"."progress" >= 0 and "projects"."task"."progress" <= 100),
	CONSTRAINT "task_weight_non_negative" CHECK ("projects"."task"."weight" >= 0)
);
--> statement-breakpoint
ALTER TABLE "projects"."task" ADD CONSTRAINT "task_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_outbox_status_idx" ON "projects"."email_outbox" USING btree ("status");--> statement-breakpoint
CREATE INDEX "task_project_idx" ON "projects"."task" USING btree ("project_id");