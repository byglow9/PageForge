# Milestones

## v2.0 Suporte a LPs do Lovable (Shipped: 2026-06-24)

**Escopo:** Fases 6–8 · 10 planos

**Key accomplishments:**

- Ingestão de projeto Lovable como template **VITE_SPA**: upload do `dist/` pré-buildado (ZIP) com validação (zip-slip / zip-bomb / `index.html`), secret-scan de 5 padrões e upload S3 tenant-scoped não-enumerável (Fase 6).
- Discriminador `kind` (LIQUID|VITE_SPA) aditivo em Template/LandingPage com coexistência no catálogo/pastas/tags e separação estrita de tipo no render boundary (`renderLp()` rejeita VITE_SPA; `assertViteSpaKind()` rejeita LIQUID) (Fase 6).
- **Serving isolado** do `dist/` em origem cross-origin do dashboard (subdomínio `serve`), com token HMAC, cookies host-only e CSP `frame-ancestors` — isolamento cross-tenant por chaves não-enumeráveis + RLS (Fase 7).
- Geração de LP VITE_SPA por **rota de entrada**, **brand theming** via injeção de CSS var `--primary` no serve/preview/export (a "editabilidade grátis", sem rebuild), e **export ZIP** da árvore `dist/` (branch por `kind`, sem CSP `script-src none`) (Fase 8).
- Editar (rota/tema) e duplicar LPs VITE_SPA reaproveitando catálogo/pastas/tags (Fase 8).
- **Aceitação v2.0 (UAT 6/6):** `renova-turismo` cadastrado, LP gerada por `/grecia`, preview tematizado, export ZIP — coexistindo com o template Liquid Grécia sem regressão. (Bloco B "preview branco" corrigido — sandbox `allow-same-origin` — e verificado ao vivo em 2026-06-24.)

**Auditoria:** `passed` (12/12 requisitos PRJ, 3/3 fases, integração OK, fluxos 6/6). Ver `milestones/v2.0-MILESTONE-AUDIT.md`.

**Known deferred items at close:** 5 quick tasks órfãs antigas (estilização jun/03–17, sem SUMMARY) — ver STATE.md Deferred Items.

---

## v1.0 MVP (Shipped: 2026-06-17, registrado retroativamente)

**Escopo:** Fases 1–5 · 25 planos

**Key accomplishments:**

- **Core engine** (Fase 1): `parse(markup) → Schema` e `render(markup, values, brand) → HTML estático` seguro, provado contra o template real da Grécia com os seis tipos de campo (incl. repeaters).
- **Multi-tenancy** (Fase 2): auth, workspaces, RBAC e isolamento por workspace com RLS nas tabelas de tenant; aceitação de convites e Server Actions guardadas.
- **Autoria de template + brand** (Fase 3): editar templates de token com os seis tipos de campo e configurar valores globais de brand/contato, persistindo markup + schema parseado por workspace.
- **Geração de LP** (Fase 4): formulário dinâmico schema-driven (repeater add/remove + upload de imagem) produzindo LPs estáticas previsíveis, editáveis, duplicáveis e exportáveis (ZIP), com globals resolvidos automaticamente.
- **Catálogo + aceitação Grécia** (Fase 5): pastas, categorias e busca sobre LPs, validados pelo loop end-to-end completo da Grécia (UAT 18/18).

---
