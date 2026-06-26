---
phase: 10-editor-visual-in-iframe-texto
verified: 2026-06-26T13:30:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "SC1 — viewer não vê o botão 'Editar'"
    expected: "Login como viewer → /w/{slug}/lps/{lpId}/preview → nenhum botão 'Editar' na toolbar"
    why_human: "Comportamento de renderização condicional React com papel de sessão real; requer autenticação e browser"
  - test: "SC1 — owner/admin/editor vê e consegue ativar o modo edição"
    expected: "Login como editor → botão 'Editar' visível; desabilitado até iframe carregar, habilitado após IFRAME_READY; clicar ativa modo edição e banner aparece"
    why_human: "Handshake IFRAME_READY e mudança de estado isEditMode requerem browser com iframe real"
  - test: "SC2 — clicar em texto em modo edição destaca o elemento"
    expected: "Em modo edição, clicar em elemento de texto na LP → outline 2px solid #2563eb aparece no elemento; banner troca para 'Editando texto — Enter para confirmar, Esc para cancelar'"
    why_human: "Comportamento de renderização in-iframe no DOM da SPA cross-origin; não verificável sem browser real"
  - test: "SC3 — salvar persiste o override e preview reflete o novo texto"
    expected: "Editar texto, clicar 'Salvar alterações' → action retorna ok:true → iframe recarrega sem edit=1 → apply-shim injeta o override → novo texto visível"
    why_human: "Requer banco de dados com LP e overrides reais, S3 com bundle Vite, e verificação visual do iframe recarregado"
  - test: "SC4 — descartar não persiste nenhum valor"
    expected: "Editar texto, clicar 'Descartar' → dialog confirma → texto original restaurado no iframe; verificar no DB que nenhum override foi gravado"
    why_human: "Requer verificação de banco de dados + comportamento visual do iframe para confirmar que o discard foi aplicado corretamente"
---

# Phase 10: Editor Visual In-Iframe (Texto) — Verification Report

**Phase Goal:** Habilitar a edição visual inline de textos dentro da preview da LP VITE_SPA (que roda em iframe cross-origin), com controle de acesso por papel, feedback visual de seleção, persistência via Server Action e descarte de edição não salva.
**Verified:** 2026-06-26T13:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Um usuário com papel owner/admin/editor vê o botão "Editar"; viewer não vê e não pode ativar o modo edição | ✓ VERIFIED | `can("viewer","lp","update")` → false (guards.ts linha 236: viewer.lp = ["read","preview","export"]); `can("editor"/"admin"/"owner","lp","update")` → true; ViteSpaPreviewEditor renderiza controles de edição somente dentro de `{canEdit && (...)}` (linha 314); `canEdit` calculado server-side via `can(ctx.role,"lp","update")` em page.tsx linha 75 |
| 2 | No modo edição ativo, clicar em texto destaca o elemento com outline azul e prepara para edição | ✓ VERIFIED (código) | edit-script.ts: handler de click aplica `outline: '2px solid #2563eb'`, `backgroundColor: 'rgba(37,99,235,0.08)'`, ativa `contenteditable="true"`, envia `ELEMENT_SELECTED` ao parent; `isTextLeaf` filtra somente elementos folha de texto; requires browser para confirmação visual |
| 3 | Após editar e salvar, o override persiste via Server Action e a preview reflete o novo texto | ✓ VERIFIED (código) | Fluxo completo: `handleSave` → `REQUEST_SAVE` → iframe envia `PENDING_EDITS` → `handleSaveWithEdits` chama `updateLpAction(slug, {id:lpId, overrides})` dentro de `startTransition` → `router.refresh()` → serve route relê LP com serving_read policy (migration 0010) → apply-shim injeta overrides na preview; requires browser para confirmação end-to-end |
| 4 | Descartar antes de salvar não persiste nenhum valor — conteúdo original restaurado | ✓ VERIFIED (código) | `handleDiscard` abre dialog quando `pendingEdits.length > 0`; `confirmDiscard` envia `REQUEST_DISCARD`; no iframe: `originalMap` restaurado via `node.textContent = originalMap[p]`, `pendingMap` zerado, `updateLpAction` NÃO é chamado; `EDIT_DISCARDED` → parent: `setIsEditMode(false)`, `setPendingEdits([])`, `setSelectedPath(null)` |

