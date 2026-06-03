-- Migration: 0002_rls_real_tenant_tables
-- Adds row-level-security policies and the current_setting policy to all
-- real workspace-scoped tables. The pattern follows 0001
-- (tenant_isolation_probe).
--
-- Per D-13: app-level scoping + Postgres RLS backstop on all tenant-owned
-- tables. Prisma does not represent RLS policies in schema.prisma, so this raw
-- SQL migration is the source of truth for tenant isolation.
--
-- The migration may run with the DATABASE_URL role, but runtime application
-- queries are expected to run as the non-superuser app role. FORCE RLS ensures
-- table owners are also subject to policies where PostgreSQL applies them.

ALTER TABLE "workspace_member" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_member" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "workspace_member"
    USING ("workspaceId" = current_setting('app.current_workspace_id', true)::text)
    WITH CHECK ("workspaceId" = current_setting('app.current_workspace_id', true)::text);

ALTER TABLE "workspace_invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_invitation" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "workspace_invitation"
    USING ("workspaceId" = current_setting('app.current_workspace_id', true)::text)
    WITH CHECK ("workspaceId" = current_setting('app.current_workspace_id', true)::text);

ALTER TABLE "workspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "workspace"
    USING ("id" = current_setting('app.current_workspace_id', true)::text)
    WITH CHECK ("id" = current_setting('app.current_workspace_id', true)::text);
