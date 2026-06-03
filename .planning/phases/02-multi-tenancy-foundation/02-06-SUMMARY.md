---
phase: 02-multi-tenancy-foundation
plan: "06"
subsystem: tenant-isolation-tests
tags: [postgres, prisma, rls, invitations, integration-tests]
requires:
  - phase: 02-multi-tenancy-foundation
    provides: "Plan 02-05 applied RLS migrations to the local pageforge database"
provides:
  - "DB-backed RLS tests for workspace_member, workspace_invitation, and workspace"
  - "DB-backed invitation authorization tests proving email mismatch rejection"
  - "RLS-compatible invitation lookup by opaque invitation ID"
affects: [phase-02-gap-closure, phase-03-template-authoring]
tech-stack:
  added: []
  patterns: ["Transaction-local set_config for RLS-protected invitation flows"]
key-files:
  created:
    - apps/web/prisma/migrations/0003_invitation_token_rls_lookup/migration.sql
  modified:
    - apps/web/src/lib/workspaces/invitations.ts
    - apps/web/tests/tenant-isolation.test.ts
    - apps/web/tests/invitations.test.ts
key-decisions:
  - "Invitation links are treated as opaque bearer IDs for reading exactly one invitation row before workspace context is known."
  - "Invitation create, accept, and revoke operations now set transaction-local RLS context before touching protected tables."
patterns-established:
  - "DB-required Vitest suites use describe.skipIf(!process.env.DATABASE_URL) and unique randomUUID fixtures."
  - "Live RLS assertions query pg_tables.rowsecurity rather than only checking migration SQL text."
requirements-completed: [WS-03, WS-04, WS-05]
duration: 18min
completed: 2026-06-03
---

# Phase 02 Plan 06: Gap Closure Summary

**DB-backed tenant isolation tests added and invitation flow made RLS-compatible**

## Performance

- **Duration:** 18 min
- **Started:** 2026-06-03T14:08:00Z
- **Completed:** 2026-06-03T14:26:00Z
- **Tasks:** 2
- **Files modified:** 3
- **Files created:** 1

## Accomplishments

- Added live PostgreSQL tests proving `workspace_member` reads are blocked without `app.current_workspace_id`.
- Added live PostgreSQL tests proving workspace A context cannot read workspace B member rows by direct ID.
- Added live `pg_tables.rowsecurity` assertions for `workspace_member`, `workspace_invitation`, and `workspace`.
- Added DB-backed invitation tests proving mismatched email rejection, successful matching-email acceptance, and cross-workspace denial.
- Fixed the discovered RLS regression where `acceptInvitation()` could not read a protected invitation before knowing the workspace.
- Added migration `0003_invitation_token_rls_lookup` with a narrow `SELECT` policy keyed by `app.current_invitation_id`.

## Task Commits

1. **Task 1: Add DB-level RLS integration tests** - `e29f236`
2. **Task 2: Add DB-backed invitation authorization tests** - `e29f236`

## Files Created/Modified

- `apps/web/prisma/migrations/0003_invitation_token_rls_lookup/migration.sql` - Adds `invitation_token_lookup` policy for opaque invite-link lookup.
- `apps/web/src/lib/workspaces/invitations.ts` - Wraps protected invitation operations in transaction-local RLS context.
- `apps/web/tests/tenant-isolation.test.ts` - Adds DB-required RLS integration suite.
- `apps/web/tests/invitations.test.ts` - Adds DB-backed invitation authorization suite and updates mocks for transactional RLS.

## Decisions Made

- Kept the broad tenant policy unchanged and added a separate invitation-token lookup policy for the pre-workspace invitation read.
- Did not open `workspace_invitation` to all pending rows. The new policy only exposes the row whose ID matches the transaction-local `app.current_invitation_id`.
- Kept DB integration tests conditional on `DATABASE_URL` so environments without PostgreSQL skip cleanly.

## Deviations from Plan

- The tests exposed an implementation bug: `acceptInvitation()` returned `Invitation not found` under forced RLS because it queried `workspace_invitation` before setting any RLS context.
- Added migration `0003_invitation_token_rls_lookup` and updated `createInvitation`, `lookupInvitation`, `acceptInvitation`, and `revokeInvitation` to set RLS context explicitly.

## Issues Encountered

- Existing mocked invitation tests assumed `lookupInvitation()` used raw Prisma calls. After making the helper transactional, the mocks needed a shared transaction-aware Prisma mock.
- Vitest filter arguments still executed all test files through the package script, but the full suite passed after the mock updates.

## Verification

- `set -a; . apps/web/.env; set +a; pnpm --filter @pageforge/web exec prisma migrate deploy` applied `0003_invitation_token_rls_lookup`.
- `set -a; . apps/web/.env; set +a; pnpm --filter @pageforge/web exec prisma migrate status` reported the database schema up to date.
- `pnpm --filter @pageforge/web run typecheck` passed.
- `set -a; . apps/web/.env; set +a; pnpm --filter @pageforge/web test -- --reporter=verbose invitations` passed: 6 files, 172 tests.
- `set -a; . apps/web/.env; set +a; pnpm --filter @pageforge/web test -- --reporter=verbose tenant-isolation` passed: 6 files, 172 tests.
- `set -a; . apps/web/.env; set +a; pnpm --filter @pageforge/web test` passed: 6 files, 172 tests.
- Acceptance greps passed for `DB-required`, `rowsecurity`, `different email address`, `current_invitation_id`, and `invitation_token_lookup`.

## User Setup Required

Local PostgreSQL must have migrations through `0003_invitation_token_rls_lookup` applied for DB-required tests to run.

## Next Phase Readiness

All gap-closure plans for Phase 02 now have summaries and passing automated gates. Phase-level verification can be rerun against the closed gaps.

---
*Phase: 02-multi-tenancy-foundation*
*Completed: 2026-06-03*
