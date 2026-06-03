---
phase: 02-multi-tenancy-foundation
reviewed: 2026-06-03T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - apps/web/src/lib/auth/auth.ts
  - apps/web/src/lib/auth/permissions.ts
  - apps/web/src/lib/db/tenant-db.ts
  - apps/web/src/lib/workspaces/actions.ts
  - apps/web/src/lib/workspaces/guards.ts
  - apps/web/src/lib/workspaces/invitations.ts
  - apps/web/src/lib/workspaces/schema.ts
  - apps/web/prisma/migrations/0001_multi_tenancy_foundation/migration.sql
  - apps/web/prisma/schema.prisma
findings:
  critical: 4
  warning: 6
  info: 4
  total: 14
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-06-03
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This phase lays the multi-tenant foundation: better-auth + organization plugin, RBAC role/permission vocabulary, server-side workspace guards, workspace/member/invitation server actions, a tenant-scoped DB helper, and an RLS-backed migration. The plumbing for the *locked design decisions* is mostly present in the right shape — slug is cross-checked against membership in `guards.ts`, `workspaceId` is server-derived in the action layer, and the role matrix matches the intended owner/admin/editor/viewer split.

However, adversarial review found the actual isolation and authorization guarantees are **not** enforced where it matters:

- **The invitation accept flow never checks that the accepting user's email matches the invitation email**, despite the code's own docstring claiming it does. Invitation links are unbounded bearer tokens — any verified user who learns an invitation ID joins someone else's workspace at the invited role. (CR-01)
- **The RLS "backstop" protects nothing real.** RLS is enabled only on the throwaway `tenant_isolation_probe` table. Every real tenant query (`workspace_member`, `workspace_invitation`, `workspace`) is run through the raw `prisma` client and bypasses `withTenantDb`/`SET LOCAL` entirely, so neither layer of the promised two-layer isolation applies to production data. (CR-02)
- **Invitation acceptance is a GET request** (`method="GET"`, `action=accept`), so prefetch, crawlers, or a planted `<img>`/link can silently auto-accept on behalf of a logged-in user — a CSRF/automatic-action vector compounded by the missing email check. (CR-03)
- **The member-management actions are unreachable.** The members page posts to `/api/workspaces/{slug}/...` route handlers that do not exist, and no component imports `createInvitationAction`, `changeMemberRoleAction`, `removeMemberAction`, or `updateWorkspaceSettingsAction`. The RBAC enforcement these actions contain is real but currently dead code; the only live invite/role/remove paths are broken forms. (CR-04)

Address the Critical findings before this foundation is built upon — later phases will copy these patterns onto real content tables.

## Critical Issues

### CR-01: Invitation acceptance does not verify the invitee's email matches the invitation

**File:** `apps/web/src/lib/workspaces/invitations.ts:199-293` (also `apps/web/src/app/invitations/[id]/page.tsx:124-130`)
**Issue:** `acceptInvitation(invitationId, user)` checks `user.emailVerified` but never compares `invitation.email` against `user.email`. The file docstring (line 10) and the function docstring (line 188-189) both claim "whose email matches the invitation email," but no such check exists. `user.email` is passed in from the page (line 128) and then ignored. Because the invitation URL is just `/invitations/{id}` with no token (by design, per `getInvitationUrl`), the ID is the only secret. Any authenticated, email-verified user who obtains an invitation ID — shared link, log leak, enumeration, shoulder-surf — can call accept and be granted membership at the invited role (admin/editor/viewer) in a workspace they were never invited to. This is a direct authorization / cross-tenant access bypass and contradicts the locked decision that tenant membership is server-validated.
**Fix:**
```ts
// in acceptInvitation, after looking up the invitation and before creating membership:
if (invitation.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
  throw new Error("This invitation was issued to a different email address.");
}
```
Compare case-insensitively (emails are case-insensitive in the local part by convention and identifiers are stored as entered). Keep the check server-side in `acceptInvitation` so it holds regardless of which caller invokes it.

### CR-02: RLS backstop and tenant-scoped helper do not cover any real tenant table

