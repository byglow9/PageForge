# Phase 8: LP Generation, Brand Theming, Export & v2.0 Acceptance - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Gerar LPs a partir de templates `VITE_SPA` (já ingeridos na Fase 6 e servíveis em origem isolada desde a Fase 7), aplicar tema de marca via **brand CSS vars** sem rebuild, exportar a LP como **ZIP da árvore `dist/`**, e provar o fluxo v2.0 end-to-end com o `renova-turismo` coexistindo com o template Liquid Grécia.

**Em escopo:** geração de `LandingPage` `kind=VITE_SPA` apontando para o `dist/` do template com **rota de entrada** escolhida; injeção de brand CSS vars no serve/preview/export (live); reabrir/editar (rota, tema) e duplicar LPs VITE_SPA reusando catálogo/pastas/tags; export ZIP do `dist/` (branch por `kind` na rota de export existente, sem CSP estrita); aceitação v2.0 (`renova-turismo` + Grécia coexistindo, caminho v1 intacto).

**Fora de escopo (outras fases / já decidido):** build server-side, edição por formulário do conteúdo Lovable, manifesto/patch/rebuild → **v2.1** (já em Out of Scope no PROJECT.md). Detecção robusta de rotas via parsing do bundle → não faremos (ver D-01). Tema além de `--primary` (paleta completa, logo, whatsapp como vars) → fora do MVP.
</domain>

<decisions>
## Implementation Decisions

### Rota de entrada (PRJ-07 / D3 — "cada rota = 1 LP")
- **D-01:** A rota de entrada **assume `/` por padrão** (caso comum: o usuário usa o PageForge para ZIPs que são **uma LP só**, uma página na raiz — sem etapa de UI extra; só gerar). Para projetos **multi-rota** (o caso de exceção, ex. `renova-turismo` com ~13 rotas em `src/App.tsx`), aparece um **campo de texto opcional** onde o usuário **digita o path** (ex: `/grecia`, `/turquia`). A rota escolhida é persistida na `LandingPage`.
- **D-02:** **Não** faremos parsing do JS minificado do `dist/` para extrair a lista de rotas. Razão load-bearing: só temos o `dist/` pré-buildado (D1-A); a tabela de rotas vive embaralhada no bundle minificado e um regex sobre isso é frágil entre builds/versões do Vite. Entrada manual de path é robusta, cobre qualquer SPA e atende o caso de aceitação. (Sugestões best-effort a partir do bundle ficam como melhoria futura, **não** no MVP.)
- **D-03:** Validação da rota é **comportamental, não estática**: a rota é considerada válida se carrega no preview (origem isolada da Fase 7 já faz fallback de rota desconhecida → `index.html`, D-07 da Fase 7). Não tentamos provar a existência da rota antes de servir.

### Tema de marca (PRJ-08 / D2 — "editabilidade grátis")
- **D-04:** Tema é **live (re-tematiza)**, não snapshot. O serve, o preview **e** o export leem o `BrandConfig` **atual** do workspace a cada renderização. Mudar a cor da marca → todas as LPs VITE_SPA seguem automaticamente. Isso é exatamente o value prop da D2 ("editabilidade grátis" via CSS vars). Contraste deliberado com o caminho LIQUID, onde o markup é snapshotado (D-06 da Fase 4).
- **D-05:** O MVP injeta **apenas `--primary`**, derivado de `BrandConfig.primaryColor`, **convertido para o HSL triplet** que os templates Lovable/shadcn esperam (eles usam `hsl(var(--primary))`). A injeção é feita via um `<style>` **prepended** no `index.html` servido/pré-visualizado/exportado. Logo, WhatsApp e demais vars de paleta ficam para v2.1 (decisão do usuário: "você decide" → escopo enxuto que prova o mecanismo).
- **D-06:** A injeção do `<style>` acontece nos **três caminhos** de forma consistente: serve (origem isolada da Fase 7), preview (iframe no dashboard) e export (ZIP). O ponto de injeção é o stream do `index.html` — **não** afeta os chunks JS/CSS do bundle.

