CREATE SCHEMA "crm";
--> statement-breakpoint
CREATE TABLE "crm"."customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"contact_phone" text,
	"contact_email" text,
	"org_node_id" uuid NOT NULL,
	"status" text DEFAULT 'lead' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_code_unique" UNIQUE("code"),
	CONSTRAINT "customer_code_format" CHECK ("crm"."customer"."code" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
	CONSTRAINT "customer_name_not_blank" CHECK (length(btrim("crm"."customer"."name")) > 0),
	CONSTRAINT "customer_status_valid" CHECK ("crm"."customer"."status" in ('lead', 'active', 'inactive', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "crm"."customer_interaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"interaction_type" text NOT NULL,
	"interaction_date" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_interaction_type_valid" CHECK ("crm"."customer_interaction"."interaction_type" in ('visit', 'call', 'email', 'note'))
);
--> statement-breakpoint
CREATE TABLE "crm"."supplier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"contact_phone" text,
	"contact_email" text,
	"org_node_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_code_unique" UNIQUE("code"),
	CONSTRAINT "supplier_code_format" CHECK ("crm"."supplier"."code" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
	CONSTRAINT "supplier_name_not_blank" CHECK (length(btrim("crm"."supplier"."name")) > 0),
	CONSTRAINT "supplier_status_valid" CHECK ("crm"."supplier"."status" in ('active', 'inactive', 'archived'))
);
--> statement-breakpoint
ALTER TABLE "crm"."customer" ADD CONSTRAINT "customer_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm"."customer_interaction" ADD CONSTRAINT "customer_interaction_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "crm"."customer"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm"."supplier" ADD CONSTRAINT "supplier_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "customer_org_node_idx" ON "crm"."customer" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "customer_interaction_customer_idx" ON "crm"."customer_interaction" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "supplier_org_node_idx" ON "crm"."supplier" USING btree ("org_node_id");
--> statement-breakpoint
-- CRM UPDATED_AT TRIGGERS
CREATE TRIGGER "crm_supplier_set_updated_at"
    BEFORE UPDATE ON "crm"."supplier"
    FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "crm_customer_set_updated_at"
    BEFORE UPDATE ON "crm"."customer"
    FOR EACH ROW EXECUTE FUNCTION "platform"."set_updated_at"();