**File:** `apps/web/prisma/migrations/0001_multi_tenancy_foundation/migration.sql:216-229`, `apps/web/src/lib/db/tenant-db.ts:90-143`, and all of `apps/web/src/lib/workspaces/actions.ts` / `invitations.ts` / `guards.ts`
**Issue:** The locked design is "app-level workspace_id scoping PLUS Postgres RLS backstop." In practice:
1. RLS is `ENABLE`d/`FORCE`d only on `tenant_isolation_probe` (migration lines 217-220). The real tenant-owned tables — `workspace_member`, `workspace_invitation`, and `workspace` — have **no** RLS policy at all.
2. `withTenantDb` (the only place that runs `SET LOCAL app.current_workspace_id`) is wired solely to `tenantIsolationProbe`. Every production query — `prisma.workspaceMember.findUnique/findMany/update/delete`, `prisma.workspaceInvitation.*`, `prisma.workspace.*`, `prisma.member.*` — uses the raw `prisma` client directly (e.g. `actions.ts:237`, `250`, `264`, `309`, `322`, `336`; `invitations.ts:86`, `148`, `231`, `240-285`; `guards.ts:107`, `115`).

Net effect: there is no DB-level isolation backstop on any data a tenant actually owns, and `withTenantDb` is effectively a demo that exercises a table no feature uses. The "two-layer" guarantee the tests document (`tenant-isolation.test.ts:262-296`) is asserted against a contract object, not against the code paths that handle members/invitations. The app-level filtering that *is* present (explicit `where: { workspaceId }`) is the only thing actually protecting tenant data, so a single missing `where` clause in a future query becomes a silent cross-tenant leak with nothing to catch it.
**Fix:** Either (a) add `ENABLE/FORCE ROW LEVEL SECURITY` + the `app.current_workspace_id` policy to `workspace_member`, `workspace_invitation`, and every future tenant-owned table, and route their reads/writes through `withTenantDb` so `SET LOCAL` is in scope; or (b) if these specific tables are intentionally accessed outside tenant scope (e.g. membership lookup must run before a tenant context exists), document that explicitly and remove the "RLS backstop on tenant data" claim from the design/tests so it is not relied upon. At minimum, do not ship later phases that assume RLS protects content tables — it currently protects none.

### CR-03: Invitation acceptance is performed via GET, enabling CSRF / automatic acceptance

**File:** `apps/web/src/app/invitations/[id]/page.tsx:124-132, 168`
**Issue:** Acceptance is triggered by a GET request: the form uses `method="GET"` with `action=/invitations/{id}?action=accept` (line 168), and the page mutates state (`acceptInvitation` → membership insert) when `action === "accept"` (line 124). State-changing operations over GET are CSRF-prone and can be triggered without user intent by link prefetching, browser pre-rendering, email-client link scanners, chat unfurlers, or a third-party page embedding `<img src=".../invitations/{id}?action=accept">`. Combined with CR-01 (no email match), a logged-in verified victim merely needs their browser to fetch the URL to be auto-joined to an attacker-controlled workspace at a chosen role. Server Actions / POST with framework CSRF protection are the correct mechanism for mutations.
**Fix:** Convert acceptance to a POST Server Action (or a POST route handler) guarded by the framework's CSRF token, and require an explicit, intentional submit. Do not perform any membership mutation on a GET render. Example:
```tsx
// server action
"use server";
export async function acceptInvitationAction(id: string) {
  const user = await requireVerifiedUser();
  const result = await acceptInvitation(id, { id: user.id, email: user.email, emailVerified: user.emailVerified });
  redirect(`/w/${result.slug}`);
}
// page: <form action={acceptInvitationAction.bind(null, id)}><button>Accept</button></form>
```

### CR-04: Member-management actions are unreachable; the members UI posts to non-existent routes

**File:** `apps/web/src/app/w/[slug]/members/page.tsx:68, 162, 174` and `apps/web/src/lib/workspaces/actions.ts:165-435`
**Issue:** The members page renders forms that POST to `/api/workspaces/${slug}/invitations`, `/api/workspaces/${slug}/members/${id}/role`, and `/api/workspaces/${slug}/members/${id}/remove`. A filesystem scan of `src/app/api` shows only `api/auth/[...all]/route.ts` exists — none of those route handlers are implemented. Grep confirms no component imports `createInvitationAction`, `changeMemberRoleAction`, `removeMemberAction`, or `updateWorkspaceSettingsAction`. As a result: (1) the invite/role-change/remove features are non-functional (submitting yields a 404), and (2) the RBAC and "owner/admin only" enforcement carefully written into those server actions is dead code that has never executed in a real request path. Because the enforcement lives in the action and not the (missing) route, when these routes are eventually added there is a real risk the author wires the form straight to a handler that forgets `requireWorkspaceRole`. This is both a broken-feature defect and a latent authz risk.
**Fix:** Wire the members page forms to the existing server actions (preferred — they already enforce `requireWorkspaceRole`) via `<form action={serverAction}>` with hidden fields / `.bind`, or implement the `/api/workspaces/...` route handlers and have each call the corresponding action (never reimplement the DB mutation without the guard). Add a test that submitting as an editor/viewer is rejected end-to-end, not just at the unit level.

