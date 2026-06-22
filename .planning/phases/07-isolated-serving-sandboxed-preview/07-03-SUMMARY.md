---
phase: 07-isolated-serving-sandboxed-preview
plan: "03"
subsystem: preview
tags: [preview, sandboxed-iframe, hmac, type-boundary, csp, security, rsc, checkpoint]
dependency_graph:
  requires:
    - apps/web/src/lib/serve/token.ts          # mintServeToken — created in Plan 01
    - apps/web/src/lib/serve/serve-vite-spa.ts  # assertViteSpaKind — Plan 01 (tested here, D-08)
    - apps/web/src/lib/workspaces/guards.ts     # requireWorkspaceRole, WorkspaceContext (existing)
    - apps/web/src/lib/db/tenant-db.ts          # withTenantDb + template.findById (existing)
  provides:
    - apps/web/src/app/w/[slug]/project-templates/[id]/preview/page.tsx  # dashboard preview UI (sandboxed iframe)
    - apps/web/tests/type-boundary.test.ts                               # D-08 reciprocal guard tests
  affects:
    - Dashboard navigation — preview reachable directly by URL (no sidebar link added; polish deferred)
tech_stack:
  added: []
  patterns:
    - RSC preview page minting HMAC serve token server-side (token never generated client-side, T-07-03-03)
    - sandbox="allow-scripts" iframe with NO allow-same-origin → opaque origin, document.cookie === "" (PRJ-05 / SC3)
    - serveOrigin construction via NODE_ENV split (dev *.serve.localhost / prod *.serve.SERVE_DOMAIN) (D-01, D-02)
    - withTenantDb workspace-scoped template lookup for IDOR prevention (T-07-03-04)
    - NEXT_REDIRECT/NEXT_NOT_FOUND re-throw inside try/catch (Next.js internals must not be swallowed)
    - synchronous expect(() => assertViteSpaKind(...)).toThrow() (sync guard, not async .rejects)
key_files:
  created:
    - apps/web/src/app/w/[slug]/project-templates/[id]/preview/page.tsx
  modified:
    - apps/web/tests/type-boundary.test.ts
decisions:
  - "D-01 realized: serveOrigin built from templateId UUID as subdomain at root path for iframe src"
  - "D-02 realized: NODE_ENV==='development' selects http://{id}.serve.localhost:{PORT} vs https://{id}.serve.{SERVE_DOMAIN}"
  - "D-03 realized: cross-origin sandboxed iframe shares no PageForge session cookie — opaque origin guarantee (SC3 human-verify)"
  - "D-06 realized: dedicated preview route embeds <iframe sandbox='allow-scripts'> (no allow-same-origin); CSP frame-ancestors enforced by Plan 02 serving handler"
  - "D-08 realized: type-boundary.test.ts extended with assertViteSpaKind tests — LIQUID rejected, VITE_SPA passes (bidirectional guard complete)"
  - "Auth: requireWorkspaceRole allows all roles (owner/admin/editor/viewer) — any member can preview; redirects to /login if unauthenticated (T-07-03-03)"
metrics:
  duration_seconds: 90
  completed_date: "2026-06-22"
  task_count: 3
  file_count: 2
---

# Phase 7 Plan 03: Sandboxed Preview Page + Type-Boundary Tests Summary

**One-liner:** RSC preview page that mints an HMAC serve token server-side and embeds a cross-origin `sandbox="allow-scripts"` iframe (opaque origin → no session-cookie exposure), plus the D-08 reciprocal type-boundary tests proving `assertViteSpaKind` rejects LIQUID.

## Execution Note

The code for Tasks 1 and 2 was authored and committed in a prior wave-2 worktree merge before this SUMMARY was produced. Both target files already existed at the worktree base (`b5789613`) as committed `feat(07-03)` commits:
- Task 1 (tests): commit `053c261`
- Task 2 (preview page): commit `bab5545`

This executor run verified the committed work against every acceptance criterion (greps, vitest, tsc — all pass) and produced the missing 07-03-SUMMARY.md. No source code re-write was needed; the implementation matches the plan exactly. Task 3 is a blocking `checkpoint:human-verify` that cannot be automated — it is recorded below as pending human confirmation.

## What Was Built

### Task 1: type-boundary.test.ts — D-08 reciprocal guard tests

Extended `apps/web/tests/type-boundary.test.ts` with a second `describe` block, `"type boundary (V2-11) — serve path"`, importing `assertViteSpaKind` from `@/lib/serve/serve-vite-spa`. The original two `renderLp` tests are unchanged.

