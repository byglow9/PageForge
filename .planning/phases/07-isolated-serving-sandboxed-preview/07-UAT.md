---
status: complete
phase: 07-isolated-serving-sandboxed-preview
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md]
started: 2026-06-23T13:55:24Z
updated: 2026-06-23T14:55:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Preview carrega o SPA na origem isolada
expected: Na página /w/{slug}/project-templates/{id}/preview, o iframe carrega {id}.serve.localhost e o index.html do SPA renderiza (200). A LP aparece dentro do iframe.
result: pass
note: Validado visualmente — card "🚀 PageForge SPA Fixture" renderizou dentro do iframe após correções (ver Bugs corrigidos).

### 2. Iframe está sandboxed corretamente
expected: Inspecionando o elemento iframe no preview, o atributo é sandbox="allow-scripts" apenas — SEM allow-same-origin. (Critério de segurança PRJ-05/SC3.)
result: pass
note: Prova empírica — dentro do iframe, ler document.cookie lança SecurityError (origem opaca), confirmando ausência de allow-same-origin.

### 3. Isolamento de cookies (crítico)
expected: No DevTools, dentro do contexto do iframe (origem opaca), document.cookie retorna string vazia "". A sessão do PageForge NÃO vaza para o SPA servido.
result: pass
note: Isolamento ainda mais forte que o esperado — o SPA nem consegue LER document.cookie (SecurityError).

### 4. Token cross-tenant é rejeitado
expected: Usar um token válido mas escopado para OUTRO template/workspace ao acessar a origem isolada retorna 403 (claims.templateId !== tplId).
result: pass
note: curl com token de VITE_TPL no host de outro template → 403 Forbidden. Token adulterado também → 403.

### 5. Fallback de sub-rota SPA
expected: Navegar para uma sub-rota dentro do SPA (caminho sem extensão) resolve via index.html — não retorna 404 espúrio. Assets com extensão continuam servidos diretamente.
result: pass
note: curl GET /grecia/roteiro → 200 + serviu o index.html (SPA Fixture). Assets (.js/.css) servidos direto com 200.

### 6. Fronteira de tipo (LIQUID rejeitado)
expected: Um template LIQUID não pode ser servido por esta rota isolada — retorna 403 "Type boundary violation". Apenas VITE_SPA é aceito.
result: pass
note: curl em asset de template LIQUID → 403 "Forbidden — Type boundary violation".

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Bugs corrigidos durante a verificação

A fase 7 estava **completamente não-funcional** no ambiente real (o checkpoint human-verify SC1–SC5 nunca havia sido executado). Cinco bugs reais foram encontrados e corrigidos durante esta UAT para os testes passarem:

1. **Coluna `entry_route` em snake_case (P2022)** — migração 0007 criou `entry_route`, mas o campo Prisma `entryRoute` não tem `@map`; quebrava TODA geração de LP. Fix: renomeada para `entryRoute` + migration `0008_fix_entry_route_column_name`.

2. **`SERVE_TOKEN_SECRET` ausente do `.env`** — só estava no `.env.example`; `mintServeToken` recebia `undefined` → preview page lançava `ERR_INVALID_ARG_TYPE`. Fix: variável adicionada ao `.env`.

3. **RLS forçado bloqueava o serving (404 em tudo)** — o route handler usa o prisma global sem contexto RLS, mas `template`/`brand_config` têm FORCE RLS (fase 02); o lookup cross-workspace que o serving exige retornava null → 404. Fix: policy `serving_read` gated em `app.serving='on'` (migration `0009_serving_read_policy`) + handler roda lookups em transação com o flag setado (`servingRead`).

4. **Link "Back to templates" → 404** — preview page apontava para `/w/{slug}/project-templates` (sem página índice). Fix: corrigido para `/w/{slug}/templates`.

5. **Navegação inexistente para VITE_SPA (polish adiado)** — não havia como chegar ao upload nem ao preview pela UI. Fix: botão "New Project Template (ZIP)" na lista de Templates, botão "Preview" no card VITE_SPA, e "Back to templates" na página de upload.

## Gaps

[none — todos os testes passam após as correções acima]
