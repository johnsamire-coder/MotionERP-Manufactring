CREATE TABLE "crm"."address" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"address_type" text DEFAULT 'billing' NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"city" text NOT NULL,
	"governorate" text,
	"country" text DEFAULT 'Egypt' NOT NULL,
	"postal_code" text,
	"phone" text,
	"email" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "address_type_valid" CHECK ("crm"."address"."address_type" in ('billing', 'shipping', 'office', 'warehouse', 'site', 'other')),
	CONSTRAINT "address_status_valid" CHECK ("crm"."address"."status" in ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "crm"."contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"designation" text,
	"email" text,
	"phone" text,
	"mobile" text,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_status_valid" CHECK ("crm"."contact"."status" in ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "crm"."party_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"party_type" text NOT NULL,
	"party_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "party_link_unique" UNIQUE("owner_type","owner_id","party_type","party_id"),
	CONSTRAINT "party_link_owner_type_valid" CHECK ("crm"."party_link"."owner_type" in ('contact', 'address')),
	CONSTRAINT "party_link_party_type_valid" CHECK ("crm"."party_link"."party_type" in ('customer', 'supplier', 'lead'))
);
--> statement-breakpoint
CREATE INDEX "contact_email_idx" ON "crm"."contact" USING btree ("email");--> statement-breakpoint
CREATE INDEX "party_link_party_idx" ON "crm"."party_link" USING btree ("party_type","party_id");--> statement-breakpoint
CREATE UNIQUE INDEX "party_link_one_primary" ON "crm"."party_link" USING btree ("owner_type","party_type","party_id") WHERE "crm"."party_link"."is_primary";--> statement-breakpoint
-- Existing customers and suppliers keep their phone / e-mail as a primary contact (the old columns stay).
WITH src AS (
  SELECT gen_random_uuid() AS contact_id, 'customer' AS party_type, c.id AS party_id, c.name, c.contact_phone, c.contact_email
  FROM "crm"."customer" c
  WHERE (c.contact_phone IS NOT NULL OR c.contact_email IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM "crm"."party_link" l WHERE l.owner_type = 'contact' AND l.party_type = 'customer' AND l.party_id = c.id)
  UNION ALL
  SELECT gen_random_uuid(), 'supplier', s.id, s.name, s.contact_phone, s.contact_email
  FROM "crm"."supplier" s
  WHERE (s.contact_phone IS NOT NULL OR s.contact_email IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM "crm"."party_link" l WHERE l.owner_type = 'contact' AND l.party_type = 'supplier' AND l.party_id = s.id)
),
ins AS (
  INSERT INTO "crm"."contact" ("id", "first_name", "phone", "email")
  SELECT contact_id, name, contact_phone, contact_email FROM src
  RETURNING id
)
INSERT INTO "crm"."party_link" ("owner_type", "owner_id", "party_type", "party_id", "is_primary")
SELECT 'contact', src.contact_id, src.party_type, src.party_id, true
FROM src JOIN ins ON ins.id = src.contact_id;
