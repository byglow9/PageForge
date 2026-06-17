---
phase: "05"
plan: "04"
subsystem: catalog
tags: [kebab-menu, dropdown, delete-folder, migration, rls]
dependency_graph:
  requires: []
  provides:
    - portaled-lp-catalog-kebab
    - non-destructive-folder-delete
    - catalog-migration-0005
  affects:
    - apps/web/src/components/catalog/LpCatalogCard.tsx
    - apps/web/src/lib/catalog/actions.ts
    - apps/web/prisma/migrations/0005_catalog_folders_tags/migration.sql
tech_stack:
  added: []
  patterns:
    - Base UI DropdownMenu portal pattern for overflow-hidden card escape
    - Prisma updateMany for safe bulk re-parenting inside transactions
    - Manual migration SQL with RLS parity for catalog tables
key_files:
  created:
    - apps/web/prisma/migrations/0005_catalog_folders_tags/migration.sql
  modified:
    - apps/web/src/components/catalog/LpCatalogCard.tsx
    - apps/web/src/lib/catalog/actions.ts
decisions:
  - "Portaled DropdownMenu (not overflow-visible card) to fix kebab clipping — portal is correct scope; editing card.tsx would affect all cards globally"
  - "Prisma updateMany replaces tx.$executeRaw for re-parenting — eliminates snake_case column name mismatch and keeps type safety"
  - "Migration 0005 includes landing_page + lp_asset (not just catalog delta) because db push was the only application mechanism for all post-0004 tables"
  - "RLS applied to all 5 catalog tables in migration and retroactively to dev DB (folder, landing_page, lp_asset, tag, lp_tag)"
metrics:
  duration: "~20 minutes"
  completed: "2026-06-17"
  tasks: 3
  files: 3
---

# Phase 05 Plan 04: Catalog Gap Closure — Kebab Clipping, Delete Folder Bug, and Migration Summary

**One-liner:** Fixed LpCatalogCard kebab clipping via DropdownMenu portal, deleted-folder raw SQL snake_case bug via Prisma updateMany, and committed the missing catalog migration 0005 with full RLS parity on folder/landing_page/lp_asset/tag/lp_tag.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Portalize LpCatalogCard kebab via DropdownMenu | 986567c | LpCatalogCard.tsx |
| 2 | Fix deleteFolderAction raw SQL → Prisma updateMany | 6b3ab53 | catalog/actions.ts |
| 3 | Generate Phase 5 catalog migration | b219b9b | migrations/0005_catalog_folders_tags/migration.sql |

## What Was Built

### Task 1 — LpCatalogCard kebab portalized (fixes UAT Tests 4/5/7/18)

**Root cause:** The kebab menu opened upward (`absolute right-0 bottom-full`) inside a `Card` component that hardcodes `overflow-hidden`. The top items "Move to folder…" and "Edit tags…" were clipped by the card boundary.

**Fix:** Replaced the custom toggle button + backdrop + absolute div pattern with shadcn DropdownMenu (Base UI `MenuPrimitive`), which portals `DropdownMenuContent` to `document.body` — escaping any ancestor `overflow-hidden`. Pattern mirrors `FolderContextMenu.tsx` from plan 05-03.

Changes:
- Added DropdownMenu/Trigger/Content/Item/Separator imports from `@/components/ui/dropdown-menu`
- Removed `menuOpen` useState (DropdownMenu manages its own open state)
- Removed `setMenuOpen(false)` from `handleDuplicate` and `handleExportZip`
- `DropdownMenuTrigger` takes the same button styling as the previous manual trigger
- All 6 menu items preserved in correct order: Move to folder…, Edit tags…, separator, Duplicate, Export ZIP, separator, Delete landing page

### Task 2 — deleteFolderAction raw SQL fixed (fixes UAT Test 16)

**Root cause:** Two `tx.$executeRaw` UPDATE statements used snake_case column names (`folder_id`, `parent_id`, `workspace_id`) that don't exist in the database. Prisma schema has no `@map` on columns — only `@@map` on tables — so the physical columns are camelCase (`folderId`, `parentId`, `workspaceId`). The error was swallowed by the generic `catch` and surfaced as "Failed to delete folder" toast.

