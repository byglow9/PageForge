---
status: resolved
resolution: "Confirmado ao vivo pelo usuário em 2026-06-24: preview da renova-turismo (Grécia) renderiza corretamente após o fix (iframe sandbox 'allow-scripts' → 'allow-scripts allow-same-origin' em preview/page.tsx). Causa raiz (módulo ESM bloqueado por CORS em origem opaca + SecurityError de localStorage) eliminada. Isolamento preservado via subdomínio de serve cross-origin + cookies host-only + CSP frame-ancestors (08-SECURITY.md AR-08-08)."
trigger: "Preview de LP VITE_SPA renderiza tela branca — iframe carrega assets (200) mas React não monta"
created: 2026-06-24
updated: 2026-06-24
phase: 08-lp-generation-brand-theming-export-v2-0-acceptance
---

# Debug Session: vite-spa-preview-blank

## Symptoms

- **Expected:** Ao abrir o preview de uma LP VITE_SPA (`/w/{slug}/lps/{lpId}/preview`), o iframe deve exibir a SPA renderizada (ex: página Grécia do `renova-turismo`) com o brand `--primary` aplicado.
- **Actual:** O iframe carrega mas fica totalmente branco. React não monta.
- **Errors:** Logs do servidor mostram `GET /?t=... 200`, `/assets/index-*.css 200`, `/assets/index-*.js 200` (assets servidos OK). Console do navegador (iframe) provavelmente tem erro CORS — não confirmado pelo usuário ainda.
- **Timeline:** Primeiro teste real com um `dist/` de SPA Vite (renova-turismo do Lovable, build isolado da rota Grécia). A UAT da Phase 08 (Bloco B) marcou PASS, mas interpretou um SecurityError como "isolamento confirmado".
- **Reproduction:** Cadastrar um template VITE_SPA a partir de um `dist/` Vite real → gerar LP → abrir preview → tela branca.

## Root Cause Hypothesis (pré-diagnóstico por análise de código)

Combinação de três fatos:

1. Todo build Vite emite o entry como `<script type="module" crossorigin src="/assets/index-*.js">` (confirmado em `renova-turismo-jornada-main/dist/index.html:60`). Módulo ESM é sempre buscado em modo CORS.
2. O iframe do preview usa `sandbox="allow-scripts"` SEM `allow-same-origin` (`apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx:84`) → documento do iframe tem **origem opaca** (`Origin: null`). Decisão T-08-03-03 da Phase 08.
3. O serve handler (`apps/web/src/app/serve/[tplId]/[[...path]]/route.ts`, `buildSecurityHeaders` ~linha 88) **não envia** `Access-Control-Allow-Origin`.

→ O navegador baixa o módulo (200) mas se recusa a executá-lo (falta header CORS para `Origin: null`). React nunca monta → tela branca.

**Problema secundário pela mesma causa:** origem opaca faz `localStorage` lançar `SecurityError`, quebrando SPAs com storage (ex: client Supabase com `storage: localStorage` em `renova-turismo-jornada-main/src/integrations/supabase/client.ts`).

## Proposed Fix

Trocar o sandbox do iframe para `sandbox="allow-scripts allow-same-origin"`. O iframe é servido de subdomínio isolado (`<tplId>.serve.localhost` / `serve.{SERVE_DOMAIN}`), logo cross-origin em relação ao app — a combinação só é perigosa quando o conteúdo é same-origin com o embutidor (poderia remover o próprio sandbox), o que NÃO é o caso. Resolve CORS do módulo (passa a ser same-origin ao doc do iframe) E o localStorage de uma vez.

## Security Re-evaluation Required (revisa T-08-03-03)

- A origem opaca era a mitigação escolhida. Avaliar se **subdomínio cross-origin + CSP `frame-ancestors`** mantém o isolamento desejado.
- Confirmar que cookies de sessão do app (`localhost`) são host-only e NÃO vazam para o subdomínio `*.serve.localhost`.
- Atualizar `08-SECURITY.md` (T-08-03-03) e `08-UI-SPEC.md`.
- Reabrir/atualizar o Bloco B da UAT da Phase 08 (`08-UAT.md`).

## Related (separate) — verificar

Export standalone: `index.html` aberto via `file://` também usa módulo `crossorigin` → pode dar o mesmo bloqueio CORS. Bug relacionado mas separado do preview.

## Current Focus

reasoning_checkpoint:
  hypothesis: "O iframe do preview VITE_SPA usa sandbox='allow-scripts' sem allow-same-origin → documento tem origem opaca. O entry da SPA é <script type='module' crossorigin> (fetch em modo CORS). Numa origem opaca o crossorigin fetch falha (sem ACAO compatível) E qualquer acesso a localStorage lança SecurityError no boot do módulo Supabase. Resultado: o módulo nunca executa → React nunca monta → tela branca."
  confirming_evidence:
    - "dist/index.html:60 — <script type='module' crossorigin src='/assets/index-CWkPg5qi.js'> (módulo ESM, fetch CORS)"
    - "preview/page.tsx:84 — sandbox='allow-scripts' sem allow-same-origin (origem opaca confirmada)"
    - "serve/route.ts buildSecurityHeaders (linha 88-95) — NÃO envia Access-Control-Allow-Origin"
    - "supabase/client.ts:12-13 — storage: localStorage acessado no init do módulo → SecurityError em origem opaca"
    - "UAT Bloco B (08-UAT.md:54) interpretou o SecurityError como 'isolamento confirmado' — era na verdade o bug"
  falsification_test: "Se ao trocar para 'allow-scripts allow-same-origin' a SPA continuar branca, a hipótese está errada. Verificação ao vivo após restart do dev server (CHECKPOINT)."
  fix_rationale: "Com allow-same-origin o documento do iframe assume a origem real ({tplId}.serve.localhost), tornando o fetch do módulo same-origin (sem necessidade de ACAO) e habilitando localStorage daquela origem. Aborda a causa-raiz (origem opaca), não o sintoma."
  blind_spots: "Verificação ao vivo (render real) depende de restart gerenciado pelo usuário. Export standalone via file:// é problema relacionado SEPARADO, não coberto por este fix."

