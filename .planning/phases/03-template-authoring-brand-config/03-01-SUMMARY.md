---
phase: 03-template-authoring-brand-config
plan: "01"
subsystem: engine-wiring-foundations
tags: [prisma, engine, tenant-db, zod, metadata, tdd]
dependency_graph:
  requires:
    - Phase 02 (TenantClient, workspace isolation, RLS pattern)
    - pageforge-engine (monorepo root package)
  provides:
    - Template and BrandConfig Prisma models with workspaceId
    - TenantTemplateHelpers and TenantBrandHelpers in TenantClient
    - reconcileMetadataOverlay pure function
    - CreateTemplateSchema, UpdateTemplateSchema, SaveBrandConfigSchema
    - RED test scaffolds for Plan 03 and Plan 04 source assertion gates
  affects:
    - Plan 02 (migration): Template + BrandConfig models need RLS migration SQL
    - Plan 03 (template slice): depends on tenant-db.ts template helpers
    - Plan 04 (brand slice): depends on tenant-db.ts brandConfig helpers
tech_stack:
  added:
    - pageforge-engine workspace:* dependency in apps/web
    - "sideEffects": false on root package.json for tree-shaking renderer.ts
    - exports/main/types fields added to root package.json for TS resolution
  patterns:
    - TenantClient extension: inline interfaces + implementations in tenant-db.ts
    - Prisma.InputJsonValue typing for Json columns
    - Zod v4 z.record() requires two args (key type + value type)
