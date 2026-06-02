---
phase: 01-core-engine-parser-merge
verified: 2026-06-02T18:36:34Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification: false
---

# Fase 01: Core Engine (Parser + Merge) — Relatório de Verificação

**Goal da Fase:** Provar que o componente de maior risco — `parse(markup) → Schema` e `render(markup, values, brand) → HTML estático` — funciona correta e seguramente contra o template real da Grécia, sem UI.
**Verificado:** 2026-06-02T18:36:34Z
**Status:** PASSED
**Re-verificação:** Não — verificação inicial.

---

## Resultado da Suite de Testes

```
pnpm vitest run
  Test Files  6 passed (6)
       Tests  118 passed (118)
    Duration  517ms
```

Todos os 118 testes passam. Nenhuma falha, nenhum skip.

---

## Verdades Observáveis (Critérios de Sucesso do ROADMAP)

| # | Critério | Status | Evidência |
|---|----------|--------|-----------|
| 1 | Parser emite schema tipado detectando os seis tipos de campo, blocos repeater e tokens globais | VERIFICADO | `parser.test.ts` — 10 testes confirmam detecção de text/richtext/image/color/button/repeater, repeaters por nome (destaques, info_cards, inclusos, roteiro, diferenciais, depoimentos), tokens `brand.*` com `global:true`, warnings para tipos desconhecidos e ausentes (D-04) |
| 2 | Engine de merge produz HTML estático completo e layout-fiel, iterando repeaters para 0/1/N itens (golden-file) | VERIFICADO | `renderer.test.ts` — golden-file `tests/__snapshots__/grecia.output.html` (20 KB) gerado e estável; 3 testes de repeater confirmam 0 cards com `roteiro:[]`, exatamente 1 card com `roteiro[0]`, e `N` cards com todos os `N` itens do fixture; `<p>` literais no golden-file (19 ocorrências), zero `&lt;p&gt;` escapados |
| 3 | Payloads SSTI rendem inerte (literal/vazio), sem eval/compile sobre markup do usuário — comprovado pelo corpus | VERIFICADO | `security.test.ts` — 60 testes parametrizados (10 payloads × 6 contextos) passam; `hardening.test.ts` — CR-02 comprovado: `{{ campo \| raw }}` injetado por autor de template neutralizado via mecanismo de stash/placeholder no `compiler.ts`; `ownPropertyOnly:true` bloqueia prototype chain; `outputEscape:'escape'` escapa `{{}}` em valores text; nenhum `eval`/`new Function`/`vm` no engine |
| 4 | Todo tipo de campo fuzzado com XSS produz HTML inerte via escaping context-aware; rich-text sanitizado com allowlist estrita | VERIFICADO | `security.test.ts` — 6 contextos cobertos: text (outputEscape), richtext (sanitize-html allowlist D-11), image (sanitizeUrl + outputEscape), color (sanitizeCssColor regex anchored), button (sanitizeUrl), repeater-text (pipeline aplica recursivamente via `processRepeaterItems`); `hardening.test.ts` — CR-01 comprovado: valores `brand.*` sanitizados por tipo antes de entrar no scope |

**Score: 4/4 critérios verificados**

---

## Artefatos Obrigatórios