**Fix:** Replaced both `$executeRaw` calls with Prisma `updateMany`:
```ts
// Before (broken):
await tx.$executeRaw`UPDATE landing_page SET folder_id = NULL WHERE workspace_id = ${workspaceId} AND folder_id = ${folderId}`;

// After (fixed):
await tx.landingPage.updateMany({ where: { workspaceId, folderId }, data: { folderId: null } });
```
Same pattern for subfolder re-parenting. RLS `set_config` line and `tx.folder.delete` remain unchanged.

### Task 3 — Migration 0005_catalog_folders_tags committed (fixes clean-env deploys)

**Context:** Migrations 0001-0004 only covered auth, workspace, template, and brand_config tables. Landing page catalog tables (folder, landing_page, lp_asset, tag, lp_tag) were applied only via `db push` in dev — meaning a clean environment (CI, new clone) would fail with "relation does not exist" on any catalog operation.

**What was included:**
- `folder` — workspaceId, name, parentId (nullable self-ref), unique(workspaceId, name, parentId), indexes
- `landing_page` — workspaceId, templateId, name, markupSnapshot, schemaVersion, values (jsonb), folderId (nullable FK to folder)
- `lp_asset` — workspaceId, landingPageId, s3Key, publicUrl, filename, mimeType, fileSize
- `tag` — workspaceId, name, unique(workspaceId, name)
- `lp_tag` — join table: landingPageId, tagId, workspaceId (denormalized for RLS)
- All foreign keys with correct CASCADE behavior

**RLS added (T-05-04-02 mitigate):**
All 5 tables: `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + `CREATE POLICY tenant_isolation` keyed on `current_setting('app.current_workspace_id', true)::text`. Pattern mirrors 0002_rls_real_tenant_tables and 0004_add_template_brand_config.

**Note:** Migration needed to include `landing_page` and `lp_asset` (not just folder/tag/lp_tag as the plan described) because all 5 tables were absent from migration history. The plan description was accurate about "catalog delta" but understated scope; including all 5 is the correct artifact.

**Verification:** Applied 0001→0005 against a fresh PostgreSQL database — all tables, indexes, foreign keys, and RLS policies created without errors. Shadow DB dropped after verification. RLS also applied retroactively to the dev DB.

## Deviations from Plan

### Auto-added scope

**1. [Rule 2 - Missing Critical Functionality] Migration includes landing_page + lp_asset**
- **Found during:** Task 3 investigation
- **Issue:** The plan said "CREATE TABLE folder, tag, lp_tag; ALTER TABLE landing_page ADD COLUMN folderId" but investigation showed `landing_page` itself was never migrated (only via db push). The migration history had no CREATE TABLE for landing_page, lp_asset, or any catalog table.
- **Fix:** Migration 0005 creates all 5 tables (folder, landing_page, lp_asset, tag, lp_tag) to make a clean-environment deploy possible.
- **Files modified:** migrations/0005_catalog_folders_tags/migration.sql

**2. [Rule 2 - Security] RLS applied to dev DB**
- **Found during:** Task 3 — dev DB had the tables but no RLS policies (db push doesn't apply RLS from SQL)
- **Fix:** After committing the migration, applied RLS directly to the dev DB's existing catalog tables to bring them in sync with the migration
- **Files modified:** Postgres DB state only (no file change)

## Known Stubs

None — all three fixes are implementation changes with no placeholder values.

## Threat Flags

None — no new network endpoints or auth paths introduced. RLS was added as required by T-05-04-02.

## Self-Check: PASSED

- [x] `apps/web/src/components/catalog/LpCatalogCard.tsx` — exists, contains `DropdownMenu` and `DropdownMenuContent`
- [x] `apps/web/src/lib/catalog/actions.ts` — exists, contains `updateMany` (no `$executeRaw` for re-parenting)
- [x] `apps/web/prisma/migrations/0005_catalog_folders_tags/migration.sql` — exists, contains CREATE TABLE folder/tag/lp_tag and landing_page with folderId
- [x] Commits 986567c, 6b3ab53, b219b9b — all present in git log
- [x] `npx tsc --noEmit` — no errors
