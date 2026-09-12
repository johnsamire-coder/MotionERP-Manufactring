ALTER TABLE "technical"."bom" ADD COLUMN "org_node_id" uuid;--> statement-breakpoint
ALTER TABLE "technical"."technical_document" ADD COLUMN "org_node_id" uuid;--> statement-breakpoint
ALTER TABLE "technical"."bom" ADD CONSTRAINT "bom_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "technical"."technical_document" ADD CONSTRAINT "technical_document_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "bom_org_node_idx" ON "technical"."bom" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "technical_document_org_node_idx" ON "technical"."technical_document" USING btree ("org_node_id");