| Artefato | Descrição | Status | Detalhes |
|----------|-----------|--------|---------|
| `src/engine/schema.ts` | Schema Zod — 6 tipos, TokenField, ParsedSchema, ParseWarning | VERIFICADO | Exporta `FieldTypeSchema` (z.enum 6 valores), `TokenFieldSchema`, `ParsedSchemaSchema`, `ParseWarningSchema` e os 4 tipos inferidos; `repeater: z.string().nullable()` presente |
| `src/engine/parser.ts` | `parse(markup) → ParsedSchema` com detecção dos 6 tipos, repeaters, globals, warnings | VERIFICADO | Implementação real — 159 linhas; algoritmo 4 fases (REPEAT_OPEN/CLOSE → TOKEN_PATTERN → resolveType → isBrandToken); validação Zod antes de retornar; WR-04 corrigido: detecta repeaters aninhados e emite warning |
| `src/engine/compiler.ts` | `compileToLiquid(markup, schema) → Liquid` com for-loops, item-scope, `\| raw` para richtext | VERIFICADO | Implementação real — 77 linhas; mecanismo stash/placeholder neutraliza Liquid injetado (CR-02); emite `{{ campo \| raw }}` para richtext; reescreve tokens de repeater como `{{ item.campo }}`; converte `<!-- repeat:X -->` para `{% for item in X %}` |
| `src/engine/renderer.ts` | `render(markup, values, brand) → Promise<string>` com guardrails LiquidJS e sanitização | VERIFICADO | `outputEscape:'escape'` + `ownPropertyOnly:true` configurados; `processRepeaterItems` sanitiza por tipo; CR-01 corrigido: `safeBrand` sanitizado por tipo de campo antes de entrar no scope; `image` fields passam por `sanitizeUrl` (Rule 2) |
| `src/engine/sanitizers.ts` | `sanitizeRichText`, `sanitizeUrl`, `sanitizeCssColor` — implementações reais | VERIFICADO | `sanitizeRichText`: usa `sanitize-html` com `RICHTEXT_SANITIZE_OPTIONS` D-11 (allowedTags estrita, `allowProtocolRelative:false`, `parseStyleAttributes:false`); `sanitizeUrl`: bloqueia `//host` (WR-01), `javascript:`, `data:`, qualquer scheme não permitido; `sanitizeCssColor`: regex anchored + `NAMED_COLORS` allowlist explícita (WR-03 corrigido — removeu `[a-z]+` catch-all) |
| `src/engine/index.ts` | Barrel export público — `parse`, `render` e 4 tipos | VERIFICADO | 3 linhas; re-exporta de `./parser.js`, `./renderer.js`, `./schema.js`; não contém lógica |
| `tests/fixtures/grecia-template.html` | Template tokenizado derivado da landing Grécia real | VERIFICADO | 6 repeaters presentes: `destaques`, `info_cards`, `inclusos`, `roteiro`, `diferenciais`, `depoimentos`; `<!-- repeat:roteiro -->` e `<!-- /repeat:roteiro -->` encontrados; usa `class="card-roteiro"` para contagem nos testes |
| `tests/fixtures/grecia-values.ts` | `greciaValues` e `greciaBrand` com dados reais | VERIFICADO | Importado por `renderer.test.ts`; `roteiro` array com múltiplos itens (contador dinâmico: `greciaValues.roteiro.length` usado nos testes) |
| `tests/__snapshots__/grecia.output.html` | Golden-file (20 KB) | VERIFICADO | Existe; 19 ocorrências de `<p>` literal; 0 ocorrências de `&lt;p&gt;` — confirma que o filtro `\| raw` do compiler está correto |
| `tests/engine/parser.test.ts` | Asserções de schema: 6 tipos, repeaters, globals, warnings (TPL-02) | VERIFICADO | 10 testes, todos passam |
| `tests/engine/renderer.test.ts` | Golden-file + repeaters 0/1/N (GEN-05, TPL-04) | VERIFICADO | 6 testes, todos passam |
| `tests/engine/security.test.ts` | 60 testes parametrizados D-16 (10 × 6 contextos) | VERIFICADO | 66 testes total (60 corpus + 6 unitários focados), todos passam |
| `tests/engine/sanitizers.test.ts` | 22 testes unitários dos 3 sanitizadores | VERIFICADO | Todos passam; confirma transição de stub para implementação real |
| `tests/engine/hardening.test.ts` | 10 testes de regressão dos achados do code review (CR-01, CR-02, WR-01/03/04) | VERIFICADO | Todos passam; criado no commit `c91c36c` |
| `tests/engine/e2e.test.ts` | 4 testes e2e do pipeline completo | VERIFICADO | Todos passam (stubs do Plano 01 substituídos) |

---

## Verificação de Vínculos Chave (Key Links)

| De | Para | Via | Status | Detalhes |
|----|------|-----|--------|---------|
| `renderer.ts` | `compiler.ts` | `compileToLiquid(markup, schema)` | WIRED | Import e chamada confirmados nas linhas 3 e 84 do renderer |
| `renderer.ts` | `parser.ts` | `parse(markup)` | WIRED | Import e chamada confirmados nas linhas 2 e 83 do renderer |
| `renderer.ts` | LiquidJS engine | `engine.parseAndRender(compiledLiquid, scope)` | WIRED | Instância `new Liquid({...})` exportada e chamada na linha 142 |
| `renderer.ts` | `sanitizers.ts` | `sanitizeRichText`, `sanitizeUrl`, `sanitizeCssColor` | WIRED | Import linha 4; chamadas em `processRepeaterItems`, loop principal e loop `safeBrand` |
| `compiler.ts` | schema `fields[].repeater` | reescrita `item.campo` | WIRED | `fieldToRepeater` Map construído de `schema.fields`; usado no `.replace()` principal |
| `tests/engine/security.test.ts` | `src/engine/index.ts` | `import { render } from '../../src/engine/index.js'` | WIRED | Linha 22 do security.test.ts |
| `tests/engine/hardening.test.ts` | `src/engine/index.ts` + `sanitizers.ts` | imports diretos | WIRED | Linhas 2-3 do hardening.test.ts |

