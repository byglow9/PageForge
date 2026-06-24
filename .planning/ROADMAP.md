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

Override em runtime: edições de conteúdo viram overrides `{path→valor}` por LP, reaplicados após o React montar no serve e no export. Detalhes do design: `~/.claude/plans/centralizar-horizontalmente-o-conte-do-bright-valley.md`.

- [ ] **Fase 9: Modelo de overrides + runtime de aplicação** — schema de overrides em `LandingPage.values`; shim de apply (texto + cor por LP); serve e export injetam overrides JSON + shim. Verificável "semeando" overrides via action, sem UI.
  - Requisitos: OVR-01, OVR-02, OVR-03, EDIT-06
  - Sucesso: (1) override de texto semeado aparece na preview após mount; (2) override de cor por LP sobrescreve o brand do workspace; (3) export ZIP contém os mesmos overrides (preview==export); (4) overrides escopados por LP (não vazam entre LPs).
- [ ] **Fase 10: Editor visual in-iframe (texto)** — injeção de modo edição autorizada; click-to-select + edição inline de texto; `postMessage` → Server Action de save; descartar edição.
  - Requisitos: EDIT-01, EDIT-02, EDIT-03, EDIT-07
  - Sucesso: (1) owner/admin/editor entra em modo edição na preview; (2) clicar num texto seleciona com destaque; (3) editar inline + salvar persiste e reflete; (4) cancelar descarta sem persistir.
- [ ] **Fase 11: Imagens + links** — troca de imagem (upload S3 presigned / URL) e edição de `href` em âncoras, com validação de URL.
  - Requisitos: EDIT-04, EDIT-05
  - Sucesso: (1) trocar imagem por upload reflete na preview e no export; (2) trocar imagem por URL válida funciona; (3) editar `href` de um `<a>` persiste; (4) URLs inválidas/`javascript:` rejeitadas.
- [ ] **Fase 12: Hardening + aceitação** — `MutationObserver` re-apply (sem loop), detecção de drift por hash, sanitização server-side, isolamento por LP/cross-tenant, fidelidade preview==export.
  - Requisitos: OVR-04, OVR-05, SEC-01, SEC-02, SEC-03
  - Sucesso: (1) overrides sobrevivem a re-render do React; (2) drift (template alterado) ignora override em vez de aplicar errado; (3) modo edição bloqueado p/ viewer e ausente no host público/export; (4) valores sanitizados (sem XSS); (5) LP de outro workspace inacessível (cross-tenant).

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