### Modelo de dados da LP VITE_SPA (PRJ-07 / PRJ-10)
- **D-07:** A `LandingPage` `kind=VITE_SPA` **referencia os arquivos compartilhados do template** (aponta para o `templateId`/prefixo S3 do `dist/`), **não** faz cópia própria do `dist/`. Razão: o `dist/` de um projeto React pesa vários MB; copiar por LP duplicaria armazenamento e custo. A LP guarda **qual template + qual rota de entrada + tema é live** — leve.
  - **Consequência aceita pelo usuário:** apagar o **template/projeto** desativa as LPs `VITE_SPA` geradas a partir dele (não há cópia para sobreviver). Isto **difere** do LIQUID (que snapshota `markupSnapshot` e sobrevive à deleção do template — D-06 da Fase 4).
- **D-08:** Reusar a tabela `LandingPage` existente (não criar tabela nova). Para `VITE_SPA`: `templateId` aponta para o template `dist/`, e adicionar/usar uma coluna de **rota de entrada** (ex. `entryRoute`, nullable; null/`/` = raiz). `markupSnapshot`/`schemaVersion`/`values` **não se aplicam** ao caminho VITE_SPA (planner decide tornar nullable vs. valor sentinela). Catálogo/pastas/tags/duplicação permanecem **inalterados** para ambos os kinds (PRJ-10).
- **D-09:** Editar uma LP VITE_SPA = editar **rota de entrada** e (implicitamente) o tema é sempre o atual (live). Duplicar = nova `LandingPage` apontando para o mesmo template/rota. Sem reconciliação de schema (não há schema de campos no VITE_SPA).

### Export ZIP (PRJ-09)
- **D-10:** **Branch por `kind`** na rota de export que **já existe** (`apps/web/src/app/api/lps/[lpId]/export/route.ts`) — não criar rota nova. Para `VITE_SPA`: o ZIP leva a **árvore `dist/` inteira** (HTML + JS + CSS + imagens), auto-contido, abre offline.
- **D-11:** A **cor da marca é "assada" no `index.html`** exportado (o mesmo `<style>` prepended de D-05/D-06), de modo que o ZIP sai **já tematizado** e consistente com o preview — sem depender do PageForge em runtime.
- **D-12:** A **CSP estrita `script-src 'none'`** do export LIQUID **NÃO** se aplica ao `VITE_SPA` — ele tem runtime JS próprio e não funcionaria sob essa CSP. O guard recíproco de tipo (D-08 da Fase 7) garante que os caminhos não se cruzam.

### Claude's Discretion
- Conjunto exato de CSS vars além de `--primary` (usuário disse "você decide" → MVP usa só `--primary`; planner pode adicionar `--primary-foreground`/`--ring` por derivação se for trivial e sem custo de UX).
- Conversão exata de cor (hex do `primaryColor` → HSL triplet) e biblioteca/utilitário usado.
- Forma exata da coluna de rota na `LandingPage` (nome, nullability, default) e se `markupSnapshot`/`values` viram nullable ou recebem sentinela para VITE_SPA — planner decide via migration aditiva.
- Estrutura/nomes internos do ZIP (raiz do `dist/` vs. subpasta) e mecânica de streaming (reusar `archiver` + padrão do handler de export existente).
- Onde exatamente o `<style>` é prepended no stream do `index.html` (helper compartilhado entre serve/preview/export para não duplicar lógica).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decisões travadas / requisitos
- `.planning/PROJECT.md` §Key Decisions — **D2** (opaco + brand CSS vars, "editabilidade grátis"), **D3** (1 projeto = 1 template, rota = LP), **D1-A** (só `dist/` pré-buildado), **D4** (origem isolada, entregue na Fase 7). Out of Scope: edição por formulário/rebuild → v2.1.
- `.planning/PROJECT.md` §Requisitos — **PRJ-07** (geração por rota), **PRJ-08** (brand CSS vars no serve/preview/export), **PRJ-09** (export ZIP do `dist/`, branch por kind, sem CSP estrita), **PRJ-10** (editar rota/tema + duplicar, reusar catálogo), **PRJ-12** (aceitação v2.0 `renova-turismo` + Grécia coexistindo). **PRJ-11** já validado (separação estrita de tipo, Fase 6).
- `.planning/ROADMAP.md` §Phase 8 — Goal + 5 Success Criteria (geração por rota sem build; injeção live de brand vars; export ZIP sem CSP estrita; editar/duplicar com catálogo intacto; aceitação v2.0 coexistente).

