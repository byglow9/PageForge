---
phase: quick-260625-ihz
plan: "01"
subsystem: dashboard
tags: [dashboard, workspace, server-component, prisma, rbac]
dependency_graph:
  requires: [requireWorkspace, prisma, can, Card]
  provides: [WorkspacePage redesigned with 4 actionable sections]
  affects: [/w/[slug]]
tech_stack:
  added: []
  patterns: [parallel Promise.all queries, Server Component pure, anchor-download, relativeTime pt-BR]
key_files:
  created: []
  modified:
    - apps/web/src/app/w/[slug]/page.tsx
decisions:
  - "D-ihz-01: Prisma queries diretas no page, sem actions, para include eficiente do folder"
  - "D-ihz-02: Export via <a href download> puro, mantendo page como Server Component 100%"
metrics:
  duration: "~8 min"
  completed: "2026-06-25T16:30:17Z"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase quick-260625-ihz Plan 01: Dashboard Redesign Summary

**One-liner:** Dashboard do workspace substituida por 4 secoes uteis: metricas clivaveis, LPs recentes com acoes inline, templates de acesso rapido e alertas de setup condicionais por role.

## What Was Built

`apps/web/src/app/w/[slug]/page.tsx` foi completamente reescrito, mantendo a assinatura `async function WorkspacePage` e o componente como puro Server Component.

### Key changes

**1. 8 queries paralelas via Promise.all:**
- `templateCount`, `lpCount`, `memberCount`, `lpWithoutFolderCount` — contagens simples
- `recentLps` — 5 LPs mais recentes com `select` eficiente incluindo `folder.name`
- `recentTemplates` — 6 templates mais recentes
- `brandConfig` — configuracao de marca (nullable)
- `pendingInviteCount` — convites pendentes do modelo `WorkspaceInvitation`

**2. Helper `relativeTime(date: Date)`** — retorna strings em pt-BR: "agora", "ha N min", "ha N h", "ha N dias".

**3. Flags de permissao:** `canCreateLp`, `canCreateTemplate`, `canEditBrand`, `showBrandAlert`, `showInviteAlert`.

**4. Layout com 4 secoes:**
- Alertas condicionais (brand nao configurada + convites pendentes) — gate por role
- Metricas clivaveis em grid 2x2 / 4 colunas com Cards hovaraveis
- LPs recentes com acoes Editar/Preview/Exportar inline
- Templates de acesso rapido (so para canCreateLp) com link "Gerar LP"

**5. Export via `<a href download>`** — sem client JS, conforme D-ihz-02.

**6. Bloco "Quick access" completamente removido.**

## Verification

- `pnpm typecheck` passa sem erros
- Arquivo final tem 297 linhas (acrescimo de 222 linhas liquidas)
- Contem: `recentLps`, `recentTemplates`, `brandConfig`, `pendingInviteCount`
- Link de export aponta para `/api/lps/{id}/export` com atributo `download`
- Link "Gerar LP" aponta para `/w/${slug}/lps/new/${t.id}`

## Commits

| Hash | Message |
|------|---------|
| a16c7dd | feat(quick-260625-ihz-01): redesign workspace dashboard with 4 actionable sections |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All data is fetched live from Prisma with workspaceId scope.

## Threat Flags

None. No new network endpoints introduced. All queries scoped to `ctx.workspaceId` from session (T-ihz-03). Alert visibility gated by `can()` checks (T-ihz-01). Export anchor relies on server-side auth in the export route (T-ihz-02).

## Self-Check: PASSED

- [x] `apps/web/src/app/w/[slug]/page.tsx` exists and is modified
- [x] Commit `a16c7dd` exists in git log
- [x] `pnpm typecheck` returned exit 0 with no output (no errors)
- [x] File contains `recentLps`, `recentTemplates`, `brandConfig`, `pendingInviteCount`
- [x] "Quick access" heading removed
- [x] `<h1>` "Dashboard" present
