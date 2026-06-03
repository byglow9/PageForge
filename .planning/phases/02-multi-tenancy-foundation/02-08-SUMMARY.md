---
phase: 02-multi-tenancy-foundation
plan: "08"
subsystem: workspaces/listing
tags: [workspace-listing, post-login-ux, server-component, non-rls-query, tdd]
dependency_graph:
  requires: ["02-06"]
  provides: [getUserWorkspaces, /workspaces-page]
  affects: [post-login-redirect, workspace-navigation]
tech_stack:
  added: []
  patterns: [server-component-with-guard, prisma-non-rls-query, vi-doMock-module-isolation]
key_files:
  created:
    - apps/web/src/lib/workspaces/listing.ts
    - apps/web/src/app/workspaces/page.tsx
  modified:
    - apps/web/src/app/(auth)/login/page.tsx
    - apps/web/tests/workspaces.test.ts
decisions:
  - "Read from organization/member (non-RLS better-auth tables) for workspace listing — same rationale as getWorkspaceContext in guards.ts; RLS-protected workspace/workspaceMember tables return no rows before app.current_workspace_id is set"
  - "userId sourced exclusively from requireVerifiedUser() session — never from URL param or client input, preventing cross-user enumeration (T-02-08-02)"
  - "Inline styles used for /workspaces/page.tsx to match the existing workspaces/new/page.tsx aesthetic — no Tailwind/shadcn yet"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-03T18:22:00Z"
  tasks_completed: 2
  files_changed: 4
---

# Phase 02 Plan 08: Workspace Listing (UAT Gap Closure) Summary

**One-liner:** Post-login workspace list page using non-RLS organization/member query with session-derived userId, closing UAT Test 10.

## What Was Built

### Task 1: getUserWorkspaces helper + TDD tests (commit c434412)

Created `apps/web/src/lib/workspaces/listing.ts` exporting:
- `UserWorkspace` interface: `{ workspaceId, name, slug, role }`
- `getUserWorkspaces(userId)`: queries `prisma.member.findMany({ where: { userId }, include: { organization: true }, orderBy: { organization: { name: 'asc' } } })` and maps to `UserWorkspace[]`. Returns empty array when user has no memberships.

Added 4 tests to `workspaces.test.ts` (TDD RED → GREEN):
1. Returns empty array when user has no memberships
2. Returns mapped `UserWorkspace[]` from two-member result
3. `workspaceId` equals `organization.id`
4. Does not call `prisma.workspace` or `prisma.workspaceMember` (RLS tables — T-02-08-03)

### Task 2: /workspaces index page + login redirect (commit 52d7bf3)

Created `apps/web/src/app/workspaces/page.tsx` as a Server Component:
- Calls `requireVerifiedUser()` first (redirects to /login or /verify-email if needed)
- Calls `getUserWorkspaces(user.id)` — userId from session, never from URL
- Zero-workspace state: centered prompt with "Create your first workspace" link to /workspaces/new
- Non-empty state: "Your workspaces" list with links to `/w/{slug}`, role label, and "Create another workspace" link

Updated `apps/web/src/app/(auth)/login/page.tsx`: changed `window.location.href = "/workspaces/new"` to `window.location.href = "/workspaces"`.

Also fixed a missing `afterEach` import in `workspaces.test.ts` discovered by typecheck (Rule 1 — auto-fix).

## Verification

- Tests: 173 passed, 10 skipped (183 total) — 4 new getUserWorkspaces tests all green
- Typecheck: clean (tsc --noEmit exits 0)
- Build: `pnpm build` exits 0; /workspaces appears as `ƒ (Dynamic)` server-rendered route

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing afterEach import in workspaces.test.ts**
- **Found during:** Task 2 typecheck run
- **Issue:** The new `getUserWorkspaces` describe block used `afterEach` but the file-level import from `vitest` only had `{ describe, it, expect, vi, beforeEach }` — TypeScript error TS2304
- **Fix:** Added `afterEach` to the import statement
- **Files modified:** apps/web/tests/workspaces.test.ts
- **Commit:** included in 52d7bf3

## Known Stubs

None. The workspace list is fully wired: `requireVerifiedUser()` → `getUserWorkspaces(user.id)` → rendered list with real `/w/{slug}` links.

## Threat Flags

No new threat surface introduced beyond the threat model defined in the plan. The /workspaces route gates on `requireVerifiedUser()` (T-02-08-01), uses session-derived userId (T-02-08-02), and reads from non-RLS tables (T-02-08-03) — all mitigations implemented.

## Self-Check: PASSED

- FOUND: apps/web/src/lib/workspaces/listing.ts
- FOUND: apps/web/src/app/workspaces/page.tsx
- FOUND commit c434412 (feat(02-08): getUserWorkspaces helper + TDD tests)
- FOUND commit 52d7bf3 (feat(02-08): /workspaces index page + login redirect)
- Tests: 173 passed | 10 skipped (183 total)
- Typecheck: clean
- Build: exits 0
