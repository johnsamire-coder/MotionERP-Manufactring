CREATE TABLE "finance"."ledger_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_key" text NOT NULL,
	"check_type" text NOT NULL,
	"document_type" text,
	"document_id" uuid,
	"document_number" text,
	"journal_entry_id" uuid,
	"org_node_id" uuid,
	"details" text NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "ledger_health_check_type_valid" CHECK ("finance"."ledger_health"."check_type" in ('debit_credit_mismatch', 'missing_gl_entry', 'orphan_gl_entry'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_health_open_issue_unique" ON "finance"."ledger_health" USING btree ("issue_key") WHERE "finance"."ledger_health"."resolved_at" is null;--> statement-breakpoint
CREATE INDEX "ledger_health_detected_idx" ON "finance"."ledger_health" USING btree ("detected_at");