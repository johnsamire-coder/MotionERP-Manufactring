CREATE TABLE "workflow"."task_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"instance_id" uuid NOT NULL,
	"status" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_run_status_valid" CHECK ("workflow"."task_run"."status" in ('ok', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "workflow"."transition_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"action" text NOT NULL,
	"task_type" text NOT NULL,
	"config" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transition_task_type_valid" CHECK ("workflow"."transition_task"."task_type" in ('email', 'webhook', 'print'))
);
--> statement-breakpoint
CREATE TABLE "printing"."print_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_type" text NOT NULL,
	"document_ids" jsonb NOT NULL,
	"print_format_id" uuid,
	"printer_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"done" integer DEFAULT 0 NOT NULL,
	"skipped" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"output" text,
	"error" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "print_job_status_valid" CHECK ("printing"."print_job"."status" in ('queued', 'running', 'done', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "printing"."printer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"host" text NOT NULL,
	"port" integer DEFAULT 9100 NOT NULL,
	"payload_format" text DEFAULT 'text' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "printer_name_unique" UNIQUE("name"),
	CONSTRAINT "printer_port_range" CHECK ("printing"."printer"."port" between 1 and 65535),
	CONSTRAINT "printer_payload_valid" CHECK ("printing"."printer"."payload_format" in ('text'))
);
--> statement-breakpoint
ALTER TABLE "workflow"."task_run" ADD CONSTRAINT "task_run_task_id_transition_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "workflow"."transition_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."task_run" ADD CONSTRAINT "task_run_instance_id_workflow_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "workflow"."workflow_instance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."transition_task" ADD CONSTRAINT "transition_task_workflow_id_workflow_definition_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "workflow"."workflow_definition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printing"."print_job" ADD CONSTRAINT "print_job_print_format_id_print_format_id_fk" FOREIGN KEY ("print_format_id") REFERENCES "printing"."print_format"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printing"."print_job" ADD CONSTRAINT "print_job_printer_id_printer_id_fk" FOREIGN KEY ("printer_id") REFERENCES "printing"."printer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_run_instance_idx" ON "workflow"."task_run" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "transition_task_workflow_idx" ON "workflow"."transition_task" USING btree ("workflow_id","action");--> statement-breakpoint
CREATE INDEX "print_job_status_idx" ON "printing"."print_job" USING btree ("status");