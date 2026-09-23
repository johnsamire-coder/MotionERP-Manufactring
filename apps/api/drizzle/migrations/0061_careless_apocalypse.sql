CREATE TABLE "auth"."user_permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"allow_type" text NOT NULL,
	"allow_value" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_permission_unique" UNIQUE("user_id","allow_type","allow_value"),
	CONSTRAINT "user_permission_allow_type_valid" CHECK ("auth"."user_permission"."allow_type" in ('org_node', 'warehouse'))
);
--> statement-breakpoint
ALTER TABLE "auth"."user_permission" ADD CONSTRAINT "user_permission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "user_permission_user_idx" ON "auth"."user_permission" USING btree ("user_id");