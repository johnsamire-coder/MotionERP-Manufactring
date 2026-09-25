CREATE TABLE "inventory"."pick_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pick_list_number" text NOT NULL,
	"purpose" text DEFAULT 'delivery' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"scope_warehouse_id" uuid,
	"target_warehouse_id" uuid,
	"reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pick_list_number_unique" UNIQUE("pick_list_number"),
	CONSTRAINT "pick_list_purpose_valid" CHECK ("inventory"."pick_list"."purpose" in ('delivery', 'material_transfer')),
	CONSTRAINT "pick_list_status_valid" CHECK ("inventory"."pick_list"."status" in ('draft', 'completed', 'cancelled')),
	CONSTRAINT "pick_list_transfer_has_target" CHECK ("inventory"."pick_list"."purpose" <> 'material_transfer' or "inventory"."pick_list"."target_warehouse_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "inventory"."pick_list_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pick_list_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"batch_id" uuid,
	"quantity" numeric(24, 6) NOT NULL,
	"picked_quantity" numeric(24, 6),
	"line_number" integer NOT NULL,
	CONSTRAINT "pick_list_line_quantity_positive" CHECK ("inventory"."pick_list_line"."quantity" > 0),
	CONSTRAINT "pick_list_line_picked_range" CHECK ("inventory"."pick_list_line"."picked_quantity" is null or ("inventory"."pick_list_line"."picked_quantity" >= 0 and "inventory"."pick_list_line"."picked_quantity" <= "inventory"."pick_list_line"."quantity"))
);
--> statement-breakpoint
ALTER TABLE "inventory"."pick_list" ADD CONSTRAINT "pick_list_scope_warehouse_id_warehouse_id_fk" FOREIGN KEY ("scope_warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."pick_list" ADD CONSTRAINT "pick_list_target_warehouse_id_warehouse_id_fk" FOREIGN KEY ("target_warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."pick_list_line" ADD CONSTRAINT "pick_list_line_pick_list_id_pick_list_id_fk" FOREIGN KEY ("pick_list_id") REFERENCES "inventory"."pick_list"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."pick_list_line" ADD CONSTRAINT "pick_list_line_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."pick_list_line" ADD CONSTRAINT "pick_list_line_batch_id_item_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "inventory"."item_batch"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "pick_list_line_list_idx" ON "inventory"."pick_list_line" USING btree ("pick_list_id");