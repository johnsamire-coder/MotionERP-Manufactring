ALTER TABLE "sales"."job_order" ADD COLUMN "org_node_id" uuid;--> statement-breakpoint
ALTER TABLE "sales"."quotation" ADD COLUMN "org_node_id" uuid;--> statement-breakpoint
ALTER TABLE "sales"."job_order" ADD CONSTRAINT "job_order_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales"."quotation" ADD CONSTRAINT "quotation_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "job_order_org_node_idx" ON "sales"."job_order" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "quotation_org_node_idx" ON "sales"."quotation" USING btree ("org_node_id");