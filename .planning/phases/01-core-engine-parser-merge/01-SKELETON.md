# Walking Skeleton — PageForge Core Engine

**Phase:** 1 — Core Engine (Parser + Merge)
**Generated:** 2026-06-02

## Capability Proven End-to-End

Um desenvolvedor chama `parse(markup)` e recebe um schema tipado, e chama `render(markup, values, brand)` e recebe HTML estático válido — provado por `pnpm test` saindo com código 0, sem UI, sem DB, sem HTTP.

## Architectural Decisions

| Decisão | Escolha | Rationale |
|---------|---------|-----------|
| Template engine | LiquidJS v10.27.0 com `outputEscape:'escape'` + `ownPropertyOnly:true` | D-10 (RESOLVIDO): benchmark contra corpus SSTI/XSS — CVEs todas corrigidas na v10.27.0; loop nativo elimina surface de iteração própria |
| Gramática do autor | Token `:type` colon-suffix + `<!-- repeat:X -->` HTML-comment repeaters | D-01..D-07: engine-agnostic, HTML válido, sem quebra de editors |
| Compilação | Parser → ParsedSchema → compileToLiquid(markup, schema) → Liquid puro | Camada de indireção torna o backend substituível sem tocar na gramática |
| Sanitização rich-text | sanitize-html v2.17.4 com allowlist estrita (D-11) ANTES do render | sanitize-html é Node-first; DOMPurify é browser-first; allowlist é a única abordagem segura |
| Validação de schema | Zod v4.4.3 | Tipos gerados alimentam o pipeline inteiro nas Fases 3–4; runtime validation gratuita |
| Test runner | Vitest v4.1.8, `environment: 'node'`, `toMatchFileSnapshot` para golden-file | Engine é Node puro — sem jsdom; `toMatchFileSnapshot` é o mecanismo de golden-file do Vitest |
| Package manager | pnpm | Padrão do stack Next.js documentado em CLAUDE.md |
| Layout de diretório | `src/engine/` para módulos; `tests/engine/` para testes; `tests/fixtures/` para fixture | Isolamento claro; `src/engine/index.ts` é a API pública importada pelas Fases 3–4 |
| Escaping context-aware | Por tipo de campo: `text`/`image` → outputEscape automático; `button` → `sanitizeUrl()`; `color` → `sanitizeCssColor()`; `richtext` → `sanitize-html` + `\| raw` | D-12: cada tipo tem vetor de injeção diferente |
| Fixture Grécia | HTML estático tokenizado manualmente a partir dos componentes `renova-turismo-jornada-main/src/components/campaigns/grecia/` | Fixture manual (Wave 1 prioridade) entrega fidelidade de layout sem dependência de servidor Vite; Playwright-capture é upgrade futuro |

## Stack Touched in Phase 1

- [x] Project scaffold (package.json com deps pinadas, tsconfig.json, vitest.config.ts)
- [x] Parsing — `parse(markup) → ParsedSchema` com Zod
- [x] Compilation — `compileToLiquid(markup, schema) → string Liquid`
- [x] Rendering — `render(markup, values, brand) → Promise<string>` via LiquidJS
- [x] Sanitização — `sanitizeRichText`, `sanitizeUrl`, `sanitizeCssColor`
- [x] Test suite — parser assertions, golden-file (fixture Grécia), corpus SSTI/XSS (50 combinações tipo×payload)
- [ ] UI — zero (fora de escopo para Fase 1)
- [ ] DB — zero (fora de escopo para Fase 1)
- [ ] Deployment — zero (entregável é `pnpm test` passando)

## Out of Scope (Deferred to Later Slices)

- Qualquer UI/dashboard — Fase 3
- Persistência de templates e schemas (Postgres + Prisma) — Fases 2/3
- Multi-tenancy/auth (workspaces, RBAC) — Fase 2
- Dynamic form gerado a partir do schema — Fase 4
- Image upload e asset handling — Fase 4
- Export ZIP / preview UI — Fase 4
- Brand config authoring/persistence — Fase 3
- Repeaters aninhados — diferido indefinidamente (D-08)
- Rich per-field metadata (label, required, default) — Fase 3
- CSS do Tailwind inlined no fixture — Fase 4/5

## Subsequent Slice Plan

Cada fase posterior adiciona uma fatia vertical sobre este esqueleto sem renegociar as decisões arquiteturais acima:

- Fase 2: Workspace + auth (better-auth, Postgres, RBAC) — ortogonal ao engine
- Fase 3: Template authoring UI (form de markup, parse-on-save, brand config) — consome `parse()` desta fase
- Fase 4: Geração de LP (dynamic form, image upload, preview, export ZIP) — consome `render()` desta fase
- Fase 5: Catalog (folders, browse, search) + acceptance Grécia end-to-end
