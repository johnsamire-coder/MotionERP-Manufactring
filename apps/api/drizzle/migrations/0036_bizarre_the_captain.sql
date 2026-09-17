CREATE TABLE "planning"."sales_forecast_period_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_forecast_id" uuid NOT NULL,
	"period_name" text NOT NULL,
	"forecast_quantity" numeric(24, 6) NOT NULL,
	"planned_quantity" numeric(24, 6),
	"line_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sales_forecast_period_line_qty_positive" CHECK ("planning"."sales_forecast_period_line"."forecast_quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "technical"."bom_line" ADD COLUMN "operation_id" uuid;--> statement-breakpoint
ALTER TABLE "technical"."bom_line" ADD COLUMN "standard_time_minutes" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "planning"."sales_forecast_period_line" ADD CONSTRAINT "sales_forecast_period_line_sales_forecast_id_sales_forecast_id_fk" FOREIGN KEY ("sales_forecast_id") REFERENCES "planning"."sales_forecast"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "sales_forecast_period_line_forecast_idx" ON "planning"."sales_forecast_period_line" USING btree ("sales_forecast_id");