---

## Rastreio de Fluxo de Dados (Level 4)

| Artefato | Variável de Dados | Fonte | Produz Dados Reais | Status |
|----------|-------------------|-------|--------------------|--------|
| `renderer.ts` — campo text | `values[field.name]` | Parâmetro `values` do chamador → passado ao scope | Sim — passado diretamente (LiquidJS escapa) | FLOWING |
| `renderer.ts` — campo richtext | `sanitizeRichText(String(raw))` | Parâmetro `values` → `sanitizeRichText` → scope | Sim — implementação real com `sanitize-html` | FLOWING |
| `renderer.ts` — campo button/image | `sanitizeUrl(String(raw))` | Parâmetro `values` → `sanitizeUrl` → scope | Sim — allowlist de scheme + URLs relativas | FLOWING |
| `renderer.ts` — campo color | `sanitizeCssColor(String(raw))` | Parâmetro `values` → `sanitizeCssColor` → scope | Sim — regex anchored + `NAMED_COLORS` Set | FLOWING |
| `renderer.ts` — repeater items | `processRepeaterItems(values[repeaterName], ...)` | Array no `values` → processado por tipo → scope | Sim — sanitiza cada item por tipo de campo | FLOWING |
| `renderer.ts` — brand fields | `safeBrand` via loop `schema.fields` filtrado por `global` | Parâmetro `brand` → sanitizado por tipo → scope | Sim — CR-01 corrigido em commit `c91c36c` | FLOWING |

---

## Verificação dos Achados do Code Review (01-REVIEW.md, status: resolved)

Todos os achados críticos e warnings foram corrigidos no commit `c91c36c`. Verificação nos arquivos atuais:

| Finding | Correção Esperada | Status | Localização no Código |
|---------|-------------------|--------|----------------------|
| **CR-01** — `brand` passava sem sanitização ao scope | `safeBrand` loop sanitiza por tipo antes de `scope = {..., brand: safeBrand}` | CONFIRMADO | `renderer.ts` linhas 120-140 |
| **CR-02** — `\| raw` nativo LiquidJS podia ser injetado por autor de template | Mecanismo stash/placeholder: tokens válidos → sentinelas → Liquid residual neutralizado como entidades HTML `&#123;&#123;` | CONFIRMADO | `compiler.ts` linhas 36-74 (const `placeholders`, `stash()`, 4 passos de substituição) |
| **WR-01** — `sanitizeUrl` permitia `//evil.com` (protocol-relative) | `if (trimmed.startsWith('//')) return '#'` antes do check de scheme | CONFIRMADO | `sanitizers.ts` linha 65 |
| **WR-02** — `RELATIVE_URL` era código morto | Constante removida junto com a correção WR-01 | CONFIRMADO | Não existe mais em `sanitizers.ts` |
| **WR-03** — `[a-z]+` aceitava qualquer string alphabética como cor CSS | Substituído por `NAMED_COLORS` Set com 40+ cores nomeadas CSS válidas | CONFIRMADO | `sanitizers.ts` linhas 96-103 |
| **WR-04** — repeaters aninhados produziam output incorreto silencioso | Loop em `repeaterRanges` detecta nesting e emite warning via `warnings.push(...)` | CONFIRMADO | `parser.ts` linhas 96-108 |
| **WR-05** — `brand.*` dentro de repeater renderiza como string vazia sem aviso | Aceito como limitação conhecida da v1 (in-scope behavior documentado em REVIEW.md) | ACEITO (WR-05 is a WARNING, not BLOCKER) | — |
| **IN-01** — corpus não cobria payloads em `brand` | `hardening.test.ts` (CR-01 describe) cobre brand image, richtext e color com payloads | CONFIRMADO | `hardening.test.ts` linhas 10-39 |

---

## Cobertura de Requisitos

