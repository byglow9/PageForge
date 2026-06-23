-- Migration: 0007_vite_spa_lp_entry_route
-- ADDITIVE: adds nullable entry_route column to landing_page.
-- VITE_SPA rows: NULL = root '/'; non-null = '/grecia', '/turquia', etc.
-- LIQUID rows get NULL automatically (correct — unused column).
-- No DEFAULT needed — NULL is the correct default.
-- No CHECK constraint — free-form path; Zod validates at action boundary.
-- No RLS change needed — existing policy on landing_page covers all columns.
ALTER TABLE "landing_page"
  ADD COLUMN "entry_route" TEXT;
