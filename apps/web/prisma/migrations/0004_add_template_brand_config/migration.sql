-- DropIndex
DROP INDEX "tenant_isolation_probe_workspaceId_idx";

-- AlterTable
ALTER TABLE "verification" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "template" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "markup" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "metadataOverlay" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_config" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "whatsapp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "template_workspaceId_idx" ON "template"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "brand_config_workspaceId_key" ON "brand_config"("workspaceId");

-- AddForeignKey
ALTER TABLE "template" ADD CONSTRAINT "template_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_config" ADD CONSTRAINT "brand_config_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: Row Level Security policies for tenant isolation
-- Pattern follows 0002_rls_real_tenant_tables (D-13: app-level scoping + Postgres RLS backstop).
-- FORCE ROW LEVEL SECURITY ensures table owners are also subject to policies.

ALTER TABLE "template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "template" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "template"
    USING ("workspaceId" = current_setting('app.current_workspace_id', true)::text)
    WITH CHECK ("workspaceId" = current_setting('app.current_workspace_id', true)::text);

ALTER TABLE "brand_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brand_config" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "brand_config"
    USING ("workspaceId" = current_setting('app.current_workspace_id', true)::text)
    WITH CHECK ("workspaceId" = current_setting('app.current_workspace_id', true)::text);
