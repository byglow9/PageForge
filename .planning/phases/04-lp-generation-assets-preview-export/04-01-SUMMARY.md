---
phase: 04-lp-generation-assets-preview-export
plan: "01"
subsystem: lp-data-layer
tags:
  - prisma
  - s3
  - minio
  - tenant-db
  - render
  - zod
dependency_graph:
  requires:
    - 03-01 (TenantClient, BrandConfig, Template models — already present)
    - 01-03 (pageforge-engine render() function)
  provides:
    - LandingPage Prisma model + table
    - LpAsset Prisma model + table
    - TenantLpHelpers + TenantAssetHelpers in TenantClient
    - renderLp() shared render utility
    - GenerateLpSchema + UpdateLpSchema Zod schemas
    - deriveZodSchema() RHF resolver utility
    - MinIO docker-compose service
    - S3 env vars in .env.example
    - file-type in transpilePackages
  affects:
    - 04-02 (LP form generation — depends on TenantClient.lp and deriveZodSchema)
    - 04-03 (Image upload — depends on MinIO config and TenantAssetHelpers)
    - 04-04 (Preview/export — depends on renderLp())
tech_stack:
  added:
    - docker-compose MinIO service (minio/minio:latest)
    - Prisma model: LandingPage
    - Prisma model: LpAsset
  patterns:
    - TenantClient extension pattern (mirrors TenantTemplateHelpers)
    - renderLp() server-only utility (no "use server" — Pitfall 1 prevention)
    - deriveZodSchema() runtime Zod derivation from ParsedSchema + MetadataOverlay
