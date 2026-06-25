---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Editor visual de conteúdo VITE_SPA
status: executing
stopped_at: Roadmap v2.1 created (Fases 9–12) — 15/15 requisitos mapeados
last_updated: "2026-06-24T18:12:37.618Z"
last_activity: 2026-06-25 -- Completed quick task 260625-i1c: Dashboard do workspace
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 2
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-24)

**Core value:** A partir de um template cadastrado uma vez, um usuário gera uma nova landing page completa e fiel ao layout apenas preenchendo um formulário — sem tocar em código.
**Current focus:** Phase 09 — modelo-de-overrides-runtime-de-aplica-o

## Current Position

Phase: 09 (modelo-de-overrides-runtime-de-aplica-o) — EXECUTING
Plan: 1 of 2
Status: Executing Phase 09
Last activity: 2026-06-24 -- Phase 09 execution started

```
[Phase 9 ] [ 10 ] [ 11 ] [ 12 ]
[░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  0% complete
```

## Performance Metrics

**Velocity:**

- Total plans completed: 5
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | - | - |
| 06 | 2 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-core-engine-parser-merge P01 | 223 | 3 tasks | 10 files |
| Phase 01-core-engine-parser-merge P03 | 8 | 2 tasks | 4 files |
| Phase 05 P04 | 20 | 3 tasks | 3 files |
| Phase 05-catalog-grecia-acceptance P06 | 20 | 3 tasks | 4 files |
| Phase 08 P03 | 3 | 2 tasks | 2 files |
| Phase 08 P04 | 4 | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Engine-first, UI-less spike (Phase 1) before any consuming feature — highest risk/leverage.
- [Roadmap]: Multi-tenancy (Phase 2) landed early as un-retrofittable foundation; `workspace_id` + RLS backstop everywhere.
- [Roadmap, OPEN]: LiquidJS vs. logic-less substitution engine — KEY DECISION GATE to resolve at start of Phase 1.
- [Phase ?]: ESM + NodeNext: type:module + moduleResolution:NodeNext para imports .js em runtime Node
- [Phase ?]: pnpm 11: allowBuilds:esbuild em pnpm-workspace.yaml (pnpm.onlyBuiltDependencies obsoleto)
- [Phase ?]: D-03/D-05 implementados: FieldTypeSchema 6 tipos; schema mínimo (name, type, repeater, global) via Zod
- [Phase ?]: Shell padding via page-wrapper not shared main
- [Phase ?]: ImageUploadField hydration via useEffect on field.value without calling onChange — stored value remains RHF source of truth
- [Phase ?]: Base UI SelectValue children render function maps template ID to human-readable name in trigger
- [v2.1 design]: Override em runtime é a única abordagem que funciona em SPA já compilado — conteúdo está no JS bundle, não nos templates. Shim de apply injetado no serve/export após React montar.
- [v2.1 design]: Overrides `{path, originalHash, type, value}` armazenados em `LandingPage.values` (jsonb ocioso para VITE_SPA) — sem nova migração.
- [v2.1 design]: Limitações declaradas — botões com handler JS (não `<a href>`) e conteúdo vindo do Supabase em runtime não são editáveis por override de DOM.
- [v2.1 design]: postMessage entre iframe (serve cross-origin) e dashboard usa allowlist de origem — necessário porque SPA é cross-origin.

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: Engine choice (LiquidJS vs. logic-less substitution) is unresolved across research docs. Resolve at Phase 1 start; both paths must pass the same SSTI/XSS payload corpus. May warrant `/gsd-research-phase`.
- [Phase 4/5]: Schema-change vs. existing-LP reconciliation policy and globals snapshot-vs-live at generate time need a decision during planning.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260603-ju4 | Fix Phase-2 workspace-creation RLS bug + email-verification token (sendOnSignUp) + commit kysely/trustedOrigins fixes | 2026-06-03 | 9cd3826 | [260603-ju4](./quick/260603-ju4-fix-phase-2-workspace-creation-rls-bug-a/) |
| 260608-d6s | Front básico estilizado para a homepage pública (hero centralizado + CTAs Login/Sign up usando design system) | 2026-06-08 | 7723f8c | [260608-d6s](./quick/260608-d6s-homepage-basic-front/) |
| 260608-dbk | Estilizar páginas de login e signup (Card/Input/Label/Button/Alert) preservando toda a lógica de auth | 2026-06-08 | c651e39 | [260608-dbk](./quick/260608-dbk-style-auth-pages/) |
| 260608-d6s-2 | Fix: dev script usa webpack (next dev --webpack) p/ resolver imports .js→.ts do engine | 2026-06-08 | abd6862 | (gsd-fast) |
| 260608-ly0 | Estilizar página de Members (Card/tabelas/Badge/Button) preservando server actions e Server Component | 2026-06-08 | 7dae599 | [260608-ly0](./quick/260608-ly0-style-members-page/) |
| 260617-jzg | Estilizar fluxo de convite (Phase 02): invite link como popup/modal + estilizar página de aceite de convite | 2026-06-17 | d5b4247 | [260617-jzg](./quick/260617-jzg-estilizar-fluxo-de-convite-phase-02-invi/) |
| (fast) | Botão "Switch account" na página de convite (logout + volta a /login?invitationId) | 2026-06-17 | 87b60a7 | (gsd-fast) |
| (fast) | Signup redireciona para /login após cadastro (?registered=1) com aviso de verificar e-mail | 2026-06-17 | c5dbcaf | (gsd-fast) |
| (fast) | Botão de logout no canto da tela /workspaces (signOut → /login) | 2026-06-17 | 0f8a21c | (gsd-fast) |
| (fast) | Fix: Switch account / Log out navegam sempre (redirect no finally) | 2026-06-17 | 1188dd1 | (gsd-fast) |
| (fast) | Login volta ao convite (invitationId) pós-login + nome da conta no canto de /workspaces | 2026-06-17 | 6410657 | (gsd-fast) |
| (fast) | Nome da conta logada movido para o canto superior esquerdo de /workspaces | 2026-06-17 | 999d68f | (gsd-fast) |
| (fast) | suppressHydrationWarning no html/body (fix login GET-nativo por extensão ColorZilla) | 2026-06-17 | 83d06a9 | (gsd-fast) |
| (fast) | Nome da conta + Log out no rodapé da sidebar do workspace shell | 2026-06-17 | 4419d49 | (gsd-fast) |
| (fast) | Esconder nav Templates/Brand Settings para viewer (via can()) | 2026-06-17 | 281e39f | (gsd-fast) |
| (fast) | Bloquear viewer (redirect) das rotas /templates e /brand via requireWorkspaceRole | 2026-06-17 | 1484303 | (gsd-fast) |
| (fast) | Fix: serverActions.bodySizeLimit=50mb no next.config (upload de project-template ZIP estourava limite default de 1MB → HTTP 413) | 2026-06-24 | 090efe4 | (gsd-fast) |
| 260625-i1c | Dashboard do workspace: título "Dashboard" + item no menu lateral (active exato) + cards de métricas reais (Templates/LPs/Members via Prisma) + atalhos role-gated | 2026-06-25 | 7d496f5 | [260625-i1c](./quick/260625-i1c-transformar-a-pagina-inicial-do-workspac/) |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| quick_task | 260603-ju4-fix-phase-2-workspace-creation-rls-bug-a | done (commit 9cd3826) — SUMMARY.md ausente na pasta | 2026-06-24 (v2.0 close) |
| quick_task | 260608-d6s-homepage-basic-front | done (commit 7723f8c) — SUMMARY.md ausente | 2026-06-24 (v2.0 close) |
| quick_task | 260608-dbk-style-auth-pages | done (commit c651e39) — SUMMARY.md ausente | 2026-06-24 (v2.0 close) |
| quick_task | 260608-ly0-style-members-page | done (commit 7dae599) — SUMMARY.md ausente | 2026-06-24 (v2.0 close) |
| quick_task | 260617-jzg-estilizar-fluxo-de-convite-phase-02-invi | done (commit d5b4247) — SUMMARY.md ausente | 2026-06-24 (v2.0 close) |

> Nota: os 5 quick tasks acima foram **concluídos e commitados** (ver "Quick Tasks Completed"); o scanner `audit-open` os marca como "missing" apenas porque as pastas em `.planning/quick/` não têm `SUMMARY.md`. Lacuna de artefato, não trabalho pendente.

## Session Continuity

Last session: 2026-06-24T00:00:00.000Z
Stopped at: Roadmap v2.1 created (Fases 9–12) — 15/15 requisitos mapeados
Resume file: None

## Operator Next Steps

- Plan Phase 9: `/gsd-plan-phase 9`
