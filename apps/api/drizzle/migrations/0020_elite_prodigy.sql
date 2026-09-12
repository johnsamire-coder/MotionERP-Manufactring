ALTER TABLE "production"."material_request" ADD COLUMN "org_node_id" uuid;--> statement-breakpoint
ALTER TABLE "production_ops"."production_step" ADD COLUMN "org_node_id" uuid;--> statement-breakpoint
ALTER TABLE "cost"."job_cost_sheet" ADD COLUMN "org_node_id" uuid;--> statement-breakpoint
ALTER TABLE "delivery"."delivery_order" ADD COLUMN "org_node_id" uuid;--> statement-breakpoint
ALTER TABLE "finance"."collection" ADD COLUMN "org_node_id" uuid;--> statement-breakpoint
ALTER TABLE "finance"."retention" ADD COLUMN "org_node_id" uuid;--> statement-breakpoint
ALTER TABLE "production"."material_request" ADD CONSTRAINT "material_request_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "production_ops"."production_step" ADD CONSTRAINT "production_step_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "cost"."job_cost_sheet" ADD CONSTRAINT "job_cost_sheet_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "delivery"."delivery_order" ADD CONSTRAINT "delivery_order_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "finance"."collection" ADD CONSTRAINT "collection_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "finance"."retention" ADD CONSTRAINT "retention_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "material_request_org_node_idx" ON "production"."material_request" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "production_step_org_node_idx" ON "production_ops"."production_step" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "idx_job_cost_sheet_org_node" ON "cost"."job_cost_sheet" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "idx_delivery_order_org_node" ON "delivery"."delivery_order" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "idx_collection_org_node" ON "finance"."collection" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "idx_retention_org_node" ON "finance"."retention" USING btree ("org_node_id");