## Warnings

### WR-01: `SET LOCAL` value is built by raw string interpolation with no format validation at the boundary

**File:** `apps/web/src/lib/db/tenant-db.ts:103-105`
**Issue:** `tx.$executeRawUnsafe(\`SET LOCAL "app.current_workspace_id" = '${workspaceId}'\`)` concatenates `workspaceId` directly into SQL. The comment argues it is safe because the value is "server-derived and validated by requireWorkspace." That holds for the current callers, but `withTenantDb` is an exported, reusable helper with a plain `{ workspaceId: string }` contract — nothing in the function itself prevents a future caller from passing an unvalidated string, at which point a value containing `'` becomes SQL injection into a privileged `SET LOCAL`. `SET LOCAL` cannot use `$1` bind parameters, but `set_config('app.current_workspace_id', $1, true)` can.
**Fix:**
```ts
await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${workspaceId}, true)`;
```
This parameterizes the value and removes the injection surface regardless of caller discipline. Optionally also assert `workspaceId` matches a UUID/cuid pattern at the top of `withTenantDb`.

### WR-02: RLS policy and schema comment disagree on the workspace ID type (`::text` vs `::uuid`); ID generation is inconsistent

**File:** `apps/web/prisma/migrations/0001_multi_tenancy_foundation/migration.sql:225,228`, `apps/web/prisma/schema.prisma:139,186`, `apps/web/src/lib/workspaces/actions.ts:92`
**Issue:** The schema comment (schema.prisma:186) documents the policy as `current_setting('app.current_workspace_id', true)::uuid`, but the actual migration casts `::text` (lines 225, 228). Separately, `Workspace.id` is declared `@default(cuid())` (schema.prisma:139), yet `createWorkspaceAction` generates the ID with `randomUUID()` (actions.ts:92) and passes it explicitly. So workspace IDs are UUID strings stored in a TEXT column whose model default is cuid. The `::text` cast happens to work today, but if anyone "corrects" the policy to `::uuid` to match the comment, every cuid-defaulted row (or any future code path that lets the default fire) breaks the RLS comparison. The drift between comment, default, and runtime generator is a latent breakage.
**Fix:** Pick one identifier scheme. Recommended: keep `::text` in both the policy and the comment, and remove the misleading `::uuid` comment. Either drop `@default(cuid())` (since the action always supplies a UUID) or stop overriding the default in the action — do not mix the two.

### WR-03: Role authorization reads from the app-mirror `workspace_member`, while better-auth `member` is declared authoritative — drift causes silent privilege errors

**File:** `apps/web/src/lib/workspaces/guards.ts:115-140`, `apps/web/prisma/schema.prisma:153-155`
**Issue:** `getWorkspaceContext` resolves the user's role from `prisma.workspaceMember` (the app mirror). The schema comment (schema.prisma:154-155) explicitly states "The authoritative source is the better-auth member table; this mirrors it." All write paths update both tables inside a transaction (good), but acceptance/role-change/remove mutate both via separate statements; any partial failure, out-of-band better-auth org mutation (e.g. via `authClient.organization`), or future code that updates only one table will make the mirror and the source of truth disagree. Authorization decisions then key off a stale mirror — a removed/downgraded member could retain access, or vice versa. Two sources of truth for authz is a standing hazard.
**Fix:** Designate a single authoritative source for role checks. Either read role from the better-auth `member` table in `getWorkspaceContext`, or formally make `workspace_member` authoritative and stop calling the better-auth `member` table authoritative in comments/design. If both must exist, add a reconciliation/consistency check and never let them be written non-atomically.

### WR-04: `acceptInvitation` upsert silently overwrites an existing member's role downward/upward

**File:** `apps/web/src/lib/workspaces/invitations.ts:243-259`
**Issue:** Acceptance uses `upsert` with `update: { role }`. If the user is already a member of the workspace (e.g. an existing admin), accepting any still-pending invitation — including one an attacker or a careless admin created at a *lower* role — overwrites their current role with the invitation's role. The comment frames this as idempotency for "duplicate accept," but it also enables an unintended role change for an already-joined member, with no check that the existing role equals the invited role. Combined with CR-01 this is worse: a stale viewer-level invitation could be used to downgrade an existing admin.
**Fix:** On upsert conflict, do not blindly overwrite. Either no-op when the membership already exists (`update: {}` and detect "already a member"), or only apply the invitation role when there is no existing membership. Decide explicitly whether re-accepting changes an existing role and document it.

### WR-05: Expired/revoked invitations are never invalidated for the matching email and remain reusable until status flips

**File:** `apps/web/src/lib/workspaces/invitations.ts:78-106, 308-331`
**Issue:** Creating an invitation does not check for or supersede an existing pending invitation for the same `(workspaceId, email)`, and there is no unique constraint (`workspace_invitation` has no unique index on email/workspace — migration lines 148-158). An admin can accumulate multiple simultaneously-valid pending invitations for the same email at different roles; any of them is acceptable (subject to CR-01). This widens the window for the wrong role to be granted and complicates revocation (revoking one leaves others live).
**Fix:** Before creating, revoke/expire prior pending invitations for the same `(workspaceId, lower(email))`, or add a partial unique index enforcing at most one pending invitation per email per workspace, and surface "an invitation is already pending" to the caller.

### WR-06: Race condition on the "last owner" guard in role-change and removal

**File:** `apps/web/src/lib/workspaces/actions.ts:248-259, 320-331`
**Issue:** The "cannot remove/downgrade the only owner" guard does `count()` then `update`/`delete` in separate statements, and the count runs *outside* the mutation transaction. Two concurrent admin requests, each removing/downgrading a different one of two owners, can both observe `ownerCount === 2`, both proceed, and leave the workspace with zero owners. Multi-tenant member management is exactly where concurrent admin actions happen.
**Fix:** Perform the count and the mutation inside the same `$transaction` with appropriate locking (e.g. `SELECT ... FOR UPDATE` on the owner rows, or a conditional update guarded by a re-count inside the transaction), so the invariant "at least one owner" holds under concurrency. Consider a DB-level constraint/trigger as a backstop.

## Info

### IN-01: Permission matrix is duplicated between `permissions.ts` and `guards.ts can()`

**File:** `apps/web/src/lib/workspaces/guards.ts:201-234` vs `apps/web/src/lib/auth/permissions.ts:56-99`
**Issue:** `can()` hand-rolls a second copy of the exact role→resource→action matrix already defined as the access-control roles in `permissions.ts`. The file header in `permissions.ts` says it is the "single source of truth" and to "never define role strings inline elsewhere," which `can()` violates. The two will drift as resources/actions are added.
**Fix:** Derive `can()` from the `statement`/role definitions in `permissions.ts` (or from a single shared matrix object), so there is one source of truth.

### IN-02: `getInvitationUrl` and the members page independently re-derive the base URL with hardcoded localhost fallback

**File:** `apps/web/src/lib/workspaces/invitations.ts:124-133` and `apps/web/src/app/w/[slug]/members/page.tsx:107-109`
**Issue:** Both build the invite URL from `NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"`, with the construction duplicated in the page rather than calling `getInvitationUrl`. If `NEXT_PUBLIC_APP_URL` is unset in production, generated invite links silently point at `localhost`.
**Fix:** Have the members page call `getInvitationUrl(inv.id)`. Consider failing fast (or warning) when `NEXT_PUBLIC_APP_URL` is unset outside development instead of falling back to localhost.

