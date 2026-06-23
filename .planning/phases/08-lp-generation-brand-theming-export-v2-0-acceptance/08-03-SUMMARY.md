---
phase: "08"
plan: "03"
subsystem: serve-preview
tags:
  - brand-theming
  - vite-spa
  - preview
  - iframe
  - serve-route
dependency_graph:
  requires:
    - "08-01: hexToHslTriplet/buildBrandStyleTag/injectBrandStyle helpers"
    - "Phase 07: serve route handler + mintServeToken + isolated origin"
  provides:
    - "Brand CSS var injection in serve handler (index.html path)"
    - "VITE_SPA branch in LP preview page (iframe sandboxed)"
  affects:
    - "Phase 08-04: export route (same brand injection pattern)"
tech_stack:
  added: []
  patterns:
    - "transformToString() for index.html (brand injection); transformToWebStream() for assets — mutually exclusive per request (T-08-03-05)"
    - "VITE_SPA branch before renderLp() — prevents type guard throw, renders iframe"
    - "mintServeToken scoped to templateId (not lpId) — matches serve handler claims check"
key_files:
  created: []
  modified:
    - apps/web/src/app/serve/[tplId]/[[...path]]/route.ts
    - apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx
decisions:
  - "D-04: tema live — BrandConfig lido a cada render no serve handler (não snapshotado)"
  - "D-06: injeção de <style> consistente via buildBrandStyleTag/injectBrandStyle importados de lib/brand/theme"
  - "Token scoped a templateId (não lpId) — alinhado com claims check no serve handler"
metrics:
  duration_minutes: 3
  completed_date: "2026-06-23"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
---

# Phase 08 Plan 03: Brand Theming + VITE_SPA Preview (iframe) Summary

**One-liner:** Injeção live de brand CSS vars (`--primary`) no `index.html` servido pela origem isolada + branch VITE_SPA na página de preview de LP com iframe sandboxed apontando para a rota de entrada.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Injeção de brand CSS vars no serve route handler | 8295ce2 | route.ts |
| 2 | Branch VITE_SPA na página de preview da LP (iframe sandboxed) | cae71a4 | preview/page.tsx |

## What Was Built

### Task 1: Brand injection no serve handler

No `apps/web/src/app/serve/[tplId]/[[...path]]/route.ts`:

- **Import adicionado:** `buildBrandStyleTag` e `injectBrandStyle` de `@/lib/brand/theme`.
- **Path index.html substituído:** `transformToWebStream()` trocado por `transformToString()` — lê o HTML do S3 como string. Em seguida, faz `prisma.brandConfig.findFirst({ where: { workspaceId } })` onde `workspaceId` vem exclusivamente das claims HMAC verificadas (trusted). Aplica `buildBrandStyleTag(brand?.primaryColor)` e `injectBrandStyle(html, styleTag)` antes de retornar com `buildSecurityHeaders(contentType)`.
- **Path de assets (non-HTML):** `transformToWebStream()` inalterado — branch mutualmente exclusivo por request (T-08-03-05).

Segurança:
- **T-08-03-02:** `workspaceId` para lookup de BrandConfig vem das claims HMAC verificadas — nunca do URL ou cookie (a origem isolada não tem sessão PageForge).
- **T-08-03-01:** `primaryColor` validado como `/^#[0-9a-fA-F]{6}$/` pela `SaveBrandConfigSchema` antes de atingir o módulo — o triplet HSL contém apenas dígitos, `%` e espaços.
- **T-08-03-05:** `transformToString()` e `transformToWebStream()` nunca são chamados no mesmo request (branches `if/else` separados).

### Task 2: VITE_SPA branch no preview de LP

No `apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx`:

- **Imports adicionados:** `mintServeToken` de `@/lib/serve/token` e `Badge` de `@/components/ui/badge`.
- **Branch VITE_SPA inserido** após `if (!lp) redirect(...)`, antes de `renderLp()`:
  - Minta token com `mintServeToken(ctx.workspaceId, lp.templateId!)` — scoped a `templateId`, não ao `lpId` (T-08-03-04).
  - Constrói `serveOrigin` espelhando o padrão de `project-templates/[id]/preview/page.tsx`.
  - `entryPath = lp.entryRoute ?? "/"` — rota persistida ou raiz.
  - Retorna JSX com `<Badge variant="outline">Vite SPA</Badge>`, rota exibida se presente, e `<iframe src="${serveOrigin}${entryPath}?t=${token}" sandbox="allow-scripts" ...>`.
- **Caminho LIQUID:** `renderLp()` inalterado — zero regressão.

Segurança:
- **T-08-03-03:** `sandbox="allow-scripts"` sem `allow-same-origin` mantém a origem do iframe opaca — `document.cookie` e `localStorage` inacessíveis ao JS do SPA.
- **T-08-03-04:** token scoped a `templateId` (não `lpId`) — o serve handler valida `claims.templateId !== tplId`, então usar `lpId` causaria 403.

## Verification Results

1. `pnpm tsc --noEmit` (apps/web) — sem erros (PASS)
2. Serve handler: `grep transformToString route.ts` — `const html = await s3Response.Body!.transformToString();` presente, assets branch inalterado (PASS)
3. Preview page: `grep "allow-scripts\|mintServeToken\|VITE_SPA"` — todos presentes, `allow-same-*` ausente (PASS)
4. Token scoping: `mintServeToken(ctx.workspaceId, lp.templateId!)` — `templateId`, não `lpId` (PASS)

## Deviations from Plan

Nenhuma — plano executado exatamente como escrito.

## Known Stubs

Nenhum — todos os outputs são funcionais.

## Threat Flags

Nenhuma nova superfície de ataque além do documentado no `<threat_model>` do plano:
- T-08-03-01: CSS injection via buildBrandStyleTag — aceito (primaryColor validado como hex)
- T-08-03-02: BrandConfig lookup via bare prisma — mitigado (workspaceId das claims HMAC)
- T-08-03-03: iframe sandbox breakout — mitigado (sandbox="allow-scripts" sem allow-same-*)
- T-08-03-04: entryPath no iframe URL — aceito (string do banco, serve handler faz fallback)
- T-08-03-05: transformToString() vs transformToWebStream() — mitigado (branches exclusivos)

## Self-Check: PASSED

- [x] `apps/web/src/app/serve/[tplId]/[[...path]]/route.ts` modificado com brand injection
- [x] `apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx` modificado com VITE_SPA branch
- [x] Commit 8295ce2 existe no git log
- [x] Commit cae71a4 existe no git log
- [x] TypeScript compila sem erros
- [x] Asset path (transformToWebStream) inalterado
- [x] Token scoped a templateId, não lpId
