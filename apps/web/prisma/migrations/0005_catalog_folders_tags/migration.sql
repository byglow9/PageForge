-- Migration: 0005_catalog_folders_tags
-- Adds landing_page, lp_asset, folder, tag, and lp_tag tables for the
-- Phase 5 catalog feature (CAT-02 folders, CAT-03 tags).
--
-- Context: migrations 0001-0004 created the auth, workspace, template, and
-- brand_config tables. This migration captures the catalog schema delta that
-- was previously applied only via `prisma db push` in the dev environment.
--
-- Per D-13: all tenant-owned tables have ENABLE ROW LEVEL SECURITY +
-- FORCE ROW LEVEL SECURITY + tenant_isolation policy keyed on
-- current_setting('app.current_workspace_id', true)::text.
-- Pattern mirrors 0002_rls_real_tenant_tables and 0004_add_template_brand_config.
--
-- IMPORTANT: folder must be created before landing_page (FK reference).

-- ------------------------------------------------------------
-- CreateTable: folder
-- D-02: unlimited depth via self-referential parentId (null = top-level)
-- D-03: non-destructive delete — LPs and subfolders re-parent to root
-- ------------------------------------------------------------

CREATE TABLE "folder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "folder_workspaceId_name_parentId_key" ON "folder"("workspaceId", "name", "parentId");

-- CreateIndex
CREATE INDEX "folder_workspaceId_idx" ON "folder"("workspaceId");

-- CreateIndex
CREATE INDEX "folder_parentId_idx" ON "folder"("parentId");

-- AddForeignKey
ALTER TABLE "folder" ADD CONSTRAINT "folder_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "folder" ADD CONSTRAINT "folder_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- CreateTable: landing_page
-- D-01: folderId nullable — null means root ("All LPs")
-- D-06: markupSnapshot captures template at generation time
-- D-11: name is user-provided at generation time
-- ------------------------------------------------------------

CREATE TABLE "landing_page" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "markupSnapshot" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "values" JSONB NOT NULL,
    "folderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_page_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "landing_page_workspaceId_idx" ON "landing_page"("workspaceId");

-- CreateIndex
CREATE INDEX "landing_page_folderId_idx" ON "landing_page"("folderId");

-- AddForeignKey
ALTER TABLE "landing_page" ADD CONSTRAINT "landing_page_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "landing_page" ADD CONSTRAINT "landing_page_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- CreateTable: lp_asset
-- Tracks S3 keys for images uploaded per LP (cleanup on LP delete)
-- ------------------------------------------------------------

CREATE TABLE "lp_asset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "landingPageId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lp_asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lp_asset_workspaceId_idx" ON "lp_asset"("workspaceId");

-- CreateIndex
CREATE INDEX "lp_asset_landingPageId_idx" ON "lp_asset"("landingPageId");

-- AddForeignKey
ALTER TABLE "lp_asset" ADD CONSTRAINT "lp_asset_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lp_asset" ADD CONSTRAINT "lp_asset_landingPageId_fkey"
    FOREIGN KEY ("landingPageId") REFERENCES "landing_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- CreateTable: tag
-- D-05: free-form tags forming a shared deduplicated workspace vocabulary
-- D-07: normalized (trim, lowercase) before upsert
-- @@unique([workspaceId, name]) enforces dedup
-- ------------------------------------------------------------

CREATE TABLE "tag" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tag_workspaceId_name_key" ON "tag"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "tag_workspaceId_idx" ON "tag"("workspaceId");

-- AddForeignKey
ALTER TABLE "tag" ADD CONSTRAINT "tag_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- CreateTable: lp_tag
-- Join table between landing_page and tag.
-- workspaceId denormalized for RLS policy enforcement.
-- ------------------------------------------------------------

CREATE TABLE "lp_tag" (
    "id" TEXT NOT NULL,
    "landingPageId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "lp_tag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lp_tag_landingPageId_tagId_key" ON "lp_tag"("landingPageId", "tagId");

-- CreateIndex
CREATE INDEX "lp_tag_landingPageId_idx" ON "lp_tag"("landingPageId");

-- CreateIndex
CREATE INDEX "lp_tag_tagId_idx" ON "lp_tag"("tagId");

-- CreateIndex
CREATE INDEX "lp_tag_workspaceId_idx" ON "lp_tag"("workspaceId");

-- AddForeignKey
ALTER TABLE "lp_tag" ADD CONSTRAINT "lp_tag_landingPageId_fkey"
    FOREIGN KEY ("landingPageId") REFERENCES "landing_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lp_tag" ADD CONSTRAINT "lp_tag_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lp_tag" ADD CONSTRAINT "lp_tag_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- RLS: Row Level Security for tenant isolation
-- Pattern follows 0002_rls_real_tenant_tables and 0004_add_template_brand_config.
-- FORCE ROW LEVEL SECURITY ensures table owners are also subject to policies.
-- T-05-04-02: catalog tables must enforce workspace_id boundaries (mitigate).
-- ------------------------------------------------------------

ALTER TABLE "folder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "folder" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "folder"
    USING ("workspaceId" = current_setting('app.current_workspace_id', true)::text)
    WITH CHECK ("workspaceId" = current_setting('app.current_workspace_id', true)::text);

ALTER TABLE "landing_page" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "landing_page" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "landing_page"
    USING ("workspaceId" = current_setting('app.current_workspace_id', true)::text)
    WITH CHECK ("workspaceId" = current_setting('app.current_workspace_id', true)::text);

ALTER TABLE "lp_asset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lp_asset" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "lp_asset"
    USING ("workspaceId" = current_setting('app.current_workspace_id', true)::text)
    WITH CHECK ("workspaceId" = current_setting('app.current_workspace_id', true)::text);

ALTER TABLE "tag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tag" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tag"
    USING ("workspaceId" = current_setting('app.current_workspace_id', true)::text)
    WITH CHECK ("workspaceId" = current_setting('app.current_workspace_id', true)::text);

ALTER TABLE "lp_tag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lp_tag" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "lp_tag"
    USING ("workspaceId" = current_setting('app.current_workspace_id', true)::text)
    WITH CHECK ("workspaceId" = current_setting('app.current_workspace_id', true)::text);
