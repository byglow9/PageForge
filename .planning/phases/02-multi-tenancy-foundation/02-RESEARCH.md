# Phase 02: Multi-Tenancy Foundation - Research

**Researched:** 2026-06-03
**Status:** Ready for planning

## RESEARCH COMPLETE

<summary>
Phase 2 should bootstrap the first application package around the existing pure engine:
`apps/web` using Next.js App Router, Prisma/PostgreSQL, better-auth, and a central
tenant-scoped data layer. The load-bearing design is defense in depth:

1. better-auth owns users, sessions, email-password auth, email verification, and the
   organization/member/invitation base tables.
2. Application code resolves the active workspace from `/w/{slug}` plus the server session,
   then validates membership and role before any scoped data access.
3. All tenant-owned persistence goes through a central helper that injects `workspace_id`.
4. PostgreSQL Row-Level Security is enabled as a backstop using a per-transaction workspace
   setting such as `SET LOCAL app.current_workspace_id = '<uuid>'`.

This phase is greenfield for the app layer. The existing `pageforge-engine` package stays
untouched except for monorepo/package wiring needed for the new app package.
</summary>

<official_sources>
Primary sources checked:

- Better Auth organization plugin: https://better-auth.com/docs/plugins/organization
- Better Auth email/password auth: https://better-auth.com/docs/authentication/email-password
- Better Auth email verification concepts: https://better-auth.com/docs/concepts/email
- Better Auth Prisma adapter: https://better-auth.com/docs/adapters/prisma
- Next.js authentication guide: https://nextjs.org/docs/app/guides/authentication
- Next.js Server Actions security note: https://nextjs.org/docs/13/app/building-your-application/data-fetching/server-actions-and-mutations
- Prisma Client extensions: https://www.prisma.io/docs/orm/prisma-client/client-extensions
- Prisma transactions: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
- PostgreSQL Row Security Policies: https://www.postgresql.org/docs/17/ddl-rowsecurity.html
</official_sources>

<findings>

## F1. better-auth is a good fit for Phase 2, but custom roles must be explicit

The organization plugin covers organizations, members, invitations, default owner/admin/member
roles, invitations, and custom access control. Phase 2 needs owner/admin/editor/viewer, so the
implementation must define a custom access-control statement set and pass custom roles to the
organization plugin on server and client. Treat better-auth defaults as a starting point, not as
the final RBAC model.

Implementation implication:
- `owner`: all workspace permissions, single owner semantics enforced by app logic.
- `admin`: member management and workspace settings except owner-only future actions.
- `editor`: content permissions for future templates/LPs/brand config.
- `viewer`: read/preview/export permissions only.

## F2. Email verification requires a sender hook

better-auth supports email verification but requires app-provided email delivery logic. Phase 2
must wire a provider abstraction even if local development uses a console transport. Mandatory
email verification before workspace creation/joining maps directly to Better Auth
`emailAndPassword.requireEmailVerification` plus `emailVerification.sendVerificationEmail`.

Planning implication:
- Add `lib/email/send-email.ts` with `console`/`smtp` modes selected by env.
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`, and sender env vars must be in
  `apps/web/.env.example`.
- Acceptance tests must prove unverified users cannot create a workspace or accept an invite.

## F3. Invitations can be copyable links while still storing invitee email

Better Auth invitations are email-address based and have configurable expiration. Phase 2 can
create invite records and display/copy the acceptance URL instead of sending the invitation
email automatically. This satisfies the context decision D-06 while preserving WS-03 semantics
as "invite a member by email address".

Planning implication:
- Owner/admin creates an invitation with `email`, `role`, `organizationId`, and expiration.
- The route returns or renders a copyable invite URL.
- Accept flow must support account-creation-on-accept for users without an account.

## F4. Server Actions and route handlers are public boundaries

Next.js docs explicitly frame Server Actions as public-facing mutation surfaces that still need
authentication and authorization. Every mutation in Phase 2 must call a server-side guard before
doing work, even if the UI hides buttons.

Planning implication:
- Create `requireUser()`, `requireWorkspace(slug)`, and `requireWorkspaceRole(slug, roles)`.
- Every Server Action has Zod validation plus an auth/role guard at the top.
- Route handlers used by better-auth are the only broad auth endpoints; workspace mutations stay
  guarded Server Actions.

## F5. Prisma Client extensions are a fit for the central data layer

Prisma officially supports client extensions and calls out RLS-style request-specific clients as
an extension use case. Phase 2 should expose a narrow helper rather than raw Prisma:

- `db` raw client: only for auth adapter, migrations, and low-level utilities.
- `createTenantDb(ctx)`: returns a request-bound client that wraps operations in a transaction,
  executes `SET LOCAL app.current_workspace_id = ...`, and injects `workspace_id` for tenant
  owned models.

Do not rely on a global active workspace stored in memory; serverless and concurrent requests
make that unsafe.

## F6. PostgreSQL RLS is the non-forgettable isolation backstop

PostgreSQL RLS applies policies at the table level once enabled. For tenant-owned tables, the
policy should compare each row's `workspace_id` to a transaction-local setting. The app must set
that setting inside the same transaction as the scoped query.

Recommended pattern for future tenant tables:

```sql
ALTER TABLE tenant_owned_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_owned_table FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_owned_table
  USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid)
  WITH CHECK (workspace_id = current_setting('app.current_workspace_id', true)::uuid);
