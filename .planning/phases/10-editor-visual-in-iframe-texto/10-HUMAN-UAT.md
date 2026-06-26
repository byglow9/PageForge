---
status: complete
phase: 10-editor-visual-in-iframe-texto
source: [10-VERIFICATION.md]
started: 2026-06-26T12:00:00Z
updated: 2026-06-26T14:30:00Z
seed: apps/web/scripts/seed-vite-spa-uat.ts
workspace_slug: uat-vite-spa
landing_page_id: 8f2e4a0e-1f83-4383-8fb8-6e4702d88122
---

## Current Test

[testing complete]

## Tests

### 1. SC1 — Viewer não vê controle de edição
expected: Autenticado como papel `viewer`, abrir a preview de uma LP VITE_SPA — o botão "Editar" NÃO aparece e o modo edição não pode ser ativado.
result: pass
note: Verificado na LP "testando github" (Vite SPA) no workspace "test" — toolbar do preview mostra só voltar/título/badge, sem controle de edição.

### 2. SC1 — Editor vê e ativa o modo edição
expected: Autenticado como `editor` (ou admin/owner), o botão "Editar" aparece habilitado após `IFRAME_READY`; ao clicar, o banner de modo edição aparece e o iframe ganha o outline azul (3px solid #2563eb).
result: pass
note: Como owner — botão "Editar" desabilitado ("aguarde para editar") até IFRAME_READY, depois destrava; ao clicar, banner "Editando texto" + outline azul no iframe.

### 3. SC2 — Seleção visual de elemento de texto
expected: No modo edição ativo, passar o mouse sobre um elemento de texto da LP mostra outline tracejado (hover); clicar nele aplica outline sólido + fundo azul (selecionado), pronto para edição.
result: pass
note: Elemento "A JORNADA" selecionado com contorno tracejado azul + fundo azul claro, contentEditable ativo.

### 4. SC3 — Editar + salvar persiste e reflete na preview
expected: Editar o texto de um elemento selecionado e salvar grava o override via `updateLpAction`; após `router.refresh()` / re-mount do SPA, o iframe recarregado exibe o novo texto (apply-shim aplicou o override).
result: partial
resolution: |
  Parte da Fase 10 (capturar edição + persistir via Server Action) RESOLVIDA. Bugs A e B
  corrigidos e commitados (4c25e56). DB confirma override válido e único salvo:
  {path:/1/2/2/1/0/0/2, type:text, value:"a Jornada jorge", originalHash:3b77a5c4}.
  A parte "preview reflete após re-mount" NÃO é defeito da Fase 10 — o editor salva dado
  correto; a não-reaplicação é o apply-shim (fase 9) rodando em DOMContentLoaded, antes do
  React montar. Fix = MutationObserver = escopo da FASE 12. Por decisão do usuário, NÃO
  puxar a fase 12 agora. SC3 visual fica gated na fase 12; nada mais a fazer na fase 10.
severity: n/a (Phase 10 portion fixed; visual re-application is Phase 12)
diagnosis: |
  DOIS bugs no código da fase 10 (confirmados por observação: clicar em Salvar não gera
  NENHUM POST no Network → updateLpAction nunca roda).

  BUG A (blocker — save não dispara): ViteSpaPreviewEditor.tsx tem
  `onLoad={() => setIframeReady(false)}` no <iframe>. Numa Vite SPA pesada (29 req, 1.7MB),
  o evento `load` do iframe dispara DEPOIS do DOMContentLoaded. Sequência: DOMContentLoaded
  → edit-script envia IFRAME_READY → parent setIframeReady(true) → EDIT_MODE_ENTER passa
  (por isso a SELEÇÃO funciona) → `load` dispara → onLoad zera iframeReady para false → e
  não chega novo IFRAME_READY. Resultado: sendToIframe (gated em iframeReady) descarta o
  REQUEST_SAVE silenciosamente → iframe nunca devolve PENDING_EDITS → updateLpAction nunca
  é chamado → nenhum POST.
  Fix: remover o reset em onLoad. iframeReady já é resetado em handleEnterEdit e
  handleSaveWithEdits (nas trocas de src). O reset por evento `load` é redundante e nocivo.

  BUG B (contador inflado / overrides fantasma): edit-script.ts handler de `blur` SEMPRE
  grava pendingMap[path] e emite ELEMENT_CHANGED, mesmo quando newText === original (clicar
  e sair de um elemento sem editar conta como alteração). O parent conta todo ELEMENT_CHANGED
  sem filtrar. Carrossel/troca de seleção rouba foco → blur → alteração fantasma.
  Fix: no blur, só gravar/emitir quando newText !== originalMap[path]; quando reverteu ao
  original, remover de pendingMap e avisar o parent para decrementar (novo ELEMENT_REVERTED).

  PÓS-FIX (re-teste em LP Vite SPA real, workspace "test"):
  - BUG A confirmado RESOLVIDO: server logs mostram `POST .../preview → updateLpAction(...,
    overrides)` — o save agora dispara e persiste no banco.
  - BUG C (NOVO, blocker de SC3): override salvo NÃO reaparece na tela após reload. Causa:
    apply-shim.ts (fase 9) aplica overrides dentro de `DOMContentLoaded`. Numa Vite SPA o
    React monta o conteúdo DEPOIS do DOMContentLoaded → no momento do shim o #root está
    vazio → pathToNode retorna null → override ignorado. Funciona em HTML estático (seed/
    testes unit) mas não em SPA client-rendered real. Fix correto = MutationObserver que
    reaplica os overrides quando os nós aparecem / em re-renders — que é exatamente o escopo
    da FASE 12 ("overrides sobrevivem a re-renders via MutationObserver"). Decisão de escopo:
    puxar a fase 12 para agora vs registrar SC3 como gap conhecido da fase 12.
  - BUG D (menor, UX): tela do iframe pisca branca ao entrar/sair do modo edição (reload
    completo do iframe). Otimização, não bloqueia funcionalidade.

### 5. SC4 — Descartar não persiste nada
expected: Editar um texto e descartar via dialog de confirmação restaura o conteúdo original e NÃO grava nenhum override (parcial) no banco.
result: pass
note: Descartar restaura o texto original na hora e não dispara updateLpAction (nenhum POST).

## Summary

total: 5
passed: 4
issues: 0
partial: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "SC3 — preview reflete o novo texto após re-mount do SPA"
  status: deferred
  reason: "Não é defeito da Fase 10. O editor persiste override válido via Server Action (verificado no DB). A re-aplicação visual numa SPA client-rendered exige MutationObserver (apply-shim roda em DOMContentLoaded, antes do React montar) — escopo explícito da Fase 12. Diferido por decisão do usuário."
  phase: 12
  severity: n/a
