---
phase: 02-multi-tenancy-foundation
verified: 2026-06-03T00:00:00Z
status: gaps_found
score: 1/4 must-haves verified
overrides_applied: 0
re_verification: null
gaps:
  - truth: "A workspace owner can invite members by email (copyable link per D-06), and members are assigned roles (admin/editor/viewer) that gate permitted actions."
    status: failed
    reason: "CR-01: acceptInvitation never compares invitation.email against user.email. Any authenticated+verified user who learns an invitation ID can accept it and join the workspace at the invited role — a direct cross-tenant join bypass. CR-03: acceptance is triggered by a GET request (form method='GET', action=accept query param), making the mutation CSRF-prone and triggerable by link prefetchers, email scanners, or a planted img tag. CR-04: the members page invite form posts to /api/workspaces/{slug}/invitations which does not exist (only /api/auth/[...all] is implemented), so the copyable-link invite feature is entirely non-functional through the UI."
    artifacts:
      - path: "apps/web/src/lib/workspaces/invitations.ts"
        issue: "acceptInvitation lines 199-293: emailVerified is checked but user.email is never compared to invitation.email. The function docstring claims the check exists; the code does not perform it."
      - path: "apps/web/src/app/invitations/[id]/page.tsx"
        issue: "Line 168: <form action={`/invitations/${id}?action=accept`} method='GET'>. State-mutating operation via GET. Lines 124-130: acceptInvitation is called on GET render when action==='accept' — no CSRF protection."
      - path: "apps/web/src/app/w/[slug]/members/page.tsx"
        issue: "Lines 68, 162, 174: all three forms post to /api/workspaces/{slug}/* routes that do not exist. No component imports createInvitationAction, changeMemberRoleAction, removeMemberAction, or updateWorkspaceSettingsAction."
    missing:
      - "Add email match check in acceptInvitation: if (invitation.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) throw new Error('Invitation issued to a different email address')"
      - "Convert invitation acceptance to a POST Server Action with CSRF protection (Next.js <form action={serverAction}> pattern)"
      - "Wire the members page forms to the existing server actions (createInvitationAction, changeMemberRoleAction, removeMemberAction) instead of the non-existent API routes, OR implement the /api/workspaces/* route handlers that delegate to those actions"

  - truth: "A user in workspace A cannot read or edit workspace B's templates, LPs, brand config, or assets by ID — proven by per-endpoint cross-tenant access tests."
    status: failed
    reason: "CR-02: RLS is enabled and forced only on tenant_isolation_probe — the throwaway probe table. workspace_member, workspace_invitation, and workspace have no RLS policy at all. All production queries for member management and invitation acceptance use the raw prisma client directly (actions.ts lines 237, 250, 264, 309, 322, 336; invitations.ts lines 86, 148, 231, 240-285; guards.ts lines 107, 115), bypassing withTenantDb entirely. The 'two-layer isolation' guarantee is real only for the probe table; no real tenant data is protected by RLS. The migration was never applied (PostgreSQL was not running), so the probe-table RLS does not exist in any database. Tests for cross-tenant isolation mock the DB and prove the app-layer WHERE clause is present — they do not prove database-level enforcement. Per the CONTEXT, D-13 requires 'app-level scoping PLUS Postgres RLS as a backstop' and the success criterion explicitly says the RLS backstop must apply, not merely exist in migration SQL."
    artifacts:
      - path: "apps/web/prisma/migrations/0001_multi_tenancy_foundation/migration.sql"
        issue: "RLS is enabled/forced only on tenant_isolation_probe (lines 217-220). workspace_member, workspace_invitation, workspace tables have no ENABLE ROW LEVEL SECURITY statement."
      - path: "apps/web/src/lib/db/tenant-db.ts"
        issue: "withTenantDb / SET LOCAL is only accessible through the TenantClient interface and only wired to tenantIsolationProbe helpers — it is never called for workspace_member, workspace_invitation, or workspace queries."
      - path: "apps/web/src/lib/workspaces/actions.ts"
        issue: "All prisma.workspaceMember, prisma.workspaceInvitation, and prisma.workspace calls use the raw prisma client directly, not withTenantDb. The RLS backstop is absent from the entire real query path."
      - path: "apps/web/src/lib/workspaces/guards.ts"
        issue: "getWorkspaceContext uses prisma.workspace and prisma.workspaceMember directly (lines 107, 115), outside any SET LOCAL transaction."
      - path: "apps/web/tests/tenant-isolation.test.ts"
        issue: "Cross-workspace denial tests are app-layer only (mocked prisma, WHERE clause assertion). The 'DB-required' suite is skipped. Tests assert the SQL migration text contains RLS keywords but do not prove the migration was applied or that the database enforces the policy."
    missing:
      - "Add ENABLE ROW LEVEL SECURITY + FORCE ROW LEVEL SECURITY + the current_setting policy to workspace_member, workspace_invitation, and workspace tables (or document explicitly which tables are intentionally excluded and why)"
      - "Route workspace_member, workspace_invitation reads/writes through withTenantDb (or document that these tables run before tenant context exists and are excluded by design)"
      - "Apply the migration against a real PostgreSQL instance and add at least one integration test that omitting SET LOCAL causes the RLS policy to block the query"

  - truth: "Tenant context is derived from the server session only (never client-supplied), and workspace_id scoping is enforced at the data layer with an RLS backstop."
    status: failed
    reason: "The session-derived tenant context and app-level scoping are correctly implemented (getWorkspaceContext derives workspaceId from session + membership, never from client payload). However, the 'RLS backstop' half of this criterion is not met for real data: the backstop exists only on tenant_isolation_probe and the migration was never applied to any database. The criterion explicitly requires both layers; only one is in place."
    artifacts:
      - path: "apps/web/src/lib/db/tenant-db.ts"
        issue: "SET LOCAL / withTenantDb is wired correctly for the probe table but no real tenant table flows through it."
      - path: "apps/web/prisma/migrations/0001_multi_tenancy_foundation/migration.sql"
        issue: "RLS SQL is correct for the probe table but absent for real tenant tables. Migration has not been applied to any database (documented blocker in 02-02-SUMMARY.md)."
    missing:
      - "Extend RLS to real tenant tables (workspace_member at minimum) or document the explicit scope decision"
      - "Apply the migration so the RLS policy actually exists in the database"

