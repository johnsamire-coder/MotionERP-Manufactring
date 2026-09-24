ALTER TABLE "tax"."customs_declaration" ADD COLUMN "clearing_account_id" uuid;--> statement-breakpoint
ALTER TABLE "tax"."tax_settlement" ADD COLUMN "vat_payable_account_id" uuid;--> statement-breakpoint
ALTER TABLE "tax"."tax_settlement" ADD COLUMN "payment_journal_entry_id" uuid;