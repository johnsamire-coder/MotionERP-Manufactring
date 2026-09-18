CREATE TABLE "production_ops"."work_order_operation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"name" text NOT NULL,
	"work_center_id" uuid,
	"planned_start_time" timestamp with time zone,
	"planned_end_time" timestamp with time zone,
	"process_loss_quantity" numeric(24, 6),
	"sequential_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "production_ops"."work_order" ADD COLUMN "track_operations" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "production_ops"."work_order_operation" ADD CONSTRAINT "work_order_operation_work_order_id_work_order_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "production_ops"."work_order"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "production_ops"."work_order_operation" ADD CONSTRAINT "work_order_operation_work_center_id_work_center_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "production_ops"."work_center"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "work_order_operation_wo_idx" ON "production_ops"."work_order_operation" USING btree ("work_order_id");