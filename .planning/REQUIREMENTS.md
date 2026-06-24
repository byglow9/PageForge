# Requirements: PageForge — Milestone v2.1

**Milestone:** v2.1 — Editor visual de conteúdo para LPs VITE_SPA (override em runtime)
**Core value:** Editar o conteúdo de uma LP gerada de template VITE_SPA (texto, imagem, link, cor) sem código e sem rebuild — preenchendo a lacuna que hoje só permite editar nome/rota.

> Pesquisa de domínio diferida (limite de sessão dos subagentes em 2026-06-24). Requisitos derivados do design técnico aprovado (`~/.claude/plans/centralizar-horizontalmente-o-conte-do-bright-valley.md`) e do conhecimento do codebase (serve/export/render/theme/forms já mapeados).

## v2.1 Requirements

### Edição visual (EDIT)
- [ ] **EDIT-01**: Usuário com papel owner/admin/editor pode entrar em "modo edição" na preview de uma LP VITE_SPA.
- [ ] **EDIT-02**: Usuário pode clicar em um elemento da LP para selecioná-lo para edição (com destaque visual da seleção).
- [ ] **EDIT-03**: Usuário pode editar o texto de um elemento selecionado inline e salvar.
- [ ] **EDIT-04**: Usuário pode trocar uma imagem (upload via S3 presigned ou URL) e salvar.
- [ ] **EDIT-05**: Usuário pode editar o destino (`href`) de um link/botão âncora e salvar.
- [ ] **EDIT-06**: Usuário pode definir uma cor primária por LP que sobrescreve a cor do workspace (Brand Settings).
- [ ] **EDIT-07**: Usuário pode descartar/cancelar uma edição não salva antes de persistir.

### Overrides em runtime (OVR)
- [ ] **OVR-01**: Edições de conteúdo são armazenadas como overrides por LP (em `LandingPage.values`), isoladas por LP.
- [ ] **OVR-02**: Overrides salvos são reaplicados na preview (serve) após o SPA montar (preview reflete a edição).
- [ ] **OVR-03**: Overrides salvos são reaplicados no export ZIP (garantia preview == export).
- [ ] **OVR-04**: Overrides persistem de forma resiliente a re-renders do React (reaplicação via `MutationObserver`, sem loop).
- [ ] **OVR-05**: Detecção de drift — se o template mudou e o nó não corresponde mais (hash do conteúdo original), o override é ignorado em vez de aplicado no nó errado.

### Segurança / hardening (SEC)
- [ ] **SEC-01**: Modo edição restrito a owner/admin/editor e indisponível no host público e no export.
- [ ] **SEC-02**: Valores de override sanitizados/validados no servidor (texto via `textContent`; imagem/`href` por allowlist de URL http(s)/S3; bloquear `javascript:`).
- [ ] **SEC-03**: `postMessage` entre iframe e dashboard usa allowlist de origem; overrides isolados cross-tenant (escopo workspace/RLS).

## Future Requirements (diferido)
- Edição de conteúdo vindo de backend Supabase em runtime (não está no DOM estático).
- Reconfigurar ação de botões com handler JS (não `<a href>`).
- Edição de layout/estrutura (mover/remover seções) — fora do escopo de "override de conteúdo".
- Histórico/versionamento de edições e undo multi-passo.

## Out of Scope (v2.1)
| Item | Razão |
|------|-------|
| Build server-side / rebuild do bundle | Override em runtime não exige rebuild; build em sandbox segue fora (herança da v2.0 D1-A) |
| Editor para conteúdo de backend (Supabase) | Não está no DOM estático do bundle; fora do alcance de override de DOM |
| Page-builder (criar/mover seções, drag-and-drop de layout) | v2.1 é edição de CONTEÚDO de elementos existentes, não construção de página |
| Ações de botão via JS (não-âncora) | Override de DOM só alcança `href` de `<a>` |

## Traceability
| Requirement | Phase | Status |
|-------------|-------|--------|
| OVR-01 | Phase 9 | Pending |
| OVR-02 | Phase 9 | Pending |
| OVR-03 | Phase 9 | Pending |
| EDIT-06 | Phase 9 | Pending |
| EDIT-01 | Phase 10 | Pending |
| EDIT-02 | Phase 10 | Pending |
| EDIT-03 | Phase 10 | Pending |
| EDIT-07 | Phase 10 | Pending |
| EDIT-04 | Phase 11 | Pending |
| EDIT-05 | Phase 11 | Pending |
| OVR-04 | Phase 12 | Pending |
| OVR-05 | Phase 12 | Pending |
| SEC-01 | Phase 12 | Pending |
| SEC-02 | Phase 12 | Pending |
| SEC-03 | Phase 12 | Pending |
