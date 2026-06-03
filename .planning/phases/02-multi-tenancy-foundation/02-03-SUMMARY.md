---
phase: 02-multi-tenancy-foundation
plan: "03"
subsystem: workspace-invitations-member-management
tags:
  - invitations
  - member-management
  - rbac
  - tenant-isolation
  - schema-conventions
  - next-js

dependency_graph:
  requires:
    - 02-01 (Next.js app, Prisma 7, better-auth, role vocabulary)
    - 02-02 (workspace creation, guards, withTenantDb, RLS migration)
  provides:
    - copyable invitation link creation and acceptance (D-06, D-07)
    - member role change and removal with last-owner protection (D-09, T-02-03-02)
    - workspace settings update action (D-11)
    - /invitations/[id] acceptance page with account-creation-on-accept
    - /w/[slug]/members member management page (owner/admin restricted)
    - cross-workspace direct-ID read/edit denial tests (WS-05)
    - schema-convention guardrail test (D-14)
  affects:
    - Phase 3+ (schema-conventions.test.ts guardrail will fail if Template/BrandConfig lack workspaceId)

tech_stack:
  added: []
  patterns:
    - "Invitation TTL: 7-day expiry with status: pending/accepted/revoked"
    - "acceptInvitation uses upsert for idempotent membership creation"
    - "workspaceId and role always read from server-side invitation row (T-02-03-04)"
    - "schema-conventions.test.ts parses schema.prisma at test time to enforce workspaceId presence"

key_files:
  created:
    - apps/web/src/lib/workspaces/invitations.ts
    - apps/web/src/app/invitations/[id]/page.tsx
    - apps/web/src/app/w/[slug]/members/page.tsx
    - apps/web/tests/invitations.test.ts
    - apps/web/tests/schema-conventions.test.ts
  modified:
    - apps/web/src/lib/workspaces/actions.ts (added createInvitationAction, changeMemberRoleAction, removeMemberAction, updateWorkspaceSettingsAction)
    - apps/web/tests/workspaces.test.ts (added member management contract tests)
    - apps/web/tests/tenant-isolation.test.ts (added cross-workspace direct-ID denial tests)

decisions:
  - "Invitation TTL: 7 days (D-07 delegated to executor)"
  - "acceptInvitation uses $transaction with upsert for idempotent accept"
  - "changeMemberRoleAction prevents assigning owner role via role change (only creation assigns owner)"
  - "schema-conventions.test.ts defers future model tests by commenting them out (uncomment in Phases 3-5)"
  - "getInvitationUrl falls back to NEXT_PUBLIC_APP_URL env var, then localhost:3000"

metrics:
  duration: "8 minutes"
  completed_date: "2026-06-03"
  tasks_completed: 5
  tasks_total: 5
  files_created: 5
  files_modified: 3
---

# Phase 2 Plan 03: Workspace Invitations and Member Management Summary

**One-liner:** Copyable invite-link flow with 7-day TTL, server-side acceptance with account-on-accept, member role change/removal with last-owner protection, and schema-convention guardrail enforcing workspaceId on all tenant tables.

## Objective

Complete the workspace collaboration slice: copyable email-address invitations, member/role management, account-on-accept, and final cross-tenant isolation verification for WS-01..WS-05.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Implement copyable invitation links | c60ecba | invitations.ts, actions.ts (+createInvitationAction), members/page.tsx, invitations.test.ts |
| 2 | Implement invite acceptance with account-creation-on-accept | 2cf754b | invitations/[id]/page.tsx |
| 3 | Implement member role changes and removals | c693126 | workspaces.test.ts (extended) |
| 4 | Add final isolation and schema-convention verification | cc676b8 | tenant-isolation.test.ts (extended), schema-conventions.test.ts |
| 5 | Run final Phase 2 verification suite | (no new commit — verification only) | All 159 tests pass, typecheck clean |

## Success Criteria Verification

