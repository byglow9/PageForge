# Roadmap: PageForge

## Milestones

- ✅ **v1.0 MVP** — Fases 1–5 (shipped 2026-06-17)
- ✅ **v2.0 Suporte a LPs do Lovable** — Fases 6–8 (shipped 2026-06-24)
- 🚧 **v2.1 Editor visual de conteúdo VITE_SPA** — Fases 9–12 (em planejamento)

Detalhes completos das fases arquivadas: `milestones/v2.0-ROADMAP.md`.

## Phases

<details>
<summary>✅ v1.0 MVP (Fases 1–5) — SHIPPED 2026-06-17</summary>

- [x] **Fase 1: Core Engine (Parser + Merge)** (3/3) — 2026-06-02
- [x] **Fase 2: Multi-Tenancy Foundation** (8/8) — 2026-06-17
- [x] **Fase 3: Template Authoring + Brand Config** (4/4) — 2026-06-08
- [x] **Fase 4: LP Generation, Assets, Preview & Export** (4/4) — 2026-06-17
- [x] **Fase 5: Catalog & Grécia Acceptance** (6/6) — 2026-06-17

Core value v1: gerar LP estática fiel ao layout preenchendo um formulário, sem código — provado end-to-end com a Grécia (LIQUID).

</details>

<details>
<summary>✅ v2.0 Suporte a LPs do Lovable (Fases 6–8) — SHIPPED 2026-06-24</summary>

- [x] **Fase 6: Project-Template Ingestion + Type Coexistence** (2/2) — 2026-06-19
- [x] **Fase 7: Isolated Serving + Sandboxed Preview** (3/3) — 2026-06-23
- [x] **Fase 8: LP Generation, Brand Theming, Export & v2.0 Acceptance** (5/5) — 2026-06-24

Adiciona o tipo de template **VITE_SPA** (projeto React/Vite do Lovable via `dist/` pré-buildado): ingestão validada/escaneada, serving isolado + preview sandboxed, geração por rota + brand theming + export ZIP — coexistindo com o LIQUID. Aceitação `renova-turismo` (UAT 6/6). Auditoria `passed` (`milestones/v2.0-MILESTONE-AUDIT.md`).

</details>

### 🚧 v2.1 Editor visual de conteúdo VITE_SPA (Fases 9–12)

Override em runtime: edições de conteúdo (texto, imagem, link, cor) viram overrides `{path, originalHash, type, value}` por LP, reaplicados após o React montar no serve e no export. Abordagem de runtime é a única que funciona em SPA já compilado (conteúdo está no JS bundle, não nos templates). Limitações declaradas: botões com ação via handler JS (não `<a href>`) e conteúdo vindo do Supabase em runtime não são editáveis por override de DOM. Design completo: `~/.claude/plans/centralizar-horizontalmente-o-conte-do-bright-valley.md`.

- [ ] **Phase 9: Modelo de overrides + runtime de aplicação** — Schema de overrides em `LandingPage.values`; shim de apply (texto + cor por LP) injetado no serve e no export; verificável semeando overrides via `updateLpAction`, sem UI de editor.
- [ ] **Phase 10: Editor visual in-iframe (texto)** — Injeção de modo edição autorizada (owner/admin/editor); click-to-select + edição inline de texto; `postMessage` → Server Action de save; descartar edição.
- [ ] **Phase 11: Imagens + links** — Troca de imagem (upload S3 presigned / URL) e edição de `href` em âncoras, com validação de URL.
- [ ] **Phase 12: Hardening + aceitação** — `MutationObserver` re-apply sem loop; detecção de drift por `originalHash`; sanitização server-side; isolamento por LP e cross-tenant; fidelidade preview==export; aceitação v2.1.

## Phase Details

### Phase 9: Modelo de overrides + runtime de aplicação
**Goal**: Estabelecer o modelo de dados de overrides por LP e o runtime de reaplicação no serve/export — sem UI de editor. Overrides `{path, originalHash, type, value}` armazenados em `LandingPage.values` (reutilizando o campo `jsonb` ocioso para VITE_SPA, sem migração); shim de apply de texto e cor injetado no `index.html` no serve route e no export route (branch VITE_SPA). Verificável semeando overrides via `updateLpAction`.
**Depends on**: Phase 8
**Requirements**: OVR-01, OVR-02, OVR-03, EDIT-06
**Success Criteria** (what must be TRUE):
  1. Um override de texto semeado (via `updateLpAction`, sem UI) aparece refletido na preview após o SPA montar — o shim aplicou o valor ao nó correto por path.
  2. Um override de cor por LP sobrescreve a cor do workspace (Brand Settings) na preview — a cor da LP tem precedência sobre o brand do workspace.
  3. O export ZIP contém os mesmos overrides aplicados que a preview (preview == export); o HTML exportado não depende do serve ao ser aberto offline.
  4. Overrides de LP A não aparecem em LP B do mesmo workspace; LP de workspace diferente não acessa os overrides (isolamento cross-tenant verificado por teste).
**Plans**: 2 plans
Plans:
- [x] 09-01-PLAN.md — Override schema (PfOverride/ViteSpaValues), updateLpAction VITE_SPA extension, buildBrandStyleTagForLp
- [ ] 09-02-PLAN.md — Apply shim module + injection into serve route and export route
**UI hint**: yes

