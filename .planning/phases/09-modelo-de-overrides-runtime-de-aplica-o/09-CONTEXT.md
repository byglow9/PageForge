# Phase 9: Modelo de overrides + runtime de aplicação - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning
**Source:** Design aprovado (`~/.claude/plans/centralizar-horizontalmente-o-conte-do-bright-valley.md`) + decisões do milestone v2.1

<domain>
## Phase Boundary

Estabelecer o **modelo de dados de overrides por LP** e o **runtime de reaplicação** no serve e no export — **SEM UI de editor** (isso é a Fase 10). Cobre apenas overrides de **texto** e **cor por LP**. Verificável semeando overrides via `updateLpAction` (sem editor visual).

ENTRA: schema dos overrides em `LandingPage.values`; ação para gravar overrides; shim de apply (texto + cor) injetado no `index.html` no serve route e no export route; testes de isolamento por LP/cross-tenant; preview==export.

NÃO ENTRA: editor visual in-iframe / click-to-select / postMessage (Fase 10); imagens e links (Fase 11); MutationObserver re-apply, drift por hash, sanitização completa (Fase 12 — nesta fase basta o mínimo seguro: texto via textContent, cor validada).
</domain>

<decisions>
## Implementation Decisions (travadas)

### Modelo de dados
- Reusar **`LandingPage.values` (jsonb)** — já existe e está **ocioso para VITE_SPA** (markupSnapshot é sentinela vazio). **Sem migração nova.**
- Schema Zod novo: `{ overrides: PfOverride[], primaryColorOverride?: string }`, com `PfOverride = { path: string; originalHash: string; type: 'text'|'color'; value: string }`. (Nesta fase só `text` e `color`; `image`/`href` entram na Fase 11 — desenhar o enum/型 já extensível.)
- `path` = caminho determinístico do nó a partir da raiz (ex. índice de filhos `/0/2/1/0`); `originalHash` = hash do conteúdo original (fallback/anti-drift; a checagem de drift em si é Fase 12, mas o campo é gravado já aqui).

### Runtime de aplicação (shim)
- Um **shim JS de apply** (módulo cliente isolado) percorre o DOM após o React montar e aplica cada override por `path`: texto via `textContent` (nunca innerHTML); cor por LP via override do CSS var `--primary`.
- O shim + o JSON dos overrides são **injetados no `index.html`** no **serve route** (`apps/web/src/app/serve/[tplId]/[[...path]]/route.ts`, no branch isHtmlRequest, junto do `injectBrandStyle` existente) e no **export route** (`apps/web/src/app/api/lps/[lpId]/export/route.ts`, branch VITE_SPA). Mesma injeção nos dois → **preview == export**.
- Cor por LP: estender `buildBrandStyleTag`/injeção em `lib/brand/theme.ts` para **priorizar `primaryColorOverride` da LP** sobre o `primaryColor` do workspace.

### Persistência
- `updateLpAction` (branch VITE_SPA, `apps/web/src/lib/lps/actions.ts`) passa a aceitar/validar/gravar o payload de overrides em `values`. Validação mínima desta fase: texto é string (aplicado via textContent → sem HTML); cor valida `#RRGGBB` (reusar regex do BrandConfig).

### Segurança (mínimo desta fase; hardening completo na Fase 12)
- Texto aplicado via `textContent` (sem vetor XSS). Cor validada como hex. Isolamento por `LandingPage.id` + workspace/RLS (overrides nunca vazam entre LPs nem entre tenants).
- O shim de apply roda no host de serve isolado (já cross-origin) e no HTML exportado (export VITE_SPA já omite CSP — D-12; manter).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pontos de hook (código existente)
- `apps/web/src/app/serve/[tplId]/[[...path]]/route.ts` — branch isHtmlRequest; onde `injectBrandStyle` já injeta no index.html (ponto de injeção do shim + overrides JSON).
- `apps/web/src/app/api/lps/[lpId]/export/route.ts` — branch VITE_SPA (~L221); injeta brand no index.html do ZIP (mesma injeção do shim p/ preview==export).
- `apps/web/src/lib/brand/theme.ts` — `buildBrandStyleTag`/`injectBrandStyle` (estender p/ override de cor por LP).
- `apps/web/src/lib/lps/actions.ts` — `updateLpAction` branch VITE_SPA (gravar overrides em values).
- `apps/web/src/lib/lps/schema.ts` — onde adicionar os schemas Zod (`PfOverride`, payload).
- `apps/web/prisma/schema.prisma` — `LandingPage.values` jsonb (sem migração; só reuso).

### Design e roadmap
- `~/.claude/plans/centralizar-horizontalmente-o-conte-do-bright-valley.md` — design completo (arquitetura, modelo, pitfalls).
- `.planning/ROADMAP.md` — Phase 9 (Goal + Success Criteria).
</canonical_refs>

<specifics>
## Specific Ideas
- Verificação sem UI: gravar override de texto e de cor via `updateLpAction` num teste/seed, abrir a preview e confirmar que o shim aplicou; baixar o ZIP e confirmar o mesmo resultado offline.
- Desenhar o enum `type` já com `'image'|'href'` previstos (Fase 11) para não retrabalhar o schema.
</specifics>

<deferred>
## Deferred Ideas
- Editor visual in-iframe, postMessage, click-to-select → Fase 10.
- Imagens (upload S3/URL) e links (href) → Fase 11.
- MutationObserver re-apply, detecção de drift por originalHash, sanitização completa, aceitação E2E → Fase 12.
</deferred>

---

*Phase: 09-modelo-de-overrides-runtime-de-aplica-o*
*Context gathered: 2026-06-24*