### IN-03: `revokeInvitation` is implemented and documented but has no caller / no action wrapper

**File:** `apps/web/src/lib/workspaces/invitations.ts:308-331`
**Issue:** `revokeInvitation` is exported and carries a cross-workspace guard, but no server action or route invokes it (the members page lists pending invitations with no revoke control). It is currently dead code; the pending-invitations table offers no way to revoke.
**Fix:** Add a `revokeInvitationAction` gated by `requireWorkspaceRole(slug, ["owner","admin"])` and a revoke control in the members UI, or remove the helper until needed.

### IN-04: better-auth secret / SMTP password examples in `.env.example` are weak placeholders, and the app has no startup check for a real secret

**File:** `apps/web/.env.example:5-6,17` (and absence of validation in `apps/web/src/lib/auth/auth.ts`)
**Issue:** `BETTER_AUTH_SECRET="your-secret-here-min-32-chars-long"` is a copy-paste-able value; nothing fails startup if it is left as-is or unset. better-auth session integrity depends on a strong secret. (Informational only — these are example values, not committed live secrets.)
**Fix:** Add an env validation step (e.g. Zod-parsed `process.env`) that requires `BETTER_AUTH_SECRET` to be present and sufficiently long in production, and document rotation. Keep `.env.example` values obviously non-functional.

---

_Reviewed: 2026-06-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
