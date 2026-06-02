---
phase: 01-core-engine-parser-merge
plan: "01"
subsystem: engine-scaffold
tags: [scaffold, typescript, zod, vitest, liquidjs, tdd-red]
dependency_graph:
  requires: []
  provides:
    - package.json com liquidjs@^10.27.0, zod@^4.4.3, sanitize-html@^2.17.4, vitest@^4.1.8
    - src/engine/schema.ts — Zod schemas e TypeScript types (FieldTypeSchema, ParsedSchemaSchema, TokenFieldSchema, ParseWarningSchema)
    - src/engine/index.ts — barrel export da API pública do engine (parse, render)
    - tests/engine/e2e.test.ts — suite RED que guia os Planos 02/03
  affects: []
tech_stack:
  added:
    - liquidjs@10.27.0
    - zod@4.4.3
    - sanitize-html@2.17.4
    - vitest@4.1.8
    - typescript@5.9.3
    - tsx@4.22.4
  patterns:
    - ESM (type:module) com NodeNext module resolution
    - Vitest com environment:node (sem jsdom — engine é Node puro)
    - tsc --noEmit como check de tipagem sem emissão de artefatos
key_files:
  created:
    - package.json
    - tsconfig.json
    - vitest.config.ts
    - pnpm-workspace.yaml (allowBuilds:esbuild para pnpm 11)
    - .gitignore
    - src/engine/schema.ts
    - src/engine/parser.ts
    - src/engine/renderer.ts
    - src/engine/index.ts
    - tests/engine/e2e.test.ts
  modified: []
decisions:
  - "D-03 implementado: FieldTypeSchema define os 6 tipos (text, richtext, image, color, button, repeater)"
  - "D-05 implementado: schema mínimo por token — name, type, repeater (nullable), global (boolean)"
  - "D-10 confirmado: liquidjs@^10.27.0 pinado como motor de renderização"
  - "ESM + NodeNext: type:module + moduleResolution:NodeNext para compatibilidade com imports .js"
  - "pnpm 11 migration: allowBuilds:esbuild movido para pnpm-workspace.yaml (pnpm.onlyBuiltDependencies não mais suportado em package.json)"
metrics:
  duration_seconds: 223
  completed_date: "2026-06-02"
  tasks_completed: 3
  files_created: 10
  deviations: 2
---

# Phase 1 Plan 1: Scaffold Engine + Schema Zod + Teste e2e RED — Summary

**One-liner:** Scaffold do projeto PageForge engine com liquidjs@10.27.0 + zod@4.4.3 + sanitize-html@2.17.4, schema Zod completo dos 6 tipos de campo, stubs de parse/render, e suite e2e RED de 4 testes que guiarão os Planos 02/03.

## What Was Built

Estabeleceu a base executável do engine PageForge — greenfield repo que agora tem:

1. **Infraestrutura do projeto** (`package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`): dependências pinadas, TypeScript em modo strict com ESM + NodeNext, ambiente de teste Node puro (sem jsdom), e node_modules com liquidjs, zod, sanitize-html e vitest instalados.

2. **Contrato de tipos Zod** (`src/engine/schema.ts`): define o vocabulário compartilhado entre parser, compiler, renderer e testes — `FieldTypeSchema` (6 tipos), `TokenFieldSchema` (name/type/repeater/global), `ParsedSchemaSchema`, `ParseWarningSchema` e os 4 tipos TypeScript inferidos.

3. **Stubs do engine** (`parser.ts`, `renderer.ts`, `index.ts`): superfície pública do engine que os Planos 02/03 implementarão. `parse()` e `render()` lançam `Error('not implemented')` — correto para o estado RED.

4. **Suite e2e RED** (`tests/engine/e2e.test.ts`): 4 testes que exercitam o pipeline completo `parse→render` e falham exatamente com `"parse: not implemented"` / `"render: not implemented"`. Testes confirmam que, quando implementados, o Plano 02 deve: (a) detectar tipo `text`, (b) detectar repeaters, (c) produzir HTML com valores, (d) escapar XSS em campos text.

## Commits

