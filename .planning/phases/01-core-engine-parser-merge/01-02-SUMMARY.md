---
phase: 01-core-engine-parser-merge
plan: "02"
subsystem: engine-core
tags: [parser, compiler, renderer, liquidjs, fixture, golden-file, tdd-green]
dependency_graph:
  requires:
    - "01-01: schema Zod (FieldTypeSchema, ParsedSchema) + stubs parse/render + e2e RED"
  provides:
    - src/engine/parser.ts — parse(markup) → ParsedSchema (6 tipos, repeaters, globals, warnings tolerantes)
    - src/engine/compiler.ts — compileToLiquid(markup, schema) → template Liquid ({% for %}, item-scope, | raw para richtext)
    - src/engine/renderer.ts — render(markup, values, brand) → HTML estático via LiquidJS com guardrails D-10
    - tests/fixtures/grecia-template.html — fixture tokenizada derivada da landing Grécia real
    - tests/fixtures/grecia-values.ts — valores de referência (greciaValues, greciaBrand)
    - tests/__snapshots__/grecia.output.html — golden-file (20KB, richtext com <p> literal)
  affects:
    - "01-03 endurecerá src/engine/sanitizers.ts (versão básica criada aqui) com allowlist completa + corpus de 60 payloads"
tech_stack:
  added: []
  patterns:
    - "Gramática engine-agnostic compilada para Liquid (strip :type, <!-- repeat --> → {% for %}, escopo implícito → item.campo)"
    - "Tolerant parser / strict renderer: parse degrada com warnings, render sanitiza por contexto"
    - "Golden-file via toMatchFileSnapshot resolvido por process.cwd() (path repo-relativo)"
key_files:
  created:
    - src/engine/parser.ts
    - src/engine/compiler.ts
    - src/engine/sanitizers.ts
    - tests/fixtures/grecia-template.html
    - tests/fixtures/grecia-values.ts
    - tests/engine/parser.test.ts
    - tests/engine/renderer.test.ts
    - tests/__snapshots__/grecia.output.html
  modified:
    - src/engine/renderer.ts
decisions:
  - "D-01/D-02 implementado: parser reconhece anotação inline {{ nome:tipo }} (sufixo de dois-pontos), engine-agnostic"
  - "D-04 implementado: token sem tipo → text+warning; tipo desconhecido → text+warning; nunca crash"
  - "D-06/D-07 implementado: <!-- repeat:x --> compila para {% for item in x %} com escopo implícito de item"
  - "D-09 implementado: tokens brand.* resolvidos do brand no scope; demais são campos por-LP"
  - "D-10 implementado: LiquidJS outputEscape:'escape' + ownPropertyOnly:true; richtext via {{ campo | raw }}"
  - "Renderer popula repeaters por nome (schema.repeaters), não por field iteration — correção do scope vazio"
metrics:
  completed_date: "2026-06-02"
  tasks_completed: 2
  files_created: 8
  files_modified: 1
  deviations: 4
---

# Phase 1 Plan 2: Parser + Compiler + Renderer + Fixture Grécia — Summary

**One-liner:** Implementa o pipeline completo `parse → compileToLiquid → render` sobre LiquidJS com guardrails D-10, deriva a fixture tokenizada da landing Grécia real e prova o merge layout-fiel com golden-file e repeaters 0/1/N — 20/20 testes GREEN.

## What Was Built

1. **Parser** (`src/engine/parser.ts`): converte markup com a micro-gramática PageForge em `ParsedSchema` — detecta os 6 tipos via sufixo `:tipo` (D-01/D-02), repeaters delimitados por `<!-- repeat:x -->` (D-06), tokens `brand.*` como globais (D-09), e degrada com warnings para tokens sem tipo / tipo desconhecido (D-04).

2. **Compiler** (`src/engine/compiler.ts`): `compileToLiquid(markup, schema)` traduz a gramática engine-agnostic para Liquid — remove o sufixo `:tipo`, converte `<!-- repeat:x -->...<!-- /repeat:x -->` em `{% for item in x %}`, reescreve tokens internos para escopo implícito `{{ item.campo }}` (D-07) e emite `{{ campo | raw }}` para richtext (evita double-escape do HTML sanitizado).

3. **Renderer** (`src/engine/renderer.ts`): `render(markup, values, brand)` monta o scope (repeaters por nome + campos top-level sanitizados por tipo + brand) e chama `engine.parseAndRender`. LiquidJS configurado com `outputEscape:'escape'` + `ownPropertyOnly:true` (D-10).

4. **Fixture Grécia real** (`tests/fixtures/grecia-template.html` + `grecia-values.ts`): HTML tokenizado derivado dos componentes reais da landing Grécia (hero → roteiro → inclusos → depoimentos → CTA → footer), exercitando os 6 tipos e múltiplos repeaters. Golden-file `tests/__snapshots__/grecia.output.html` (20KB).