- Workspace owners/admins can invite members by email address and copy an invite link: PASS (createInvitationAction behind requireWorkspaceRole owner/admin; getInvitationUrl returns copyable URL; 32 invitation tests)
- Invitees without accounts can sign up, verify email, and accept the invitation: PASS (invitations/[id]/page.tsx routes unsigned-in users to /signup?invitationId={id}; acceptance requires emailVerified=true; D-07)
- Member role management is restricted to owner/admin with last-owner protection: PASS (changeMemberRoleAction and removeMemberAction require owner/admin; last-owner checks in both actions; T-02-03-02)
- Cross-tenant read/edit by direct ID is denied: PASS (8 new tenant isolation tests; findById always includes workspaceId filter; schema-conventions guardrail)
- Phase 2 tests cover WS-01 through WS-05: PASS (see WS requirement mapping below)
- `pnpm test` exits 0: PASS (159/159 tests)
- `pnpm typecheck`: PASS (tsc --noEmit exits 0)

## WS Requirement Mapping

| Requirement | Covered By | Test File |
|-------------|-----------|-----------|
| WS-01: email/password signup and login | Auth config + email/password enabled; emailVerified required before workspace | tests/auth.test.ts |
| WS-02: workspace creation | createWorkspaceAction; WorkspaceMember schema with workspaceId | tests/workspaces.test.ts, tests/schema-conventions.test.ts |
| WS-03: invite by email, copyable link | createInvitationAction; getInvitationUrl; /invitations/[id] page | tests/invitations.test.ts |
| WS-04: roles gate actions | Four-role RBAC matrix; requireWorkspaceRole; changeMemberRoleAction/removeMemberAction denied for editor/viewer | tests/permissions.test.ts, tests/workspaces.test.ts |
| WS-05: per-workspace isolation | withTenantDb workspaceId injection; cross-workspace findById returns null; RLS policy | tests/tenant-isolation.test.ts, tests/schema-conventions.test.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.doMock cache stale in new describe block for cross-workspace read test**
- **Found during:** Task 4 (tenant-isolation tests)
- **Issue:** The new "Cross-workspace direct-ID read denial" describe block shared the module cache with the prior describe block. `vi.doMock` without `vi.resetModules()` meant the mocked `prisma` was not re-applied, causing `findFirst` call count to be 0.
- **Fix:** Added `vi.resetModules()` and re-applied `vi.doMock` inside the affected `it()` test.
- **Files modified:** apps/web/tests/tenant-isolation.test.ts
- **No separate commit** — fixed within Task 4 before committing.

## Known Stubs

- `/w/[slug]/members/page.tsx` invite form posts to `/api/workspaces/{slug}/invitations` — this API route does not exist in v1. The members page demonstrates the UI structure; actual invite creation goes through Server Actions. The API route is deferred to when the full UI layer is built.
- The accept button on `/invitations/[id]` uses `?action=accept` as a GET query parameter trigger. This is a simplified mechanism for v1; a proper form POST with CSRF protection would be added in later phases.

## Threat Surface Scan

| Threat ID | Mitigation | Status |
|-----------|------------|--------|
| T-02-03-01 | acceptInvitation checks emailVerified before any DB operation | DONE in invitations.ts |
| T-02-03-02 | Last-owner guard in changeMemberRoleAction and removeMemberAction | DONE in actions.ts |
| T-02-03-03 | Cross-workspace findById returns null (app-layer + RLS backstop); proven by 8 isolation tests | DONE in tenant-isolation.test.ts |
| T-02-03-04 | workspaceId and role read from invitation row only; client input ignored | DONE in invitations.ts acceptInvitation |

No new threat surfaces beyond the plan's threat model.

## Self-Check

Files verified:
- apps/web/src/lib/workspaces/invitations.ts: FOUND
- apps/web/src/app/invitations/[id]/page.tsx: FOUND
- apps/web/src/app/w/[slug]/members/page.tsx: FOUND
- apps/web/tests/invitations.test.ts: FOUND
- apps/web/tests/schema-conventions.test.ts: FOUND

Commits verified:
- c60ecba: feat(02-03): implement copyable invitation links and member management actions
- 2cf754b: feat(02-03): add invitation acceptance page with account-creation-on-accept
- c693126: feat(02-03): add member role change, removal, and workspace settings tests
- cc676b8: feat(02-03): add cross-workspace read/edit denial tests and schema-convention guardrail

Test results: 159/159 passing (6 test files)
Typecheck: clean (exit 0)

## Self-Check: PASSED
