---
phase: 02-multi-tenancy-foundation
plan: "04"
subsystem: auth-database-security
tags: [better-auth, prisma, postgres, rls, invitations, server-actions]
requires:
  - phase: 02-multi-tenancy-foundation
    provides: "Plans 02-01 through 02-03 implemented baseline auth, workspaces, invitations, and tenant helpers"
provides:
  - "Invitation acceptance verifies the signed-in user's email matches the invitation email"
  - "Invitation acceptance is POST-only through a Server Action"
  - "Tenant RLS context uses parameterized set_config() instead of raw SQL interpolation"
  - "RLS migration for workspace, workspace_member, and workspace_invitation"
affects: [phase-02-gap-closure, phase-03-template-authoring, phase-04-generation]
tech-stack:
  added: []
  patterns: ["PostgreSQL RLS policies live in raw Prisma migration SQL", "Invitation acceptance mutates only through Server Actions"]
key-files:
  created:
    - apps/web/prisma/migrations/0002_rls_real_tenant_tables/migration.sql
  modified:
    - apps/web/src/lib/workspaces/invitations.ts
    - apps/web/src/app/invitations/[id]/page.tsx
    - apps/web/src/lib/workspaces/actions.ts
    - apps/web/src/lib/db/tenant-db.ts
    - apps/web/prisma/schema.prisma
    - apps/web/tests/invitations.test.ts
    - apps/web/tests/tenant-isolation.test.ts
key-decisions:
  - "Existing invitation members are not role-overwritten on re-accept; upsert update clauses are no-ops."
  - "RLS workspace context uses SELECT set_config('app.current_workspace_id', value, true) so Prisma can bind the workspace value safely."
patterns-established:
  - "State-changing invitation acceptance is bound to a POST Server Action form."
  - "Real tenant tables receive ENABLE/FORCE ROW LEVEL SECURITY policies in dedicated raw SQL migrations."
requirements-completed: [WS-03, WS-04, WS-05]
duration: 8min
completed: 2026-06-03
---

# Phase 02 Plan 04: Gap Closure Summary

**Invitation acceptance authorization and real tenant-table RLS policies for the Phase 2 security gaps**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-03T13:47:00Z
- **Completed:** 2026-06-03T13:55:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added an email-match authorization check inside `acceptInvitation`, before any membership mutation.
- Converted invitation acceptance from a GET mutation into a POST-only Server Action form path.
- Replaced raw `SET LOCAL` string interpolation with parameterized `set_config()`.
- Added a raw SQL RLS migration for `workspace`, `workspace_member`, and `workspace_invitation`.

## Task Commits

1. **Task 1: Fix acceptInvitation email match + no-overwrite upsert** - `80784a0`
2. **Task 2: Convert invitation acceptance to POST Server Action** - `c35b2dc`
3. **Task 3: Parameterize tenant context + write RLS migration** - `f8b3f9e`

## Files Created/Modified

- `apps/web/src/lib/workspaces/invitations.ts` - Email mismatch rejection and idempotent upsert no-op updates.
- `apps/web/tests/invitations.test.ts` - Tests for mismatch rejection, case-insensitive match, and no role overwrite.
- `apps/web/src/lib/workspaces/actions.ts` - `acceptInvitationAction` Server Action.
- `apps/web/src/app/invitations/[id]/page.tsx` - Server Action POST form, no GET mutation.
- `apps/web/src/lib/db/tenant-db.ts` - Parameterized `set_config()` RLS context setting.
- `apps/web/prisma/schema.prisma` - Corrected RLS comment from `::uuid` to `::text`.
- `apps/web/prisma/migrations/0002_rls_real_tenant_tables/migration.sql` - RLS policies for real workspace tables.
- `apps/web/tests/tenant-isolation.test.ts` - Updated tenant helper tests for `$executeRaw`.

## Decisions Made

- Existing members keep their current role when accepting an invitation again. This avoids a bearer-link reaccept silently downgrading or changing privileges.
- `acceptInvitationAction` returns errors for direct callers, but the page form wraps it in a `void` Server Action to satisfy Next.js form action typing.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Typecheck rejected binding `acceptInvitationAction` directly to `<form action>` because it returns `ActionResult`. Fixed by adding a page-local `submitAcceptInvitation` Server Action that awaits it and returns `void`.

## Verification

- `pnpm --filter @pageforge/web test -- --reporter=verbose invitations` passed: 6 files, 162 tests.
- `pnpm --filter @pageforge/web test -- --reporter=verbose tenant-isolation` passed: 6 files, 162 tests.
- `pnpm --filter @pageforge/web test` passed: 6 files, 162 tests.
- `pnpm --filter @pageforge/web run typecheck` passed.
- Grep checks passed for no `method="GET"` acceptance form, no `executeRawUnsafe` in `tenant-db.ts`, three `ENABLE ROW LEVEL SECURITY`, three `FORCE ROW LEVEL SECURITY`, three `CREATE POLICY tenant_isolation`, and `update: {}` no-op upserts.

## User Setup Required

None for this plan. The RLS migration is written but intentionally applied in Plan 02-05.

## Next Phase Readiness

Ready for Plan 02-05 to apply migration `0002_rls_real_tenant_tables` to the live database and wire the members page forms to server actions.

---
*Phase: 02-multi-tenancy-foundation*
*Completed: 2026-06-03*