key_files:
  created:
    - apps/web/src/lib/templates/metadata.ts
    - apps/web/src/lib/templates/schema.ts
    - apps/web/src/lib/brand/schema.ts
    - apps/web/tests/metadata.test.ts
    - apps/web/tests/templates.test.ts
    - apps/web/tests/brand.test.ts
  modified:
    - apps/web/package.json (pageforge-engine dep)
    - apps/web/next.config.ts (transpilePackages)
    - apps/web/prisma/schema.prisma (Template + BrandConfig models + Workspace back-refs)
    - apps/web/tests/schema-conventions.test.ts (uncommented Template + BrandConfig)
    - apps/web/src/lib/db/tenant-db.ts (TenantTemplateHelpers + TenantBrandHelpers)
    - package.json (sideEffects + exports for TypeScript module resolution)
    - apps/web/src/generated/prisma/* (regenerated with new models)
decisions:
  - "D-04 + D-05: MetadataOverlay is an app-level overlay separate from engine ParsedSchema; reconcileMetadataOverlay drops removed fields, preserves matched fields, defaults new fields"
  - "D-06: required boolean is the only field-level validation in v1 (no regex/range validators)"
  - "D-10: schemaVersion incremented atomically via schemaVersion: { increment: 1 } on every template update"
  - "Rule 3 deviation: Added exports/main/types to root package.json to fix TS module resolution for pageforge-engine"
  - "Rule 3 deviation: Zod v4 z.record() requires two arguments — used z.record(z.string(), z.object(...))"
metrics:
  duration_minutes: 9
  completed_date: "2026-06-05"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 8
---

# Phase 3 Plan 01: Engine Wiring + Schema Foundations Summary

**One-liner:** pageforge-engine wired into apps/web as workspace dep with transpilePackages, Template + BrandConfig Prisma models with workspaceId, TenantClient extended with template/brandConfig helpers, reconcileMetadataOverlay pure function, Zod schemas for CRUD and brand config, plus RED test scaffolds for Plans 03 and 04.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Engine wiring + shadcn bootstrap + Prisma schema + sideEffects | f05a84f | package.json, next.config.ts, schema.prisma, schema-conventions.test.ts |
| 2 | Zod schemas, metadata.ts, TenantClient extension + RED tests | d7a4f55 | metadata.ts, templates/schema.ts, brand/schema.ts, tenant-db.ts, 3 test files |

## Verification Results

| Step | Command | Result |
|------|---------|--------|
| 1 | pnpm install | PASS — workspace symlink resolved |
| 2 | prisma generate | PASS — Template and BrandConfig types generated |
| 3 | schema-conventions.test.ts | PASS — 14 tests, Template + BrandConfig enforced |
| 4 | metadata.test.ts | PASS — 4 tests, all GREEN (pure function) |
| 5 | templates.test.ts | 13 GREEN (schema validation) + 3 RED (source assertions, expected) |
| 6 | brand.test.ts | 18 GREEN (schema + permissions) + 1 RED (source assertion, expected) |
| 7 | typecheck | PASS — zero TypeScript errors |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Root package.json missing exports/main/types for TS module resolution**
- **Found during:** Task 2 — TypeScript reported "Cannot find module 'pageforge-engine' or its corresponding type declarations"
- **Issue:** Root package.json had no `exports`, `main`, or `types` fields, so TypeScript in apps/web could not resolve types for `import type { TokenField } from "pageforge-engine"`
- **Fix:** Added `"exports"`, `"main"`, and `"types"` fields to root package.json pointing to `./src/engine/index.ts`
- **Files modified:** `package.json`
- **Commit:** d7a4f55

**2. [Rule 3 - Blocking] Zod v4 z.record() requires two arguments**
- **Found during:** Task 2 — TypeScript reported "Expected 2-3 arguments, but got 1" on `z.record(z.object({...}))`
- **Issue:** Zod v4 changed `record()` to require an explicit key type argument: `record(keyType, valueType)`. In v3 the key defaulted to `z.string()`.
- **Fix:** Changed `z.record(z.object({...}))` to `z.record(z.string(), z.object({...}))` in `templates/schema.ts`
- **Files modified:** `apps/web/src/lib/templates/schema.ts`
- **Commit:** d7a4f55

**3. [Rule 3 - Blocking] Prisma-generated types use ModelName suffix**
- **Found during:** Task 2 — Import of `{ Template, BrandConfig } from "@/generated/prisma"` failed
- **Issue:** Prisma 7.x generates model types as `TemplateModel` and `BrandConfigModel`, not `Template` and `BrandConfig`
- **Fix:** Imported with type aliases: `import type { TemplateModel as Template, BrandConfigModel as BrandConfig } from "@/generated/prisma/models"`
- **Files modified:** `apps/web/src/lib/db/tenant-db.ts`
- **Commit:** d7a4f55

**4. [Rule 3 - Blocking] `unknown` not assignable to Prisma InputJsonValue**
- **Found during:** Task 2 — TypeScript error on `schema: unknown` in template create/update operations
- **Issue:** Prisma's Json column input type requires `Prisma.InputJsonValue`, not `unknown`
- **Fix:** Imported `Prisma` namespace from `@/generated/prisma/client` and typed `schema` and `metadataOverlay` as `Prisma.InputJsonValue`
- **Files modified:** `apps/web/src/lib/db/tenant-db.ts`
- **Commit:** d7a4f55

## Test State Summary

| Test File | Total | GREEN | RED | RED Reason |
|-----------|-------|-------|-----|------------|
| schema-conventions.test.ts | 14 | 14 | 0 | — |
| metadata.test.ts | 4 | 4 | 0 | — |
| templates.test.ts | 16 | 13 | 3 | actions.ts doesn't exist yet (Plan 03) |
| brand.test.ts | 19 | 18 | 1 | brand/actions.ts doesn't exist yet (Plan 04) |

Source assertion RED tests are CORRECT and EXPECTED. They gate Plan 03 (template actions) and Plan 04 (brand actions).

## Self-Check: PASSED

All files created, commits verified, package fields confirmed, Prisma models present.

| Check | Result |
|-------|--------|
| apps/web/src/lib/templates/metadata.ts | FOUND |
| apps/web/src/lib/templates/schema.ts | FOUND |
| apps/web/src/lib/brand/schema.ts | FOUND |
| apps/web/tests/metadata.test.ts | FOUND |
| apps/web/tests/templates.test.ts | FOUND |
| apps/web/tests/brand.test.ts | FOUND |
| Commit f05a84f | FOUND |
| Commit d7a4f55 | FOUND |
| pageforge-engine dep in web/package.json | FOUND |
| sideEffects: false in root package.json | FOUND |
| transpilePackages in next.config.ts | FOUND |
| model Template in schema.prisma | FOUND |
| model BrandConfig in schema.prisma | FOUND |