New tests (synchronous — `assertViteSpaKind` is sync, so `.toThrow()` not `.rejects.toThrow()`):
- `expect(() => assertViteSpaKind("LIQUID")).toThrow("Type boundary violation")`
- `expect(() => assertViteSpaKind("VITE_SPA")).not.toThrow()`

This completes the bidirectional type guard (PRJ-11): `renderLp` rejects VITE_SPA, `assertViteSpaKind` rejects LIQUID.

**Result:** 4/4 tests pass.

### Task 2: preview/page.tsx — sandboxed iframe preview page

Created `apps/web/src/app/w/[slug]/project-templates/[id]/preview/page.tsx` — a React Server Component (no `"use client"`, does not import `renderLp`).

Flow:
1. `await params` (Next.js 16 async params) → `{ slug, id }`.
2. `requireWorkspaceRole(slug, ["owner", "admin", "editor", "viewer"])` — auth gate is the first await; unauthenticated → `/login`. `workspaceId` taken exclusively from the session context (T-07-03-03).
3. `withTenantDb({ workspaceId }, db => db.template.findById(id))` — workspace-scoped lookup; null → `redirect(/w/{slug}/project-templates)` (IDOR prevention, T-07-03-04).
4. `mintServeToken(ctx.workspaceId, id)` — token minted server-side, embedded in the iframe `src` of the server-rendered HTML (never client-side).
5. `serveOrigin` constructed via `NODE_ENV` split (D-01/D-02).
6. Renders `<iframe src={`${serveOrigin}/?t=${token}`} sandbox="allow-scripts" ... />` — **no `allow-same-origin`** (PRJ-05/SC3), with an explanatory security comment.
7. `try/catch` re-throws `NEXT_REDIRECT`/`NEXT_NOT_FOUND` and shows a recovery UI for all other errors.

### Task 3: checkpoint:human-verify (gate=blocking) — PENDING

SC1–SC5 require a running browser + live MinIO + Next.js stack with a real VITE_SPA template. Browser-level cookie inspection cannot be automated via vitest. Recorded as pending human verification (full instructions in the checkpoint report returned to the orchestrator).

## Verification Performed (automated, this run)

| Check | Command | Result |
|-------|---------|--------|
| Type-boundary tests | `npx vitest run tests/type-boundary.test.ts` | 4 passed (2 existing + 2 new) |
| TypeScript | `npx tsc --noEmit` | exit 0 (clean) |
| `mintServeToken` present | grep | yes (server-side mint) |
| `allow-scripts` present | grep | yes |
| `allow-same-origin` absent | grep -c | **0** (critical — PRJ-05/SC3) |
| `requireWorkspaceRole` gate | grep | yes |
| serveOrigin constructed | grep | yes (dev + prod branches) |
| `NEXT_REDIRECT`/`NEXT_NOT_FOUND` re-throw | grep | yes |
| describe blocks | grep -c | 2 |

Note on grep counts: the plan anticipated counts of exactly 1 for several patterns; actual counts are higher because the same identifiers (`mintServeToken`, `allow-scripts`) also appear in JSDoc/security comments. The load-bearing security criterion — `allow-same-origin` count of 0 — holds.

## Deviations from Plan

None — plan executed as written. The implementation present at the worktree base matches every `<action>` and `<acceptance_criteria>` item. No deviation rules (1–4) were triggered.

## Known Stubs

None. The preview page is fully wired: real session-derived `workspaceId`, real `template.findById` lookup, real `mintServeToken` call. No placeholder/mock data paths.

## Pending Human Verification (Task 3 — SC1–SC5)

This plan is NOT fully verified. The blocking checkpoint awaits human confirmation that, in Chrome against `*.serve.localhost`:
- SC1: serving origin returns 200 with the SPA `index.html`
- SC2: preview iframe shows `sandbox="allow-scripts"` only
- SC3 (critical): `document.cookie === ""` inside the iframe context
- SC4: cross-tenant token → 403
- SC5: SPA sub-route fallback resolves via index.html (no spurious 404)

Resume signal: type `approved` when all 5 pass.

## Self-Check: PASSED

- FOUND: apps/web/src/app/w/[slug]/project-templates/[id]/preview/page.tsx (committed bab5545)
- FOUND: apps/web/tests/type-boundary.test.ts (assertViteSpaKind block, committed 053c261)
- FOUND: commit 053c261 (test extension)
- FOUND: commit bab5545 (preview page)
