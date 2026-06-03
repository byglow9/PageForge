---
phase: 02-multi-tenancy-foundation
plan: "01"
subsystem: auth-foundation
tags:
  - better-auth
  - prisma
  - email-verification
  - monorepo
  - next-js

dependency_graph:
  requires:
    - phase-01-core-engine (engine library untouched, coexists in monorepo)
  provides:
    - apps/web Next.js app package
    - better-auth email/password auth with mandatory email verification
    - Prisma 7 schema with auth + workspace entities
    - custom role vocabulary owner/admin/editor/viewer
    - transactional email abstraction with test capture
  affects:
    - pnpm-workspace.yaml (now includes apps/*)
    - 02-02-PLAN.md (workspace creation builds on this auth foundation)
    - 02-03-PLAN.md (invitation flow uses this auth config + email sender)

tech_stack:
  added:
    - "next@^16.2.7 (App Router, React 19)"
    - "better-auth@^1.6.13 (email/password, organization plugin)"
    - "@prisma/adapter-pg@7.8.0 (Prisma 7 driver adapter)"
    - "pg@^8.21.0 (PostgreSQL driver)"
    - "nodemailer@^6.9.0 (SMTP transport)"
    - "vitest@^4.1.8 + @vitejs/plugin-react (test runner)"
  patterns:
    - "Prisma 7 generator: prisma-client (not prisma-client-js) with output to src/generated/prisma"
    - "Prisma 7 requires prisma.config.ts with defineConfig; datasource URL moves out of schema.prisma"
    - "Prisma 7 PrismaClient requires @prisma/adapter-pg driver adapter (no direct connection string)"
    - "better-auth Prisma adapter imports PrismaClient from generated path @/generated/prisma/client"
    - "Email transport selected via EMAIL_TRANSPORT env: console (dev) | smtp (prod) | test (vitest)"

key_files:
  created:
    - apps/web/package.json
    - apps/web/tsconfig.json
    - apps/web/next.config.ts
    - apps/web/vitest.config.ts
    - apps/web/.env.example
    - apps/web/prisma.config.ts
    - apps/web/prisma/schema.prisma
    - apps/web/src/generated/prisma/ (Prisma 7 generated client TypeScript)
    - apps/web/src/lib/db/prisma.ts
    - apps/web/src/lib/auth/auth.ts
    - apps/web/src/lib/auth/auth-client.ts
    - apps/web/src/lib/auth/permissions.ts
    - apps/web/src/lib/email/send-email.ts
    - apps/web/src/app/api/auth/[...all]/route.ts
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/page.tsx
    - apps/web/src/app/(auth)/signup/page.tsx
    - apps/web/src/app/(auth)/login/page.tsx
    - apps/web/src/app/(auth)/verify-email/page.tsx
    - apps/web/tests/auth.test.ts
  modified:
    - pnpm-workspace.yaml (added packages glob for . and apps/*)
    - pnpm-lock.yaml (new dependencies locked)

decisions:
  - "Prisma 7 uses prisma-client generator (not prisma-client-js) and generates to src/generated/prisma"
  - "Prisma 7 requires @prisma/adapter-pg driver adapter; PrismaClient no longer accepts raw DATABASE_URL"
  - "prisma.config.ts owns the datasource URL (removed from schema.prisma datasource block)"
  - "Generated Prisma client is committed to source as src/generated/prisma (not node_modules)"
  - "better-auth imports PrismaClient from @/generated/prisma/client per Prisma 7 docs"

metrics:
  duration: "13 minutes"
  completed_date: "2026-06-03"
  tasks_completed: 4
  tasks_total: 4
  files_created: 38
  files_modified: 2
---

# Phase 2 Plan 01: Auth Foundation Summary

**One-liner:** Next.js app bootstrapped with better-auth email/password + mandatory email verification, Prisma 7 schema for auth and workspace entities, and custom owner/admin/editor/viewer role vocabulary.

## Objective

Bootstrap the first PageForge web application package with Next.js, Prisma, better-auth, mandatory email verification, and the route/UI surface for signup and login.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add Next.js app package and monorepo wiring | 6d120c7 | pnpm-workspace.yaml, apps/web/package.json, tsconfig.json, next.config.ts, vitest.config.ts, .env.example |
| 2 | Define Prisma schema baseline and raw client | 9545862 | prisma/schema.prisma, prisma.config.ts, src/lib/db/prisma.ts |
| 3 | Configure better-auth email/password, verification, and custom roles | c47d6cb | src/lib/auth/auth.ts, auth-client.ts, permissions.ts, email/send-email.ts, api/auth/[...all]/route.ts |
| 4 | Add signup/login/verify pages and auth tests | 030aa60 | src/app/(auth)/signup, login, verify-email, tests/auth.test.ts |

## Success Criteria Verification

- WS-01 auth surface exists with email/password signup and login: PASS (signup/login pages created)
- Mandatory email verification wired through better-auth and transactional email: PASS (sendVerificationEmail hooked, test capture confirmed)
- Web app package and Prisma schema baseline exist: PASS (prisma generate exits 0)
- Role vocabulary owner/admin/editor/viewer exists: PASS (permissions.ts with 4 roles, tested)
- No OAuth, magic-link, or MFA configured: PASS (auth.ts only uses emailAndPassword + organization plugins)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prisma 7 requires different generator and import patterns**
- **Found during:** Task 2 (prisma generate)
- **Issue:** Prisma 7 no longer uses `prisma-client-js` generator or `.prisma/client` output. The `datasource.url` is no longer valid in schema.prisma. TypeScript cannot resolve `PrismaClient` from `@prisma/client` when using symlinked pnpm node_modules + Prisma 7 driver adapter.
- **Fix:**
  1. Changed `generator client { provider = "prisma-client" }` (Prisma 7 TS generator)
  2. Added `output = "../src/generated/prisma"` (generates TypeScript source, not compiled artifacts)
  3. Created `prisma.config.ts` with `defineConfig({ datasource: { url: process.env.DATABASE_URL } })`
  4. Removed `url` from `datasource db` block in schema.prisma
  5. Added `@prisma/adapter-pg` + `pg` dependencies; updated `src/lib/db/prisma.ts` to use `PrismaPg` driver adapter
  6. Updated all `PrismaClient` imports to use `@/generated/prisma/client`
- **Files modified:** apps/web/prisma/schema.prisma, apps/web/prisma.config.ts (new), apps/web/src/lib/db/prisma.ts, apps/web/package.json
- **Commit:** 9545862 (schema changes), c47d6cb (prisma.ts update)

**2. [Rule 1 - Bug] TypeScript TS2540: NODE_ENV is read-only**
- **Found during:** Task 4 (typecheck after writing tests)
- **Issue:** Test tried to assign `process.env.NODE_ENV = "test"` which is a read-only property.
- **Fix:** Removed the assignment; Vitest sets NODE_ENV="test" by default, so the email capture already works without override.
- **Files modified:** apps/web/tests/auth.test.ts
- **Commit:** 030aa60

## Known Stubs

None — no UI components render placeholder data. Pages are functional navigation shells without wired data dependencies yet (workspace pages are Plan 02 scope).

## Threat Surface Scan

No new surfaces beyond the plan's threat model. The auth route `api/auth/[...all]/route.ts` is exactly as planned (T-02-01-01). No new endpoints or file access patterns introduced outside the plan.

## Self-Check

Files verified:
- apps/web/src/lib/auth/auth.ts: created
- apps/web/src/lib/auth/permissions.ts: created
- apps/web/src/lib/email/send-email.ts: created
- apps/web/prisma/schema.prisma: created
- apps/web/tests/auth.test.ts: created

Commits verified:
- 6d120c7: chore(02-01): add Next.js app package and monorepo wiring
- 9545862: feat(02-01): add Prisma schema baseline and raw client singleton
- c47d6cb: feat(02-01): configure better-auth email/password, verification, and custom roles
- 030aa60: feat(02-01): add signup/login/verify pages and auth configuration tests

Test results: 12/12 passing
Typecheck: clean (exit 0)
Prisma generate: exit 0

## Self-Check: PASSED