key_files:
  created:
    - docker-compose.yml
    - apps/web/src/lib/lps/render.ts
    - apps/web/src/lib/lps/schema.ts
    - apps/web/src/lib/lps/schema-derive.ts
    - apps/web/src/generated/prisma/models/LandingPage.ts
    - apps/web/src/generated/prisma/models/LpAsset.ts
  modified:
    - apps/web/.env.example (S3 vars appended)
    - apps/web/next.config.ts (file-type added to transpilePackages)
    - apps/web/prisma/schema.prisma (LandingPage + LpAsset models + Workspace relations)
    - apps/web/src/lib/db/tenant-db.ts (TenantLpHelpers + TenantAssetHelpers interfaces + implementations)
    - apps/web/src/generated/prisma/* (Prisma client regenerated)
decisions:
  - "LandingPage.templateId is a soft reference (String?) with no FK — LP survives template deletion (D-06)"
  - "renderLp() has NO 'use server' directive to prevent sanitize-html from being bundled client-side (RESEARCH.md Pitfall 1)"
  - "brand scope keys mapped explicitly: logo/primary_color/whatsapp (not DB column names logoUrl/primaryColor)"
  - "deriveZodSchema uses Record<string, z.ZodTypeAny> accumulator (not z.ZodRawShape) for Zod v4 Readonly shape compatibility"
metrics:
  duration: "8 minutes"
  completed_date: "2026-06-09T19:08:24Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 8
---

# Phase 04 Plan 01: Data Layer Bootstrap — LP Models, Render Utility, Zod Schemas Summary

**One-liner:** Prisma LandingPage + LpAsset models (db pushed), TenantClient extended with workspaceId-scoped lp/lpAsset helpers, renderLp() server-only render utility, GenerateLpSchema/UpdateLpSchema/deriveZodSchema Zod utilities, and MinIO docker-compose + S3 env vars bootstrapped.

## What Was Built

Three complementary blocks that unblock all downstream Phase 4 plans:

**1. Environment (Task 1):** MinIO docker-compose service (image upload testing), S3 env vars in .env.example, file-type ESM package added to transpilePackages.

**2. Data models (Task 2):** Two new Prisma models — `LandingPage` (with markupSnapshot D-06 snapshot field, soft templateId reference, values jsonb) and `LpAsset` (S3 key tracking for cleanup). Both tables created in the live database via `prisma db push`. Prisma client regenerated with `LandingPageModel` and `LpAssetModel` types.

**3. Service layer (Task 3):** `TenantClient` extended with `lp` and `lpAsset` namespaces, each with full workspaceId-scoped CRUD. Three `lib/lps/` utility files: `render.ts` (renderLp shared server utility, no "use server"), `schema.ts` (GenerateLpSchema + UpdateLpSchema), and `schema-derive.ts` (deriveZodSchema for RHF resolver).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | fd74683 | chore(04-01): environment setup — MinIO docker-compose, S3 env vars, file-type transpile |
| Task 2 | ec5a13f | feat(04-01): add LandingPage + LpAsset Prisma models; db push confirmed |
| Task 3 | 2a15dd0 | feat(04-01): extend TenantClient with lp/lpAsset helpers; scaffold lib/lps utilities |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod v4 ZodRawShape incompatibility in schema-derive.ts**
- **Found during:** Task 3 TypeScript check
- **Issue:** The plan called for `z.ZodRawShape` as the shape accumulator type, but Zod v4 exports `$ZodShape` as `Readonly<{...}>`. Using the old `ZodRawShape` type (only available in `zod/v3`) as a mutable accumulator caused TS2542 "Index signature only permits reading" errors.
- **Fix:** Changed shape accumulator type to `Record<string, z.ZodTypeAny>` (plain mutable Record) and set return type to `z.ZodObject<any>`. The implementation is functionally identical.
- **Files modified:** apps/web/src/lib/lps/schema-derive.ts
- **Commit:** 2a15dd0

**2. [Rule 3 - Blocking] Prisma binary not in worktree node_modules**
- **Found during:** Task 2
- **Issue:** Worktree does not have node_modules. `npx prisma` attempted to install a fresh version which failed to load `prisma.config.ts` (cannot find module 'prisma/config').
- **Fix:** Used the binary from the main repo: `/home/glow/Documentos/projetos/PageForge/apps/web/node_modules/.bin/prisma`. Ran all prisma commands with the explicit path and `DATABASE_URL` env var.
- **Commit:** ec5a13f

**3. [Rule 3 - Blocking] No .env file in worktree for DATABASE_URL**
- **Found during:** Task 2 (db push)
- **Issue:** The worktree doesn't have `.env`. DATABASE_URL defaulted to an invalid connection string.
- **Fix:** Passed `DATABASE_URL=postgresql://pageforge:pageforge_dev@localhost:5432/pageforge` explicitly to the prisma commands (sourced from main repo `.env`).
- **Commit:** ec5a13f

## Verification Results

All 6 verification checks from the plan passed:

1. `docker compose config` — exits without error (minor `version` attribute deprecation warning, not an error)
2. `npx prisma validate` — "The schema at prisma/schema.prisma is valid"
3. `npx prisma db push` — "The database is already in sync with your Prisma schema" (tables created on first run)
4. `grep -c "TenantLpHelpers" tenant-db.ts` — returns 2 (interface + property)
5. `grep -n "^\"use server\"" render.ts` — no output (no directive present)
6. PostgreSQL: `landing_page` and `lp_asset` tables confirmed present

## Known Stubs

None. All utilities are fully implemented. The `deriveZodSchema`, `renderLp`, `GenerateLpSchema`, and `UpdateLpSchema` exports are complete with no TODO or placeholder values. The TenantLpHelpers and TenantAssetHelpers implementations are complete CRUD with workspaceId isolation.

## Threat Surface Scan

No new network endpoints introduced in this plan. All new code is internal server utilities and DB models. The threat mitigations specified in the plan's threat model are implemented:

| Threat | Status |
|--------|--------|
| T-04-01-01: IDOR on lp.findById | Mitigated — every findById/update/delete includes `workspaceId` filter |
| T-04-01-02: LandingPage.values tampering | Mitigated — values validated by deriveZodSchema; engine sanitizes at render |
| T-04-01-03: S3 credentials in env | Mitigated — server-side env vars only, documented in .env.example |
| T-04-01-04: brand scope in renderLp | Mitigated — brandScope keys mapped explicitly from DB, never from client input |
| T-04-01-05: Client-supplied workspaceId | Mitigated — workspaceId always injected from TenantContext, never accepted from client |

## Self-Check: PASSED

- [x] docker-compose.yml exists at worktree root
- [x] apps/web/.env.example contains S3_ENDPOINT
- [x] apps/web/next.config.ts contains "file-type" in transpilePackages
- [x] apps/web/prisma/schema.prisma contains `model LandingPage`
- [x] apps/web/prisma/schema.prisma contains `model LpAsset`
- [x] apps/web/src/generated/prisma/models/LandingPage.ts exists
- [x] apps/web/src/generated/prisma/models/LpAsset.ts exists
- [x] apps/web/src/lib/db/tenant-db.ts exports TenantLpHelpers, TenantAssetHelpers
- [x] apps/web/src/lib/lps/render.ts exports renderLp, no "use server" directive
- [x] apps/web/src/lib/lps/schema.ts exports GenerateLpSchema, UpdateLpSchema
- [x] apps/web/src/lib/lps/schema-derive.ts exports deriveZodSchema
- [x] Commits fd74683, ec5a13f, 2a15dd0 exist in git log
