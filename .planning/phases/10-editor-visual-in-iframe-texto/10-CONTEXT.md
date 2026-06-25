# Phase 10: Editor visual in-iframe (texto) - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Editor visual inline de **TEXTO** dentro da preview de uma LP VITE_SPA, que roda em **iframe cross-origin**. Cobre EDIT-01 (entrar/sair do modo edição, gated por papel), EDIT-02 (clicar elemento → selecionar com destaque visual), EDIT-03 (editar texto inline e salvar via Server Action) e EDIT-07 (descartar edição não salva). O override gerado reutiliza o modelo da Fase 9 (`{path, originalHash, type:'text', value}` em `LandingPage.values`), persistido via `updateLpAction`, e reaplicado pelo apply-shim da Fase 9.

**ENTRA:** modo edição com toggle; injeção de um script de edição no iframe (em modo edição); click-to-select de elementos de texto com feedback visual; edição in-place (contentEditable) no iframe; geração do `path`/`originalHash` do nó; comunicação iframe↔dashboard via `postMessage` (allowlist de origem); acúmulo de edições + salvar em lote via `updateLpAction`; descartar revertendo ao original; gating por papel (owner/admin/editor vê e ativa; viewer não).

**NÃO ENTRA:** imagem (EDIT-04) e link/href (EDIT-05) → Fase 11; controle de cor por LP na UI (EDIT-06; dado/aplicação já existem da Fase 9) → adiado p/ Fase 11; reposicionar/mover elementos → fora do roadmap (backlog); MutationObserver re-apply, detecção de drift por `originalHash`, sanitização completa server-side e aceitação E2E → Fase 12.
</domain>

<decisions>
## Implementation Decisions

### Entrar/sair do modo edição (EDIT-01)
- **D-01:** Controle do modo edição fica numa **barra de ferramentas acima da preview, no dashboard (fora do iframe)** — botão "Editar" ↔ "Concluir". A tela sinaliza o modo ativo com **banner/borda destacando a preview**. (Cross-origin: o toggle vive no parent; o iframe recebe a ativação por postMessage.)
- **D-02:** Gating por papel: **owner/admin/editor** veem e ativam o modo edição; **viewer** não vê o controle nem consegue ativar. Reusar o RBAC já existente (`can(role, ...)` / `requireWorkspaceRole`), resolvido server-side.

### Seleção do elemento (EDIT-02)
- **D-03:** Apenas **elementos de texto (folhas)** são selecionáveis nesta fase. Feedback visual: **outline ao passar o mouse (hover)** + **realce forte no elemento selecionado**.
- **D-04:** A "casca" do modo edição (seleção, toolbar, canal postMessage, salvar/descartar) deve ser **arquitetada para extensão**: imagem/link (Fase 11) e um controle de cor plugam depois **sem retrabalho** — o enum `type` do override já prevê `image`/`href`.

### Edição do texto (EDIT-03)
- **D-05:** Edição **in-place dentro do iframe** (script injetado torna o elemento selecionado `contentEditable`), WYSIWYG fiel ao layout. O valor editado **sobe do iframe para o dashboard via `postMessage`** (allowlist de origem) e o dashboard persiste via `updateLpAction`.

