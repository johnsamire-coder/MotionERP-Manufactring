CREATE TABLE "crm"."lead" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_number" text NOT NULL,
	"person_name" text NOT NULL,
	"company_name" text,
	"phone" text,
	"email" text,
	"source" text,
	"org_node_id" uuid NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"prospect_id" uuid,
	"customer_id" uuid,
	"lost_reason" text,
	"last_contacted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_number_unique" UNIQUE("lead_number"),
	CONSTRAINT "lead_status_valid" CHECK ("crm"."lead"."status" in ('new', 'contacted', 'interested', 'prospect', 'converted', 'lost', 'do_not_contact')),
	CONSTRAINT "lead_lost_needs_reason" CHECK ("crm"."lead"."status" <> 'lost' or "crm"."lead"."lost_reason" is not null),
	CONSTRAINT "lead_converted_has_customer" CHECK ("crm"."lead"."status" <> 'converted' or "crm"."lead"."customer_id" is not null),
	CONSTRAINT "lead_person_not_blank" CHECK (length(btrim("crm"."lead"."person_name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "crm"."lead_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"activity_type" text NOT NULL,
	"activity_date" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_activity_type_valid" CHECK ("crm"."lead_activity"."activity_type" in ('call', 'visit', 'email', 'note'))
);
--> statement-breakpoint
CREATE TABLE "crm"."prospect" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_number" text NOT NULL,
	"company_name" text NOT NULL,
	"industry" text,
	"org_node_id" uuid NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"customer_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prospect_number_unique" UNIQUE("prospect_number"),
	CONSTRAINT "prospect_status_valid" CHECK ("crm"."prospect"."status" in ('open', 'converted', 'lost')),
	CONSTRAINT "prospect_converted_has_customer" CHECK ("crm"."prospect"."status" <> 'converted' or "crm"."prospect"."customer_id" is not null),
	CONSTRAINT "prospect_company_not_blank" CHECK (length(btrim("crm"."prospect"."company_name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "crm"."lead" ADD CONSTRAINT "lead_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm"."lead" ADD CONSTRAINT "lead_prospect_id_prospect_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "crm"."prospect"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm"."lead" ADD CONSTRAINT "lead_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "crm"."customer"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm"."lead_activity" ADD CONSTRAINT "lead_activity_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "crm"."lead"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm"."prospect" ADD CONSTRAINT "prospect_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm"."prospect" ADD CONSTRAINT "prospect_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "crm"."customer"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "lead_prospect_idx" ON "crm"."lead" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "lead_email_idx" ON "crm"."lead" USING btree ("email");--> statement-breakpoint
CREATE INDEX "lead_phone_idx" ON "crm"."lead" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "lead_activity_lead_idx" ON "crm"."lead_activity" USING btree ("lead_id");