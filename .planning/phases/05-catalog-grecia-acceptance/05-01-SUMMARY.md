---
phase: "05"
plan: "01"
subsystem: catalog-folders-tags
tags: [catalog, folders, tags, prisma-schema, server-actions, ui-components]
dependency_graph:
  requires:
    - "04-lp-generation-assets-preview-export"  # LandingPage model, withTenantDb, actions pattern
    - "02-multi-tenancy-workspace-rbac"          # withTenantDb, requireWorkspaceRole
  provides:
    - "Folder model + folderId on LandingPage — DB schema + Prisma client"
    - "TenantFolderHelpers + TenantTagHelpers in TenantClient"
    - "lib/catalog Server Actions — listFoldersAction, createFolderAction, renameFolderAction, deleteFolderAction, moveLpAction, setTagsForLpAction, listTagsForLpAction, listWorkspaceTagsAction"
    - "FolderTree + FolderContextMenu + Create/Rename/Delete/Move dialogs"
  affects:
    - "apps/web/prisma/schema.prisma"
    - "apps/web/src/lib/db/tenant-db.ts"
    - "apps/web/src/generated/prisma/*"
tech_stack:
  added: []
  patterns:
    - "Flat adjacency-list folder tree assembled client-side (D-02: unlimited depth)"
    - "Non-destructive folder delete via $executeRaw batch re-parent (D-03)"
    - "Tag normalization: trim + toLowerCase before upsert (D-07)"
    - "Atomic setTagsForLp: deleteMany + createMany in same withTenantDb tx"
key_files:
  created:
    - apps/web/src/lib/catalog/schema.ts
    - apps/web/src/lib/catalog/actions.ts
    - apps/web/src/components/catalog/FolderTree.tsx
    - apps/web/src/components/catalog/FolderContextMenu.tsx
    - apps/web/src/components/catalog/CreateFolderDialog.tsx
    - apps/web/src/components/catalog/RenameFolderDialog.tsx
    - apps/web/src/components/catalog/DeleteFolderDialog.tsx
    - apps/web/src/components/catalog/MoveLpDialog.tsx
    - apps/web/src/generated/prisma/models/Folder.ts
    - apps/web/src/generated/prisma/models/Tag.ts
    - apps/web/src/generated/prisma/models/LpTag.ts
  modified:
    - apps/web/prisma/schema.prisma
    - apps/web/src/lib/db/tenant-db.ts
    - apps/web/src/generated/prisma/models/LandingPage.ts
    - apps/web/src/generated/prisma/models/Workspace.ts
    - apps/web/src/generated/prisma/models.ts
    - apps/web/src/generated/prisma/client.ts
    - apps/web/src/generated/prisma/browser.ts
decisions:
  - "Flat adjacency list fetched once per page load, assembled client-side — avoids recursive DB queries; unlimited-depth tree (D-02) rendered by FolderNode component"
  - "deleteFolderAction uses raw $executeRaw for batch re-parenting (not a loop over child IDs) — single SQL UPDATE per table in same Prisma $transaction (D-03, T-05-01-03)"
  - "FolderContextMenu uses custom div kebab pattern (same as LpCard) — NOT shadcn DropdownMenu per plan spec (reserved for Plan 03)"
  - "Workspace.lpTags back-relation added to schema for referential integrity with LpTag.workspaceId"
metrics:
  duration_minutes: 20
  completed_date: "2026-06-11"
  tasks_completed: 4
  files_changed: 19
---

# Phase 5 Plan 01: Catalog Folders Vertical Slice Summary

**One-liner:** Folder + Tag + LpTag Prisma models with DB migration, TenantClient folder/tag helpers, 7 catalog Server Actions, and a recursive FolderTree with context menu and dialogs — all workspace-isolated.

## What Was Built

### Task 1 — Schema: Folder, Tag, LpTag + folderId on LandingPage (commit f003222)

Three new models added to `apps/web/prisma/schema.prisma` following the tenant-owned table pattern:

- **Folder**: self-referential via `parentId` (null = top-level), `@@unique([workspaceId, name, parentId])` prevents duplicate names at the same level, `@@index([parentId])` for tree traversal.
- **Tag**: normalized workspace vocabulary, `@@unique([workspaceId, name])` for deduplication (D-06).
- **LpTag**: join table with denormalized `workspaceId` for RLS, `@@unique([landingPageId, tagId])`.
- **LandingPage** gains `folderId String?` (nullable, D-01) with `onDelete: SetNull` as DB-level backstop.
- **Workspace** gains `folders`, `tags`, `lpTags` back-relations.

