---
phase: "09"
plan: "01"
subsystem: lps/overrides
tags: [zod, schemas, overrides, brand-theme, vite-spa, server-actions]
dependency_graph:
  requires: []
  provides:
    - PfOverrideSchema (apps/web/src/lib/lps/schema.ts)
    - ViteSpaValuesSchema (apps/web/src/lib/lps/schema.ts)
    - SaveViteSpaOverridesSchema (apps/web/src/lib/lps/schema.ts)
    - updateLpAction VITE_SPA override persistence (apps/web/src/lib/lps/actions.ts)
    - buildBrandStyleTagForLp (apps/web/src/lib/brand/theme.ts)
  affects:
    - Plan 02: imports buildBrandStyleTagForLp and SaveViteSpaOverridesSchema for shim injection
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN for schema and theme function
    - W1 pattern — read override fields from raw input (UpdateLpSchema strips unknown keys)
    - Merge-not-replace pattern for values jsonb update
key_files:
  created:
    - apps/web/src/lib/lps/schema.test.ts
  modified:
    - apps/web/src/lib/lps/schema.ts
    - apps/web/src/lib/lps/actions.ts
    - apps/web/src/lib/brand/theme.ts
    - apps/web/src/lib/brand/theme.test.ts
decisions:
  - "PfOverrideSchema type enum includes image/href (Phase 11 reserved) — drawn extensible now to avoid retrabalho"
  - "Override fields read from raw input (not parsed.data) in updateLpAction — W1: UpdateLpSchema.safeParse strips unknown keys"
  - "Merge-not-replace: absent optional fields preserve existing values in LandingPage.values jsonb"
  - "buildBrandStyleTagForLp uses ?? null-coalescing: lpColor ?? workspaceColor passed to existing buildBrandStyleTag"
metrics:
  duration: "316s (5m 16s)"
  completed: "2026-06-24"
  tasks_completed: 3
  files_modified: 5
---

# Phase 9 Plan 01: Override Schema + Action Extension + Theme Function Summary

**One-liner:** Zod override schemas (PfOverride/ViteSpaValues/SaveViteSpaOverrides), updateLpAction VITE_SPA branch extended to persist overrides into LandingPage.values jsonb, and buildBrandStyleTagForLp for per-LP color precedence over workspace brand color.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing schema tests | b888e83 | schema.test.ts (created) |
| 1 (GREEN) | Implement PfOverride + ViteSpaValues + SaveViteSpaOverrides schemas | fdc79ae | schema.ts |
| 2 | Extend updateLpAction VITE_SPA branch | 0a12333 | actions.ts |
| 3 (RED) | Add failing buildBrandStyleTagForLp tests | 7447361 | theme.test.ts |
| 3 (GREEN) | Implement buildBrandStyleTagForLp | 284a859 | theme.ts |

## What Was Built

### PfOverrideSchema (schema.ts)
Zod schema for a single runtime override entry:
- `path: z.string().min(1)` — deterministic node path from SPA root (e.g. `/0/2/1`)
- `originalHash: z.string().min(1)` — original content hash for Phase 12 drift detection
- `type: z.enum(['text', 'color', 'image', 'href'])` — extensible enum; shim applies text/color in Phase 9
- `value: z.string()` — plain string, applied via textContent (never innerHTML)

### ViteSpaValuesSchema (schema.ts)
Full shape of `LandingPage.values` for VITE_SPA LPs:
- `overrides: z.array(PfOverrideSchema).default([])` — defaults to [] when parsing sentinel {}
- `primaryColorOverride: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()` — per-LP brand color

### SaveViteSpaOverridesSchema (schema.ts)
Action payload for `updateLpAction`:
- `id: z.string().cuid()` — LP to update (scoped by withTenantDb — T-09-01-02)
- `overrides: z.array(PfOverrideSchema).optional()` — absent = preserve existing
- `primaryColorOverride: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()` — absent = preserve existing

### updateLpAction VITE_SPA branch (actions.ts)
Extended to accept `overrides?: PfOverride[]` and `primaryColorOverride?: string` in input type.

**W1 compliance:** Both fields read from raw `input` parameter (not `parsed.data`) because `UpdateLpSchema.safeParse` strips unknown keys. Validated separately via `SaveViteSpaOverridesSchema` inside the VITE_SPA branch.

**Merge behavior:** When override payload is present, merges with existing `LandingPage.values` (absent fields preserved). When payload absent, `values` is not included in `db.lp.update` call (no regression for name/entryRoute-only updates).

### buildBrandStyleTagForLp (theme.ts)
New exported function:

```typescript
buildBrandStyleTagForLp(
  primaryColorOverride: string | null | undefined,
  workspacePrimaryColor: string | null | undefined
): string
```

Logic: `buildBrandStyleTag(primaryColorOverride ?? workspacePrimaryColor)`. LP color takes precedence; falls back to workspace color; returns '' when both absent.

## Tests

- `schema.test.ts`: 12 tests covering all three schemas — all passing
- `theme.test.ts`: 5 new tests for `buildBrandStyleTagForLp` — all passing (27 total; pre-existing 4 failures in `GenerateViteSpaLpSchema` describe block are out of scope — see Deferred Issues)

## Deviations from Plan

### Pre-existing Test Failures (Out of Scope)
**Found during:** Task 3 verification
**Issue:** 4 tests in `theme.test.ts > GenerateViteSpaLpSchema` fail because `templateId: "cm1234567890abcdefghi"` is a cuid but `GenerateViteSpaLpSchema` uses `.uuid()` validation. These failures **pre-existed** before this plan's changes (confirmed via `git stash` comparison).
**Action:** Logged to deferred-items — NOT fixed (out of scope per scope boundary rule).
**Impact:** None on this plan's deliverables — all 5 new `buildBrandStyleTagForLp` tests pass; all 12 `schema.test.ts` tests pass; TypeScript compiles clean.

## Known Stubs

None. No UI-facing stubs or placeholder data introduced. Plan 02 will wire `buildBrandStyleTagForLp` and the override schemas into the serve/export routes.

## Threat Surface Scan

All threat model items addressed:

| Threat ID | Status |
|-----------|--------|
| T-09-01-01 | Mitigated: `SaveViteSpaOverridesSchema.safeParse` validates every field before `db.lp.update` |
| T-09-01-02 | Mitigated: `db.lp.findById(id)` scoped via `withTenantDb(workspaceId)` — cross-tenant returns null |
| T-09-01-03 | Mitigated: `/^#[0-9a-fA-F]{6}$/` regex on `primaryColorOverride` in both schemas |
| T-09-01-04 | Accepted: RLS on `landing_page` table (workspace_id = current_setting) — per existing Phase 8 setup |
| T-09-01-05 | Mitigated: `updateLpAction` gates on `requireWorkspaceRole(['owner','admin','editor'])` |

No new threat surface introduced beyond what was planned.

## Self-Check

### Created files exist
- `apps/web/src/lib/lps/schema.test.ts` — FOUND
- `apps/web/src/lib/brand/theme.ts` (modified) — FOUND
- `apps/web/src/lib/brand/theme.test.ts` (modified) — FOUND
- `apps/web/src/lib/lps/schema.ts` (modified) — FOUND
- `apps/web/src/lib/lps/actions.ts` (modified) — FOUND

### Commits exist
- b888e83 — FOUND (test: RED schema)
- fdc79ae — FOUND (feat: schemas)
- 0a12333 — FOUND (feat: actions)
- 7447361 — FOUND (test: RED theme)
- 284a859 — FOUND (feat: theme)

## Self-Check: PASSED
