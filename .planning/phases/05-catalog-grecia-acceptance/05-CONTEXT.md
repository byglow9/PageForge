# Phase 5: Catalog & Grécia Acceptance - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the **catalog organization layer** over the LP records that Phase 4 already
persists, plus the **v1 acceptance anchor**: the real "Grécia" travel template authored
and driven end to end through the full pipeline.

Covers CAT-02 (organize LPs into nestable folders), CAT-03 (categorize/tag LPs), and
CAT-04 (browse + search the catalog). CAT-01 (LPs saved to a catalog) was already
satisfied in Phase 4 — the `LandingPage` model exists; this phase organizes those records.

In scope:
- **Folders** (CAT-02): nestable folder tree scoped to the workspace; each LP lives in
  exactly one folder (or the root); create / rename / delete / move operations.
- **Tags** (CAT-03): free-form tags forming a shared, deduplicated workspace vocabulary,
  persisted relationally; assign/remove tags on an LP.
- **Browse + search** (CAT-04): folder-tree navigation + client-side name/tag filtering
  and tag-pill filtering, per the locked `05-UI-SPEC.md` interaction contract.
- **Grécia acceptance**: author the real Grécia template through the Phase 3 authoring UI,
  generate→preview→edit→duplicate→export a complete LP, and fix any gaps the real template
  reveals in the pipeline. This is the v1 acceptance test.

Out of scope (other phases / deferred):
- **Per-folder member permissions** — v2 PERM-01 (permissions live at workspace level in v1).
- **Server-side / paginated search** — v1 uses client-side filtering at workspace scale.
- **Pixel-perfect visual reproduction** of the original Grécia site — acceptance bar is
  structural completeness + layout fidelity, not pixel parity.
- **Visual design of the catalog surfaces** — already locked in `05-UI-SPEC.md`.
- **Platform-hosted LP URLs** — v2 HOST-01; v1 stays export/download only.
</domain>

<decisions>
## Implementation Decisions

### Folder Model (CAT-02)
- **D-01:** An LP belongs to **exactly one folder** (filesystem metaphor). Implemented as a
  nullable `folderId` on `LandingPage`; `null` = root ("All LPs"). "Move to folder" simply
  reassigns `folderId`. Rejected a multi-folder junction (conflicts with the UI-SPEC "move"
  metaphor and adds complexity for no v1 benefit).
- **D-02:** Folders nest to **unlimited depth**. A `Folder` model is self-referential via a
  nullable `parentId` (`null` = top level). The tree renders recursively (UI-SPEC indents
  16px/level). Move operations **must be cycle-safe** (a folder cannot be moved into itself
  or one of its own descendants).
- **D-03:** Deleting a folder is **non-destructive**: its LPs **and** its subfolders are
  re-parented to the **root** (`folderId`/`parentId` → `null`). Nothing is cascade-deleted.
  > Note: `05-UI-SPEC.md` delete-folder body copy currently mentions only that "Landing
  > pages inside will be moved to the root catalog." It should also reflect that **subfolders**
  > move to the root. Minor copy reconciliation for the planner/executor.
- **D-04:** New LPs are created at the **root** (`folderId = null`) by default and organized
  afterward. No folder picker is added to the Phase 4 generation flow.

