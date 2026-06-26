-- Migration: 0010_lp_serving_read_policy
--
-- O-2 ROOT CAUSE: The serve route's servingRead() helper sets app.serving='on'
-- (transaction-local via SET LOCAL semantics) but does NOT set
-- app.current_workspace_id. The landing_page table has FORCE ROW LEVEL SECURITY
-- enabled and only a tenant_isolation policy (migration 0005), which requires
-- app.current_workspace_id to match. Inside servingRead(), that setting is absent,
-- so tenant_isolation evaluates to false for every row — all landing_page reads
-- return zero rows. This makes the serve route unable to inject LP overrides into
-- the preview, breaking the Phase 10 editor feedback channel.
--
-- FIX: Add a PERMISSIVE SELECT policy gated on app.serving='on', mirroring the
-- exact pattern applied to `template` and `brand_config` in migration 0009. With
-- RLS policies OR-combined:
--   - Normal dashboard queries (app.serving unset): unchanged — tenant_isolation only.
--   - Serving handler queries (app.serving='on'): may read any landing_page row.
-- FORCE RLS stays ON; the relaxation is scoped to the serving code path and to
-- reads only (FOR SELECT — writes remain untouched).
--
-- SECURITY NOTE (T-10-01-01): This policy is SELECT-only and permissive only when
-- app.serving='on'. The serve route's Prisma query already WHERE-filters by
-- workspaceId extracted from HMAC token claims (never from URL params), providing
-- application-level tenant scoping independently of this RLS policy. This is the
-- same dual-layer pattern as migration 0009 for `template`/`brand_config`:
-- the permissive RLS policy allows the serving code path to read, while the
-- WHERE clause enforces tenant isolation at the application level.
CREATE POLICY "serving_read" ON "landing_page"
  FOR SELECT
  USING (current_setting('app.serving', true) = 'on');