5. **Testes** (`parser.test.ts`, `renderer.test.ts`): asserções de schema (6 tipos, repeaters, globals, warnings) + golden-file + repeaters iterando para 0/1/N itens.

## Commits

| Tarefa | Tipo | Hash | Descrição |
|--------|------|------|-----------|
| 1 | test | e95d818 | parser + compiler RED |
| 1 | feat | 616263a | parse() + compileToLiquid() (TPL-02) |
| 2 | test | 8c54b11 | renderer + golden-file RED |
| 2 | feat | e954f2a | render() via LiquidJS — repeaters + golden-file GREEN (GEN-05, TPL-04) |

> Nota: o commit `55e74a7` (fix de blockers do plan-checker) foi feito durante o planejamento, antes da execução.

## Deviations from Plan

Este plano foi **retomado após interrupção por limite de sessão** — o executor original completou parser+compiler e deixou o renderer parcial/não-commitado. O orchestrator finalizou a wave inline. Desvios:

**1. [Bug] Renderer não populava repeaters no scope → 0 cards renderizados**
- O loop original iterava `schema.fields` esperando um campo `type:'repeater'`, que não existe; os arrays de repeater são chaveados por `schema.repeaters`. Resultado: `{% for item in roteiro %}` iterava vazio.
- **Fix:** `render()` agora popula cada `schema.repeaters[i]` por nome (via `processRepeaterItems`) e pula campos membros de repeater no loop top-level. Commit e954f2a.

**2. [Bug] Fixture usava prefixo `item.` explícito (viola D-07)**
- 21 tokens internos de repeater escritos como `{{ item.dia:text }}`; o compiler adicionava outro `item.` → `{{ item.item.dia }}`.
- **Fix:** removido o prefixo `item.` dos tokens internos (escopo implícito D-07). Commit e954f2a.

**3. [Bug] Golden-file gerado em path errado (`tests/engine/tests/__snapshots__/`)**
- `toMatchFileSnapshot('tests/__snapshots__/...')` resolve relativo ao diretório do arquivo de teste, não à raiz.
- **Fix:** path resolvido via `join(process.cwd(), 'tests/__snapshots__/grecia.output.html')`. Commit e954f2a.

**4. [Antecipação de escopo] `src/engine/sanitizers.ts` criado nesta wave (era do Plano 03)**
- O renderer importa `sanitizeRichText/Url/CssColor`; uma versão **básica** foi criada para o pipeline operar. O Plano 01-03 a substituirá pela versão endurecida (allowlist completa D-11, sanitizeUrl/CssColor robustos) e adicionará o corpus de 60 payloads.

**Correção de teste (não-desvio de implementação):** a asserção de XSS em campo text checava `not.toContain('alert(1)')`, o que é incorreto — o payload é escapado para `&lt;script&gt;alert(1)&lt;/script&gt;` (inerte), mas o texto `alert(1)` permanece como conteúdo escapado inofensivo. Corrigida para verificar ausência de `<script` executável + presença de `&lt;script&gt;`.

## Verification Results

| Check | Status | Notes |
|-------|--------|-------|
| `tsc --noEmit` | PASS | sem erros de tipagem |
| `vitest run` | PASS | 20/20 testes (e2e + parser + renderer) |
| Repeaters 0/1/N | PASS | card-roteiro count = 0, 1 e N conforme valores |
| Golden-file no path correto | PASS | tests/__snapshots__/grecia.output.html (20KB) |
| Richtext `| raw` (D-10/Blocker 2) | PASS | 19 `<p>` literais, 0 `&lt;p&gt;` escapados |
| Guardrails D-10 | PASS | outputEscape:'escape' + ownPropertyOnly:true no renderer |
| Fixture derivada do Grécia real | PASS | componentes reais da landing tokenizados |

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| sanitizers básicos | `src/engine/sanitizers.ts` | Versão mínima funcional; Plano 01-03 endurece com allowlist completa + corpus |

## Threat Model Coverage

| Threat ID | Status |
|-----------|--------|
| SSTI (markup como template) | MITIGATED — parser compila gramática própria; nenhum `eval`/`compile` sobre markup do usuário; ownPropertyOnly bloqueia prototype |
| XSS em campo text/atributo | MITIGATED — outputEscape:'escape' (context-aware) |
| XSS em richtext | PARCIAL — sanitização básica nesta wave; endurecida no 01-03 |

## Self-Check: PASSED

- `src/engine/parser.ts` exists: FOUND
- `src/engine/compiler.ts` exists: FOUND
- `src/engine/renderer.ts` exists: FOUND
- `src/engine/sanitizers.ts` exists: FOUND
- `tests/fixtures/grecia-template.html` exists: FOUND
- `tests/fixtures/grecia-values.ts` exists: FOUND
- `tests/__snapshots__/grecia.output.html` exists: FOUND
- Commit 616263a exists: FOUND
- Commit e954f2a exists: FOUND
- vitest run: 20/20 PASS
