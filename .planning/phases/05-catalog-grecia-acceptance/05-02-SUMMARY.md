---
phase: "05"
plan: "02"
subsystem: catalog-tags-search-layout
tags: [catalog, tags, search, filter, two-panel-layout, lp-catalog-card, client-side-filtering]
dependency_graph:
  requires:
    - "05-01"  # Folder, Tag, LpTag models; catalog Server Actions; FolderTree + dialogs
    - "04-lp-generation-assets-preview-export"  # LandingPage model, listLpsAction
  provides:
    - "LpCatalogCard — folder badge + tag chips + Move/Edit tags kebab items"
    - "TagInput — chip input for tag assign/remove with setTagsForLpAction"
    - "CatalogSearchBar — client-side name filter"
    - "CatalogFilterBar — workspace tag vocabulary pills (single-select)"
    - "CatalogGrid — two-panel layout client component with folder+search+tag filtering"
    - "lps/page.tsx — RSC with parallel data load: lps+folders+tags+lpTags"
    - "listAllLpTagsForWorkspaceAction — single-query LP→tags map"
    - "listLpsAction updated to include folderId"
  affects:
    - "apps/web/src/app/w/[slug]/lps/page.tsx"
    - "apps/web/src/lib/lps/actions.ts"
    - "apps/web/src/lib/catalog/actions.ts"
    - "apps/web/src/lib/db/tenant-db.ts"
tech_stack:
  added: []
  patterns:
    - "CatalogGrid client component holds all filter state (selectedFolderId, searchQuery, activeTagId)"
    - "BFS subtree expansion for folder scoping (D-10): getSubtreeFolderIds from flat adjacency list"
    - "Promise.all parallel data load in RSC page (lps + folders + workspaceTags + lpTags)"
    - "Single-query listAllForWorkspace: lpTag.findMany with include tag, grouped by caller"
    - "TagInput: immediate persist on remove; batch persist on Enter/blur via setTagsForLpAction"
    - "LpCatalogCard: self-contained (does not import LpCard) — safe to diverge independently"
key_files:
  created:
    - apps/web/src/components/catalog/LpCatalogCard.tsx
    - apps/web/src/components/catalog/TagInput.tsx
    - apps/web/src/components/catalog/CatalogSearchBar.tsx
    - apps/web/src/components/catalog/CatalogFilterBar.tsx
    - apps/web/src/components/catalog/CatalogGrid.tsx
  modified:
    - apps/web/src/app/w/[slug]/lps/page.tsx
    - apps/web/src/lib/lps/actions.ts
    - apps/web/src/lib/catalog/actions.ts
    - apps/web/src/lib/db/tenant-db.ts
decisions:
  - "CatalogGrid is a client component holding filter state; RSC page passes pre-loaded data — avoids client-side data fetching while keeping filtering instant (D-08)"
  - "listAllLpTagsForWorkspaceAction uses a single DB query (lpTag.findMany with include: { tag }) — avoids N+1 when the LP grid has many cards"
  - "LpCatalogCard is self-contained (reproduces LpCard structure) — not importing LpCard — so it can diverge independently per plan spec"
  - "TagInput batches adds on Enter/blur but persists removes immediately — better UX: remove is always instant, adds are confirmed on commit"
  - "Empty state detection in CatalogGrid: workspace empty vs folder empty vs search empty — each has distinct copy per UI-SPEC"
metrics:
  duration_minutes: 9
  completed_date: "2026-06-11"
  tasks_completed: 3
  files_changed: 9
---

# Phase 5 Plan 02: Catalog Tags Search Layout Summary

**One-liner:** Two-panel catalog page with LpCatalogCard (folder badge + tag chips), TagInput, CatalogSearchBar, CatalogFilterBar, and CatalogGrid for client-side folder/search/tag filtering — full CAT-01/03/04 catalog experience live.

## What Was Built

### Task 1 — LpCatalogCard (commit 48655a7)

Created `apps/web/src/components/catalog/LpCatalogCard.tsx` as a self-contained "use client" component.

- Extends LpCard structure (copied, not imported) with folder badge and tag chips in CardContent.
- **Folder badge**: `Badge variant="secondary"` showing the folder name resolved from the `folders` prop; only rendered when `lp.folderId` is set.
- **Tag chips**: up to 3 `Badge variant="secondary"` chips; `+N more` badge for overflow.
- **New kebab items** (prepended before Duplicate): "Move to folder…" (opens `MoveLpDialog`) and "Edit tags…" (opens inline `TagInputDialog` modal wrapping `TagInput`).
- On move success: optimistic `currentFolderId` state update + `router.refresh()`.
- On tag dialog close: `router.refresh()` for canonical reload.
- All original LpCard behaviors retained: Preview/Edit links, Duplicate, Export ZIP, Delete landing page.

### Task 2 — TagInput + CatalogSearchBar + CatalogFilterBar (commit ceee041)

Three "use client" components:

**TagInput** (`TagInput.tsx`, ~175 lines):
- Chip input rendering current tags as `Badge secondary` with `aria-label="Remove tag {name}"` × buttons.
- Add on Enter or comma keystroke; max 32 chars per tag (D-07 silently skips); max 10 tags (D-07 disables input + shows "Maximum 10 tags reached.").
- Immediate persist on remove; batch persist on Enter/blur via `setTagsForLpAction`.
- Error: `toast.error("Failed to save tags.")`.

**CatalogSearchBar** (`CatalogSearchBar.tsx`):
- Full-width `Input` with `Search` icon (Lucide 16px, absolutely positioned left).
- Placeholder "Search landing pages…"; `aria-label="Search landing pages"`.
- Controlled by props; no debounce; no API call (D-08).

