-- Restores inventory.stock_reservation.id, dropped by 0042_careful_richard_fisk (a bad generated
-- DROP COLUMN): the schema and code always used it, so every reservation insert failed with
-- "column id does not exist". Idempotent so databases that still have the column are unaffected.
ALTER TABLE "inventory"."stock_reservation" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'inventory.stock_reservation'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "inventory"."stock_reservation" ADD PRIMARY KEY ("id");
  END IF;
END $$;