**Score:** 4/4 truths verified at code level

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/prisma/migrations/0010_lp_serving_read_policy/migration.sql` | Política SELECT RLS serving_read para landing_page | ✓ VERIFIED | Existe; contém `CREATE POLICY "serving_read" ON "landing_page" FOR SELECT USING (current_setting('app.serving', true) = 'on')`; SELECT-only, sem WITH CHECK; mirror exato do padrão da migration 0009 |
| `apps/web/src/lib/overrides/edit-script.ts` | Exporta `buildEditScript` e `injectEditScript` | ✓ VERIFIED | Existe (310 linhas); ambas as funções exportadas; IIFE contém pathToNode idêntico ao apply-shim.ts, computePath usando `childNodes`, fnv1a com `0x811c9dc5`, protocolo postMessage completo |
| `apps/web/src/lib/overrides/edit-script.test.ts` | Testes Vitest para ambas as funções | ✓ VERIFIED | Existe; 32 testes; `pnpm vitest run` → 32/32 passed |
| `apps/web/src/app/serve/[tplId]/[[...path]]/route.ts` | Serve route com injeção ?edit=1 + findUnique | ✓ VERIFIED | Contém `let editMode = false`, `let lpIdParam`, extração após verificação HMAC; `landingPage.findUnique` com `workspaceId` de token claims quando lpIdParam presente; import dinâmico de edit-script quando `editMode && lpIdParam` |
| `apps/web/src/app/w/[slug]/lps/[lpId]/preview/ViteSpaPreviewEditor.tsx` | Client Component com toolbar, banner, postMessage bridge, iframe, dialog | ✓ VERIFIED | Existe (451 linhas); "use client"; export nomeado `ViteSpaPreviewEditor`; todos os 7 props; todos os 6 estados; bridge postMessage com `event.origin === serveOrigin`; 5 estados de toolbar conforme UI-SPEC |
| `apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx` | RSC com canEdit + render ViteSpaPreviewEditor | ✓ VERIFIED | Importa `can` e `ViteSpaPreviewEditor`; `const canEdit = can(ctx.role, "lp", "update")` linha 75; renderiza ViteSpaPreviewEditor com 7 props; branch LIQUID inalterado |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| page.tsx (RSC) | ViteSpaPreviewEditor | `canEdit={can(ctx.role,"lp","update")}`, lpId, slug, serveOrigin, entryPath, token | ✓ WIRED | Verificado no JSX de page.tsx linha 83-92; todos os 7 props presentes |
| ViteSpaPreviewEditor.handleSave | updateLpAction | `startTransition(async () => await updateLpAction(slug, { id: lpId, overrides }))` | ✓ WIRED | Verificado em ViteSpaPreviewEditor.tsx linhas 150-171 (`handleSaveWithEdits`); chamado via stable ref do handler PENDING_EDITS |
| ViteSpaPreviewEditor (message handler) | iframe edit script IIFE | `window.addEventListener('message')` valida `event.origin === serveOrigin` | ✓ WIRED | Linha 190: `if (event.origin !== serveOrigin) return;` antes de qualquer dispatch |
| isEditMode flag | iframeSrc | `isEditMode ? serveOrigin+entryPath+'?t='+token+'&edit=1&lpId='+lpId : ...` | ✓ WIRED | Linha 129-131; mudança de src dispara reload do iframe → handshake IFRAME_READY |
| serve route | edit-script.ts buildEditScript | `await import('@/lib/overrides/edit-script')` quando `editMode && lpIdParam` | ✓ WIRED | Linhas 309-317 do route.ts; import dinâmico; usa `DASHBOARD_ORIGIN` env var |
| migration 0010 | landing_page table | `CREATE POLICY "serving_read" ON "landing_page"` | ✓ WIRED | Arquivo de migration existe e aplica a política; serve route já usa `servingRead()` que seta `app.serving='on'` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| ViteSpaPreviewEditor | `pendingEdits` (dirty count) | `ELEMENT_CHANGED` postMessage do iframe → `setPendingEdits` | Dados reais do DOM da LP | ✓ FLOWING |
| ViteSpaPreviewEditor | `overrides` (para save) | `PENDING_EDITS` postMessage → `handleSaveWithEdits(msg.overrides)` | Override completo com path, originalHash, type, value do iframe | ✓ FLOWING |
| serve route (edit mode) | `editableHtml` | `finalHtml` (com overrides) → `injectEditScript` quando `editMode && lpIdParam` | HTML real da S3 com overrides e script de edição injetados | ✓ FLOWING |
| preview/page.tsx | `canEdit` | `can(ctx.role, "lp", "update")` — `ctx.role` de `requireWorkspace(slug)` (session) | Papel real do usuário da sessão autenticada | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| edit-script unit tests (32 testes) | `pnpm vitest run src/lib/overrides/edit-script.test.ts` | 32/32 passed | ✓ PASS |
| serve-vite-spa tests existentes inalterados | `pnpm vitest run tests/serve-vite-spa.test.ts` | 20/20 passed | ✓ PASS |
| TypeScript sem erros | `npx tsc --noEmit` | 0 errors (sem output) | ✓ PASS |
| Migration existe com política correta | `grep 'serving_read' migration.sql` | `CREATE POLICY "serving_read" ON "landing_page" FOR SELECT` | ✓ PASS |
| Serve route tem editMode e findUnique | `grep -c 'editMode\|findUnique' route.ts` | editMode: 5 ocorrências; findUnique: 5 ocorrências | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — nenhum probe-*.sh definido para esta fase. Fase não é uma fase de migração de tooling com probes declarados em PLAN.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| EDIT-01 | 10-03-PLAN.md | Usuário owner/admin/editor pode entrar em modo edição na preview VITE_SPA | ✓ SATISFIED | `canEdit = can(ctx.role,"lp","update")` em page.tsx; ViteSpaPreviewEditor renderiza controles somente quando canEdit; dual-gate com requireWorkspaceRole em updateLpAction |
| EDIT-02 | 10-02-PLAN.md, 10-03-PLAN.md | Usuário pode clicar em elemento para selecioná-lo com destaque visual | ✓ SATISFIED (requer human) | edit-script.ts click handler aplica outline, bg, contenteditable; envia ELEMENT_SELECTED; ViteSpaPreviewEditor trata ELEMENT_SELECTED setando selectedPath |
| EDIT-03 | 10-02-PLAN.md, 10-03-PLAN.md | Usuário pode editar texto inline e salvar | ✓ SATISFIED (requer human) | Fluxo completo: blur → ELEMENT_CHANGED → REQUEST_SAVE → PENDING_EDITS → updateLpAction → DB write → router.refresh() → preview atualiza |
| EDIT-07 | 10-03-PLAN.md | Usuário pode descartar edição não salva antes de persistir | ✓ SATISFIED (requer human) | handleDiscard → dialog → REQUEST_DISCARD → restore originalMap → EDIT_DISCARDED → estado limpo sem updateLpAction |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| ViteSpaPreviewEditor.tsx | 211 | `originalHash: ""` com comentário "placeholder" | ℹ️ Info | Design intencional documentado no plano e SUMMARY: hash vazio usado apenas para dirty-count badge; hashes corretos chegam via PENDING_EDITS no save; nenhum override é persistido com hash vazio |

Nenhum marcador TBD, FIXME, ou XXX encontrado em nenhum dos arquivos modificados.

### Human Verification Required

#### 1. SC1 — Viewer não vê controles de edição

**Test:** Autenticar como viewer em um workspace → abrir `/w/{slug}/lps/{lpId}/preview` de uma LP VITE_SPA
**Expected:** Toolbar exibe somente o nome da LP, badge "Vite SPA" e back link — sem botão "Editar" visível
**Why human:** Requer sessão autenticada com papel viewer real e renderização de browser

#### 2. SC1 — Editor/admin/owner vê e ativa modo edição

**Test:** Autenticar como editor → mesma página → verificar botão "Editar"; clicar "Editar" → verificar que banner aparece abaixo da toolbar
**Expected:** Botão "Editar" presente; desabilitado brevemente durante reload do iframe; habilitado após IFRAME_READY; após clicar, banner azul "Modo de edição ativo — clique em um texto para editar" aparece
**Why human:** Handshake IFRAME_READY é cross-origin postMessage em tempo real; requer iframe real com bundle Vite carregado

#### 3. SC2 — Click-to-select com destaque visual

**Test:** Em modo edição, mover o mouse sobre elementos de texto da LP e clicar em um deles
**Expected:** Hover: outline dashed azul (#3b82f6) aparece sobre elemento de texto. Click: outline muda para solid (#2563eb) + background rgba(37,99,235,0.08); cursor muda para text; toolbar/banner trocam
**Why human:** Comportamento visual in-iframe no DOM da SPA cross-origin — não verificável sem browser

#### 4. SC3 — Persistência do override e preview refletindo novo texto

**Test:** Em modo edição, clicar em texto, editar conteúdo, clicar "Salvar alterações"
**Expected:** Botão mostra "Salvando…" → spinner → success → modo edição encerra → iframe recarrega com URL sem ?edit=1 → novo texto visível na preview (serve route injeta override via apply-shim)
**Why human:** Requer banco com LP real, S3 com bundle Vite, e verificação visual do iframe após reload

#### 5. SC4 — Discard não persiste

**Test:** Em modo edição, editar texto, clicar "Descartar"
**Expected:** Dialog abre com contagem de alterações → "Descartar" confirma → texto original restaurado no iframe; verificar no DB que `LandingPage.values.overrides` NÃO contém a edição descartada
**Why human:** Requer verificação de banco de dados + comportamento visual + confirmação que REQUEST_DISCARD restaurou o DOM corretamente

---

## Gaps Summary

Nenhum gap bloqueador identificado. Todos os artefatos existem, são substantivos e estão devidamente conectados. Os testes unitários passam (32/32 + 20/20), TypeScript compila sem erros, e todos os commits documentados estão presentes no histórico git.

A única categoria de verificação pendente é comportamento visual e interativo em browser real — inerente à natureza do feature (iframe cross-origin com postMessage) e não verificável de forma programática.

---

_Verified: 2026-06-26T13:30:00Z_
_Verifier: Claude (gsd-verifier)_