deferred: []
human_verification: []
---

# Phase 2: Multi-Tenancy Foundation — Verification Report

**Phase Goal:** Establish workspaces, authentication, and role-based access with isolation enforced at a layer that cannot be forgotten — before any scoped data exists.
**Verified:** 2026-06-03
**Status:** GAPS FOUND
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A user can sign up, log in, and create a workspace | VERIFIED | auth.ts has emailAndPassword enabled with requireEmailVerification:true; signup/login/verify-email pages exist; createWorkspaceAction behind requireVerifiedUser; workspace creation is explicit (D-04) with no auto-create path |
| 2 | A workspace owner can invite members by email (copyable link, D-06) and members are assigned roles that gate permitted actions | FAILED | CR-01: no email match check in acceptInvitation (any authenticated user can accept); CR-03: acceptance is a GET mutation (CSRF-prone); CR-04: invite/role-change/remove forms post to non-existent API routes — the feature is non-functional end-to-end |
| 3 | A user in workspace A cannot read or edit workspace B data by ID — proven by per-endpoint cross-tenant access tests | FAILED | CR-02: RLS is only on tenant_isolation_probe (a probe table no feature uses); real tenant tables (workspace_member, workspace_invitation) have no RLS; all production queries bypass withTenantDb; cross-tenant tests are mocked app-layer assertions, not per-endpoint tests against real data paths; migration was never applied |
| 4 | Tenant context is derived from server session only; workspace_id scoping enforced at data layer with RLS backstop | FAILED | Session-derived context is correctly implemented (VERIFIED); the RLS backstop applies only to the probe table and was never applied to a database — the backstop protects no real data |

