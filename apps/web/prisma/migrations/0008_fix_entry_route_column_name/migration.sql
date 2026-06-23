-- Migration: 0008_fix_entry_route_column_name
-- FIX: migration 0007 created the column as "entry_route" (snake_case), but the
-- project convention (and the Prisma schema field `entryRoute`, which has no @map)
-- is camelCase. Every prisma.landingPage.create() failed with P2022
-- (column `entryRoute` does not exist) because Prisma looked for "entryRoute".
-- This renames the column to match the schema. Idempotent-safe: only renames if
-- the old column still exists (fresh DBs that already have entryRoute are skipped).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'landing_page' AND column_name = 'entry_route'
  ) THEN
    ALTER TABLE "landing_page" RENAME COLUMN "entry_route" TO "entryRoute";
  END IF;
END $$;
