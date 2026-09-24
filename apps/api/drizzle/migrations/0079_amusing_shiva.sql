CREATE TABLE "crm"."party_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_type" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"parent_group_id" uuid,
	"is_group" boolean DEFAULT false NOT NULL,
	"default_credit_limit" numeric(18, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "party_group_type_code_unique" UNIQUE("group_type","code"),
	CONSTRAINT "party_group_type_valid" CHECK ("crm"."party_group"."group_type" in ('customer', 'supplier')),
	CONSTRAINT "party_group_not_own_parent" CHECK ("crm"."party_group"."parent_group_id" is null or "crm"."party_group"."parent_group_id" <> "crm"."party_group"."id"),
	CONSTRAINT "party_group_credit_non_negative" CHECK ("crm"."party_group"."default_credit_limit" is null or "crm"."party_group"."default_credit_limit" >= 0),
	CONSTRAINT "party_group_credit_customer_only" CHECK ("crm"."party_group"."default_credit_limit" is null or "crm"."party_group"."group_type" = 'customer'),
	CONSTRAINT "party_group_name_not_blank" CHECK (length(btrim("crm"."party_group"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "crm"."customer" ADD COLUMN "customer_group_id" uuid;--> statement-breakpoint
ALTER TABLE "crm"."supplier" ADD COLUMN "supplier_group_id" uuid;--> statement-breakpoint
ALTER TABLE "crm"."party_group" ADD CONSTRAINT "party_group_parent_group_id_party_group_id_fk" FOREIGN KEY ("parent_group_id") REFERENCES "crm"."party_group"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "party_group_parent_idx" ON "crm"."party_group" USING btree ("parent_group_id");--> statement-breakpoint
ALTER TABLE "crm"."customer" ADD CONSTRAINT "customer_customer_group_id_party_group_id_fk" FOREIGN KEY ("customer_group_id") REFERENCES "crm"."party_group"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm"."supplier" ADD CONSTRAINT "supplier_supplier_group_id_party_group_id_fk" FOREIGN KEY ("supplier_group_id") REFERENCES "crm"."party_group"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "customer_group_idx" ON "crm"."customer" USING btree ("customer_group_id");--> statement-breakpoint
CREATE INDEX "supplier_group_idx" ON "crm"."supplier" USING btree ("supplier_group_id");