| Tarefa | Tipo | Hash | Descrição |
|--------|------|------|-----------|
| 1 | chore | c3c0e71 | Scaffold — package.json, tsconfig, vitest.config, .gitignore |
| 2 | feat | f8f59ed | Schema Zod + stubs do engine (parser, renderer, index) |
| 3 | test | b317434 | e2e RED — 4 testes que exercitam parse→render |
| Fix | fix | a1763eb | Remove rootDir do tsconfig — conflitava com include:tests |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] rootDir conflitava com include:["src","tests"] no tsconfig**
- **Found during:** Verificação pós-Tarefa 3 (`pnpm run build`)
- **Issue:** `tsconfig.json` tinha `rootDir: "./src"` mas `include` especificava `["src", "tests"]`. O TypeScript emitia TS6059 porque `tests/engine/e2e.test.ts` fica fora do `rootDir` declarado.
- **Fix:** Removido o campo `rootDir` do `tsconfig.json`. Como o projeto usa apenas `tsc --noEmit` (sem emissão de arquivos para `./dist` nesta fase), remover `rootDir` resolve o conflito sem impacto prático.
- **Files modified:** `tsconfig.json`
- **Commit:** a1763eb

**2. [Rule 2 - Missing Critical Functionality] Ausência de .gitignore — node_modules seria commitado**
- **Found during:** Tarefa 1, antes do primeiro commit
- **Issue:** Nenhum `.gitignore` existia no repositório greenfield. Sem ele, `node_modules/` (68+ pacotes) seria rastreado pelo git.
- **Fix:** Criado `.gitignore` com `node_modules/`, `dist/`, `.env`, `*.local`.
- **Files modified:** `.gitignore` (criado)
- **Commit:** c3c0e71

### Informational Notes (não são desvios — descobertas do ambiente)

**pnpm 11 migration — `allowBuilds` movido para `pnpm-workspace.yaml`**
- pnpm 11.x não lê mais `pnpm.onlyBuiltDependencies` de `package.json`; a chave `allowBuilds` deve ficar em `pnpm-workspace.yaml`. A instalação do pnpm criou automaticamente o arquivo template com `esbuild` listado; a correção foi definir `esbuild: true` nesse arquivo.

## Verification Results

| Check | Status | Notes |
|-------|--------|-------|
| `pnpm install` sem erros | PASS | liquidjs@10.27.0, zod@4.4.3, sanitize-html@2.17.4, vitest@4.1.8 em node_modules |
| `tsc --noEmit` sem erros | PASS | strict:true, NodeNext, sem erros de tipagem |
| `vitest run` — 4 testes falham RED | PASS | Todos 4 falham com "not implemented" (estado correto) |
| `src/engine/` tem 4 arquivos | PASS | schema.ts, parser.ts, renderer.ts, index.ts |
| `liquidjs` no package.json | PASS | "liquidjs": "^10.27.0" |
| `environment: 'node'` no vitest.config.ts | PASS | Sem jsdom |

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `parse()` — throws 'not implemented' | `src/engine/parser.ts` | Intencional — Plano 02 implementa o parser completo |
| `render()` — throws 'not implemented' | `src/engine/renderer.ts` | Intencional — Plano 02/03 implementa o renderer LiquidJS |

Os stubs são intencionais e esperados para este plano. Os testes RED confirmam que os stubs serão chamados e que as implementações nos Planos 02/03 farão esses testes passarem.

## Threat Model Coverage

Mitigações do threat register deste plano verificadas:

| Threat ID | Status |
|-----------|--------|
| T-01-01 (liquidjs versão pinada) | MITIGATED — liquidjs@^10.27.0 no package.json |
| T-01-02 (tsconfig strict:false acidental) | MITIGATED — strict:true presente no tsconfig.json |
| T-01-03 (FieldTypeSchema info disclosure) | ACCEPTED — lista de tipos é documentação pública |
| T-01-04 (Stubs em produção) | ACCEPTED — stubs existem apenas nesta wave; Wave 2 os substitui |

## Self-Check: PASSED

- `package.json` exists: FOUND
- `tsconfig.json` exists: FOUND
- `vitest.config.ts` exists: FOUND
- `src/engine/schema.ts` exists: FOUND
- `src/engine/parser.ts` exists: FOUND
- `src/engine/renderer.ts` exists: FOUND
- `src/engine/index.ts` exists: FOUND
- `tests/engine/e2e.test.ts` exists: FOUND
- Commit c3c0e71 exists: FOUND
- Commit f8f59ed exists: FOUND
- Commit b317434 exists: FOUND
- Commit a1763eb exists: FOUND