**CatalogFilterBar** (`CatalogFilterBar.tsx`):
- "All" pill always first; one pill per workspace tag.
- Active style: `bg-gray-900 text-white rounded-full px-3 py-1 text-sm font-medium`.
- Inactive style: `border border-gray-200 bg-white text-gray-700 rounded-full px-3 py-1 text-sm`.
- Single-select toggle; `aria-pressed` per pill; `role="group"` on container.
- Tag names as React text nodes (T-05-02-01: no `dangerouslySetInnerHTML`).

### Task 3 — Catalog page two-panel layout + filtering integration (commits e652049, e32e201)

**CatalogGrid** (new client component, `~220 lines`):
- Props: `lps`, `lpTagsMap` (`Record<lpId, TagModel[]>`), `folders`, `workspaceTags`, `slug`, `canCreate`, `canManage`.
- State: `selectedFolderId`, `searchQuery`, `activeTagId`.
- Folder subtree filtering (D-10): BFS from `selectedFolderId` via `getSubtreeFolderIds()` over the flat adjacency list.
- Name + tag AND filter (D-08/D-09): case-insensitive substring match + `lpTagsMap[lp.id].some(t => t.id === activeTagId)`.
- Layout: `FolderTree w-60 shrink-0 border-r border-gray-200 py-4 px-2` (left) + `flex-1 px-6 py-0` (right).
- Three empty states: workspace empty → "No landing pages yet" + CTA; folder empty → "This folder is empty."; search empty → "No landing pages match your search."

**lps/page.tsx** (restructured):
- `Promise.all([listLpsAction, listFoldersAction, listWorkspaceTagsAction, listAllLpTagsForWorkspaceAction])`.
- Page header with `pb-6 border-b` separator above two-panel `CatalogGrid`.
- `canManage = ctx.role !== "viewer"` — gates FolderTree mutations.

**listLpsAction** updated:
- Added `folderId: lp.folderId` to the returned LP shape.

**listAllLpTagsForWorkspaceAction** (new in `catalog/actions.ts`):
- Single query joining `lp_tag + tag` for the workspace; returns `Record<string, TagModel[]>`.

**TenantTagHelpers.listAllForWorkspace** (new in `tenant-db.ts`):
- `tx.lpTag.findMany({ where: { workspaceId }, include: { tag: true } })`.
- Returns `Array<{ landingPageId, tag }>` for grouping by caller.

## Deviations from Plan

### Foundation Files Restored (worktree catch-up — not a real deviation)

The worktree branch was created before Plan 01 executed on master. Files generated by Plan 01 (Folder/Tag/LpTag Prisma models, catalog actions, FolderTree dialogs, TenantClient helpers) were absent from the worktree's working tree, causing TypeScript resolution failures. Fixed by restoring all Plan 01 files from the `2e98cd0c` master commit into the worktree branch (commit `a5420e8`). Not a deviation from plan spec — a worktree setup artifact.

### TypeScript Verification Strategy

The verification commands in the plan run `npx tsc --noEmit` in `apps/web/` — this requires `node_modules` which exists in the main repo, not the worktree. Ran TypeScript verification from the main repo by copying the new files there. All files compile with zero errors.

### CatalogGrid as Separate File

The plan described CatalogGrid as a component to create in `apps/web/src/components/catalog/CatalogGrid.tsx`. This was implemented as a separate file (as implied by the plan) rather than inlining it in page.tsx, which is the cleaner pattern that preserves the RSC/client boundary.

## Known Stubs

None. All components call real Server Actions; all data paths are wired to the DB via `withTenantDb`. Placeholder text (`"Search landing pages…"`, `"Add a tag…"`) is intentional UI copy, not data stubs.

## Threat Flags

No new threat surface beyond what is documented in the plan's `<threat_model>`:

- T-05-02-01/02: Tag names in CatalogFilterBar and TagInput rendered as React text nodes — no `dangerouslySetInnerHTML`.
- T-05-02-03: `setTagsForLpAction` validates `lpId` via `db.lp.findById(workspaceId filter)` before tag assignment.
- T-05-02-04: `SetTagsSchema` enforces max 10 tags / max 32 chars server-side (D-07).
- T-05-02-05: `listAllLpTagsForWorkspaceAction` scoped by `workspaceId` from session; workspace-level metadata only.
- T-05-02-06: `activeTagId` is pure client-side UI state; no server-side query uses it as untrusted param.

## Self-Check: PASSED

- [x] `apps/web/src/components/catalog/LpCatalogCard.tsx` — exists, "use client", renders folder badge + tag chips + Move/Edit tags kebab items
- [x] `apps/web/src/components/catalog/TagInput.tsx` — exists, "use client", aria-label on remove, max 32/10 enforcement
- [x] `apps/web/src/components/catalog/CatalogSearchBar.tsx` — exists, "use client", correct placeholder, aria-label
- [x] `apps/web/src/components/catalog/CatalogFilterBar.tsx` — exists, "use client", "All" pill + tag pills, aria-pressed
- [x] `apps/web/src/components/catalog/CatalogGrid.tsx` — exists, "use client", folder/search/tag filtering + three empty states
- [x] `apps/web/src/app/w/[slug]/lps/page.tsx` — restructured RSC with Promise.all parallel load + CatalogGrid
- [x] `apps/web/src/lib/catalog/actions.ts` — `listAllLpTagsForWorkspaceAction` added
- [x] `apps/web/src/lib/lps/actions.ts` — `listLpsAction` now includes `folderId` in return shape
- [x] `apps/web/src/lib/db/tenant-db.ts` — `TenantTagHelpers.listAllForWorkspace` added and implemented
- [x] Commits a5420e8, 48655a7, ceee041, e652049, e32e201 all exist in git log
- [x] `npx tsc --noEmit` exits 0 (no new errors) — verified in main repo
