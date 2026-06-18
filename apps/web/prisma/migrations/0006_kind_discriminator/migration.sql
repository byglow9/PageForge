-- Migration: 0006_kind_discriminator
-- Adds kind discriminator to template and landing_page tables.
-- ADDITIVE: existing LIQUID rows are unaffected (DEFAULT 'LIQUID').
-- Pattern: TEXT + CHECK constraint instead of native PG enum to avoid
-- Prisma error 55P04 ("new enum values must be committed before they can be used").
-- Postgres 11+ stores constant defaults in catalog — no table rewrite, no lock.

ALTER TABLE "template"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'LIQUID'
    CHECK ("kind" IN ('LIQUID', 'VITE_SPA'));

ALTER TABLE "landing_page"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'LIQUID'
    CHECK ("kind" IN ('LIQUID', 'VITE_SPA'));

-- RLS policies are already active on both tables (from 0004/0005 migrations).
-- The kind column inherits the existing workspace_id RLS policy automatically
-- (no new policy needed; the existing USING/WITH CHECK covers all columns).