next_action: aplicar fix em preview/page.tsx:84, depois CHECKPOINT pedindo restart + verificação ao vivo

## Evidence

- timestamp: 2026-06-24T14:20:05Z — `dist/index.html:60` confirma `<script type="module" crossorigin src="/assets/index-*.js">`
- timestamp: 2026-06-24T14:20:05Z — `preview/page.tsx:84` confirma `sandbox="allow-scripts"` (sem allow-same-origin)
- timestamp: 2026-06-24T14:20:05Z — `serve/[tplId]/[[...path]]/route.ts` `buildSecurityHeaders` não inclui `Access-Control-Allow-Origin`
- timestamp: 2026-06-24T14:20:05Z — logs: assets servidos 200 mas página branca
- timestamp: 2026-06-24T15:05:00Z — VALIDAÇÃO: relido `preview/page.tsx` — confirmado `sandbox="allow-scripts"` (linha 84), comentário explícito "DO NOT add allow-same-* flags". Toda a cadeia da hipótese bate com o código real.
- timestamp: 2026-06-24T15:05:00Z — VALIDAÇÃO: relido `serve/route.ts` `buildSecurityHeaders` (88-95) — só Content-Type, CSP frame-ancestors, Cache-Control, X-Content-Type-Options. SEM Access-Control-Allow-Origin → módulo crossorigin não pode ser servido a uma origem opaca.
- timestamp: 2026-06-24T15:05:00Z — VALIDAÇÃO: `supabase/client.ts:12-13` usa `storage: localStorage` no init do módulo → SecurityError sob origem opaca (problema secundário confirmado).
- timestamp: 2026-06-24T15:05:00Z — SEGURANÇA: `lib/auth/auth.ts` não define cookieDomain/crossSubDomainCookies (grep em lib/auth → 0 resultados) → cookies de sessão better-auth são host-only, NÃO vazam para *.serve.localhost. Isolamento preservado independente da origem opaca.
- timestamp: 2026-06-24T15:05:00Z — SEGURANÇA: `proxy.ts` roteia *.serve.* para /serve via rewrite; `serve/route.ts:91` emite CSP frame-ancestors {DASHBOARD_ORIGIN}. Subdomínio cross-origin + CSP frame-ancestors = isolamento mantido.
- timestamp: 2026-06-24T15:20:00Z — FIX aplicado: `preview/page.tsx:84` sandbox → "allow-scripts allow-same-origin"; comentários do header e do bloco atualizados. `tsc --noEmit` exit 0.

## Eliminated

- hypothesis: Supabase client lança no boot por env ausente → ELIMINADA: a URL do Supabase foi embutida no bundle (`https://rqrklcczfejpuwbvwwkq.supabase.co` presente no `dist/assets/index-*.js`), então `createClient` não lança por falta de URL.
- hypothesis: asset 404 / path errado → ELIMINADA: logs mostram `/assets/index-*.js` e `.css` com 200.

## Resolution

root_cause: |
  O iframe do preview VITE_SPA usava sandbox="allow-scripts" sem allow-same-origin,
  dando ao documento do iframe uma ORIGEM OPACA. O entry da SPA Vite é
  <script type="module" crossorigin> (fetch em modo CORS); sob origem opaca esse
  fetch é bloqueado (o serve handler não envia Access-Control-Allow-Origin) e o
  acesso a localStorage (cliente Supabase) lança SecurityError. Em ambos os casos
  o módulo nunca executa → React nunca monta → tela branca. O SecurityError visto
  na UAT v2.0 (Bloco B) era o BUG, não prova de isolamento.

fix: |
  apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx:84 — iframe sandbox
  "allow-scripts" → "allow-scripts allow-same-origin". Com isso o documento do
  iframe assume sua origem real ({tplId}.serve.localhost / serve.{SERVE_DOMAIN}),
  tornando o fetch do módulo same-origin (sem ACAO) e habilitando localStorage.
  Comentários (header JSDoc + bloco inline) reescritos. Isolamento preservado por:
  (1) subdomínio de serve cross-origin distinto do dashboard, (2) cookies de sessão
  host-only do better-auth (sem Domain → não vão para *.serve.localhost),
  (3) CSP frame-ancestors no serve handler.

verification: |
  Estático: tsc --noEmit exit 0. Cadeia da hipótese validada contra o código real
  (preview/page.tsx, serve/route.ts, supabase/client.ts, auth.ts, proxy.ts).
  Ao vivo: PENDENTE — requer restart do dev server (gerenciado pelo usuário) e
  observação do render real + console do iframe. Ver CHECKPOINT.

files_changed:
  - apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx
  - .planning/phases/08-lp-generation-brand-theming-export-v2-0-acceptance/08-SECURITY.md
  - .planning/phases/08-lp-generation-brand-theming-export-v2-0-acceptance/08-UI-SPEC.md
  - .planning/phases/08-lp-generation-brand-theming-export-v2-0-acceptance/08-UAT.md

related_separate_bug: |
  Export standalone (index.html aberto via file://) usa o mesmo
  <script type="module" crossorigin>. Sob file:// (origem null) o fetch CORS de
  módulos tipicamente falha → o ZIP exportado pode não renderizar com duplo-clique.
  Bug SEPARADO do preview (não corrigido aqui); merece sua própria sessão de debug.
  Documentado em 08-SECURITY.md (notas da re-eval 2026-06-24).