`npx prisma db push` succeeded — tables `folder`, `tag`, `lp_tag` created; `folder_id` column added to `landing_page`. Prisma client regenerated with all new types.

### Task 2 — TenantClient extensions (commit 0ab4108)

- **TenantFolderHelpers** interface: `create`, `findById`, `list`, `update`, `delete` — no `isDescendantOf` (folder move deferred, T-05-01-04).
- **TenantTagHelpers** interface: `upsertByName` (normalizes to lowercase), `listWorkspaceTags`, `assignToLp`, `removeFromLp`, `listForLp`, `setTagsForLp` (atomic delete+insert).
- **TenantLpHelpers.update** extended to accept `folderId?: string | null` (D-01).
- Both helpers implemented inside `withTenantDb` with full `workspaceId` scoping.

### Task 3 — lib/catalog Server Actions (commit 2f18ea4)

- `lib/catalog/schema.ts`: `CreateFolderSchema`, `RenameFolderSchema`, `DeleteFolderSchema`, `MoveLpSchema`, `SetTagsSchema` (D-07 constraints).
- `lib/catalog/actions.ts`: 7 exported Server Actions with `"use server"` directive.
  - **deleteFolderAction**: non-destructive (D-03) — uses `prisma.$transaction` with two `$executeRaw` UPDATE statements to batch re-parent LPs and subfolders to root before deleting the folder row.
  - **moveLpAction**: validates both `lpId` and `folderId` against workspace (T-05-01-02); `folderId: null` moves LP to root.
  - **setTagsForLpAction**: normalizes to lowercase, deduplicates, caps at 10/LP (D-07).

### Task 4 — FolderTree + Dialogs (commit bb0928d)

- **FolderTree.tsx** (330 lines): recursive adjacency-list tree with `All LPs` root, 16px/level indent, expand/collapse chevrons, `canManage` gating, `router.refresh()` after mutations.
- **FolderContextMenu.tsx**: custom div kebab (same pattern as LpCard) with 3 items: New subfolder / Rename / Delete folder — no Move folder (deferred).
- **CreateFolderDialog.tsx**: shadcn Dialog with inline name validation and toast feedback.
- **RenameFolderDialog.tsx**: pre-filled dialog; syncs on folder prop change.
- **DeleteFolderDialog.tsx**: body copy mentions both LPs AND subfolders moving to root (D-03 reconciliation).
- **MoveLpDialog.tsx**: flat indented folder list with Root option (folderId null = All LPs).

All interactive elements use `<button>` elements per UI-SPEC accessibility requirements.

## Deviations from Plan

### Clarifications Applied (not deviations — required for correctness)

1. **Workspace.lpTags back-relation**: The plan spec said "Add to model Workspace: folders Folder[], tags Tag[]" but did not explicitly mention `lpTags LpTag[]`. Added it because `LpTag` has a `workspace Workspace @relation(...)` that requires a back-relation in the `Workspace` model for Prisma to compile. This is a required structural addition.

2. **deleteFolderAction isolation**: The plan spec suggested using `withTenantDb` for the delete operation, but since `deleteFolderAction` needs `$executeRaw` for batch re-parenting (not exposed through `TenantClient`), the action uses `prisma.$transaction` directly with `set_config` applied manually — consistent with the pattern in `createWorkspaceAction`. The RLS setting is still applied correctly.

## Known Stubs

None. All actions connect to real DB helpers; all components call real Server Actions.

## Threat Flags

No new threat surface beyond what is documented in the plan's `<threat_model>`.

- New network endpoints: none (Server Actions are not REST endpoints).
- New auth paths: none (same `requireWorkspace` / `requireWorkspaceRole` guards).
- Schema changes at trust boundaries: `folderId` is nullable FK on `landing_page` with `onDelete: SetNull` — correctly isolated via `withTenantDb`.

## Self-Check: PASSED

- [x] `apps/web/prisma/schema.prisma` — contains `model Folder`, `model Tag`, `model LpTag`, `folderId` on LandingPage
- [x] `apps/web/src/lib/catalog/schema.ts` — exists with all 5 schemas
- [x] `apps/web/src/lib/catalog/actions.ts` — exists with 7 Server Actions
- [x] `apps/web/src/lib/db/tenant-db.ts` — TenantClient has `folder` and `tag` properties
- [x] `apps/web/src/components/catalog/` — all 6 component files exist
- [x] Commits f003222, 0ab4108, 2f18ea4, bb0928d all exist in git log
- [x] `npx prisma validate` exits 0
- [x] `npx tsc --noEmit` exits 0 (no new errors)
- [x] `npx prisma db push` succeeded — tables created in DB
