CREATE SCHEMA "workflow";
--> statement-breakpoint
CREATE TABLE "workflow"."workflow_definition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"document_type" text NOT NULL,
	"initial_state" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_definition_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "workflow"."workflow_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"from_state" text,
	"to_state" text NOT NULL,
	"action" text NOT NULL,
	"user_id" uuid,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow"."workflow_instance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"document_id" uuid NOT NULL,
	"current_state" text NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_instance_document_unique" UNIQUE("document_type","document_id")
);
--> statement-breakpoint
CREATE TABLE "workflow"."workflow_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_final" boolean DEFAULT false NOT NULL,
	CONSTRAINT "workflow_state_code_unique" UNIQUE("workflow_id","code")
);
--> statement-breakpoint
CREATE TABLE "workflow"."workflow_transition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"action" text NOT NULL,
	"allowed_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"condition" jsonb,
	CONSTRAINT "workflow_transition_unique" UNIQUE("workflow_id","from_state","action"),
	CONSTRAINT "workflow_transition_not_self" CHECK ("workflow"."workflow_transition"."from_state" <> "workflow"."workflow_transition"."to_state")
);
--> statement-breakpoint
ALTER TABLE "workflow"."workflow_history" ADD CONSTRAINT "workflow_history_instance_id_workflow_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "workflow"."workflow_instance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."workflow_instance" ADD CONSTRAINT "workflow_instance_workflow_id_workflow_definition_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "workflow"."workflow_definition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."workflow_state" ADD CONSTRAINT "workflow_state_workflow_id_workflow_definition_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "workflow"."workflow_definition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."workflow_transition" ADD CONSTRAINT "workflow_transition_workflow_id_workflow_definition_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "workflow"."workflow_definition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_history_instance_idx" ON "workflow"."workflow_history" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "workflow_instance_state_idx" ON "workflow"."workflow_instance" USING btree ("workflow_id","current_state");