### Assets herdados — Geração / render LIQUID (molde a espelhar)
- `apps/web/src/lib/lps/actions.ts` — `generateLpAction` (≈L147), `updateLpAction`, `duplicateLpAction`, `listLpsAction`, `getLpAction`. Padrão de derivação server-side de `workspaceId`, persistência da `LandingPage`. **Ponto de extensão para o branch VITE_SPA.**
- `apps/web/src/lib/lps/render.ts` — `renderLp()` com guard que rejeita `VITE_SPA` (o recíproco do guard VITE_SPA da Fase 7). Não tocar no caminho LIQUID.
- `apps/web/prisma/schema.prisma` — `model LandingPage` (L250: `kind`, `templateId` soft-ref, `markupSnapshot`, `values`, `folderId`), `model Template` (L209: `kind`, `id` == prefixo S3), `model BrandConfig` (L230: `logoUrl`, `primaryColor`, `whatsapp`; `workspaceId @unique`). **Migration aditiva para a rota de entrada.**

### Assets herdados — Serving isolado + tema (Fase 7)
- `apps/web/src/app/serve/[tplId]/[[...path]]/route.ts` — handler de serving na origem isolada (stream do S3, validação de token, fallback de rota → `index.html`). **Ponto de injeção do `<style>` de marca no `index.html` servido.**
- `apps/web/src/lib/serve/serve-vite-spa.ts` — lógica de serving + guard `assertViteSpaKind`. **Provável lar do helper de injeção de tema compartilhado.**
- `apps/web/src/lib/serve/token.ts` — mint/verify do serve token HMAC (escopo `{workspaceId, templateId}`, TTL). Reusar para a URL do iframe da LP.
- `apps/web/src/app/w/[slug]/project-templates/[id]/preview/page.tsx` — página RSC de preview com iframe `sandbox="allow-scripts"` cross-origin. Molde para o preview da **LP** VITE_SPA.
- `apps/web/src/lib/project-templates/s3-upload.ts` — convenção de chave S3 `workspaces/{wId}/project-templates/{templateId}/dist/{path}` + MIME map; `Template.id` == prefixo S3.

### Assets herdados — Export + brand config
- `apps/web/src/app/api/lps/[lpId]/export/route.ts` — rota de export atual (LIQUID: ZIP `index.html` + assets, CSP `script-src 'none'`). **Branch por `kind` aqui (D-10/D-12).**
- `apps/web/src/lib/brand/actions.ts` + `apps/web/src/lib/brand/schema.ts` — leitura/escrita do `BrandConfig`. Fonte do `primaryColor` para `--primary` (D-05).
- `apps/web/src/lib/db/tenant-db.ts` — `TenantClient`, scoping por `workspace_id` + RLS (toda query de LP/template/brand passa por aqui).
- `apps/web/src/lib/auth/permissions.ts` — `requireWorkspaceRole`/`can()` (autorização das actions de geração/edição/export e do minting de token).
- `.planning/phases/07-isolated-serving-sandboxed-preview/07-CONTEXT.md` — decisões D-01..D-08 da Fase 7 (subdomínio por template, token HMAC, fallback de rota, guard recíproco) que esta fase consome.

