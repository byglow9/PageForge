---
phase: 01-core-engine-parser-merge
plan: "03"
subsystem: engine-security
tags: [sanitizers, security, xss, ssti, corpus, tdd-green, liquidjs, sanitize-html]
dependency_graph:
  requires:
    - "01-02: renderer.ts + sanitizers.ts stubs + golden-file Grécia"
  provides:
    - src/engine/sanitizers.ts — sanitizeRichText real (sanitize-html D-11), sanitizeUrl + sanitizeCssColor hardened + relative URLs
    - src/engine/renderer.ts — image fields now sanitized via sanitizeUrl (Rule 2 fix)
    - tests/engine/sanitizers.test.ts — 22 unit tests for all three sanitizers
    - tests/engine/security.test.ts — 60-payload corpus (10 × 6 contexts, D-16)
  affects:
    - "Phase 2+: sanitizers exported as hardened — downstream consumers get D-11/D-12 guarantees"
tech_stack:
  added: []
  patterns:
    - "sanitize-html IOptions allowlist pattern (D-11): allowedTags + allowedAttributes + allowedSchemes + allowProtocolRelative:false"
    - "URL sanitization: HAS_SCHEME blocklist + relative URL passthrough (allows /assets/..., ./, #)"
    - "CSS color regex allowlist with secondary dangerous-keyword check (expression/url/javascript/import)"
    - "TDD corpus: context-aware assertions check executability not string presence"
key_files:
  created:
    - tests/engine/sanitizers.test.ts
    - tests/engine/security.test.ts
  modified:
    - src/engine/sanitizers.ts
    - src/engine/renderer.ts
decisions:
  - "D-11 implementado: sanitizeRichText usa sanitize-html com allowlist estrita — p/strong/em/b/i/ul/ol/li/a/br, href apenas http/https/mailto, allowProtocolRelative:false"
  - "D-12 implementado: sanitizeUrl usa blocklist de schemes (HAS_SCHEME + allowlist), aceita paths relativos; sanitizeCssColor usa regex anchored allowlist + check secundário"
  - "Rule 2 aplicada: campos image passam por sanitizeUrl (não apenas button) — javascript: e data: em src bloqueados"
  - "sanitizeUrl ampliado: URLs relativas (sem scheme) são permitidas para suportar /assets/... do fixture Grécia"
  - "Asserções de corpus: context-aware (verificam executabilidade do payload no contexto específico, não presença da string)"
metrics:
  duration: "8 minutes"
  completed_date: "2026-06-02"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
  deviations: 2
---

# Phase 1 Plan 3: Sanitizadores Reais + Corpus de Segurança SSTI/XSS — Summary

**One-liner:** Implementa sanitizeRichText real com sanitize-html D-11, aplica sanitizeUrl a campos image (Rule 2), e prova inércia de 10 payloads em 6 contextos (60 testes D-16) — fechando o critério de segurança da Fase 1.

## What Was Built

1. **sanitizers.ts hardened** (`src/engine/sanitizers.ts`): `sanitizeRichText` substituído do stub pela implementação real usando `sanitize-html` com `RICHTEXT_SANITIZE_OPTIONS` D-11 — allowlist estrita (`p`, `strong`, `em`, `b`, `i`, `ul`, `ol`, `li`, `a`, `br`), href apenas `http`/`https`/`mailto`, `allowProtocolRelative: false`, `parseStyleAttributes: false`. `RICHTEXT_SANITIZE_OPTIONS` exportado para inspeção em testes. `sanitizeUrl` ampliado para aceitar URLs relativas (sem scheme — `/assets/...`, `./`, `#`) enquanto bloqueia `javascript:`, `data:`, `vbscript:` e qualquer outro scheme absoluto não permitido.

2. **renderer.ts corrigido** (`src/engine/renderer.ts`): campos `image` agora passam por `sanitizeUrl` (assim como `button`) — anteriormente campos image eram passados diretos ao LiquidJS sem sanitização de scheme, permitindo `src="javascript:..."` em browsers antigos. Corrigido tanto em `processRepeaterItems` quanto no loop principal.

3. **Testes de sanitizadores** (`tests/engine/sanitizers.test.ts`): 22 testes unitários cobrindo as três funções — 7 casos RED→GREEN para `sanitizeRichText` (verificando stub→real), 9 para `sanitizeUrl` (inclui relative URLs), 6 para `sanitizeCssColor`.

4. **Corpus de segurança D-16** (`tests/engine/security.test.ts`): 60 testes parametrizados (10 payloads × 6 contextos) + 6 testes unitários adicionais = 66 testes. Contextos: `text`, `richtext`, `image`, `color`, `button`, `repeater-text` (campo dentro de `{% for %}`). Asserções context-aware verificam executabilidade do payload no contexto específico (não presença de strings — ex: `onerror=` como texto escapado é inerte).

## Commits

| Tarefa | Tipo | Hash | Descrição |
|--------|------|------|-----------|
| 1 | test | 2be9144 | sanitizers RED — failing tests para sanitizeRichText real |
| 1 | feat | 408fd25 | sanitizers GREEN — sanitizeRichText com sanitize-html D-11 |
| 2 | test | ce8e26f | corpus de segurança — 60 payloads D-16 |
| 2 | feat | f5382fc | image fields sanitizeUrl + relative URLs (Rule 2) |

