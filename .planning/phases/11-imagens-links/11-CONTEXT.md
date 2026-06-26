# Phase 11: Imagens + links - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Completar a cobertura de tipos editáveis do editor visual VITE_SPA: **trocar imagens** (`<img>`) e **editar o destino (`href`) de links/botões âncora** (`<a>`), com **validação de URL server-side** antes de persistir. Cobre EDIT-04 (imagem) e EDIT-05 (href). Pluga no shell do editor da Fase 10 (seleção, postMessage, toolbar com slot por-tipo reservado em D-04, salvar em lote via `updateLpAction`) e estende o modelo de override da Fase 9 (`type` já é `enum(["text","color","image","href"])`).

**ENTRA:**
- Seleção de `<img>` e de `<a href>` no modo edição (estende o detector de elementos do edit-script, que hoje só pega text-leaf).
- Troca de imagem: **upload via S3 presigned (reusando o mecanismo existente) OU URL externa** — num painel único.
- Edição do `href` de `<a>` via campo de URL no slot reservado da toolbar.
- Override `type:'image'` (value = URL final da imagem) e `type:'href'` (value = URL destino), gerados pelo edit-script e persistidos via `updateLpAction`.
- **Extensão do apply-shim** (Fase 9) para aplicar `image` (set `<img src>`) e `href` (set `<a href>`) — hoje ambos são "silently skipped".
- **Validação de URL server-side** (SEC-02) em `updateLpAction`: imagem só http(s)/S3; href só http/https; bloquear `javascript:`/`data:`/malformada; pré-validação no cliente para feedback instantâneo, servidor autoritativo.
- Imagem trocada aparece na preview e no **export ZIP**.

**NÃO ENTRA:**
- Texto (Fase 10), cor por-LP na UI (EDIT-06 — dado/aplicação já da Fase 9; UI adiada).
- Reconfigurar ação de botões via handler JS (não-âncora) — fora do roadmap (só `<a href>` é alcançável por override de DOM).
- Reposicionar/mover elementos — backlog.
- **MutationObserver / re-apply em re-render, detecção de drift por `originalHash`, sanitização completa e aceitação E2E → Fase 12.** A extensão do apply-shim para tratar `image`/`href` é Fase 11; o *timing* de reaplicação em SPA client-rendered (DOMContentLoaded roda antes do React montar) é a Fase 12 (mesmo limite do texto na Fase 10).
</domain>

<decisions>
## Implementation Decisions

### Troca de imagem (EDIT-04)
- **D-11-01:** A troca de imagem usa um **painel único** que oferece, juntos, **"Enviar arquivo" (upload S3 presigned)** e um **campo "ou cole uma URL"** (URL externa http(s)). Reutilizar `ImageUploadField.tsx` / `s3-upload.ts` / fluxo presigned existente. O painel abre a partir do **slot por-tipo reservado na toolbar** (D-04 da Fase 10) quando um `<img>` está selecionado.
- **D-11-04 (export):** Imagens de **upload S3** são **baixadas para `./assets`** no ZIP com `src` reescrito relativo (self-contained — Mode b do CLAUDE.md, consistente com o export atual). Imagens de **URL externa** **mantêm a URL absoluta** no HTML exportado (não baixar conteúdo de terceiros).

### Edição de link / href (EDIT-05)
- **D-11-02:** Ao selecionar um `<a>`, surge um **campo de URL na toolbar** (slot reservado) para editar o `href`. **Editar o TEXTO do link e editar o DESTINO (href) são fluxos separados** — não misturar os dois tipos de override no mesmo gesto. Selecionável = **apenas `<a href>`** (inclui botões estilizados como âncora). Override `type:'href'`, value = nova URL.

### Validação de URL (SEC-02, SC4)
- **D-11-03:** **Imagem:** value aceito = **http(s) ou S3** apenas (deve ser uma URL de imagem). **href:** **http/https apenas** (decisão: NÃO permitir mailto:/tel:/relativo nesta fase — manter allowlist mínima). Ambos **bloqueiam `javascript:`, `data:` e protocolos não-http(s)** e URLs malformadas. **Pré-validação no cliente** (feedback instantâneo, erro inline no controle) + **validação server-side autoritativa** em `updateLpAction` (a validação do servidor é a que conta — cliente é só UX). Nenhum override inválido é persistido.

