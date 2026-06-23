---
phase: "08"
plan: "04"
subsystem: export-edit
tags:
  - vite-spa
  - export
  - zip
  - s3
  - brand-theming
  - edit-page
dependency_graph:
  requires:
    - "08-01: buildBrandStyleTag + injectBrandStyle helpers em lib/brand/theme"
    - "08-02: ViteSpaLpForm + getLpAction retornando kind + entryRoute"
    - "08-03: padrão S3 + archiver do serve handler (modelo para o export)"
  provides:
    - "Export VITE_SPA: ZIP do dist/ com index.html tematizado, sem CSP estrita"
    - "Edit page VITE_SPA: ViteSpaLpForm com name e entryRoute pré-preenchidos"
  affects:
    - "Ciclo de vida completo da LP VITE_SPA: generate → preview → edit → export"
tech_stack:
  added:
    - "S3Client singleton no export route handler (mesmo padrão do serve handler)"
    - "ListObjectsV2Command: paginação do dist/ prefix no S3"
    - "GetObjectCommand: busca por chave individual (index.html e assets)"
  patterns:
    - "ListObjectsV2 paginado com ContinuationToken — loop até NextContinuationToken ser undefined"
    - "transformToString() para index.html (brand injection); transformToWebStream() para assets — mutuamente exclusivos por request"
    - "Branch VITE_SPA inserido antes de parse(lp.markupSnapshot) — early return previne sentinel crash"
key_files:
  created: []
  modified:
    - apps/web/src/app/api/lps/[lpId]/export/route.ts
    - apps/web/src/app/w/[slug]/lps/[lpId]/edit/page.tsx
decisions:
  - "D-10: branch por kind na rota de export existente — ZIP da árvore dist/ inteira"
  - "D-11: cor da marca assada no index.html exportado via buildBrandStyleTag + injectBrandStyle"
  - "D-12: CSP estrita script-src none do LIQUID NÃO se aplica ao VITE_SPA — bundle SPA precisa de JS"
metrics:
  duration_minutes: 4
  completed_date: "2026-06-23"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
---

# Phase 08 Plan 04: Export VITE_SPA + Edit Page Branch Summary

**One-liner:** Branch VITE_SPA no export route (ListObjectsV2 paginado → ZIP archiver com index.html tematizado, sem CSP) e na edit page (ViteSpaLpForm pré-preenchido antes de parse()), completando o ciclo de vida da LP VITE_SPA.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Branch VITE_SPA na rota de export (ZIP dist/ tematizado, sem CSP) | 733ab9f | export/route.ts |
| 2 | Branch VITE_SPA na página de edição da LP | 984dabe | edit/page.tsx |

## What Was Built

### Task 1: Branch VITE_SPA na rota de export

Em `apps/web/src/app/api/lps/[lpId]/export/route.ts`:

- **S3Client singleton adicionado:** Mesmo padrão do serve handler — module-level, não importado de actions.ts ("use server").
- **Imports adicionados:** `GetObjectCommand`, `ListObjectsV2Command`, `S3Client` de `@aws-sdk/client-s3`; `buildBrandStyleTag`, `injectBrandStyle` de `@/lib/brand/theme`.
- **Guard 409 substituído pelo branch completo:**
  - Valida `lp.templateId` — retorna 400 se null.
  - Busca `BrandConfig` via `prisma.brandConfig.findFirst({ where: { workspaceId: lp.workspaceId } })`.
  - **ListObjectsV2 paginado:** loop `do/while` com `ContinuationToken` — coleta todas as chaves do prefix `workspaces/{wId}/project-templates/{tplId}/dist/`.
  - **Archiver loop:** Para `index.html` → `transformToString()` + `injectBrandStyle(html, buildBrandStyleTag(brand?.primaryColor))` + `append(Buffer)`. Para outros assets → `transformToWebStream() as any` + `Readable.fromWeb()` + `append(nodeStream)` (streaming constante).
  - `viteSpaArchive.finalize()` + `Readable.toWeb()` + `NextResponse` com headers `application/zip`.
  - `injectCsp()` **NÃO chamado** para VITE_SPA (D-12).
