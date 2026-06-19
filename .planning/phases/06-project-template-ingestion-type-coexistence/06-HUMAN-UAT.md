---
status: partial
phase: 06-project-template-ingestion-type-coexistence
source: [06-VERIFICATION.md]
started: "2026-06-19T11:40:00Z"
updated: "2026-06-19T11:40:00Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. LIQUID templates e LPs existentes carregam sem erros após a migração de kind
expected: O catálogo de LPs e a lista de templates exibem corretamente os registros LIQUID existentes, sem badges 'Vite SPA', sem erros de runtime
result: [pending]

### 2. Formulário de upload em /w/[slug]/project-templates/new funciona end-to-end
expected: Upload de ZIP válido cria template VITE_SPA, aparece no catálogo com badge 'Vite SPA'; upload de ZIP sem index.html rejeita com mensagem clara; upload de ZIP > 50 MB rejeita
result: [pending]

### 3. Seção Security Warnings exibida após upload de ZIP com credenciais embutidas
expected: O formulário permanece montado, exibe a seção amber com os achados listados, e o botão "I've reviewed these — continue to templates" navega para a lista de templates
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