| Requisito | Plano | Descrição | Status | Evidência |
|-----------|-------|-----------|--------|-----------|
| **TPL-02** | 01-01, 01-02 | Sistema parseia tokens em schema tipado ao salvar o template | SATISFEITO | `parser.test.ts` 10 testes passando; schema Zod validado; 6 tipos detectados |
| **TPL-04** | 01-02 | Usuário pode definir blocos repetíveis (repeaters) | SATISFEITO (engine) | `renderer.test.ts` — repeaters 0/1/N iterados corretamente; `parser.test.ts` — 6 repeaters detectados no fixture Grécia. Nota: `REQUIREMENTS.md` marcou o checkbox como `[ ]` e status "Pending", mas o engine que suporta repeaters está completo. A UI de authoring de repeaters é Fase 3 (TPL-01/03) — o engine prova a semântica de dados. |
| **GEN-05** | 01-02 | Sistema gera HTML estático via merge dos valores no template | SATISFEITO | `renderer.test.ts` golden-file 20 KB; render retorna HTML não-vazio com seções id="inicio", id="roteiro", id="depoimentos" |
| **GEN-06** | 01-03 | Rich-text e valores de tokens sanitizados — HTML sem scripts injetados (XSS) | SATISFEITO | `security.test.ts` 66 testes; `sanitizers.test.ts` 22 testes; `hardening.test.ts` 10 testes; 118 total |

**Nota sobre TPL-04:** O `REQUIREMENTS.md` apresenta inconsistência entre o checkbox da lista (`[ ]` — desmarcado) e a coluna de status na tabela de rastreabilidade (`Pending`). O engine de repeaters está completamente implementado e provado por testes. O status "Pending" reflete que a experiência de authoring de UI (definir repeaters via formulário — que pertence à Fase 3) não está feita. Isso não é um gap desta fase — é a separação correta entre engine (Fase 1) e UI de authoring (Fase 3).

---

## Anti-Padrões Encontrados

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---------|-------|--------|------------|---------|
| Nenhum | — | — | — | — |

Varredura de artefatos modificados nesta fase (src/engine/*.ts, tests/engine/*.ts):
- Nenhum `TBD`, `FIXME` ou `XXX` encontrado
- Nenhum `return html` / `return raw` incondicional (stubs removidos)
- Nenhum `eval`, `new Function`, `require('vm')` encontrado
- Nenhum `ownPropertyOnly: false` encontrado

---

## Verificações Comportamentais (Spot-Checks)

| Comportamento | Comando | Resultado | Status |
|---------------|---------|-----------|--------|
| Suite completa passa | `pnpm vitest run` | 118/118 testes, 6 arquivos | PASS |
| Repeater 0 itens sem crash | `renderer.test.ts` "0 itens" | `cardCount === 0`, sem throw | PASS |
| Repeater N itens exato | `renderer.test.ts` "N itens" | `cardCount === greciaValues.roteiro.length` | PASS |
| `<script>` em richtext removido | `security.test.ts` richtext P7 | HTML não contém `<script` | PASS |
| `javascript:` em button → `#` | `hardening.test.ts` CR-01 | `href="#"` no output | PASS |
| `{{ campo \| raw }}` injetado pelo autor → inerte | `hardening.test.ts` CR-02 | HTML não contém `<script` | PASS |
| Protocol-relative URL bloqueada | `hardening.test.ts` WR-01 | `sanitizeUrl('//evil.com') === '#'` | PASS |
| Nested repeater gera warning | `hardening.test.ts` WR-04 | `schema.warnings` contém "aninhado" | PASS |

---

## Verificação de Probes

Nenhum probe declarado ou convencional (`scripts/*/tests/probe-*.sh`) para esta fase. A fase é verificada por test suite (Step 7b acima).

---

## Itens que Requerem Verificação Humana

Nenhum. Todos os critérios são verificáveis programaticamente pela suite de testes.

---

## Resumo de Gaps

Nenhum gap. Todos os 4 critérios de sucesso do ROADMAP são verificados pela codebase:

1. O parser detecta os 6 tipos de campo, todos os repeaters e tokens globais — provado por `parser.test.ts`.
2. O engine de merge produz HTML layout-fiel com golden-file e iteração 0/1/N de repeaters — provado por `renderer.test.ts`.
3. Payloads SSTI/Liquid injetados por autores de template rendem inerte — provado pelo mecanismo stash/placeholder de `compiler.ts` e por `hardening.test.ts` (CR-02).
4. Todo tipo de campo fuzzado com XSS produz HTML inerte via escaping context-aware — provado por 60 testes em `security.test.ts` e 22 em `sanitizers.test.ts`; rich-text usa allowlist D-11 via `sanitize-html`.

Os dois achados Críticos (CR-01, CR-02) e quatro Warnings (WR-01 a WR-04) identificados no code review `01-REVIEW.md` estão corrigidos e cobertos por testes de regressão em `hardening.test.ts` (commit `c91c36c`).

---

_Verificado: 2026-06-02T18:36:34Z_
_Verificador: Claude (gsd-verifier)_