**Score: 1/4 truths verified**

---

### Deferred Items

None. All gaps are in scope for this phase.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/lib/auth/auth.ts` | better-auth server config with email/password, email verification, organization plugin, Prisma adapter | VERIFIED | Correctly configured; no OAuth/MFA; custom roles wired |
| `apps/web/src/lib/auth/permissions.ts` | Single role/permission vocabulary for owner/admin/editor/viewer | VERIFIED | Exports RoleSchema, Role, ROLES, statement, ac, roles |
| `apps/web/src/lib/email/send-email.ts` | Transactional email abstraction with console/test transport | VERIFIED | EMAIL_TRANSPORT=console and test capture implemented |
| `apps/web/prisma/schema.prisma` | Database schema for auth/workspace entities | VERIFIED | Includes user, session, account, workspace, workspace_member, workspace_invitation, tenant_isolation_probe |
| `apps/web/src/lib/workspaces/guards.ts` | Server-side session, workspace membership, and role guards | VERIFIED | requireUser, requireVerifiedUser, getWorkspaceContext, requireWorkspace, requireWorkspaceRole, can — all implemented and correctly derive context from session |
| `apps/web/src/lib/db/tenant-db.ts` | Central tenant-scoped Prisma helper with SET LOCAL and workspaceId injection | PARTIAL | withTenantDb is correctly implemented but only covers TenantIsolationProbe; all real production queries bypass it |
| `apps/web/prisma/migrations/0001_multi_tenancy_foundation/migration.sql` | Workspace schema migration plus RLS policy contract | PARTIAL | Tables created correctly; RLS policy correct for tenant_isolation_probe but absent on workspace_member, workspace_invitation, and workspace; migration never applied to a database |
| `apps/web/src/lib/workspaces/invitations.ts` | Copyable invitation link creation, lookup, and acceptance helpers | STUB (security-critical bug) | Functions exist and are substantive, but acceptInvitation is missing the email match check — the central authorization invariant for cross-tenant join prevention |
| `apps/web/src/app/w/[slug]/members/page.tsx` | Member management UI restricted to owner/admin | ORPHANED | UI renders based on real session data; invite/role/remove forms post to non-existent API routes; server actions are never imported or bound |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| members/page.tsx invite form | createInvitationAction | form action binding | NOT WIRED | Form posts to `/api/workspaces/${slug}/invitations` — route does not exist |
| members/page.tsx role-change form | changeMemberRoleAction | form action binding | NOT WIRED | Form posts to `/api/workspaces/${slug}/members/${id}/role` — route does not exist |
| members/page.tsx remove form | removeMemberAction | form action binding | NOT WIRED | Form posts to `/api/workspaces/${slug}/members/${id}/remove` — route does not exist |
| invitations/[id]/page.tsx accept | acceptInvitation | email match check | NOT WIRED | user.email is passed to acceptInvitation but never compared against invitation.email inside the function |
| withTenantDb / SET LOCAL | workspace_member queries | called from actions/guards | NOT WIRED | All workspace_member, workspace_invitation, workspace queries use raw prisma client |
| RLS policy | workspace_member table | migration SQL | NOT WIRED | No ENABLE/FORCE ROW LEVEL SECURITY on workspace_member; only on tenant_isolation_probe |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| members/page.tsx | members (WorkspaceMember list) | prisma.workspaceMember.findMany with workspaceId filter | Yes (app-layer scoped) | FLOWING — app-layer correct, but never rendered via RLS-protected path |
| members/page.tsx | invite form submission | /api/workspaces/{slug}/invitations | No — route 404s | DISCONNECTED |
| invitations/[id]/page.tsx | invitation record | lookupInvitation → prisma.workspaceInvitation.findUnique | Yes | FLOWING for display |
| invitations/[id]/page.tsx | acceptance result | acceptInvitation on GET with action=accept | No email match check | HOLLOW — executes but authorization check is missing |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — no runnable server entry point available. The migration was not applied; PostgreSQL is not running in this environment.

---

### Probe Execution

Step 7c: No probe scripts declared or found in conventional locations.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| WS-01 | 02-01, 02-03 | User can sign up and log in | SATISFIED | email/password auth, verification flow, signup/login pages all implemented and tested |
| WS-02 | 02-02, 02-03 | User can create a workspace | SATISFIED | createWorkspaceAction behind requireVerifiedUser; explicit creation page; no auto-create path |
| WS-03 | 02-03 | User can invite members to a workspace by email | BLOCKED | Invite form posts to non-existent API route; email match check missing in acceptInvitation; acceptance is a GET mutation |
| WS-04 | 02-02, 02-03 | Workspace members have roles that control permitted actions | PARTIAL | Role matrix and guards are correctly implemented; changeMemberRoleAction and removeMemberAction have correct guards; but these actions are unreachable from the members page UI |
| WS-05 | 02-02, 02-03 | All templates, LPs, and assets are isolated per workspace | BLOCKED | App-layer scoping is present for workspace_member queries; RLS backstop applies only to the probe table; migration never applied; cross-tenant tests are mocked, not live-DB |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/app/invitations/[id]/page.tsx` | 168 | `method="GET"` on state-mutating form | BLOCKER | GET mutation triggers on prefetch/crawl/img-tag; compounded by CR-01 |
| `apps/web/src/app/invitations/[id]/page.tsx` | 124-130 | State mutation (acceptInvitation) on GET render | BLOCKER | CSRF — any URL fetch by authenticated user triggers workspace join |
| `apps/web/src/lib/workspaces/invitations.ts` | 199-293 | Missing authorization check (email match) | BLOCKER | Cross-tenant join bypass — the function docstring claims the check exists but the code does not perform it |
| `apps/web/src/app/w/[slug]/members/page.tsx` | 68, 162, 174 | Forms wired to non-existent API routes | BLOCKER | Invite/role-change/remove features 404; RBAC enforcement is dead code |
| `apps/web/src/lib/db/tenant-db.ts` | 103-105 | `$executeRawUnsafe` with string interpolation | WARNING | SQL injection surface if workspaceId bypasses server-only derivation path (WR-01 from review) |
| `apps/web/src/lib/workspaces/guards.ts` | 201-234 | Duplicate permission matrix | INFO | `can()` re-implements what permissions.ts defines as single source of truth (IN-01 from review) |

