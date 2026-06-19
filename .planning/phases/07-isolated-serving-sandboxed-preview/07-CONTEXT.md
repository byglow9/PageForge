# Phase 7: Isolated Serving + Sandboxed Preview - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Servir e pré-visualizar o `dist/` de templates `VITE_SPA` (já ingeridos na Fase 6) a partir de uma **origem isolada** do dashboard, com `<iframe>` sandbox e isolamento cross-tenant. Esta fase entrega a decisão de origem **não-retrofitável** (D4): o limite de segurança no navegador que impede o JS de terceiros de roubar o cookie de sessão do PageForge.

**Em escopo:** origem isolada de serving; route handler que serve os bytes do `dist/`; autorização da origem isolada; fallback de roteamento SPA; preview embutido via iframe sandbox; isolamento cross-tenant verificado por teste; guard recíproco de tipo (LIQUID nunca entra no caminho VITE_SPA).

**Fora de escopo (outras fases):** geração de LP por rota, tema por brand CSS vars, export ZIP do `dist/`, aceitação v2.0 end-to-end → **Fase 8**. Build server-side, edição por formulário → v2.1 (já em Out of Scope no PROJECT.md).
</domain>

<decisions>
## Implementation Decisions

### Origem isolada (D4 — não-retrofitável)
- **D-01:** Formato da origem = **subdomínio por template** — cada template `VITE_SPA` é servido de um host próprio (`{tplHash}.serve.<domínio>`), com o SPA na **raiz** desse host. Razão load-bearing: os projetos Lovable são buildados com `base:'/'`, então `index.html` e os chunks do Vite referenciam assets por caminho **absoluto** (`/assets/...`). Só servindo na raiz da própria origem esses caminhos resolvem sem remendo — atende ao critério do roadmap *"na raiz da origem para `base:'/'` funcionar"*. Bônus: isolamento mais forte (origin distinto até entre tenants), não só vs dashboard.
- **D-02:** Wildcard (`*.serve.<domínio>`) para os hosts de serving. Em produção o wildcard cert é provisionado automaticamente em plataformas modernas (Vercel/Cloudflare); em dev usar `*.localhost` (resolvido nativamente pelo Chrome) ou `lvh.me`/`nip.io` para obter uma origem cross-origin **real** localmente. **Nenhuma compra de domínio adicional** além do domínio do próprio PageForge — a origem isolada é um subdomínio dele.
- **D-03:** A origem isolada **nunca** compartilha o cookie de sessão do dashboard (premissa central da D4). Isso é consequência direta de ser host/origin diferente; o serving não deve setar nem ler cookies de sessão do PageForge.

### Como os bytes são servidos
- **D-04:** Um **route handler na origem isolada faz stream do S3** (`GetObject`) e devolve os bytes com `Content-Type` correto. O bucket **não** é exposto publicamente nem via presigned/CDN. O handler resolve a chave S3 a partir do `templateId` (lembrar: `Template.id` == prefixo S3, planejado na Fase 6 para este lookup): `workspaces/{wId}/project-templates/{tplId}/dist/{path}`. Enforcement de isolamento e fallback de rota ficam **100% no servidor**.

### Autorização da origem isolada
- **D-05:** **Token assinado/efêmero emitido pelo dashboard.** Como a origem isolada não tem sessão, o dashboard minta uma URL com token assinado (HMAC) com escopo `{workspaceId, templateId}` e expiração. A origem valida assinatura + expiração + escopo antes de servir. Tentativa cross-tenant (workspace A acessando template de B) → token inválido → **403** (e path/chave inexistente → 404). Isso satisfaz o critério "cross-tenant retorna 403/404" com autorização real, não só obscuridade de chave.

### Preview no dashboard + fallback
- **D-06:** **Rota/página dedicada de preview** no dashboard (ex: `/w/{slug}/project-templates/{id}/preview`) que embute o `<iframe>` cross-origin apontando para a origem isolada, com `sandbox="allow-scripts"` (**sem** `allow-same-origin`) e CSP `frame-ancestors` restrita ao dashboard. Padrão consistente com a futura geração da Fase 8.
- **D-07:** Fallback de roteamento SPA = **rota desconhecida → `index.html`**; **asset realmente ausente** (`.js`/`.css`/imagem com extensão) → **404**. A distinção (fallback de rota vs 404 de asset) é feita no route handler de serving (D-04).

### Guard recíproco de tipo
- **D-08:** Implementar o guard recíproco da separação estrita de tipo (V2-11): o caminho de serving/preview VITE_SPA deve **rejeitar explicitamente** um template `LIQUID` (espelho do `renderLp()` que já rejeita `VITE_SPA`). Coberto por teste de fronteira.