### Phase 10: Editor visual in-iframe (texto)
**Goal**: Habilitar a edição visual inline de textos dentro da preview da LP VITE_SPA (que roda em iframe cross-origin), com controle de acesso por papel, feedback visual de seleção, persistência via Server Action e descarte de edição não salva.
**Depends on**: Phase 9
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-07
**Success Criteria** (what must be TRUE):
  1. Um usuário com papel owner, admin ou editor vê o botão/controle de "modo edição" na preview da LP VITE_SPA e pode ativá-lo; um viewer não vê o controle e não consegue ativar o modo edição.
  2. No modo edição ativo, clicar em um elemento de texto da LP o seleciona com destaque visual claro — o elemento está pronto para edição.
  3. Após editar o texto de um elemento selecionado e salvar, a mudança persiste (override gravado via Server Action) e a preview reflete o novo texto após re-mount do SPA.
  4. Cancelar/descartar uma edição antes de salvar não persiste nenhum valor — o conteúdo original é restaurado e nenhum override parcial é gravado.
**Plans**: TBD
**UI hint**: yes

### Phase 11: Imagens + links
**Goal**: Completar a cobertura de tipos de elemento editáveis: trocar imagens (via upload S3 presigned ou URL externa) e editar o destino (`href`) de links/botões âncora, com validação de URL no servidor antes de persistir o override.
**Depends on**: Phase 10
**Requirements**: EDIT-04, EDIT-05
**Success Criteria** (what must be TRUE):
  1. O usuário pode selecionar uma imagem da LP, fazer upload de uma nova via S3 presigned (reutilizando o mecanismo existente), e a nova imagem aparece na preview e no export ZIP — o override de imagem persiste e é reaplicado.
  2. O usuário pode selecionar uma imagem da LP e substituí-la por uma URL externa válida (http/https); a imagem substituta aparece corretamente na preview e no export.
  3. O usuário pode selecionar um `<a>` da LP, editar seu `href` e salvar; o novo destino persiste (override de link) e o link abre para o endereço correto na preview e no export.
  4. Tentar salvar uma URL de imagem ou `href` contendo `javascript:`, protocolo não-http(s) ou URL malformada é rejeitado com erro — nenhum override inválido é persistido.
**Plans**: TBD
**UI hint**: yes

### Phase 12: Hardening + aceitação
**Goal**: Tornar o editor resiliente e seguro para uso em produção: overrides sobrevivem a re-renders do React via `MutationObserver`, drift detectado por `originalHash` (template alterado ignora override em vez de aplicar errado), valores sanitizados server-side, modo edição isolado por papel e ausente no host público/export, isolamento cross-tenant verificado — culminando na aceitação v2.1 end-to-end.
**Depends on**: Phase 11
**Requirements**: OVR-04, OVR-05, SEC-01, SEC-02, SEC-03
**Success Criteria** (what must be TRUE):
  1. Overrides de texto, imagem e link sobrevivem a re-renders do React (o `MutationObserver` re-aplica após cada mutação do DOM) sem entrar em loop de reaplicação infinita.
  2. Quando o template VITE_SPA é atualizado e o nó original não corresponde mais ao `originalHash` salvo, o override é ignorado silenciosamente em vez de ser aplicado no nó errado — nenhum conteúdo incorreto aparece na preview/export.
  3. O modo edição está disponível apenas para owner/admin/editor no contexto autenticado do dashboard; viewers e visitantes do host público (serve cross-origin) não veem nenhum controle de edição; o HTML exportado não contém código do editor.
  4. Valores de override sanitizados no servidor: texto extraído via `textContent` (sem HTML arbitrário), URLs de imagem/`href` validadas por allowlist de protocolo http(s)/S3 — `javascript:` e protocolos não-permitidos são rejeitados antes de persistir.
  5. **Aceitação v2.1**: um usuário edita texto, imagem e link de uma LP `renova-turismo` via editor visual, exporta o ZIP e verifica que o HTML exportado reflete todas as edições — preview == export, sem regressão no fluxo LIQUID (Grécia).
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Core Engine (Parser + Merge) | v1.0 | 3/3 | Complete | 2026-06-02 |
| 2. Multi-Tenancy Foundation | v1.0 | 8/8 | Complete | 2026-06-17 |
| 3. Template Authoring + Brand Config | v1.0 | 4/4 | Complete | 2026-06-08 |
| 4. LP Generation, Assets, Preview & Export | v1.0 | 4/4 | Complete | 2026-06-17 |
| 5. Catalog & Grécia Acceptance | v1.0 | 6/6 | Complete | 2026-06-17 |
| 6. Project-Template Ingestion + Type Coexistence | v2.0 | 2/2 | Complete | 2026-06-19 |
| 7. Isolated Serving + Sandboxed Preview | v2.0 | 3/3 | Complete | 2026-06-23 |
| 8. LP Generation, Brand Theming, Export & v2.0 Acceptance | v2.0 | 5/5 | Complete | 2026-06-24 |
| 9. Modelo de overrides + runtime de aplicação | v2.1 | 0/? | Not started | — |
| 10. Editor visual in-iframe (texto) | v2.1 | 0/? | Not started | — |
| 11. Imagens + links | v2.1 | 0/? | Not started | — |
| 12. Hardening + aceitação | v2.1 | 0/? | Not started | — |
