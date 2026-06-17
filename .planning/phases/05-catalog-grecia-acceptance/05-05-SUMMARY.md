---
phase: 05-catalog-grecia-acceptance
plan: "05"
subsystem: ui
tags: [next.js, react, template-editor, catalog, ux]

# Dependency graph
requires:
  - phase: 05-catalog-grecia-acceptance
    provides: CatalogGrid with folder/search/tag filtering and LP card grid
  - phase: 03-template-editor
    provides: TemplateEditor with createTemplateAction / updateTemplateAction
provides:
  - TemplateEditor redirects to edit route after first save (no duplicate template creation)
  - Single Save Template CTA (bottom action bar only, footer-primary pattern)
  - Single Generate LP CTA when catalog is empty (page-header only)
  - CatalogGrid search bar has top breathing room (pt-4)
affects: [05-uat, template-editor, lp-catalog]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "footer-primary CTA pattern: single primary action in the bottom action bar, breadcrumb-only in header (applied to both TemplateEditor and LP catalog)"
    - "post-create redirect: router.replace to edit route after successful create, preventing mode drift"

key-files:
  created: []
  modified:
    - apps/web/src/components/templates/TemplateEditor.tsx
    - apps/web/src/components/catalog/CatalogGrid.tsx

key-decisions:
  - "Post-create redirect (router.replace) chosen over in-place mode switch: navigates immediately after toast, avoids stale create form in browser history, warnings handled by edit page on next save"
  - "Footer-primary CTA pattern: Save Template lives in the bottom action bar; header toolbar is breadcrumb-only. Applied symmetrically with Generate LP in the catalog"
  - "Option A for Generate LP CTA: remove empty-state Link, keep page-header Link as the single primary action. No prop plumbing required"

patterns-established:
  - "Single-primary-CTA-per-state: one prominent action per UI state (create/edit/empty), never duplicated across toolbar and empty-state simultaneously"
  - "Post-create-redirect: after successful create server action, router.replace() to the edit URL so repeat saves are updates"

requirements-completed:
  - TPL-05
  - CAT-04

# Metrics
duration: 15min
completed: 2026-06-17
---

# Phase 05 Plan 05: Template Editor + Catalog CTA Gap-Closure Summary

**TemplateEditor now redirects to edit route after first save (eliminating duplicate-template creation), collapses to a single bottom-bar Save CTA, and the LP catalog empty state shows only one Generate LP CTA with a properly spaced search bar.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-17T13:20:00Z
- **Completed:** 2026-06-17T13:35:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Fixed UAT Test 9 (duplicate template creation): after `createTemplateAction` succeeds, `router.replace` navigates to `/w/[slug]/templates/[id]/edit` so all subsequent saves call `updateTemplateAction` on the same record
- Fixed UAT Test 9 (duplicate CTA): removed header toolbar Save button; bottom action-bar button is now the single Save Template CTA, establishing the footer-primary pattern
- Fixed UAT Test 2 (duplicate CTA): removed empty-state Generate LP Link from CatalogGrid; the page-header Link in `lps/page.tsx` is the sole primary CTA when the workspace is empty
- Fixed UAT Test 2 (cosmetic): changed SearchBar wrapper from `pt-0` to `pt-4` giving the search bar vertical breathing room below the header border

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix template double-save + collapse to one Save CTA** - `2e550b4` (fix)
2. **Task 2: Single Generate LP CTA + search-bar spacing in the catalog** - `6660f4e` (fix)

## Files Created/Modified

- `apps/web/src/components/templates/TemplateEditor.tsx` - Added `useRouter` + post-create `router.replace`; removed header toolbar Save button; removed unused `RefreshCw` import
- `apps/web/src/components/catalog/CatalogGrid.tsx` - Removed empty-state Generate LP Link + unused `Link` import; changed search wrapper to `pt-4 pb-2`

## Decisions Made

- **Post-create redirect (router.replace) over in-place mode switch:** Redirect is simpler, avoids stale form state in browser history, and the edit page surfaces schema warnings on its next save. Warnings panel during first-save is not a required UI-SPEC behavior.
- **Footer-primary CTA pattern:** The bottom action bar is the canonical Save location; the header toolbar holds breadcrumb navigation only. This is symmetric with the LP generate form and other multi-panel pages.
- **Option A for Generate LP CTA:** Remove the empty-state Link (no prop plumbing) and keep the page-header Link. `canCreate` gating is preserved on the surviving header CTA; the empty-state keeps its descriptive copy without a competing button.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Unused imports] Removed unused RefreshCw and Link imports**
- **Found during:** Task 1 and Task 2 (after removing UI elements that used those imports)
- **Issue:** After removing the header Save button, `RefreshCw` was imported but unused in TemplateEditor; after removing the empty-state Link, `Link` was imported but unused in CatalogGrid
- **Fix:** Removed the unused import lines
- **Files modified:** `apps/web/src/components/templates/TemplateEditor.tsx`, `apps/web/src/components/catalog/CatalogGrid.tsx`
- **Verification:** `npx tsc --noEmit` passes clean after each removal
- **Committed in:** `2e550b4` and `6660f4e` (part of task commits)

---

**Total deviations:** 1 auto-fixed (import cleanup, Rule 1)
**Impact on plan:** Minor cleanup only. No scope creep.

## Issues Encountered

None — TypeScript compiled clean after each change.

## Known Stubs

None — all changes are behavioral/structural, no placeholder data.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes were introduced. The only change at a trust boundary (T-05-05-01) is the client-side redirect after `createTemplateAction`, which routes subsequent saves through `updateTemplateAction` — server-side authorization gates remain unchanged.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- UAT Test 9 (duplicate template creation and duplicate Save CTA) and UAT Test 2 (duplicate Generate LP CTA and search-bar spacing) are resolved
- The footer-primary / single-CTA-per-state pattern is now established and documented for future UI work
- Single unresolved UAT item: toast feedback copy clarification (cosmetic, flagged for user input in prior SUMMARY) — not in scope here

---
*Phase: 05-catalog-grecia-acceptance*
*Completed: 2026-06-17*
