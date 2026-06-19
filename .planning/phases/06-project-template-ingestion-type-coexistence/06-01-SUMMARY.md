---
phase: 06-project-template-ingestion-type-coexistence
plan: 01
subsystem: database, api, ui
tags: [prisma, postgres, migration, typescript, react, catalog, kind-discriminator]

# Dependency graph
requires:
  - phase: 05-catalog-grecia-acceptance
    provides: catalog UI components (CatalogGrid, LpCatalogCard) and LP/template server actions

provides:
  - kind TEXT NOT NULL DEFAULT 'LIQUID' column on template and landing_page tables (migration 0006)
  - Prisma schema and generated client with kind field on Template and LandingPage
  - TenantTemplateHelpers.create extended with optional id? and kind?
  - Type boundary guard in renderLp(): throws on kind === 'VITE_SPA' (PRJ-11)
  - listLpsAction and listTemplatesAction returning kind field
  - CatalogGrid, LpCatalogCard, TemplateCard wired to pass/display kind
  - 'Vite SPA' outline badge on VITE_SPA records in catalog and template list

affects:
  - 06-02 (project template ingestion): will use TenantTemplateHelpers.create with kind: 'VITE_SPA'
  - Any future plan that creates LandingPage or Template records needs to be aware of kind default

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TEXT + CHECK constraint for kind discriminator (avoids Prisma error 55P04 from native enum)"
    - "Type boundary guard pattern: renderLp() throws before any processing when kind !== 'LIQUID'"
    - "Additive migration pattern: ALTER TABLE ADD COLUMN with DEFAULT fills existing rows without data migration"

key-files:
  created:
    - apps/web/prisma/migrations/0006_kind_discriminator/migration.sql
  modified:
    - apps/web/prisma/schema.prisma
    - apps/web/src/lib/db/tenant-db.ts
    - apps/web/src/generated/prisma/models/Template.ts
    - apps/web/src/generated/prisma/models/LandingPage.ts
    - apps/web/src/generated/prisma/internal/class.ts
    - apps/web/src/generated/prisma/internal/prismaNamespace.ts
    - apps/web/src/generated/prisma/internal/prismaNamespaceBrowser.ts
    - apps/web/src/lib/lps/render.ts
    - apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx
    - apps/web/src/app/api/lps/[lpId]/export/route.ts
    - apps/web/src/lib/lps/actions.ts
    - apps/web/src/lib/templates/actions.ts
    - apps/web/src/components/catalog/CatalogGrid.tsx
    - apps/web/src/components/catalog/LpCatalogCard.tsx
    - apps/web/src/components/templates/TemplateCard.tsx

key-decisions:
  - "TEXT + CHECK instead of native PG enum avoids Prisma 55P04 error (new enum values cannot be used in same transaction that creates them)"
  - "Kind defaults to 'LIQUID' at DB level — zero code changes required on existing LIQUID read paths"
  - "renderLp() type boundary guard uses lp.kind ?? 'LIQUID' at call sites for backward compatibility"

patterns-established:
  - "Type boundary guard pattern: check kind as first statement in render function, throw descriptive error"
  - "Additive discriminator column: TEXT NOT NULL DEFAULT 'VALUE' + CHECK constraint (no table rewrite on PG 11+)"

requirements-completed:
  - PRJ-01
  - PRJ-03
  - PRJ-11

# Metrics
duration: 8min
completed: 2026-06-19
---

# Phase 06 Plan 01: Kind Discriminator Foundation Summary

**Added LIQUID|VITE_SPA kind discriminator column to both DB tables, Prisma client, render guard, and catalog UI — LIQUID records are completely unaffected.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-19T13:11:33Z
- **Completed:** 2026-06-19T13:19:37Z
- **Tasks:** 4 (Tasks 1, 2, 3a, 3b)
- **Files modified:** 15

## Accomplishments

- Migration 0006 applied: `kind TEXT NOT NULL DEFAULT 'LIQUID' CHECK (kind IN ('LIQUID', 'VITE_SPA'))` on both `template` and `landing_page` tables — Postgres 11+ catalog-stored default, no table rewrite, no lock
- Prisma client regenerated with `kind: string` on Template and LandingPage result types
- `renderLp()` now requires `kind: string` and throws "Type boundary violation" if `kind === 'VITE_SPA'` (PRJ-11 / T-06-01)
- `listLpsAction` and `listTemplatesAction` return type and map() include `kind` field — flowing kind to the catalog UI
- `CatalogGrid.CatalogLp` interface, `LpCatalogCard`, and `TemplateCard` all wired to pass and display `kind`; "Vite SPA" outline badge appears on VITE_SPA records

## Task Commits

Each task was committed atomically:

1. **Task 1: Write migration SQL + update Prisma schema + extend TenantClient** - `e96cab3` (feat)
2. **Task 2: Apply migration + prisma generate** - `1f19e87` (chore)
3. **Task 3a: Wire kind through render path + server actions** - `8696800` (feat)
4. **Task 3b: Add kind badges to catalog UI components** - `c767fd7` (feat)

**Plan metadata:** (pending — created after this note)

## Files Created/Modified

- `apps/web/prisma/migrations/0006_kind_discriminator/migration.sql` - Additive ALTER TABLE migration for kind column on both tables (already existed in base commit)
- `apps/web/prisma/schema.prisma` - Added kind String @default("LIQUID") to Template and LandingPage models
- `apps/web/src/lib/db/tenant-db.ts` - Extended TenantTemplateHelpers.create with optional id? and kind?
- `apps/web/src/generated/prisma/models/Template.ts` - Regenerated with kind: string
- `apps/web/src/generated/prisma/models/LandingPage.ts` - Regenerated with kind: string
- `apps/web/src/lib/lps/render.ts` - Added kind param to renderLp() + type boundary guard
- `apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx` - Passes kind: lp.kind ?? 'LIQUID' to renderLp()
- `apps/web/src/app/api/lps/[lpId]/export/route.ts` - Passes kind: lp.kind ?? 'LIQUID' to renderLp()
- `apps/web/src/lib/lps/actions.ts` - listLpsAction return includes kind: lp.kind
- `apps/web/src/lib/templates/actions.ts` - listTemplatesAction return includes kind: t.kind
- `apps/web/src/components/catalog/CatalogGrid.tsx` - CatalogLp interface gains kind: string
- `apps/web/src/components/catalog/LpCatalogCard.tsx` - lp prop type gains kind; shows 'Vite SPA' badge
- `apps/web/src/components/templates/TemplateCard.tsx` - template prop type gains kind; imports Badge; shows 'Vite SPA' badge

## Deviations from Plan

None — plan executed exactly as written. The migration SQL was already present in the base commit (from previous work); prisma generate was required instead of migrate dev because the migration was already applied to the live database (0006_kind_discriminator showed `finished_at = 2026-06-18` in `_prisma_migrations`).

## Self-Check: PASSED

- migration.sql exists and contains 2 ADD COLUMN statements: confirmed
- schema.prisma contains kind in Template (line 217) and LandingPage (line 259): confirmed
- Generated types expose kind: string on Template and LandingPage: confirmed
- renderLp() contains "Type boundary violation" guard: confirmed
- listLpsAction map() contains `kind: lp.kind`: confirmed
- listTemplatesAction map() contains `kind: t.kind`: confirmed
- LpCatalogCard contains "Vite SPA" badge: confirmed
- TemplateCard contains "Vite SPA" badge and `import { Badge }`: confirmed
- CatalogGrid.CatalogLp interface contains `kind: string`: confirmed
- DB has kind column on both tables (verified via psql): confirmed
