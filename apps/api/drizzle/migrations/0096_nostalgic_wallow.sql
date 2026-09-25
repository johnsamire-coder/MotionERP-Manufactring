CREATE SCHEMA "printing";
--> statement-breakpoint
CREATE TABLE "printing"."letterhead" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_node_id" uuid NOT NULL,
	"name" text NOT NULL,
	"header_html" text DEFAULT '' NOT NULL,
	"footer_html" text DEFAULT '' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "letterhead_org_name_unique" UNIQUE("org_node_id","name")
);
--> statement-breakpoint
CREATE TABLE "printing"."print_format" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"document_type" text NOT NULL,
	"template" text NOT NULL,
	"css" text DEFAULT '' NOT NULL,
	"letterhead_id" uuid,
	"is_default" boolean DEFAULT false NOT NULL,
	"allow_draft" boolean DEFAULT false NOT NULL,
	"allow_cancelled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "print_format_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "printing"."print_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_type" text NOT NULL,
	"document_id" uuid,
	"print_format_id" uuid,
	"user_id" uuid,
	"printed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "print_log_doc_type_not_blank" CHECK (length("printing"."print_log"."document_type") > 0)
);
--> statement-breakpoint
ALTER TABLE "printing"."print_format" ADD CONSTRAINT "print_format_letterhead_id_letterhead_id_fk" FOREIGN KEY ("letterhead_id") REFERENCES "printing"."letterhead"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printing"."print_log" ADD CONSTRAINT "print_log_print_format_id_print_format_id_fk" FOREIGN KEY ("print_format_id") REFERENCES "printing"."print_format"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "print_format_doctype_idx" ON "printing"."print_format" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "print_log_document_idx" ON "printing"."print_log" USING btree ("document_type","document_id");