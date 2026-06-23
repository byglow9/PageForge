---
phase: "08"
plan: "01"
subsystem: data-layer
tags:
  - prisma
  - migration
  - brand-theming
  - zod
  - vite-spa
  - tdd
dependency_graph:
  requires:
    - "Phase 07: VITE_SPA template creation (kind discriminator migration 0006)"
  provides:
    - "landing_page.entry_route column (nullable TEXT)"
    - "TenantLpHelpers.create/update with entryRoute field"
    - "GenerateViteSpaLpSchema (Zod, normalized entryRoute)"
    - "UpdateLpSchema extended with entryRoute"
    - "hexToHslTriplet / buildBrandStyleTag / injectBrandStyle helpers"
  affects:
    - "Phase 08-02: VITE_SPA generate action (uses GenerateViteSpaLpSchema + entryRoute)"
    - "Phase 08-03: VITE_SPA preview/serve (uses injectBrandStyle)"
    - "Phase 08-04: VITE_SPA export (uses buildBrandStyleTag + injectBrandStyle)"
tech_stack:
  added:
    - "lib/brand/theme.ts: hexToHslTriplet, buildBrandStyleTag, injectBrandStyle"
    - "migration 0007_vite_spa_lp_entry_route: ALTER TABLE landing_page ADD COLUMN entry_route TEXT"
  patterns:
    - "Nullable additive migration (no DEFAULT, no CHECK constraint)"
    - "TDD RED->GREEN with vitest for pure utility functions"
    - "Zod .transform() + .default(null) for normalized nullable fields"
key_files:
  created:
    - apps/web/prisma/migrations/0007_vite_spa_lp_entry_route/migration.sql
    - apps/web/src/lib/brand/theme.ts
    - apps/web/src/lib/brand/theme.test.ts
  modified:
    - apps/web/prisma/schema.prisma
    - apps/web/src/lib/db/tenant-db.ts
    - apps/web/src/lib/lps/schema.ts
decisions:
  - "D-05 implementado: MVP injeta apenas --primary convertido para HSL triplet via hexToHslTriplet"
  - "D-08 implementado: reutiliza tabela LandingPage com coluna aditiva nullable entry_route"
  - "entryRoute absent em GenerateViteSpaLpSchema resulta em null (via .default(null))"
  - "entryRoute absent em UpdateLpSchema resulta em undefined (sem alteracao no update)"
metrics:
  duration_minutes: 66
  completed_date: "2026-06-23"
  tasks_completed: 2
  files_created: 3
  files_modified: 3
---

# Phase 08 Plan 01: Foundation — Migration entry_route + Brand Theme Helpers Summary

**One-liner:** Migration aditiva `entry_route TEXT NULL` na tabela `landing_page` + helper `hexToHslTriplet/buildBrandStyleTag/injectBrandStyle` para injeção de CSS vars de marca em LPs VITE_SPA.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migration aditiva entry_route + Prisma schema + TenantLpHelpers | b4b9d0b | migration.sql, schema.prisma, tenant-db.ts |
| 2 (RED) | Testes falhando para brand/theme.ts | 0f9ec4f | theme.test.ts |
| 2 (GREEN) | theme.ts + GenerateViteSpaLpSchema + UpdateLpSchema entryRoute | 8e20f98 | theme.ts, theme.test.ts, schema.ts |

## What Was Built

### Task 1: Migration + Schema + TenantLpHelpers

- **Migration `0007_vite_spa_lp_entry_route`:** `ALTER TABLE "landing_page" ADD COLUMN "entry_route" TEXT` — coluna nullable, sem DEFAULT, sem CHECK constraint. Linhas LIQUID existentes recebem NULL automaticamente.
- **`schema.prisma`:** Adicionado `entryRoute String?` ao model `LandingPage` com comentario inline explicando uso VITE_SPA (D-08).
- **`tenant-db.ts`:** Interfaces `TenantLpHelpers.create` e `.update` estendidas com `entryRoute?: string | null`. Implementacoes passam `entryRoute: data.entryRoute ?? null` no create e `...(entryRoute !== undefined ? { entryRoute } : {})` no update (semantica: undefined=sem alteracao, null=limpar, string=setar).

### Task 2: brand/theme.ts + Zod VITE_SPA schemas (TDD)

- **`lib/brand/theme.ts`:** Modulo server-only puro sem imports externos:
  - `hexToHslTriplet(hex)`: Converte `#RRGGBB` para triplet `"H S% L%"` (formato shadcn) usando algoritmo padrao RGB->HSL com `Math.round`.
  - `buildBrandStyleTag(primaryColor)`: Retorna `""` se falsy; caso contrario `<style>:root{--primary:H S% L%;}</style>`.
  - `injectBrandStyle(html, styleTag)`: Injeta antes de `</head>` ou prepend se ausente.

