---
status: complete
phase: 09-modelo-de-overrides-runtime-de-aplica-o
source: [09-01-SUMMARY.md, 09-02-SUMMARY.md]
started: 2026-06-25T00:00:00Z
updated: 2026-06-25T16:55:00Z
acceptance: "Usuário aceitou verificação por código (2026-06-25). E2e dispensado por ausência de LP VITE_SPA/dist real no ambiente; 38 testes do pipeline passam."
---

## Current Test

[testing complete — verificação por código aceita pelo usuário; e2e dispensado]

## Tests

### 1. Override de texto reflete na preview
expected: Semeando um override `type: 'text'` via updateLpAction e abrindo a preview da LP VITE_SPA, o elemento alvo exibe o novo valor (aplicado via textContent) no lugar do texto original do template.
result: blocked
blocked_by: other
reason: "Sem LP VITE_SPA no banco (0 templates/LPs/workspaces) e sem dist/ Vite real para um e2e fiel. Lógica verificada por código: apply-shim.test.ts cobre text override via textContent percorrendo o path do DOM em DOMContentLoaded (sem innerHTML). 33/33 testes do pipeline passam."

### 2. Override de cor por LP tem precedência sobre a marca do workspace
expected: Definindo `primaryColorOverride` (ex. `#06356f`) numa LP via updateLpAction e abrindo a preview, a cor primária (`--primary`) reflete a cor da LP — tendo precedência sobre a cor de marca do workspace. Sem override de cor na LP, a cor do workspace continua aplicada.
result: blocked
blocked_by: other
reason: "Sem LP VITE_SPA no banco para abrir preview ao vivo. Lógica verificada por código: theme.test.ts confirma buildBrandStyleTagForLp (lpColor ?? workspaceColor) — 5/5; apply-shim.test.ts confirma --primary via setProperty + hex→HSL fiel (#06356f → 213 90% 23%)."

### 3. Export == preview (mesmos overrides no ZIP exportado)
expected: Exportar a LP (ZIP via export route) e abrir o `index.html` resultante mostra exatamente os mesmos overrides de texto e cor que a preview — o shim injetado e o JSON de overrides estão presentes no HTML estático.
result: blocked
blocked_by: other
reason: "Sem LP VITE_SPA para exportar. Lógica verificada por código: apply-shim.test.ts confirma injectOverrides insere shim + JSON antes de </head> (mesma estratégia em serve e export, conforme 09-02-SUMMARY)."

### 4. LP sem overrides não regride
expected: Uma LP VITE_SPA sem nenhum override (values sentinela `{}` / sem `overrides`) renderiza idêntica ao template original na preview e no export — sem injeção quebrada, sem erro de shim, conteúdo original intacto.
result: blocked
blocked_by: other
reason: "Sem LP VITE_SPA para abrir. Lógica verificada por código: apply-shim.test.ts cobre a guarda B2 — null/undefined/sentinela {}/array vazio → injeção no-op."

## Code Verification (2026-06-25)

Executado `pnpm vitest run` no pipeline da Fase 9:
- apply-shim.test.ts + schema.test.ts: **33/33 passaram**
- theme.test.ts `buildBrandStyleTagForLp`: **5/5 passaram**

4 falhas na suíte total são PRÉ-EXISTENTES e fora de escopo (GenerateViteSpaLpSchema valida templateId como uuid mas o teste usa cuid — "Deferred Issue" no 09-01-SUMMARY), sem relação com overrides.

## Summary

total: 4
passed: 0
issues: 0
pending: 0
skipped: 0
blocked: 4

## Gaps

[none — nenhum defeito encontrado; itens bloqueados aguardam dados de seed (LP VITE_SPA real) para verificação end-to-end]