### Salvar e descartar (EDIT-03 / EDIT-07)
- **D-06:** Modelo **em lote**: várias edições são acumuladas e um botão **"Salvar alterações"** persiste tudo de uma vez via `updateLpAction`. **"Descartar"** reverte os elementos não salvos ao conteúdo original e **não persiste nada** (EDIT-07).
- **D-07:** Após salvar, a preview reflete o novo texto **após re-mount do SPA** + reaplicação do apply-shim (consistente com Success Criteria #3 do ROADMAP). Decidir no planning se é reload do iframe ou reaplicação otimista — preferir o caminho que garanta preview==export.

### Claude's Discretion
- Mecânica exata de cálculo do `path` do nó (índice de filhos a partir da raiz) e do `originalHash` — deve casar **exatamente** com o que o apply-shim da Fase 9 espera (ler `apply-shim.ts`). Researcher/planner definem.
- Protocolo concreto das mensagens `postMessage` (shape, tipos de evento, handshake) e a allowlist de origem (derivada do host de serve cross-origin).
- Como injetar o script de edição **só em modo edição** e **só para papéis autorizados** (provável parâmetro no serve route, análogo ao apply-shim), sem expor o modo edição no host público/export.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pontos de hook (código existente)
- `apps/web/src/app/serve/[tplId]/[[...path]]/route.ts` — serve route cross-origin; onde o apply-shim + brand são injetados no index.html. Ponto provável de injeção do **script de edição** (condicionado a modo edição + papel). **Atenção ao O-2 abaixo.**
- `apps/web/src/lib/overrides/apply-shim.ts` — runtime de reaplicação da Fase 9; o editor deve gerar `path`/`originalHash` **compatíveis** com o que este shim consome (mesma convenção de path do DOM).
- `apps/web/src/lib/lps/actions.ts` — `updateLpAction` (branch VITE_SPA) já persiste `{overrides, primaryColorOverride}` em `LandingPage.values`; o editor chama esta action para salvar.
- `apps/web/src/lib/lps/schema.ts` — `PfOverrideSchema` / `SaveViteSpaOverridesSchema` (shape do override que o editor produz).
- `apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx` — página que embute o iframe da preview; onde mora a toolbar do modo edição (parent).
- `apps/web/src/lib/workspaces/guards.ts` — `requireWorkspaceRole` / `can()` para o gating de papel (owner/admin/editor).

### Design, roadmap e segurança
- `.planning/ROADMAP.md` — Phase 10 (Goal + Success Criteria 1–4; requisitos EDIT-01/02/03/07).
- `.planning/REQUIREMENTS.md` — EDIT-01, EDIT-02, EDIT-03, EDIT-07 (e o mapa EDIT-04/05/06 → Fases 11/9).
- `.planning/phases/09-modelo-de-overrides-runtime-de-aplica-o/09-CONTEXT.md` — decisões travadas do modelo de override (path, hash, enum extensível, cross-origin/postMessage).
- `.planning/phases/09-modelo-de-overrides-runtime-de-aplica-o/09-SECURITY.md` — **Observação O-2 (dependência crítica):** o serve route pode estar lendo a `landing_page` como **zero linhas** sob RLS (`servingRead` não concede `serving_read` a `landing_page`), o que faria a preview não carregar a LP. Como a Fase 10 inteira vive na preview do serve route, **isto precisa ser confirmado/resolvido** antes ou no início da fase. Candidato a `/gsd-debug`.
- `~/.claude/plans/centralizar-horizontalmente-o-conte-do-bright-valley.md` — design completo do milestone v2.1 (arquitetura do editor, postMessage, pitfalls cross-origin).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **apply-shim da Fase 9** (`apply-shim.ts`): convenção de `path` do DOM + reaplicação de overrides já implementada e testada — o editor é o "lado de escrita" do mesmo modelo.
- **`updateLpAction` (VITE_SPA)**: já valida e grava `overrides[]` em `values` com RBAC + tenancy. O editor reusa essa action no salvar; não precisa de nova persistência.
- **RBAC** (`can()` / `requireWorkspaceRole`): gating de papel já pronto.
- **Componentes de shell/UI** (Card, toolbar patterns, `cn`, lucide-react) para a barra do modo edição no dashboard.

### Established Patterns
- **Injeção condicional no serve route**: o apply-shim já é injetado no index.html; o script de edição segue o mesmo padrão, mas **condicionado a modo edição + papel autorizado** (não deve aparecer no host público/export).
- **Cross-origin via postMessage com allowlist**: decisão de design do v2.1; iframe e dashboard não compartilham DOM.

### Integration Points
- Toolbar do modo edição na página de preview (parent) ↔ script de edição no iframe (serve route) via `postMessage`.
- Script de edição → gera override `{path, originalHash, type:'text', value}` → dashboard → `updateLpAction` → `LandingPage.values`.
</code_context>

<specifics>
## Specific Ideas
- A "casca" do editor deve nascer **multi-tipo-ready**: embora a Fase 10 só edite texto, a seleção/toolbar/postMessage/salvar devem acomodar imagem e link (Fase 11) e um futuro controle de cor sem reescrever a base.
- Verificação alinhada aos Success Criteria do ROADMAP: viewer não vê o controle; clicar texto destaca; editar+salvar persiste e reflete após re-mount; descartar não persiste nada.
</specifics>

<deferred>
## Deferred Ideas
- **Imagem (EDIT-04) e link/href (EDIT-05)** → Fase 11. A casca do editor desta fase deve prepará-los.
- **Controle de UI de cor por LP (EDIT-06)** → adiado (dado + aplicação já existem da Fase 9); usuário optou por deixar para a Fase 11.
- **Reposicionar/mover elementos** → fora do roadmap atual; capacidade nova → backlog.
- **Hardening (MutationObserver re-apply, drift por originalHash, sanitização server-side completa, aceitação E2E)** → Fase 12.
</deferred>

---

*Phase: 10-editor-visual-in-iframe-texto*
*Context gathered: 2026-06-25*
