CREATE TABLE "technical"."bom_creator" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_number" text NOT NULL,
	"product_item_id" uuid NOT NULL,
	"org_node_id" uuid NOT NULL,
	"quantity_to_produce" numeric(24, 6) DEFAULT '1' NOT NULL,
	"allow_alternative_item" boolean DEFAULT false NOT NULL,
	"remarks" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bom_creator_number_unique" UNIQUE("creator_number"),
	CONSTRAINT "bom_creator_qty_positive" CHECK ("technical"."bom_creator"."quantity_to_produce" > 0),
	CONSTRAINT "bom_creator_status_valid" CHECK ("technical"."bom_creator"."status" in ('draft', 'completed'))
);
--> statement-breakpoint
CREATE TABLE "technical"."bom_creator_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bom_creator_id" uuid NOT NULL,
	"parent_id" uuid,
	"component_item_id" uuid NOT NULL,
	"quantity" numeric(24, 6) NOT NULL,
	"is_sub_assembly" boolean DEFAULT false NOT NULL,
	"generated_bom_id" uuid,
	"line_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "bom_creator_item_qty_positive" CHECK ("technical"."bom_creator_item"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "technical"."bom_creator" ADD CONSTRAINT "bom_creator_product_item_id_item_id_fk" FOREIGN KEY ("product_item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "technical"."bom_creator" ADD CONSTRAINT "bom_creator_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "technical"."bom_creator_item" ADD CONSTRAINT "bom_creator_item_bom_creator_id_bom_creator_id_fk" FOREIGN KEY ("bom_creator_id") REFERENCES "technical"."bom_creator"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "technical"."bom_creator_item" ADD CONSTRAINT "bom_creator_item_component_item_id_item_id_fk" FOREIGN KEY ("component_item_id") REFERENCES "catalog"."item"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "bom_creator_org_node_idx" ON "technical"."bom_creator" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "bom_creator_item_creator_idx" ON "technical"."bom_creator_item" USING btree ("bom_creator_id");--> statement-breakpoint
CREATE INDEX "bom_creator_item_parent_idx" ON "technical"."bom_creator_item" USING btree ("parent_id");