- **Caminho LIQUID:** Completamente inalterado abaixo do branch.

### Task 2: Branch VITE_SPA na página de edição da LP

Em `apps/web/src/app/w/[slug]/lps/[lpId]/edit/page.tsx`:

- **Import adicionado:** `ViteSpaLpForm` de `@/components/lps/ViteSpaLpForm`.
- **Branch inserido após `if (!lp) redirect(...)` e ANTES de `parse(lp.markupSnapshot)`** (T-08-04-05):
  - `if (lp.kind === "VITE_SPA")` → retorna JSX com `ViteSpaLpForm` em `mode="edit"` com `lpId`, `lpName` e `initialEntryRoute={lp.entryRoute ?? ""}`.
  - Early return garante que `parse(sentinel "")` nunca é executado para VITE_SPA.
- **Caminho LIQUID:** `parse(lp.markupSnapshot)`, `LpForm`, `metadataOverlay`, `brandConfig` — tudo inalterado.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tipo incompatível: `transformToWebStream()` → `Readable.fromWeb()`**
- **Encontrado durante:** Task 1, ao rodar `tsc --noEmit`
- **Erro:** `Argument of type 'ReadableStream<any>' is not assignable to parameter of type 'import("stream/web").ReadableStream<any>'` — o AWS SDK retorna um `ReadableStream` que é compatível em runtime mas tipado de forma diferente do tipo `ReadableStream<any>` do Node.js `stream/web`
- **Fix:** `s3Obj.Body!.transformToWebStream() as any` com comentário explicativo — o cast `as any` resolve o mismatch de tipos sem impacto funcional (a stream é compatível em runtime)
- **Arquivos:** `apps/web/src/app/api/lps/[lpId]/export/route.ts`
- **Commit:** 733ab9f

## Known Stubs

Nenhum — todos os outputs são funcionais. O export VITE_SPA retorna um ZIP real com o dist/ do S3. A edit page VITE_SPA exibe o formulário pré-preenchido com dados reais do banco.

## Threat Flags

Nenhuma nova superfície de ataque além do documentado no `<threat_model>` do plano:

| Threat | Status |
|--------|--------|
| T-08-04-01: S3 prefix inclui workspaceId (campo banco); IDOR check antes de acessar S3 | Implementado — IDOR check (membership) permanece no topo do handler, antes do branch VITE_SPA |
| T-08-04-02: primaryColor validado como hex antes de atingir buildBrandStyleTag | Aceito — validação acontece em SaveBrandConfigSchema antes de persistir |
| T-08-04-03: ListObjectsV2 em loop — dist/ com muitos assets | Aceito — loop termina quando NextContinuationToken é undefined; assets não-HTML streamados sem carregamento em memória |
| T-08-04-04: Export VITE_SPA sem CSP | Aceito — VITE_SPA precisa de JS próprio; ZIP é arquivo local do workspace owner |
| T-08-04-05: parse(sentinel) prevenido pelo branch antes de parse() | Implementado — linha 49 (VITE_SPA check) antes da linha 71 (parse call) |

## Self-Check: PASSED

- [x] `apps/web/src/app/api/lps/[lpId]/export/route.ts` modificado — branch VITE_SPA completo
- [x] `apps/web/src/app/w/[slug]/lps/[lpId]/edit/page.tsx` modificado — ViteSpaLpForm branch
- [x] Commit 733ab9f existe no git log
- [x] Commit 984dabe existe no git log
- [x] TypeScript compila sem erros (`tsc --noEmit` exit 0)
- [x] 409 placeholder removido — `grep "status: 409"` não encontra nada no export route
- [x] `ListObjectsV2Command` importado e usado no loop paginado
- [x] `injectCsp()` ausente do branch VITE_SPA (só chamada na linha 346, caminho LIQUID)
- [x] Branch VITE_SPA na edit page na linha 49, `parse()` na linha 71 — ordem correta
- [x] ViteSpaLpForm com `mode="edit"`, `lpId`, `lpName`, `initialEntryRoute` corretos
