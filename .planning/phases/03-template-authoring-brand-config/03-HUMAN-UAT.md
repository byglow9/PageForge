---
status: partial
phase: 03-template-authoring-brand-config
source: [03-VERIFICATION.md]
started: "2026-06-05T22:10:00Z"
updated: "2026-06-05T22:10:00Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Criar template end-to-end
expected: Em `/w/[slug]/templates/new`, escrever `<h1>{{ hero:text }}</h1> {{ desc:rich_text }}` — o SchemaPanel exibe 2 campos com badges coloridos após ~400ms; ao salvar, toast "Template saved — schema v1"; o template aparece na lista como card e persiste ao recarregar.
result: [pending]

### 2. Editar template e increment de schemaVersion
expected: Abrir o template criado, adicionar `{{ img:image }}` e salvar — o SchemaPanel atualiza em tempo real (debounce 400ms); toast "Template saved — schema v2" (schemaVersion incrementado de v1 → v2).
result: [pending]

### 3. Excluir template via dialog de confirmação
expected: Pelo kebab menu do TemplateCard, "Delete template" abre dialog mostrando o nome do template e botão destructive "Delete template"; ao confirmar, o card some otimisticamente e aparece toast "Template deleted."
result: [pending]

### 4. Brand Settings — swatch de cor ao vivo
expected: Em `/w/[slug]/brand`, digitar `#ff6600` no campo Primary Color — o swatch de 24×24px muda para laranja em tempo real; ao salvar, toast "Brand settings saved."; o bloco de tokens `brand.*` mostra os valores resolvidos.
result: [pending]

### 5. Brand Settings — RBAC para role viewer
expected: Autenticado como conta com role `viewer`, no formulário de brand todos os campos estão `disabled` e o botão "Save Brand Settings" não é renderizado (condicional via `canEdit=false`).
result: [pending]

### 6. Validação onBlur de logoUrl (open redirect)
expected: Inserir `http://insecure.com` no campo logoUrl e perder o foco — mensagem de erro inline aparece e o formulário não é submetido (apenas https:// é aceito).
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