```

Plan implication:
- Include an exemplar `tenantResource`/`tenantIsolationProbe` table for automated isolation tests
  if no template/LP/brand/assets tables exist yet.
- Store migration SQL alongside Prisma schema because RLS policies are database behavior, not just
  generated TypeScript types.

## F7. Schema push is mandatory for this phase

Phase 2 will add `apps/web/prisma/schema.prisma` and migrations. The plan must include a blocking
schema task:

- `pnpm --filter @pageforge/web prisma generate`
- `pnpm --filter @pageforge/web prisma migrate dev --name multi_tenancy_foundation`

If the executor runs in an environment without a Postgres database, the task must stop for manual
DB setup rather than pretending type/build checks prove database behavior.

## F8. Test strategy should prove isolation before later domain tables exist

Because template/LP/brand/assets tables are deferred, Phase 2 should prove the reusable isolation
contract through:

- unit tests for permission matrix and guards;
- integration tests against workspace/member/invitation mutations;
- cross-tenant tests using an exemplar tenant-owned table and direct ID access attempts;
- RLS tests that fail when `app.current_workspace_id` is not set or mismatched.

This gives Phase 3-5 a verified contract instead of merely documenting that every future table
should include `workspace_id`.

</findings>

<recommended_architecture>

## Package Layout

- `apps/web/` - Next.js app package.
- `apps/web/prisma/schema.prisma` - app database schema.
- `apps/web/prisma/migrations/*/migration.sql` - SQL migrations including RLS policies.
- `apps/web/src/lib/auth/*` - better-auth config, client, permissions, and route handler.
- `apps/web/src/lib/db/*` - Prisma client plus tenant-scoped helpers.
- `apps/web/src/lib/workspaces/*` - server actions and workspace guard functions.
- `apps/web/src/app/(auth)/*` - signup/login/verify screens.
- `apps/web/src/app/w/[slug]/*` - workspace shell.
- `apps/web/tests/*` - Vitest integration/unit tests for auth, RBAC, tenant isolation.

## Data Model

Use better-auth generated auth tables plus explicit workspace tables if the organization plugin's
table names are not ergonomic enough. The plan should make the mapping explicit:

- user/session/account/verification tables from better-auth;
- organization/workspace table with `id`, `name`, `slug`, owner relation, timestamps;
- member table with `user_id`, `workspace_id`, `role`;
- invitation table with `email`, `workspace_id`, `role`, `token/id`, `expires_at`, `status`;
- exemplar `tenant_isolation_probe` table with `id`, `workspace_id`, `label` for RLS tests only.

## Permission Statements

Define permission resources now even if content tables arrive later:

- `workspace`: `read`, `update`, `delete`
- `member`: `invite`, `remove`, `updateRole`, `read`
- `template`: `create`, `read`, `update`, `delete`, `duplicate`
- `lp`: `create`, `read`, `update`, `delete`, `duplicate`, `preview`, `export`
- `brand`: `read`, `update`
- `asset`: `create`, `read`, `delete`

This lets Phase 3-5 consume one stable permission vocabulary.

</recommended_architecture>

<risks_and_mitigations>

| Risk | Impact | Mitigation |
|------|--------|------------|
| Raw Prisma client leaks into feature code | Tenant filter can be forgotten | Export raw client only from an internal module; add lint/test grep that feature modules import tenant helpers only |
| RLS not exercised in tests | False confidence from type/build passing | Add integration tests that set and omit transaction workspace settings |
| better-auth custom roles mismatch app role enum | UI/actions disagree with stored role | One `permissions.ts` exports `RoleSchema`, role constants, and Better Auth role definitions |
| Email provider blocks local testing | Auth verification flow untestable | Console email transport writes verification URLs to an in-memory/test sink |
| Copyable invites conflict with WS-03 wording | Requirement ambiguity | Store invited email and role; defer automatic send only, as captured in D-06 |
| Future tables skip `workspace_id` | WS-05 violated in later phases | Add schema convention test that tenant-owned Prisma models include `workspaceId` |

</risks_and_mitigations>

<planning_recommendation>
Create three executable plans:

1. App/auth/database foundation: monorepo app package, Prisma, better-auth email/password,
   email verification, auth pages, and schema/migration baseline.
2. Workspace/RBAC/tenant data layer: workspace creation, slug routing, role matrix, central
   tenant DB helper, RLS policy contract, and workspace shell.
3. Invitations and isolation verification: copyable invite links, account-on-accept, member
   management, cross-tenant tests, final coverage against WS-01..WS-05 and D-01..D-14.
</planning_recommendation>