### Claude's Discretion
- Mecânica exata do roteamento por host (middleware Next vs config de host) e do dev cross-origin (`*.localhost` vs `lvh.me`/`nip.io`) — researcher escolhe e valida contra o alvo de deploy; recomendação atual é confirmar B contra o ambiente de produção real antes de travar detalhes de infra.
- Algoritmo/segredo de assinatura do token (HMAC-SHA256 etc.), TTL exato e formato da URL — definir no PLAN.
- Onde inicializar o `S3Client` singleton da origem isolada e como reutilizar o cliente existente das actions da Fase 6.
- Estrutura exata dos `Content-Type` (reusar/estender o MIME map de `s3-upload.ts`).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decisões travadas / requisitos
- `.planning/PROJECT.md` §Key Decisions — D4 (origem isolada + iframe sandbox, não-retrofitável), D1-A (só `dist/` pré-buildado), D2 (opaco + brand CSS vars), D3 (1 projeto = 1 template, rota = LP), D6 (scan de segredos / fronteira de backend).
- `.planning/REQUIREMENTS.md` — **PRJ-04** (serving em origem isolada), **PRJ-05** (iframe `sandbox="allow-scripts"` sem `allow-same-origin` + CSP `frame-ancestors`), **PRJ-06** (isolamento cross-tenant, chaves não-enumeráveis). PRJ-11 (separação estrita de tipo) para o guard recíproco.
- `.planning/ROADMAP.md` §Phase 7 — Goal + 5 Success Criteria (incl. "na raiz da origem para `base:'/'` funcionar" e teste de `document.cookie`).

### Assets de serving herdados da Fase 6
- `apps/web/src/lib/project-templates/s3-upload.ts` — convenção de chave S3 `workspaces/{wId}/project-templates/{templateId}/dist/{fileName}`, MIME map por extensão, `Template.id` == prefixo S3 (lookup de serving). **Ponto de partida do route handler.**
- `apps/web/src/lib/project-templates/actions.ts` — `createProjectTemplateAction`, init do `S3Client`, derivação de `workspaceId` server-side (nunca do cliente).
- `apps/web/src/lib/lps/render.ts` — `renderLp()` com guard que rejeita `VITE_SPA`; espelhar o recíproco aqui (D-08).
- `apps/web/tests/type-boundary.test.ts` — padrão de teste de fronteira de tipo a estender.
- `.planning/phases/06-project-template-ingestion-type-coexistence/06-RESEARCH.md` — notas de serving (linhas ~376, ~434, ~699: prefixo não-enumerável, guard recíproco, `Template.id` = prefixo).

### Integração existente
- `apps/web/src/app/api/lps/[lpId]/export/route.ts` — padrão de route handler que lê do S3 + injeta CSP (referência para branch-por-kind na Fase 8; aqui informa o padrão de handler/stream).
- `apps/web/src/lib/auth/permissions.ts` — `requireWorkspaceRole`/`can()` (autorização no lado dashboard que minta o token).
- `apps/web/src/lib/db/tenant-db.ts` — `TenantClient`, scoping por `workspace_id` + RLS.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `s3-upload.ts`: convenção de chave S3 + MIME map já existem — o route handler de serving reusa exatamente o mesmo prefixo para fazer `GetObject`.
- `S3Client` já inicializado em `lib/project-templates/actions.ts` (e `lib/lps/actions.ts` para assets) — reaproveitar o singleton.
- `export/route.ts` já demonstra route handler lendo do S3 e manipulando headers/CSP — molde para o handler de serving e para o CSP `frame-ancestors` do preview.
- `permissions.ts` (`requireWorkspaceRole`) — usado no lado dashboard para autorizar a emissão do token assinado.

### Established Patterns
- `Template.id` é deliberadamente igual ao prefixo S3 (`{templateId}`) — o lookup de serving resolve direto de `template.id`, sem tabela extra.
- `workspaceId` **sempre** derivado da sessão server-side; nunca do payload do cliente (mantido aqui no minting do token).
- Guard de tipo bidirecional: `renderLp()` rejeita `VITE_SPA`; o serving VITE_SPA deve rejeitar `LIQUID` (simétrico, testado).
- App monolítico Next (`apps/web`) — a "origem isolada" precisa ser realizada por host/subdomínio distinto, não por um app separado; roteamento por host (middleware/host-config) é o ponto a definir na pesquisa.

### Integration Points
- Novo route handler de serving (origem isolada) ↔ S3 (`GetObject` no prefixo da Fase 6).
- Nova rota de preview no dashboard ↔ origem isolada (via `<iframe>` + URL com token assinado).
- Emissão do token assinado (dashboard, autorizado por `requireWorkspaceRole`) ↔ validação do token (origem isolada).
- Catálogo/cards de template VITE_SPA (Fase 6) ↔ ação "Preview" que leva à rota dedicada.

</code_context>

<specifics>
## Specific Ideas

- O usuário inicialmente não conhecia o conceito de "origem"/cross-origin; a decisão B (subdomínio por template) foi escolhida após explicação de que `base:'/'` dos builds Lovable exige o SPA na raiz da origem — alinhado ao critério já escrito no roadmap.
- Preferência por **não** exigir compra de domínio para dev: usar `*.localhost`/`lvh.me`/`nip.io` para origem cross-origin real local; MinIO já cobre o S3 local. O teste de `document.cookie` (SC3) deve passar nesse setup local.
</specifics>

<deferred>
## Deferred Ideas

None — discussão permaneceu dentro do escopo da fase. (Geração por rota, tema por brand CSS vars e export ZIP já estão roteados para a Fase 8; build server-side / edição por formulário para v2.1.)

</deferred>

---

*Phase: 7-isolated-serving-sandboxed-preview*
*Context gathered: 2026-06-19*