### Alvo de aceitação v2.0
- `renova-turismo-jornada-main/` (raiz do repo) — projeto Lovable real **multi-rota** (rotas em `src/App.tsx`: `/`, `/grecia`, `/turquia`, `/marrocos`, ...). Alvo do PRJ-12 / SC5: cadastrar `dist/`, gerar LP por rota, preview isolado, tematizar, exportar — coexistindo com o Liquid Grécia.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `generateLpAction`/`duplicateLpAction`/`updateLpAction` (`lib/lps/actions.ts`): já fazem persistência tenant-scoped de `LandingPage` — estender com branch `kind=VITE_SPA` (sem markup, com `entryRoute`).
- Serving da Fase 7 (`app/serve/.../route.ts`, `lib/serve/serve-vite-spa.ts`, `lib/serve/token.ts`): origem isolada + token + fallback de rota **já funcionam**; a LP só precisa mintar token e apontar o iframe para `{tplId}` + path da rota.
- Página de preview da Fase 7 (`project-templates/[id]/preview/page.tsx`): molde direto para o preview da LP VITE_SPA (`lps/[lpId]/preview/page.tsx` já existe para LIQUID — espelhar o branch).
- Rota de export (`api/lps/[lpId]/export/route.ts`) com `archiver`: branch por `kind` para empacotar a árvore `dist/`.
- `BrandConfig.primaryColor`: única fonte do tema MVP (`--primary`).

### Established Patterns
- Guard de tipo **bidirecional**: `renderLp()` rejeita VITE_SPA; serving VITE_SPA rejeita LIQUID (`assertViteSpaKind`). A geração/export devem respeitar o mesmo branch — nada de cruzar caminhos.
- `workspaceId` **sempre** derivado da sessão server-side; nunca do payload do cliente.
- `Template.id` == prefixo S3 do `dist/` — o lookup de serving/export resolve direto, sem tabela extra.
- LIQUID **snapshota** (markup no momento da geração); VITE_SPA **referencia live** (template dist + brand atual). Dois modelos de fidelidade convivendo na mesma tabela `LandingPage`, discriminados por `kind`.
- Tema injetado por `<style>` prepended no `index.html` — reaproveitável entre serve/preview/export via um único helper (evitar drift preview≠export).

### Integration Points
- `generateLpAction` (branch VITE_SPA) ↔ `LandingPage` (nova coluna `entryRoute`) ↔ `Template` VITE_SPA (referência live ao `dist/`).
- Preview da LP VITE_SPA ↔ origem isolada da Fase 7 (token HMAC + iframe sandbox).
- Helper de injeção de `--primary` ↔ serve handler + preview + export route (3 consumidores, 1 fonte = `BrandConfig`).
- Export route (branch por `kind`) ↔ S3 (`dist/` do template) + `archiver` (ZIP) + `<style>` assado.
- Catálogo/cards/pastas/tags (Fase 5) ↔ LPs VITE_SPA (sem mudança — coexistência por `kind`).

</code_context>

<specifics>
## Specific Ideas

- O usuário esclareceu que o **caso de uso normal** do PageForge é ZIP de **uma LP só** (página na raiz `/`); projetos com várias LPs dentro (multi-rota) são exceção — por isso a rota assume `/` por padrão e o campo de path é opcional, aparecendo só quando relevante.
- O usuário não conhecia os conceitos de "rota" nem "tema snapshot vs live"; após explicação com o `renova-turismo` (prédio com vários apartamentos = rotas) e o exemplo de mudar a cor da marca, escolheu **path digitado** e **tema ao vivo**.
- Export deve sair **auto-contido e já tematizado** ("assar a marca no ZIP") — quem abre o ZIP vê a LP com a cor da marca sem depender do PageForge.
</specifics>

<deferred>
## Deferred Ideas

- **Detecção/sugestão automática de rotas** a partir do bundle `dist/` — melhoria de UX futura; fora do MVP por fragilidade (D-02).
- **Tema além de `--primary`** (paleta completa, logo, WhatsApp como vars/injeção) — v2.1.
- **Edição por formulário do conteúdo Lovable** (manifesto/patch/rebuild) — já roteado para v2.1 no PROJECT.md (depende de build server-side).

</deferred>

---

*Phase: 8-lp-generation-brand-theming-export-v2-0-acceptance*
*Context gathered: 2026-06-22*
