# Phase 02: Multi-Tenancy Foundation - Patterns

**Mapped:** 2026-06-03
**Status:** Ready for planning

## PATTERN MAPPING COMPLETE

<codebase_state>
The repository currently contains a single pure TypeScript engine package at the root:

- `package.json` - `pageforge-engine`, ESM, scripts `test`, `build`, `typecheck`.
- `pnpm-workspace.yaml` - only `allowBuilds.esbuild: true`; no package globs yet.
- `tsconfig.json` - strict, `module` and `moduleResolution` set to `NodeNext`.
- `src/engine/*` and `tests/engine/*` - Phase 1 parser/render engine and tests.

There is no `apps/web`, no Next.js app, no Prisma schema, no database code, and no auth code.
Phase 2 establishes the app-layer conventions that later phases must follow.
</codebase_state>

<closest_existing_patterns>

## Root TypeScript/ESM Pattern

Existing files:
- `package.json`
- `tsconfig.json`
- `vitest.config.ts`

Pattern to preserve:
- strict TypeScript;
- ESM package semantics;
- explicit `.js` extensions in internal TS imports where NodeNext applies;
- Vitest for unit/integration tests.

Phase 2 adaptation:
- Root remains the engine package.
- Add `apps/web/package.json` with its own Next/Prisma scripts.
- Update `pnpm-workspace.yaml` to include `"apps/*"` and `"."`.

## Engine Boundary Pattern

Existing files:
- `src/engine/index.ts`
- `src/engine/parser.ts`
- `src/engine/renderer.ts`

Pattern to preserve:
- root engine is a pure library with no auth/database/app dependency.

Phase 2 adaptation:
- Do not import Next.js, Prisma, or better-auth into `src/engine`.
- The app package can later import the engine, but Phase 2 does not need to modify engine code.

## Test Pattern

Existing files:
- `tests/engine/*.test.ts`

Pattern to preserve:
- direct assertions over behavior;
- clear security/invariant tests;
- no "build passes" as a substitute for behavior.

Phase 2 adaptation:
- Use `apps/web/tests/*.test.ts` for auth/RBAC/data-layer tests.
- Integration tests should assert denial across workspaces by ID and RLS behavior with mismatched
  `app.current_workspace_id`.

</closest_existing_patterns>

<planned_files>

## Monorepo and App Package

- `pnpm-workspace.yaml` - add package globs while preserving `allowBuilds.esbuild`.
- `apps/web/package.json` - Next app scripts and dependencies.
- `apps/web/tsconfig.json` - Next TypeScript config.
- `apps/web/next.config.ts`
- `apps/web/vitest.config.ts`
- `apps/web/.env.example`

## Auth

- `apps/web/src/lib/auth/auth.ts` - better-auth server config.
- `apps/web/src/lib/auth/auth-client.ts` - client plugin config.
- `apps/web/src/lib/auth/permissions.ts` - role enum, permission statements, custom roles.
- `apps/web/src/lib/auth/route.ts` or `apps/web/src/app/api/auth/[...all]/route.ts` - auth route handler.
- `apps/web/src/lib/email/send-email.ts` - console/test/provider email sender.

## Database and Tenancy

- `apps/web/prisma/schema.prisma` - Prisma schema.
- `apps/web/prisma/migrations/*/migration.sql` - baseline tables and RLS SQL.
- `apps/web/src/lib/db/prisma.ts` - singleton raw Prisma client.
- `apps/web/src/lib/db/tenant-db.ts` - request-scoped tenant data helper.
- `apps/web/src/lib/workspaces/guards.ts` - session, membership, and role guards.
- `apps/web/src/lib/workspaces/actions.ts` - workspace creation/settings/member/invite actions.
- `apps/web/src/lib/workspaces/schema.ts` - Zod schemas for action inputs.

## UI and Routes

- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/(auth)/signup/page.tsx`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/verify-email/page.tsx`
- `apps/web/src/app/workspaces/new/page.tsx`
- `apps/web/src/app/w/[slug]/layout.tsx`
- `apps/web/src/app/w/[slug]/page.tsx`
- `apps/web/src/app/w/[slug]/members/page.tsx`
- `apps/web/src/components/auth/*`
- `apps/web/src/components/workspaces/*`

## Tests

- `apps/web/tests/auth.test.ts`
- `apps/web/tests/permissions.test.ts`
- `apps/web/tests/workspaces.test.ts`
- `apps/web/tests/tenant-isolation.test.ts`
- `apps/web/tests/invitations.test.ts`

</planned_files>

<schema_push_requirement>
**[BLOCKING] Schema Push Required**

This phase modifies schema-relevant files:

- `apps/web/prisma/schema.prisma`
- `apps/web/prisma/migrations/*/migration.sql`

ORM detected: Prisma.

The plans must include a blocking database task after schema/migration files are created and
before verification:

- `pnpm --filter @pageforge/web prisma generate`
- `pnpm --filter @pageforge/web prisma migrate dev --name multi_tenancy_foundation`

If no local PostgreSQL database is available, execution must stop for manual DB setup. TypeScript
build success alone is not sufficient for this phase because RLS and migrations are database
behavior.
</schema_push_requirement>