### Tags / Categories (CAT-03)
- **D-05:** Tags are **free-form** and form a **shared, deduplicated workspace vocabulary**.
  A tag is created the first time it is used; there is no separate management screen. This is
  exactly what the UI-SPEC `CatalogFilterBar` assumes ("one pill per unique tag in the
  workspace"). Rejected a managed category list and the category+tags hybrid as out of scope
  for CAT-03 / over-engineered for v1.
- **D-06:** Tags are persisted **relationally**: a `Tag` model (`workspaceId`, `name`,
  `@@unique([workspaceId, name])`) + an `LpTag` join table. This lets the FilterBar list
  workspace tags efficiently, supports usage counts / orphan cleanup, and keeps the shared
  vocabulary canonical. Rejected a `String[]` column on `LandingPage` (forces scanning all
  LPs to derive the pill set; no global rename/cleanup).
- **D-07:** Tag **normalization**: trim whitespace, **case-insensitive deduplication**
  (`Promo` == `promo`), **max 32 chars** (matches UI-SPEC TagInput), and a per-LP cap of
  ~10 tags. Keeps the shared vocabulary clean and the FilterBar manageable.

### Browse + Search (CAT-04)
- **D-08:** Search/filter is **client-side**. The server loads the LPs in scope (the selected
  folder subtree); name+tag filtering and tag-pill filtering run in the browser, instant, no
  per-keystroke API call. Matches the UI-SPEC. Rejected server-side ILIKE+pagination as
  beyond v1 catalog scale.
- **D-09:** Search **scope = LP name (case-insensitive substring) + tags**. Folder names are
  navigation (the tree exposes them), not search targets.
- **D-10:** Search/filter respects the **selected folder + its descendants**; selecting the
  root ("All LPs") searches the whole workspace. Filesystem-explorer behavior.
  > Interaction note for the planner: the `CatalogFilterBar` pills represent the **workspace-wide**
  > tag vocabulary (D-05/D-06), but applying a pill filters within the **current folder scope**
  > (D-10). A pill may therefore yield zero results in a narrow folder — that's expected and
  > handled by the UI-SPEC "No landing pages match your search." empty state.

### Grécia Acceptance (Success Criterion 3 — the v1 anchor)
- **D-11:** Acceptance bar = **structurally complete + layout-faithful**, not pixel-perfect.
  All Grécia sections (hero, repeatable highlight cards, "what's included" cards, day-by-day
  itinerary, differentiators, testimonials, CTA, footer) must be authorable via tokens and
  the **full pipeline** must work (generate→preview→edit→duplicate→export). Pixel parity with
  the original site is explicitly NOT required.
- **D-12:** Authoring the **real Grécia template through the Phase 3 authoring UI is a
  deliverable** of this phase, and **fixing any gaps it reveals** (missing/insufficient field
  type, unsupported token pattern, layout-fidelity defect) is in scope. This is the fire test
  that validates the whole v1 product, not a throwaway fixture check.
- **D-13:** Verification = **manual UAT checklist** for the full Grécia loop (visual fidelity
  is human judgment) **plus a few Playwright E2E checks** at the critical points (generate,
  ZIP export). Matches the verification pattern of prior phases.

### Claude's Discretion
- Exact Prisma shape of the new `Folder`, `Tag`, and `LpTag` models (must carry `workspaceId`,
  follow the tenant-owned pattern with `@@map`, and live behind `withTenantDb`).
- Whether folder move / LP move use a dialog vs. inline submenu (UI-SPEC allows either).
- The recursive folder-tree fetch/serialization shape (e.g., adjacency list loaded once and
  assembled client-side vs. recursive query) — a planning detail, given unlimited depth (D-02).
- Cycle-prevention implementation for folder moves (D-02).
- Default catalog ordering (e.g., most-recently-updated first) — not discussed; planner's call.
- Where the real Grécia markup/values are seeded from (the existing `tests/fixtures/grecia-*`
  are reference inputs, but D-12 requires going through the real authoring UI).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 5: Catalog & Grécia Acceptance" — goal, the 3 success
  criteria (folders+nesting, tag/browse/search, Grécia end-to-end anchor), `**Mode:** mvp`,
  CAT-01..04 mapping.
- `.planning/REQUIREMENTS.md` §"Catalog" (CAT-01 saved to catalog, CAT-02 folders, CAT-03
  categorize/tag, CAT-04 browse+search) and §"Acceptance Anchor" (the Grécia end-to-end test
  verified in Phase 5). Note §"Out of Scope": per-folder permissions (PERM-01) are v2.

### Locked UI / interaction contract (this phase)
- `.planning/phases/05-catalog-grecia-acceptance/05-UI-SPEC.md` — APPROVED design contract:
  FolderTree, FolderContextMenu, Create/Rename/Delete folder dialogs, TagInput,
  CatalogSearchBar, CatalogFilterBar, LpCatalogCard; layout, copywriting, spacing/typography/
  color tokens; `dropdown-menu` is the one new shadcn install. Decisions here MUST honor it.
  (Reconcile the delete-folder body copy per D-03 to mention subfolders.)

### LP data model & feature module (Phase 4 — what this phase organizes)
- `apps/web/prisma/schema.prisma` §`model LandingPage` (`workspaceId`, `templateId?`, `name`,
  `markupSnapshot`, `schemaVersion`, `values` jsonb) and §`model LpAsset`. The new `Folder`/
  `Tag`/`LpTag` models follow this tenant-owned pattern; `LandingPage` gains a nullable
  `folderId` (D-01) and a tags relation (D-06).
- `apps/web/src/lib/lps/` (`actions.ts`, `render.ts`, `reconcile.ts`, `schema.ts`,
  `schema-derive.ts`) — the LP Server Actions + render path; catalog actions (folder/tag CRUD,
  move, tag assign) extend this module or a sibling `catalog/` module mirroring its shape.
- `apps/web/src/components/lps/` (`LpCard.tsx`, `LpForm.tsx`, `LpPreview.tsx`,
  `RepeaterBlock.tsx`, `RichTextField.tsx`, `ImageUploadField.tsx`) — `LpCatalogCard` extends
  `LpCard`; kebab/dialog/toast patterns are reused per the UI-SPEC.
- `apps/web/src/app/w/[slug]/lps/` (`page.tsx`, `new/`, `[lpId]/edit/`, `[lpId]/preview/`) —
  the catalog layout enhances the existing `/w/[slug]/lps` route (UI-SPEC keeps the URL).
- `.planning/phases/04-lp-generation-assets-preview-export/04-CONTEXT.md` — LP = values-as-data
  / HTML-derived (D-06 snapshot), preview==export pipeline, user names LP at generation (D-11),
  duplicate = full independent copy (D-12). These constrain how the catalog treats LP records.

### Tenant isolation (Phase 2 — the layer all new tables live behind)
- `apps/web/src/lib/db/tenant-db.ts` — `withTenantDb` / `withWorkspaceTenantDb`: mandatory data
  layer. `Folder`, `Tag`, `LpTag` access and all catalog Server Actions MUST go through it.
- `apps/web/src/lib/workspaces/guards.ts` — `requireWorkspace` / `requireWorkspaceRole`;
  workspaceId + role come from the server session, never client input.
- `apps/web/src/lib/auth/permissions.ts` — role gating for folder/tag/move/delete operations.

### Engine + Grécia acceptance inputs (Phase 1 / fixtures)
- `src/engine/index.ts`, `src/engine/renderer.ts` — `parse`/`render` contract the Grécia
  template exercises end to end (D-11/D-12). Gaps the real template reveals may surface here.
- `tests/fixtures/grecia-template.html`, `tests/fixtures/grecia-values.ts`,
  `tests/__snapshots__/grecia.output.html` — existing reference inputs for the Grécia template
  (used by engine tests). Reference for authoring the real template through the UI (D-12), not
  a substitute for the authoring path.
- `renova-turismo-jornada-main/src/pages/Grecia.tsx` + `src/components/campaigns/grecia/`,
  `src/assets/grecia/` — the **original** Grécia campaign site; the visual/structural reference
  for what the authored template must reproduce (layout-faithful, D-11).

### Tech stack
- `CLAUDE.md` — Next.js 16 App Router + React 19, **shadcn/ui + Tailwind 4** (catalog UI),
  Prisma 7 (`Folder`/`Tag`/`LpTag` migrations), Zod 4 (Server Action input validation),
  **Playwright** (the few E2E acceptance checks, D-13), Postgres `jsonb` already used for LP
  values. `dropdown-menu` is the one new shadcn component (UI-SPEC).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`LandingPage` model + `lib/lps/`** — the catalog is an organization layer over existing LP
  records; add `folderId` + tags relation and new catalog Server Actions rather than reworking
  LP storage.
- **`LpCard` + kebab/dialog/toast patterns** — `LpCatalogCard` extends `LpCard`; folder dialogs
  reuse the established shadcn `Dialog` + `sonner` toast conventions (UI-SPEC).
- **`withTenantDb` / `requireWorkspace` / `requireWorkspaceRole`** — Phase 2 helpers; every new
  table and Server Action in this phase routes through them (workspace isolation, WS-05).
- **Existing `/w/[slug]/lps` route + layout (`w-60` sidebar, `px-8 py-6`)** — the catalog layout
  enhances this page in place (UI-SPEC keeps the URL).

### Established Patterns
- **Feature module shape**: Server Actions + Zod schema + guards per domain (`lib/templates/`,
  `lib/brand/`, `lib/lps/`). A `lib/catalog/` (folders + tags) should mirror it.
- **Tenant-owned tables**: `workspaceId` on every row, `@@map`, accessed via `withTenantDb`.
- **Snapshot/independence model**: LPs are self-sufficient (markup snapshot, D-06 from Phase 4);
  duplicate = full independent copy (D-12). Catalog ops (move, tag) only touch organization
  metadata, never the LP's rendered output.

### Integration Points
- `LandingPage.folderId` (new, nullable) → FolderTree filtering (D-01/D-10).
- `Tag` + `LpTag` (new) → TagInput (assign) and CatalogFilterBar (workspace vocabulary, D-05/D-06).
- Phase 3 authoring UI → real Grécia template authored here (D-12); any gap → fix in
  templates/engine code.
- Full Phase 4 pipeline (generate→preview→edit→duplicate→export) → exercised end to end by the
  Grécia acceptance loop (D-11/D-13).

</code_context>

<specifics>
## Specific Ideas

- Treat the catalog like a **file explorer**: one home per LP, unlimited nested folders,
  non-destructive delete that lifts contents to the root, and folder-scoped search that
  includes descendants. Predictable, familiar mental model.
- Tags are a **living workspace vocabulary** — typing a new tag grows the shared set; the
  FilterBar reflects the union; normalization (case-insensitive, trimmed, 32-char) keeps it
  from fragmenting into `Promo`/`promo`/`PROMO`.
- The **Grécia template is the v1 fire test**: author it for real through the product, and any
  friction it exposes (a missing field type, a token that won't express a section, a layout
  that drifts) is a bug to fix in this phase — that's the point of the anchor.

</specifics>

<deferred>
## Deferred Ideas

- **Per-folder member permissions** — v2 PERM-01; permissions stay at workspace level in v1.
- **Server-side / paginated catalog search** — revisit if a workspace's LP count outgrows
  comfortable client-side filtering. v1 is client-side (D-08).
- **Managed category list / category+tags hybrid** — considered for CAT-03, rejected for v1 in
  favor of free-form shared tags (D-05). Could return if a controlled taxonomy is needed.
- **Pixel-perfect Grécia reproduction** — acceptance is structural + layout-faithful (D-11);
  exact visual parity with the original site is not a v1 goal.
- **Folder picker at LP generation time** — LPs start at root and are organized afterward
  (D-04); an at-creation picker could be a later convenience.
- **Full automated E2E of the entire authoring→export flow** — v1 uses manual UAT + targeted
  Playwright checks (D-13); broader automated coverage can come later.

None of the above blocks Phase 5.

</deferred>

---

*Phase: 5-Catalog & Grécia Acceptance*
*Context gathered: 2026-06-10*