---

### Human Verification Required

None — all failures are structurally verifiable from the code. The gaps do not require human testing to confirm.

---

## Gaps Summary

Three of four roadmap success criteria fail. The root causes cluster around two implementation gaps:

**Gap A — Invitation security (CR-01, CR-03, CR-04):** The invitation acceptance flow has a missing email match authorization check (any verified user can accept any invitation), uses a GET mutation making it CSRF-vulnerable, and the UI forms that trigger the flow are wired to API routes that do not exist. The server actions (`createInvitationAction`, `changeMemberRoleAction`, `removeMemberAction`) contain correct RBAC enforcement but are never called from any live request path. The invitation feature is effectively non-functional end-to-end.

**Gap B — RLS backstop scope (CR-02):** The locked design decision D-13 requires "app-level scoping PLUS Postgres RLS as a backstop" and the context document explicitly states "Forgetting the app-level filter is still blocked by the database." In practice, RLS is only applied to `tenant_isolation_probe` — a table no feature uses. All real tenant tables (`workspace_member`, `workspace_invitation`, `workspace`) are accessed via the raw Prisma client without `withTenantDb` or `SET LOCAL`. The migration was never applied to a database, so even the probe-table RLS does not exist anywhere. Success criterion 4 explicitly requires the RLS backstop; it is absent from all real data.

These are not deferred items or documentation gaps — they are concrete missing implementations that contradict the phase goal's core security promise.

---

_Verified: 2026-06-03_
_Verifier: Claude (gsd-verifier)_
