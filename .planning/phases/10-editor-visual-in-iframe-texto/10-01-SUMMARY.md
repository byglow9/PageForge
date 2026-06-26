---
phase: 10-editor-visual-in-iframe-texto
plan: "01"
subsystem: database
tags: [postgres, prisma, rls, migration, serving]

# Dependency graph
requires:
  - phase: 10-editor-visual-in-iframe-texto (0009_serving_read_policy)
    provides: serving_read RLS policy pattern for template and brand_config tables
provides:
  - "serving_read SELECT RLS policy on landing_page table (migration 0010)"
  - "serve route can now read LP overrides inside servingRead() — O-2 gap closed"
affects:
  - "10-02 (edit-script delivery depends on preview showing overrides)"
  - "10-03 (ViteSpaPreviewEditor depends on overrides injected into iframe)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-layer tenant scoping: permissive RLS policy (app.serving='on') + Prisma WHERE clause (workspaceId from HMAC token)"

key-files:
  created:
    - apps/web/prisma/migrations/0010_lp_serving_read_policy/migration.sql
  modified: []

key-decisions:
  - "serving_read policy on landing_page is SELECT-only with no WITH CHECK clause — mirrors exact pattern from migration 0009 for template/brand_config"
  - "Application-level tenant scoping (Prisma WHERE workspaceId from HMAC token) enforced independently of the permissive RLS policy"

patterns-established:
  - "serving_read dual-layer pattern: permissive SELECT RLS (app.serving='on') + app-level WHERE (workspaceId from HMAC) for cross-workspace serving"

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-06-26
---

# Phase 10 Plan 01: serving_read RLS policy for landing_page (O-2 fix) Summary

**PostgreSQL SELECT RLS policy `serving_read` adicionada na tabela `landing_page` via migration 0010 — fecha a lacuna O-2 que impedia o serve route de ler overrides de LP dentro de `servingRead()`**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-26T12:33:00Z
- **Completed:** 2026-06-26T12:41:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Identificado e corrigido o gap O-2: `landing_page` só tinha `tenant_isolation` (requer `app.current_workspace_id`), mas `servingRead()` seta apenas `app.serving='on'` — causando zero rows para LPs no serve route
- Criada migration `0010_lp_serving_read_policy` com `CREATE POLICY "serving_read" ON "landing_page" FOR SELECT USING (current_setting('app.serving', true) = 'on')`, exatamente o padrão da 0009 para `template`/`brand_config`
- Migração aplicada ao banco local — `pg_policies` confirma: `serving_read (SELECT)` e `tenant_isolation (ALL)` coexistem na tabela `landing_page`

## Task Commits

1. **Task 1: Create migration 0010 — serving_read policy on landing_page** - `4ca4c51` (feat)
2. **Task 2: Apply migration and verify database state** - sem novo commit (migração aplicada ao DB; nenhum arquivo novo foi gerado — migration_lock.toml não muda para políticas RLS puras sem alteração de modelo Prisma)

**Plan metadata:** (a ser registrado pelo commit do SUMMARY)

## Files Created/Modified

- `apps/web/prisma/migrations/0010_lp_serving_read_policy/migration.sql` - Política SELECT RLS `serving_read` para a tabela `landing_page`; comentário explica a causa raiz O-2 e a justificativa de segurança (dual-layer)

## Decisions Made

- Policy é SELECT-only (sem WITH CHECK) pois RLS de escrita não é necessário aqui — mirrors exato da migration 0009
- Sem alteração ao `schema.prisma` — policy RLS pura não requer modelo Prisma novo; `migration_lock.toml` permanece inalterado

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] DATABASE_URL não carregada automaticamente pelo Prisma CLI na worktree**
- **Found during:** Task 2 (Apply migration)
- **Issue:** `pnpm --filter web prisma migrate dev` retornava "P1010: User was denied access" porque o `.env` do diretório `apps/web` não era carregado pelo Prisma CLI quando chamado via `--filter` no monorepo root; e a worktree tem seu próprio CWD isolado
- **Fix:** Executar o comando diretamente do diretório `apps/web` da worktree com `DATABASE_URL` explícito (`DATABASE_URL="..." npx prisma migrate dev`)
- **Files modified:** Nenhum — somente forma de invocação alterada
- **Verification:** `prisma migrate status` mostra "10 migrations found — Database schema is up to date!"; `pg_policies` confirma política criada
- **Committed in:** N/A (não gerou alteração de arquivo)

---

**Total deviations:** 1 auto-fixed (1 blocking — invocação CLI na worktree)
**Impact on plan:** Correção de procedimento sem impacto no artefato final. A migration foi aplicada corretamente ao banco.

## Issues Encountered

- `pnpm --filter web prisma` não encontra o script `prisma` nas workspaces do monorepo — resolvido executando diretamente do diretório `apps/web` da worktree com DATABASE_URL explícito

## Known Stubs

None — este plano é puro SQL de migração, sem UI ou dados de apresentação.

## Threat Flags

None — nenhuma nova superfície de rede, path de auth ou endpoint foi introduzida. O threat T-10-01-01 (Elevation of Privilege) foi mitigado conforme o threat model: policy SELECT-only + WHERE clause via HMAC token no Prisma.

## Next Phase Readiness

- O serve route `servingRead()` agora pode ler `landing_page` rows para injetar overrides no preview
- Plano 10-02 (edit-script entregue na SPA compilada) e 10-03 (ViteSpaPreviewEditor) podem prosseguir sabendo que o preview refletirá os overrides salvos
- Nenhum bloqueador

---
*Phase: 10-editor-visual-in-iframe-texto*
*Completed: 2026-06-26*
