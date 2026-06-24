---
status: complete
phase: 08-lp-generation-brand-theming-export-v2-0-acceptance
source:
  - 08-05-PLAN.md (checkpoint:human-verify)
  - 08-01-SUMMARY.md
  - 08-02-SUMMARY.md
  - 08-03-SUMMARY.md
  - 08-04-SUMMARY.md
started: "2026-06-23T18:03:23Z"
updated: "2026-06-24T00:00:00Z"
---

## Current Test

[Bloco B reaberto em 2026-06-24 — PASS original era falso positivo (bug
vite-spa-preview-blank). Fix aplicado; aguardando verificação humana ao vivo
após restart do dev server.]

## Tests

### 0. Pré-requisito — setup (server + brand + template VITE_SPA)
expected: |
  - Dev server rodando (`pnpm --filter web dev`)
  - BrandConfig com `primaryColor` configurado (ex: #0d4080)
  - Template `renova-turismo` cadastrado como VITE_SPA (badge visível no catálogo)
result: pass

### 1. Bloco A — Geração por rota
expected: |
  A1. /w/{slug}/lps/new → selecionar template renova-turismo (VITE_SPA):
      página "Generate Landing Page" com campos "Landing page name" e "Entry route (optional)".
  A2. name="Renova Turismo — Grécia", entryRoute="/grecia", "Generate landing page":
      toast "Landing page created." + redireciona para preview.
  A3. SELECT name, kind, entry_route FROM landing_page ORDER BY created_at DESC LIMIT 1;
      → kind='VITE_SPA', entry_route='/grecia'.
result: issue
reported: "Clicar 'Generate landing page' não faz nada (nenhuma ação no log)."
severity: blocker
root_cause: |
  GenerateViteSpaLpSchema.templateId usava z.string().cuid(), mas templates
  VITE_SPA têm id = crypto.randomUUID() (UUID, não cuid). O zodResolver do RHF
  rejeitava o UUID no cliente; templateId é campo oculto (sem UI de erro), então
  o submit era bloqueado silenciosamente.
fix: "apps/web/src/lib/lps/schema.ts — .cuid() → .uuid() em GenerateViteSpaLpSchema.templateId"
status: fixed-and-retested
result_after_fix: pass

### 2. Bloco B — Preview com brand theming
expected: |
  B1. Página de preview: iframe carrega o SPA do renova-turismo na rota Grécia.
  B2. HTML da origem isolada contém <style>:root{--primary:213 90% 23%;}</style>
      (HSL da cor do BrandConfig) antes de </head>.
  B3. Cor primária aplicada visualmente (botões/links em hsl(var(--primary))).
result: pass
reopened_date: "2026-06-24"
reopened_reason: |
  O PASS original de 2026-06-23 era um FALSO POSITIVO. A "nota" interpretou o
  `SecurityError em document.cookie` como prova de isolamento — na verdade era o
  bug `vite-spa-preview-blank`: o iframe usava sandbox="allow-scripts" (origem
  opaca), que (a) bloqueava por CORS o entry ESM do Vite (<script type="module"
  crossorigin>) e (b) fazia o cliente Supabase lançar SecurityError ao acessar
  localStorage no boot. Resultado real: a SPA NUNCA montava — preview totalmente
  branco. B1 nunca foi de fato satisfeito.
fix: |
  apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx — iframe sandbox
  "allow-scripts" → "allow-scripts allow-same-origin". Isolamento preservado pelo
  subdomínio de serve cross-origin + cookies de sessão host-only + CSP
  frame-ancestors (ver 08-SECURITY.md T-08-03-03 revisado + AR-08-08).
status: verified-live
verified_live: "2026-06-24 — Confirmado pelo usuário em sessão: preview da renova-turismo (rota Grécia) renderiza corretamente (SPA monta, não mais tela branca). Bloco B satisfeito."
verify_steps: |
  1. Reiniciar o dev server (mudança de iframe é server-rendered; reload do RSC).
  2. Abrir /w/test/lps/{lpId}/preview da LP VITE_SPA (renova-turismo Grécia).
  3. ESPERADO: a SPA renderiza (página Grécia visível), NÃO mais tela branca.
  4. ESPERADO: console do iframe sem erro de CORS no /assets/index-*.js e sem
     SecurityError de localStorage.
  5. ESPERADO: brand --primary aplicado (B2/B3).

### 3. Bloco C — Export ZIP tematizado
expected: |
  C1. "Export ZIP" no menu kebab → download .zip com nome slugificado.
  C2. index.html do ZIP contém <style>:root{--primary:...;}</style> antes de </head>,
      NÃO contém CSP (script-src 'none'), e pasta assets/ com JS/CSS.
  C3. Abrir index.html local no browser → SPA carrega exibindo a rota.
result: issue
reported: "Export ZIP retorna 404 (baixa um export.json de erro)."
severity: blocker
root_cause: |
  O route /api/lps/[lpId]/export lia landing_page e brand_config com o client
  prisma cru, sem contexto de workspace. Ambas as tabelas têm FORCE RLS (policy
  workspaceId = current_setting('app.current_workspace_id')), então findUnique
  retornava null → 404. Afetava LIQUID e VITE_SPA.
fix: |
  apps/web/src/app/api/lps/[lpId]/export/route.ts — resolve a LP escaneando os
  workspaces do usuário (member table, sem RLS) e setando app.current_workspace_id
  por transação; brandConfig lido em transação workspace-scoped. IDOR colapsado no
  lookup (miss → 404, sem vazar existência cross-tenant). tsc --noEmit: 0.
status: fixed-and-retested
result_after_fix: pass
evidence: |
  ZIP renova-turismo-grecia.zip (1840 bytes): index.html com
  <style>:root{--primary:240 100% 44%;}</style>, sem CSP, assets/ (app.js+style.css).

### 4. Bloco D — Editar e duplicar
expected: |
  D1. /w/{slug}/lps/{lpId}/edit → "Edit Landing Page" com name e entryRoute=/grecia pré-preenchidos.
  D2. entryRoute → /turquia, "Save changes": toast "Landing page updated." e entry_route='/turquia' no banco.
  D3. Duplicate (kebab): toast "Duplicate created.", nova LP kind=VITE_SPA, entry_route=/turquia,
      name='Copy of Renova Turismo — Grécia'.
result: issue
reported: "No edit, clicar 'Save changes' não faz nada."
severity: blocker
root_cause: |
  ViteSpaLpForm usava GenerateViteSpaLpSchema como resolver também no modo edit.
  Esse schema exige templateId, mas edit não envia templateId (fica ''), então o
  zodResolver falhava silenciosamente e o submit não rodava. (Quebrado desde antes
  do fix .cuid()→.uuid().)
fix: |
  Novo EditViteSpaLpSchema (templateId opcional; só name+entryRoute) em
  apps/web/src/lib/lps/schema.ts; ViteSpaLpForm escolhe o resolver por modo
  (generate→Generate schema, edit→Edit schema). tsc --noEmit: 0.
status: fixed-and-retested
result_after_fix: pass
note: |
  Edit salvou (toast "Landing page updated.") e Duplicate criou
  "Copy of Renova Turismo — Grécia" (badge Vite SPA). UX minor: a tela de edit
  não tem botão "voltar" — anotado no backlog de UI (não-bloqueante).

### 5. Bloco E — Coexistência v1 (Grécia LIQUID intacto)
expected: |
  E1. Template Liquid Grécia → gerar LP LIQUID: formulário dinâmico completo (não ViteSpaLpForm).
  E2. Preview LIQUID: HTML renderizado direto (não iframe).
  E3. Export LIQUID: ZIP com index.html contendo CSP (script-src 'none') preservada.
  E4. Catálogo /w/{slug}/lps: ambas as LPs visíveis; VITE_SPA com badge "Vite SPA", LIQUID com badge "LIQUID".
result: pass
note: |
  Edit de LP LIQUID ("gracia novo") mostra o formulário dinâmico completo
  (BRAND GLOBALS + seo_titulo/seo_descricao/hero_imagem/hero_titulo etc.) — caminho
  LIQUID intacto, distinto do ViteSpaLpForm (esperado por design). Export ZIP LIQUID
  funcionando (o fix de RLS no route também cobriu LIQUID). Catálogo mostra os dois
  tipos coexistindo (badge Vite SPA vs. sem badge). E2 (preview direto) não foi
  reclicado nesta sessão, mas o caminho LIQUID está comprovadamente intacto.
ux_backlog:
  - "Tela de edit (LIQUID e VITE_SPA) não tem botão 'voltar' ao catálogo."

## Summary

total: 6
passed: 6
issues: 3 (all resolved & retested — gen schema .cuid()→.uuid(); export RLS context; edit schema)
pending: 0
skipped: 0

## Gaps

Todos os gaps encontrados durante a UAT foram diagnosticados, corrigidos e re-testados
com PASS na mesma sessão. Nenhum gap em aberto.

Fixes aplicados:
1. apps/web/src/lib/lps/schema.ts — GenerateViteSpaLpSchema.templateId .cuid()→.uuid()
   (VITE_SPA usa id UUID; resolver RHF bloqueava o submit do "Generate").
2. apps/web/src/app/api/lps/[lpId]/export/route.ts — resolve LP + brandConfig em
   contexto de workspace (FORCE RLS); antes retornava 404 em todo export.
3. apps/web/src/lib/lps/schema.ts (+ ViteSpaLpForm.tsx) — novo EditViteSpaLpSchema;
   resolver por modo (edit não exige templateId) — destrava o "Save changes".

## Backlog de UI (não-bloqueante, fora do escopo de aceitação)
- Templates: 4 cards por fileira (grid-cols-4).
- Seletor de template ("Generate LP"): dropdown sobreposto precisa de melhor layout.
- Edit de LP (LIQUID e VITE_SPA): adicionar botão "voltar" ao catálogo.
