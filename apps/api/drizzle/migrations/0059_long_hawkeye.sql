CREATE TABLE "inventory"."stock_movement_serial" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movement_id" uuid NOT NULL,
	"serial_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movement_serial_unique" UNIQUE("movement_id","serial_id")
);
--> statement-breakpoint
ALTER TABLE "inventory"."stock_movement_serial" ADD CONSTRAINT "stock_movement_serial_movement_id_stock_movement_id_fk" FOREIGN KEY ("movement_id") REFERENCES "inventory"."stock_movement"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movement_serial" ADD CONSTRAINT "stock_movement_serial_serial_id_serial_number_id_fk" FOREIGN KEY ("serial_id") REFERENCES "inventory"."serial_number"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_stock_movement_serial_serial" ON "inventory"."stock_movement_serial" USING btree ("serial_id");