### Claude's Discretion
- Mecânica de detecção de `<img>` / `<a>` no edit-script e geração de `path`/`originalHash` compatível com o apply-shim (mesma convenção da Fase 9/10 — `pathToNode` idêntico).
- Forma exata de aplicar `image`/`href` no apply-shim (`pathToNode(path).src = value` / `.href = value` via atributo, NUNCA innerHTML), e a reescrita de `src` no export route.
- Onde exatamente plugar o painel de imagem e o campo href no slot da toolbar (`ViteSpaPreviewEditor`), e o shape das novas mensagens postMessage para imagem/href.
- Implementação concreta da validação de URL (lib vs regex/URL parser) no servidor e no cliente — desde que o servidor seja autoritativo e bloqueie `javascript:`/`data:`.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pontos de hook (código existente — reusar/estender)
- `apps/web/src/lib/overrides/apply-shim.ts` — runtime de reaplicação (Fase 9). **Estender** para `type==='image'` (set `src`) e `type==='href'` (set `href`); hoje ambos caem no "silently skipped" (linha ~156).
- `apps/web/src/lib/overrides/edit-script.ts` — IIFE in-iframe (Fase 10). **Estender** o detector (`isTextLeaf`) para também selecionar `<img>` e `<a>`, e emitir overrides `image`/`href` via postMessage.
- `apps/web/src/app/w/[slug]/lps/[lpId]/preview/ViteSpaPreviewEditor.tsx` — parent/dashboard (Fase 10). **Plugar** o painel de imagem (upload+URL) e o campo de href no **slot por-tipo reservado** (D-04). Novos handlers de mensagem para imagem/href.
- `apps/web/src/lib/lps/actions.ts` — `updateLpAction` (branch VITE_SPA). **Adicionar validação de URL** (SEC-02) para overrides `image`/`href` antes de persistir.
- `apps/web/src/lib/lps/schema.ts` — `PfOverrideSchema` (`type` já inclui `image`/`href`) / `SaveViteSpaOverridesSchema`. Possível endurecer a validação de `value` por `type`.
- `apps/web/src/lib/project-templates/s3-upload.ts` + `apps/web/src/components/lps/ImageUploadField.tsx` — mecanismo de **upload S3 presigned existente** a reutilizar (SC1).
- `apps/web/src/app/api/lps/[lpId]/export/route.ts` — **export ZIP** (branch VITE_SPA); onde a imagem trocada deve entrar (baixar upload S3 → `./assets`, reescrever `src`; URL externa fica absoluta).

### Design, roadmap e segurança
- `.planning/ROADMAP.md` — Phase 11 (Goal + Success Criteria 1–4; EDIT-04/EDIT-05).
- `.planning/REQUIREMENTS.md` — EDIT-04, EDIT-05, **SEC-02** (override sanitizado/validado server-side; allowlist http(s)/S3; bloquear `javascript:`); tabela de restrições (botões via JS não alcançáveis).
- `.planning/phases/10-editor-visual-in-iframe-texto/10-CONTEXT.md` — decisões do shell do editor (D-04: toolbar arquitetada para extensão; slot por-tipo; postMessage/seleção).
- `.planning/phases/10-editor-visual-in-iframe-texto/10-HUMAN-UAT.md` — **dependência Fase 12** registrada (Bug C): apply-shim aplica em `DOMContentLoaded` antes do React montar → `image`/`href` terão o mesmo limite de reaplicação visual em SPA real; o fix (`MutationObserver`) é Fase 12, NÃO trazer para a Fase 11.
- `.planning/phases/09-modelo-de-overrides-runtime-de-aplica-o/09-CONTEXT.md` — modelo de override (path, hash, enum extensível, cross-origin/postMessage).
- `~/.claude/plans/centralizar-horizontalmente-o-conte-do-bright-valley.md` — design completo do milestone v2.1.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Upload S3 presigned** (`ImageUploadField.tsx`, `s3-upload.ts`): mecanismo de upload já pronto — SC1 manda reutilizar para a troca de imagem.
- **Shell do editor (Fase 10)**: seleção, canal postMessage com allowlist de origem, toolbar com **slot por-tipo reservado (D-04)**, salvar em lote via `updateLpAction`, descartar. Imagem/link plugam sem retrabalho.
- **Modelo de override (Fase 9)**: `type` já é `enum(["text","color","image","href"])` — sem mudança de schema no enum; `updateLpAction` já persiste `overrides[]` com RBAC + tenancy.
- **apply-shim (Fase 9)**: convenção de `path`/`pathToNode` + reaplicação — só falta o ramo `image`/`href`.

### Established Patterns
- **Injeção condicional no serve route** (apply-shim + edit-script só em modo edição/papel) — imagem/href seguem o mesmo runtime já injetado.
- **Override aplicado por atributo, nunca innerHTML** (T-09-02-02 / T-10-02-05) — `image`/`href` via `.src`/`.href`/`setAttribute`.
- **Export self-contained (archiver, reescrita de assets relativos)** — a imagem trocada via S3 entra por esse mesmo caminho.

### Integration Points
- edit-script (iframe) detecta `<img>`/`<a>` → emite override `image`/`href` via postMessage → `ViteSpaPreviewEditor` (parent) → `updateLpAction` (valida URL) → `LandingPage.values`.
- apply-shim aplica `image`/`href` no serve (preview) e no export (mesma estratégia).
</code_context>

<specifics>
## Specific Ideas

- Painel de imagem deve mostrar upload E campo de URL **juntos** (não em abas) — menos cliques.
- Para LP de turismo, o cenário típico é trocar fotos de destino (upload) e ajustar o `href` do botão "Reservar"/"Reserve agora".
- Allowlist de href deliberadamente **mínima** (só http/https) nesta fase — mailto:/tel:/relativo ficam fora por ora (podem virar deferred se surgir necessidade real).
</specifics>

<deferred>
## Deferred Ideas

- **href com mailto:/tel:/relativo** — allowlist mais ampla para botões "ligar"/"email"/links internos. Fora desta fase (allowlist mínima decidida); reconsiderar em fase futura se houver demanda.
- **Baixar imagens de URL externa para o ZIP** (export 100% self-contained de terceiros) — decidido manter URL externa absoluta; revisitar se exportações precisarem ser totalmente offline.
- **Reconfigurar ação de botões via JS** (não-âncora) — fora do roadmap (override de DOM só alcança `<a href>`).
- **MutationObserver / re-apply timing para SPA client-rendered** — Fase 12 (afeta texto, imagem e href igualmente).

### Reviewed Todos (not folded)
None — discussion stayed within phase scope.
</deferred>

---

*Phase: 11-Imagens + links*
*Context gathered: 2026-06-26*