## Deviations from Plan

**1. [Rule 2 — Segurança] campos image não sanitizavam URL de scheme**
- **Encontrado durante:** Tarefa 2 (corpus security.test.ts)
- **Issue:** O renderer.ts do Plano 02 aplicava `sanitizeUrl` apenas para campos `button`. Campos `image` passavam diretos ao LiquidJS — um valor `javascript:alert(1)` num campo `image` produziria `src="javascript:alert(1)"` no HTML final, potencialmente executável via click em browsers antigos.
- **Fix:** Adicionado `|| field.type === 'image'` na condição que chama `sanitizeUrl`, tanto em `processRepeaterItems` quanto no loop principal de `render`.
- **Arquivos modificados:** `src/engine/renderer.ts`
- **Commit:** f5382fc

**2. [Rule 2 — Segurança] sanitizeUrl rejeitava paths relativos, quebrando o fixture Grécia**
- **Encontrado durante:** Tarefa 2 (após corrigir campos image — o golden-file do renderer falhou)
- **Issue:** O fixture Grécia usa caminhos relativos para imagens (`/assets/grecia/hero.jpg`). Com a correção de image→sanitizeUrl, esses caminhos passavam pelo bloqueio e retornavam `#`. Caminhos sem scheme absoluto são seguros (não executam código).
- **Fix:** `sanitizeUrl` ampliado com lógica de detecção de scheme: se o valor tem um scheme (`/^[a-zA-Z][a-zA-Z0-9+\-.]*:/`), verifica contra allowlist; se não tem scheme, passa direto (URLs relativas são seguras).
- **Arquivos modificados:** `src/engine/sanitizers.ts`
- **Commit:** f5382fc

## Verification Results

| Check | Status | Notes |
|-------|--------|-------|
| `pnpm run build` | PASS | sem erros de tipagem |
| `pnpm vitest run` | PASS | 108/108 (e2e + parser + renderer + sanitizers + security) |
| sanitizers.test.ts | PASS | 22 testes — stub→real confirmado |
| security.test.ts | PASS | 66 testes (60 corpus + 6 unitários) |
| Golden-file Grécia | PASS | inalterado — hardening não muda output com valores válidos |
| sanitizeRichText real | PASS | `grep sanitizeHtml sanitizers.ts` retorna implementação real |
| allowProtocolRelative:false | PASS | `grep allowProtocolRelative sanitizers.ts` confirma |
| image field sanitized | PASS | `grep "image" renderer.ts` confirma `sanitizeUrl` para image |
| Repeater-text context | PASS | 10 payloads dentro de `{% for %}` todos inertes |
| SSTI P1/P2 inertes | PASS | `{{constructor...}}` escapado — `process.env` não executado |

## Security Coverage

| Threat ID | Status | Evidência |
|-----------|--------|-----------|
| T-03-01: XSS richtext (script, onerror, on*) | MITIGATED | sanitize-html allowlist estrita; payload P3/P7/P8 no corpus richtext |
| T-03-02: XSS javascript: em href | MITIGATED | sanitizeUrl bloqueia; payload P4 → `href="#"` |
| T-03-03: XSS data: URI em href/src | MITIGATED | sanitizeUrl bloqueia; payload P9 → `#` |
| T-03-04: CSS expression() | MITIGATED | sanitizeCssColor rejeita; payload P5 → `""` |
| T-03-05: CSS url(javascript:) polyglot | MITIGATED | sanitizeCssColor rejeita; payload P6 → `""` |
| T-03-06: atributo break-out (P8: " onmouseover=) | MITIGATED | outputEscape escapa `"` → `&quot;` em text; sanitize-html remove de richtext |
| T-03-07: null-byte injection (P10: \x00<script>) | MITIGATED | LiquidJS outputEscape escapa `<` → `&lt;`; sanitize-html descarta tag |
| T-03-08: allowProtocolRelative faltando | MITIGATED | RICHTEXT_SANITIZE_OPTIONS tem `allowProtocolRelative: false` |
| T-03-09: SSTI prototype (P1, P2) | MITIGATED | LiquidJS ownPropertyOnly:true; valores não re-parseados como templates |
| T-03-10: bypass CSS regex | MITIGATED | regex anchored (^...$) bloqueia qualquer formato fora da allowlist |
| T-03-11: XSS dentro de repeater | MITIGATED | escaping aplica recursivamente via `processRepeaterItems`; 6º contexto corpus |
| image src: javascript:/data: (novo, detectado) | MITIGATED | sanitizeUrl aplicado a campos image (Rule 2) |

## Self-Check: PASSED

- `src/engine/sanitizers.ts` exists: FOUND
- `src/engine/renderer.ts` exists: FOUND (image fields sanitized)
- `tests/engine/sanitizers.test.ts` exists: FOUND
- `tests/engine/security.test.ts` exists: FOUND
- Commit 2be9144 exists: FOUND (test RED)
- Commit 408fd25 exists: FOUND (feat GREEN — sanitizeRichText)
- Commit ce8e26f exists: FOUND (test — corpus 60 payloads)
- Commit f5382fc exists: FOUND (feat — image fix + relative URLs)
- pnpm vitest run: 108/108 PASS
