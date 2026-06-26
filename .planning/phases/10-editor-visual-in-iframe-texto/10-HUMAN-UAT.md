---
status: partial
phase: 10-editor-visual-in-iframe-texto
source: [10-VERIFICATION.md]
started: 2026-06-26T12:00:00Z
updated: 2026-06-26T12:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. SC1 — Viewer não vê controle de edição
expected: Autenticado como papel `viewer`, abrir a preview de uma LP VITE_SPA — o botão "Editar" NÃO aparece e o modo edição não pode ser ativado.
result: [pending]

### 2. SC1 — Editor vê e ativa o modo edição
expected: Autenticado como `editor` (ou admin/owner), o botão "Editar" aparece habilitado após `IFRAME_READY`; ao clicar, o banner de modo edição aparece e o iframe ganha o outline azul (3px solid #2563eb).
result: [pending]

### 3. SC2 — Seleção visual de elemento de texto
expected: No modo edição ativo, passar o mouse sobre um elemento de texto da LP mostra outline tracejado (hover); clicar nele aplica outline sólido + fundo azul (selecionado), pronto para edição.
result: [pending]

### 4. SC3 — Editar + salvar persiste e reflete na preview
expected: Editar o texto de um elemento selecionado e salvar grava o override via `updateLpAction`; após `router.refresh()` / re-mount do SPA, o iframe recarregado exibe o novo texto (apply-shim aplicou o override).
result: [pending]

### 5. SC4 — Descartar não persiste nada
expected: Editar um texto e descartar via dialog de confirmação restaura o conteúdo original e NÃO grava nenhum override (parcial) no banco.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
