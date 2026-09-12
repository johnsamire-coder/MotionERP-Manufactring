ALTER TABLE "accounting"."chart_of_accounts" DROP CONSTRAINT "chart_of_accounts_code_unique";--> statement-breakpoint
ALTER TABLE "accounting"."chart_of_accounts" ADD COLUMN "org_node_id" uuid;--> statement-breakpoint
ALTER TABLE "accounting"."journal_entry" ADD COLUMN "org_node_id" uuid;--> statement-breakpoint
ALTER TABLE "accounting"."chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounting"."journal_entry" ADD CONSTRAINT "journal_entry_org_node_id_org_node_id_fk" FOREIGN KEY ("org_node_id") REFERENCES "platform"."org_node"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_chart_of_accounts_org_node" ON "accounting"."chart_of_accounts" USING btree ("org_node_id");--> statement-breakpoint
CREATE INDEX "idx_journal_entry_org_node" ON "accounting"."journal_entry" USING btree ("org_node_id");--> statement-breakpoint
ALTER TABLE "accounting"."chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_org_code_unique" UNIQUE("org_node_id","code");