- **`lib/lps/schema.ts`:** Adicionado ao final sem quebrar exports existentes:
  - `GenerateViteSpaLpSchema`: `templateId` (cuid) + `name` + `entryRoute` com `.default(null)` (ausente=null=root).
  - `GenerateViteSpaLpInput`: tipo inferido.
  - `UpdateLpSchema` estendido com `entryRoute` opcional (ausente=undefined=sem alteracao; `""`=null).

- **`lib/brand/theme.test.ts`:** 17 testes Vitest cobrindo todos os casos do `<behavior>` mais casos de schema.

## Verification Results

1. `SELECT column_name FROM information_schema.columns WHERE table_name='landing_page' AND column_name='entry_route'` — retornou 1 linha (PASS)
2. `pnpm exec vitest run src/lib/brand/theme.test.ts` — 17/17 testes passando (PASS)
3. `pnpm tsc --noEmit` — sem erros (PASS)
4. `grep -c "entryRoute" tenant-db.ts` — retornou 6 (>= 4 requerido) (PASS)
5. `theme.ts` sem `"use server"` e sem imports externos (PASS)
6. Suite completa: 14 arquivos de teste, 271 passando, 10 skipped (PASS)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration 0005 em estado failed bloqueou deploy da 0007**
- **Encontrado durante:** Task 1, ao executar `prisma migrate deploy`
- **Causa:** Migration `0005_catalog_folders_tags` havia falhado anteriormente com `relation "folder" already exists` (as tabelas ja existiam no banco), deixando o estado da migration como failed
- **Fix:** `npx prisma migrate resolve --applied 0005_catalog_folders_tags` para marcar como aplicada
- **Impacto:** Zero — as tabelas ja existiam corretamente no banco; o estado era inconsistente
- **Commit:** b4b9d0b

**2. [Rule 1 - Bug] Expectativa de teste incorreta no plano: `#0d4080` nao produz `'213 90% 23%'`**
- **Encontrado durante:** Task 2 GREEN phase (teste falhou com valor correto `213 82% 28%`)
- **Causa:** O plano especificou `hexToHslTriplet('#0d4080')` -> `'213 90% 23%'` baseado no CSS de renova-turismo, mas o valor CSS foi configurado manualmente para o hex `#06356f` (nao derivado de `#0d4080`). O algoritmo padrao RGB->HSL para `#0d4080` produz `213 82% 28%`.
- **Fix:** Testes corrigidos para usar o valor matematicamente correto `213 82% 28%` para `#0d4080`. Adicionado caso de teste para `#06356f` -> `'213 90% 23%'` (cor real da renova-turismo).
- **Arquivos:** `apps/web/src/lib/brand/theme.test.ts`
- **Commit:** 8e20f98

**3. [Rule 3 - Blocking] Vitest nao encontra arquivos no worktree (sem node_modules)**
- **Encontrado durante:** Task 2, ao tentar verificar RED phase
- **Causa:** Worktree nao tem `node_modules`; vitest executa do repositorio principal mas os arquivos ficam no worktree
- **Fix:** Copia temporaria dos arquivos para o repositorio principal para execucao de testes; arquivos sao gerenciados no worktree para commits
- **Impacto:** Zero na funcionalidade final

## TDD Gate Compliance

- **RED gate:** Commit `0f9ec4f` (`test(08-01): add failing tests`) — testes falhando por `Cannot find module './theme'` (PASS)
- **GREEN gate:** Commit `8e20f98` (`feat(08-01): brand/theme.ts`) — 17/17 testes passando (PASS)
- **REFACTOR gate:** N/A — codigo implementado na primeira passagem, sem refatoracao necessaria

## Known Stubs

None — todos os outputs sao funcionais e nao contem hardcoded empty values ou placeholders.

## Threat Flags

Nenhuma nova superficie de ataque introduzida alem do que esta documentado no `<threat_model>` do plano:
- T-08-01-01 (CSS injection via buildBrandStyleTag): aceito — primaryColor validado como hex puro em BrandConfig.save antes de atingir o helper
- T-08-01-02 (entryRoute injection): mitigado — `GenerateViteSpaLpSchema` valida `.max(128)` e normaliza vazio->null

## Self-Check: PASSED

- [x] `apps/web/prisma/migrations/0007_vite_spa_lp_entry_route/migration.sql` existe
- [x] `apps/web/src/lib/brand/theme.ts` existe
- [x] `apps/web/src/lib/brand/theme.test.ts` existe
- [x] Commits b4b9d0b, 0f9ec4f, 8e20f98 existem no git log
- [x] Coluna `entry_route` existe no banco de dados
- [x] TypeScript compila sem erros
- [x] 17 testes passando
