-- Migration: 0009_serving_read_policy
--
-- The isolated serving layer (Phase 7) must read `template` and `brand_config`
-- ACROSS workspaces: an asset request carries no session, and the serving
-- authorization boundary is the HMAC serve token + the non-enumerable template
-- UUID — NOT the dashboard session's workspace scope. But Phase 02 enabled
-- FORCE ROW LEVEL SECURITY, so the app role (which owns the tables) cannot read
-- a row unless `app.current_workspace_id` matches. That made every serve request
-- 404 (template lookup returned null under RLS).
--
-- Fix: add a PERMISSIVE SELECT policy that grants read access only when the
-- serving handler explicitly opts in by setting `app.serving = 'on'` (via
-- SET LOCAL inside a transaction). Because RLS policies are OR-combined:
--   - Normal app queries (app.serving unset) → unchanged: tenant_isolation only.
--   - Serving handler queries (app.serving = 'on') → may read any row.
-- FORCE RLS stays ON; the relaxation is scoped to the serving code path and to
-- reads only (FOR SELECT — writes are untouched).
CREATE POLICY "serving_read" ON "template"
  FOR SELECT
  USING (current_setting('app.serving', true) = 'on');

CREATE POLICY "serving_read" ON "brand_config"
  FOR SELECT
  USING (current_setting('app.serving', true) = 'on');
