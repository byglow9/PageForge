---
status: complete
phase: 03-template-authoring-brand-config
source: [03-VERIFICATION.md]
started: "2026-06-05T22:10:00Z"
updated: "2026-06-08T13:10:00Z"
---

## Current Test

[testing complete]

## Tests

### 1. Criar template end-to-end
expected: Em `/w/[slug]/templates/new`, escrever `<h1>{{ hero:text }}</h1> {{ desc:rich_text }}` — o SchemaPanel exibe 2 campos com badges coloridos após ~400ms; ao salvar, toast "Template saved — schema v1"; o template aparece na lista como card e persiste ao recarregar.
result: pass

### 2. Editar template e increment de schemaVersion
expected: Abrir o template criado, adicionar `{{ img:image }}` e salvar — o SchemaPanel atualiza em tempo real (debounce 400ms); toast "Template saved — schema v2" (schemaVersion incrementado de v1 → v2).
result: pass

### 3. Excluir template via dialog de confirmação
expected: Pelo kebab menu do TemplateCard, "Delete template" abre dialog mostrando o nome do template e botão destructive "Delete template"; ao confirmar, o card some otimisticamente e aparece toast "Template deleted."
result: pass

### 4. Brand Settings — swatch de cor ao vivo
expected: Em `/w/[slug]/brand`, digitar `#ff6600` no campo Primary Color — o swatch de 24×24px muda para laranja em tempo real; ao salvar, toast "Brand settings saved."; o bloco de tokens `brand.*` mostra os valores resolvidos.
result: pass

### 5. Brand Settings — RBAC para role viewer
expected: Autenticado como conta com role `viewer`, no formulário de brand todos os campos estão `disabled` e o botão "Save Brand Settings" não é renderizado (condicional via `canEdit=false`).
result: pass

### 6. Validação onBlur de logoUrl (open redirect)
expected: Inserir `http://insecure.com` no campo logoUrl e perder o foco — mensagem de erro inline aparece e o formulário não é submetido (apenas https:// é aceito).
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none — all tests passed]
