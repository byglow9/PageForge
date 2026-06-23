# Roadmap: PageForge

## Overview

PageForge delivers its core value — generate a complete, layout-faithful landing page by filling a form, no code — through a schema-centric pipeline. The journey starts where the risk and leverage concentrate: a UI-less spike that proves the token **parser → schema → merge/render** engine against the real "Grécia" travel template, locking the engine decision (LiquidJS vs. logic-less substitution) and baking SSTI/XSS safety in from the first line. Multi-tenancy lands next as an un-retrofittable foundation (workspace isolation + RBAC). On top of those two foundations we build template authoring with all six field types and global brand config, then the end-to-end generation experience (dynamic form, repeaters, image assets, preview, edit, duplicate, export). The final phase adds catalog organization and proves the whole loop by authoring, generating, previewing, editing, duplicating, and exporting the Grécia LP end to end — the v1 acceptance anchor.

**Milestone v2.0 — Suporte a LPs do Lovable (templates de projeto React/Vite).** A v2.0 adiciona um segundo tipo de template ao lado do LiquidJS: projetos React/Vite exportados do Lovable. A tensão central é o modelo de confiança — a v1 nunca executava JS de terceiros; um projeto Lovable exige build. A decisão load-bearing (D1-A) **remove esse risco do milestone**: a v2.0 aceita apenas o `dist/` **pré-buildado** (o usuário roda `vite build` localmente e sobe o ZIP), eliminando toda a superfície de RCE de `npm install`/`vite build`. O foco de segurança desloca-se então para **servir** código de terceiros com segurança: origem isolada do dashboard + iframe sandbox (D4, não-retrofitável) e isolamento cross-tenant do `dist/`. A editabilidade fica restrita a brand CSS vars (D2, template opaco); build server-side + form-driven editing ficam para a v2.1. O percurso: (6) ingestão + discriminador de tipo + coexistência no catálogo → (7) serving isolado + preview sandboxed → (8) geração de LP por rota + tema + export, provados de ponta a ponta com o projeto `renova-turismo` coexistindo com o template Liquid Grécia.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Core Engine (Parser + Merge)** - UI-less spike proving token parsing and safe static-HTML merge against the real Grécia template; locks the engine decision. (completed 2026-06-02)
- [x] **Phase 2: Multi-Tenancy Foundation** - Auth, workspaces, RBAC, and per-workspace isolation across every table and storage path. (completed 2026-06-17 — UAT 9/10 pass, 1 skipped; Tests 7 & 10 closed)
- [x] **Phase 3: Template Authoring + Brand Config** - Author markup templates with all six field types (incl. repeaters) and configure reusable global brand/contact values. (completed 2026-06-08 — UAT 6/6)
- [x] **Phase 4: LP Generation, Assets, Preview & Export** - Schema-driven dynamic form (with repeater add/remove + image upload) producing previewable, editable, duplicable, exportable static-HTML LPs. (completed 2026-06-17 — validated end-to-end by Phase 5 Grécia acceptance UAT 18/18)
- [x] **Phase 5: Catalog & Grécia Acceptance** - Folders, categories, and browse/search over LPs, validated by the full Grécia end-to-end loop. (completed 2026-06-17)

### Milestone v2.0 — Suporte a LPs do Lovable

- [x] **Phase 6: Project-Template Ingestion + Type Coexistence** - Cadastrar um projeto Lovable como template VITE_SPA via upload do `dist/` pré-buildado (validado + escaneado + isolado por workspace), coexistindo com templates LIQUID no catálogo. (sem serving ainda) (completed 2026-06-19 — PRJ-01/02/03/11; human UAT approved)
- [ ] **Phase 7: Isolated Serving + Sandboxed Preview** - Servir e pré-visualizar o `dist/` do tenant em origem isolada do dashboard, com iframe sandbox e isolamento cross-tenant — a decisão de origem não-retrofitável (D4).
- [ ] **Phase 8: LP Generation, Brand Theming, Export & v2.0 Acceptance** - Gerar LPs de templates VITE_SPA (rota de entrada + tema por brand CSS vars), exportar ZIP do `dist/`, e provar o fluxo completo com `renova-turismo` coexistindo com o Liquid Grécia.

## Phase Details

### Phase 1: Core Engine (Parser + Merge)
**Goal**: Prove the highest-risk component — `parse(markup) → Schema` and `render(markup, values, brand) → static HTML` — works correctly and safely against the real Grécia template, with zero UI.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: TPL-02, TPL-04, GEN-05, GEN-06
**Success Criteria** (what must be TRUE):
  1. Given the real Grécia markup, the parser emits a typed schema that correctly detects all six field types, repeater blocks (9-day itinerary, repeated cards), and global tokens — verifiable from test output.
  2. Given the Grécia markup plus hand-written values, the merge engine produces complete, layout-faithful static HTML, correctly iterating repeaters for 0, 1, and N items.
  3. SSTI payloads (e.g. `{{constructor.constructor('return 1')()}}`, `{{__proto__}}`) render inert (literal/empty), with no `eval`/`compile` on user markup — proven by a payload test corpus.
  4. Every field type fuzzed with XSS payloads (`"><img src=x onerror=...>`, `javascript:`, malformed color/URL) produces inert HTML via context-aware escaping; rich text is sanitized to a strict tag allowlist.
**Plans**: 6 plans (3 original + 3 gap-closure)
**KEY DECISION GATE**: RESOLVIDO (D-10, 2026-06-01) — engine = LiquidJS v10.27.0 com outputEscape:'escape' + ownPropertyOnly:true.

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Scaffold (package.json, tsconfig, vitest.config) + schema Zod + stubs do engine + teste e2e RED

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Parser + compiler + renderer implementados + fixture Grécia + testes parser/renderer/golden-file

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-03-PLAN.md — Sanitizadores reais (sanitize-html, sanitizeUrl, sanitizeCssColor) + corpus de segurança 60 testes (10 payloads × 6 contextos)

### Phase 2: Multi-Tenancy Foundation
**Goal**: Establish workspaces, authentication, and role-based access with isolation enforced at a layer that cannot be forgotten — before any scoped data exists.
**Mode:** mvp
**Depends on**: Nothing (orthogonal to Phase 1; can run in parallel but gates all persistence)
**Requirements**: WS-01, WS-02, WS-03, WS-04, WS-05
**Success Criteria** (what must be TRUE):
  1. A user can sign up, log in, and create a workspace.
  2. A workspace owner can invite members by email, and members are assigned roles (admin/editor/viewer) that gate permitted actions.
  3. A user in workspace A cannot read or edit workspace B's templates, LPs, brand config, or assets by ID — proven by per-endpoint cross-tenant access tests.
  4. Tenant context is derived from the server session only (never client-supplied), and `workspace_id` scoping is enforced at the data layer with an RLS backstop.
**Plans**: 8 plans (3 original + 5 gap-closure)
**Verification score**: UAT 9/10 passed, 1 skipped (Test 8 — server-side RBAC confirmed in code); Tests 7 and 10 closed by plans 07/08 + re-verified 2026-06-17

Plans:
**Wave 1**
- [x] 02-01-PLAN.md — Next.js app package, Prisma baseline, better-auth email/password, mandatory email verification, and auth pages

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — Explicit workspace creation, slug-derived workspace context, RBAC guards, tenant-scoped data helper, and RLS migration

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-03-PLAN.md — Copyable invitation links, account-on-accept, member role management, and final cross-tenant isolation verification

**Wave 4** *(gap closure — blocked on Wave 3 completion)*
- [x] 02-04-PLAN.md — Fix invitation email match guard (CR-01), convert acceptance to POST server action (CR-03), parameterize SET LOCAL (WR-01), extend RLS migration to real tenant tables (CR-02)

**Wave 5** *(gap closure — blocked on Wave 4 completion; [BLOCKING] schema push)*
- [x] 02-05-PLAN.md — Apply RLS migration to live DB [BLOCKING], wire members page forms to server actions (CR-04)

**Wave 6** *(gap closure — blocked on Wave 5 completion)*
- [x] 02-06-PLAN.md — Per-endpoint cross-tenant integration tests against live PostgreSQL with RLS active (SC-3)

**Wave 7** *(gap closure — parallel; both blocked on Wave 6 completion)*
- [x] 02-07-PLAN.md — AcceptButton client island: surface invitation-acceptance failure message (UAT Test 7)
- [x] 02-08-PLAN.md — Workspace listing page + post-login redirect to /workspaces (UAT Test 10)

### Phase 3: Template Authoring + Brand Config
**Goal**: Let users author and edit token-markup templates with all six field types and configure reusable global brand/contact values, persisting markup + parsed schema scoped to the workspace.
**Mode:** mvp
**Depends on**: Phase 1 (parser), Phase 2 (tenancy)
**Requirements**: TPL-01, TPL-03, TPL-05, TPL-06, BRD-01, BRD-02
**Success Criteria** (what must be TRUE):
  1. A user can create a template by writing markup with tokens; on save it is parsed into a typed schema and persisted with a `schema_version` scoped to the workspace.
  2. Each token is assigned one of the six types (text, rich text, image, color, button+URL, repeater), with parse warnings surfaced for unknown types or unclosed repeater blocks.
  3. A user can edit an existing template and see its schema re-derived; templates are listed and selectable within the workspace.
  4. A user can configure global brand/contact values (logo, primary color, WhatsApp) once per workspace, and templates can reference those globals.
**Plans**: 4 plans

Plans:
**Wave 1**
- [x] 03-01-PLAN.md — Engine wiring + shadcn bootstrap + Prisma schema (Template + BrandConfig) + TenantClient extension + Zod schemas + metadata.ts + test scaffolds (RED)

**Wave 2** *(blocked on Wave 1 — [BLOCKING] schema push)*
- [x] 03-02-PLAN.md — Prisma migrate dev --create-only, append RLS policies, prisma migrate deploy

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03-03-PLAN.md — Template authoring slice: Server Actions + workspace layout + template list/new/edit pages + TemplateEditor + SchemaPanel + TemplateCard + DeleteTemplateDialog

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 03-04-PLAN.md — Brand config slice: Server Actions + brand page + BrandConfigForm + tenant isolation test extension

### Phase 4: LP Generation, Assets, Preview & Export
**Goal**: Deliver the core promise — selecting a template generates a dynamic form whose filled values merge into a previewable, editable, duplicable, and exportable static-HTML landing page, with image upload and globals resolved automatically.
**Mode:** mvp
**Depends on**: Phase 1 (merge), Phase 3 (stored schemas + brand config)
**Requirements**: GEN-01, GEN-02, GEN-03, GEN-04, AST-01, LP-01, LP-02, LP-03, LP-04, BRD-02
**Success Criteria** (what must be TRUE):
  1. Selecting a template opens a dynamic form generated from its schema, supporting all field types and add/remove of items in repeatable blocks, with required-by-type validation on submit; globals are pre-bound from brand config.
  2. A user can upload images for image fields (validated by magic bytes, size/pixel-capped, served from a safe tenant-scoped path) and they appear correctly in the generated LP.
  3. A user can preview a rendered LP at any time, using the exact same merge pipeline as export (preview == export).
  4. A user can reopen and edit an LP's data and regenerate its HTML, and can duplicate an existing LP to create a variation (values stored as data, HTML derived).
  5. A user can export/download the LP as a self-contained HTML bundle with working asset paths and a strict CSP baked in.
**Plans**: 4 plans

Plans:
**Wave 1**
- [x] 04-01-PLAN.md — Environment setup (MinIO docker-compose, S3 env vars, file-type transpilePackages) + Prisma schema (LandingPage + LpAsset models) + [BLOCKING] db push + TenantClient extension (lp/lpAsset helpers) + lib/lps contracts (render.ts, schema.ts, schema-derive.ts)

**Wave 2** *(blocked on Wave 1 — [BLOCKING] schema push)*
- [x] 04-02-PLAN.md — Form→merge→preview vertical slice: packages (RHF, Tiptap, @hello-pangea/dnd, slugify) + lib/lps/actions.ts (generate/update/duplicate/delete/list/get) + LpForm + LpCard + LpPreview + RepeaterBlock + RichTextField + BrandGlobalsPanel + LP pages (list/picker/new/preview/edit) + sidebar nav link

**Wave 3** *(parallel — both blocked on Wave 2 completion)*
- [x] 04-03-PLAN.md — Image upload slice: @aws-sdk packages + requestPresignedUploadAction (magic-bytes + tenant-scoped path) + ImageUploadField component (drag/drop, presigned PUT, progress) + wire into LpForm
- [x] 04-04-PLAN.md — ZIP export slice: archiver + /api/lps/[lpId]/export route handler (render + S3 image download + src rewrite + CSP inject + archiver stream) + wire export triggers in LpCard and LpPreview

### Phase 5: Catalog & Grécia Acceptance
**Goal**: As a membro do workspace, I want to organizar e buscar LPs no catálogo, so that encontro e reutilizo LPs rapidamente.
**Mode:** mvp
**Depends on**: Phase 4 (LP instances exist to organize)
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04
**Success Criteria** (what must be TRUE):
  1. Generated LPs are saved to a catalog and can be organized into (nestable) folders within the workspace.
  2. A user can categorize/tag LPs and browse and search them in the catalog.
  3. The real Grécia template is authorable end to end and used to generate, preview, edit, duplicate, and export a complete LP — the v1 acceptance anchor passes.
**Plans**: 3 plans

Plans:
**Wave 1**
- [x] 05-01-PLAN.md — Folders slice: Prisma schema (Folder + Tag + LpTag + folderId on LandingPage) + [BLOCKING] db push + TenantClient folder/tag helpers + lib/catalog Server Actions (folder CRUD + LP move) + FolderTree + folder dialogs + MoveLpDialog

**Wave 2** *(blocked on Wave 1 — [BLOCKING] schema push)*
- [x] 05-02-PLAN.md — Tags + search + catalog layout slice: LpCatalogCard (folder badge + tag chips) + TagInput + CatalogSearchBar + CatalogFilterBar + two-panel lps/page.tsx restructure with client-side filtering

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 05-03-PLAN.md — Grécia acceptance: shadcn dropdown-menu install + FolderContextMenu upgrade + real Grécia template authored via Phase 3 UI + full pipeline (generate→preview→edit→duplicate→export) + gap fixes + Playwright E2E + UAT checkpoint

**Wave 1 (gap closure — UAT diagnosed)** *(independent fixes; no file overlap → parallel)*
- [x] 05-04-PLAN.md — Major catalog blockers: portalize LpCatalogCard kebab (DropdownMenu) fixing clipping (UAT 4/5/7/18) + fix deleteFolderAction snake_case SQL → Prisma updateMany (UAT 16) + generate missing Phase 5 catalog migration
- [x] 05-05-PLAN.md — Template editor double-save fix (redirect to edit after create, UAT 9) + single Save Template / single Generate LP CTA + catalog search-bar spacing (UAT 2/9)
- [x] 05-06-PLAN.md — LP form/render gaps: composite repeater keys (UAT 10) + ImageUploadField edit hydration (UAT 12) + template picker single-control (UAT 10) + <main>/dashboard padding (UAT 1) + review committed inline LpForm/renderer fixes (UAT 10/11)

### Phase 6: Project-Template Ingestion + Type Coexistence
**Goal**: Permitir cadastrar um projeto Lovable como template do tipo VITE_SPA via upload do `dist/` pré-buildado, validado, escaneado e isolado por workspace, coexistindo com os templates LIQUID no catálogo — sem ainda servir/pré-visualizar.
**Mode:** mvp
**Depends on**: Phase 5 (catálogo/pastas/tags), Phase 2 (tenancy + storage S3)
**Requirements**: PRJ-01, PRJ-02, PRJ-03, PRJ-11
**Decisions in play**: D1-A (dist pré-buildado), D3 (kind discriminator), D6 (scan de segredos)
**Success Criteria** (what must be TRUE):
  1. `Template` e `LandingPage` ganham o discriminador `kind` (LIQUID|VITE_SPA) via migração **aditiva** e RLS-aware; todas as linhas LIQUID existentes continuam funcionando sem alteração de código de leitura.
  2. O usuário faz upload do ZIP de um `dist/` pré-buildado; a validação server-side **rejeita** ZIP sem `index.html`, com entradas de path traversal (`../`), ou acima do limite de tamanho — com mensagem clara.
  3. O upload é escaneado por credenciais embutidas (JWT Supabase, `sk_live_`, chaves AWS) e por meta/scripts Lovable (`*.lovable.app`); achados são **avisados** ao usuário antes de concluir (D6).
  4. O `dist/` é armazenado sob prefixo S3 tenant-scoped não-enumerável (`workspaces/{wId}/project-templates/{templateId}/dist/`); o catálogo, pastas e tags operam para ambos os kinds, com um **badge de tipo** distinguindo VITE_SPA de LIQUID.
  5. Separação estrita de tipo (V2-11): passar um template VITE_SPA ao caminho de render LIQUID (ou vice-versa) **falha explicitamente** — coberto por teste de fronteira.
**Plans**: 2 plans

Plans:
**Wave 1**
- [x] 06-01-PLAN.md — Kind discriminator: Prisma migration (LIQUID|VITE_SPA) + renderLp() type guard + catalog UI badges
- [x] 06-02-PLAN.md — VITE_SPA ingestion: ZIP validation + secret scan + S3 upload + server action + upload UI + V2-11 type-boundary test

### Phase 7: Isolated Serving + Sandboxed Preview
**Goal**: Servir e pré-visualizar o `dist/` de projetos a partir de uma **origem isolada** do dashboard, com sandbox de iframe e isolamento cross-tenant — a decisão de origem que não pode ser refeita depois.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: PRJ-04, PRJ-05, PRJ-06
**Decisions in play**: D4 (origem isolada + iframe sandbox) — **não-retrofitável**
**Success Criteria** (what must be TRUE):
  1. O `dist/` do tenant é servido a partir de uma **origem separada** do dashboard (subdomínio/host dedicado, na raiz da origem para `base:'/'` funcionar), nunca compartilhando os cookies de sessão do PageForge.
  2. O preview embute o `dist/` via `<iframe>` cross-origin com `sandbox="allow-scripts"` (**sem** `allow-same-origin`) e CSP `frame-ancestors` restrita ao dashboard.
  3. Verificado por teste: dentro do iframe de preview, `document.cookie` **não** expõe o cookie de sessão do PageForge.
  4. As chaves/URLs de serving são não-enumeráveis e escopadas por workspace; um usuário do workspace A **não** acessa o `dist/` do workspace B — teste cross-tenant retorna 403/404.
  5. O SPA carrega na origem isolada com assets de base relativa resolvidos e **fallback de roteamento** configurado (qualquer rota → `index.html`), sem 404 de asset ou de rota.
**Plans**: 3 plans

Plans:
**Wave 1**
- [x] 07-01-PLAN.md — Serve libs: lib/serve/token.ts (HMAC-SHA256 mint/verify + createTokenUtils factory) + lib/serve/serve-vite-spa.ts (assertViteSpaKind D-08 + resolveServePath SPA fallback + getContentType MIME helper)

**Wave 2** *(parallel — both blocked on Wave 1 completion)*
- [x] 07-02-PLAN.md — Isolated serving: proxy.ts (host detection *.serve.* → rewrite) + app/serve/[tplId]/[[...path]]/route.ts (token validation + S3 stream + SPA fallback + security headers)
- [ ] 07-03-PLAN.md — Preview page + isolation tests: /w/[slug]/project-templates/[id]/preview/page.tsx (sandboxed iframe, mintServeToken server-side) + type-boundary.test.ts extension (assertViteSpaKind D-08) + SC3 human-verify checkpoint

### Phase 8: LP Generation, Brand Theming, Export & v2.0 Acceptance
**Goal**: Gerar LPs a partir de templates VITE_SPA (seleção de rota de entrada + tema de marca via CSS vars), exportá-las como ZIP do `dist/`, e provar o fluxo completo com o projeto `renova-turismo` coexistindo com o template Liquid Grécia.
**Mode:** mvp
**Depends on**: Phase 7
**Requirements**: PRJ-07, PRJ-08, PRJ-09, PRJ-10, PRJ-12
**Decisions in play**: D2 (opaco + brand CSS vars), D3 (rota = LP)
**Success Criteria** (what must be TRUE):
  1. Gerar LP de um template VITE_SPA cria uma `LandingPage` `kind=VITE_SPA` apontando para o `dist/`, com a **rota de entrada** escolhida quando o projeto é multi-rota — **sem etapa de build**.
  2. Injeção de **brand CSS vars**: as variáveis de marca do workspace (`--primary`, etc.) são aplicadas via `<style>` prepended no serve/preview/export (a editabilidade "grátis"), sem rebuild.
  3. O export gera um ZIP da árvore `dist/` (branch por `kind` na rota de export existente); a CSP estrita `script-src 'none'` do export LIQUID **não** é aplicada ao VITE_SPA (tem runtime JS próprio).
  4. O usuário pode reabrir/editar (rota, tema) e **duplicar** uma LP VITE_SPA; catálogo/pastas/tags permanecem inalterados para ambos os kinds.
  5. **Aceitação v2.0**: o `dist/` do `renova-turismo` é cadastrado, LP gerada por rota, pré-visualizada em origem isolada, tematizada por marca e exportada — tudo **coexistindo** com o template Liquid Grécia (caminho v1 intacto e verificado).
**Plans**: 5 plans

Plans:
**Wave 1**
- [x] 08-01-PLAN.md — [BLOCKING] Migration entry_route + Prisma schema entryRoute + TenantLpHelpers + GenerateViteSpaLpSchema + lib/brand/theme.ts (hexToHslTriplet + buildBrandStyleTag + injectBrandStyle)

**Wave 2** *(parallel — both blocked on Wave 1 completion)*
- [x] 08-02-PLAN.md — Geração VITE_SPA: generateViteSpaLpAction + branch VITE_SPA em generate/update/duplicate/getLp + ViteSpaLpForm component + branch na página new/[templateId]
- [x] 08-03-PLAN.md — Brand theming + preview: injeção de brand <style> no serve handler (isHtmlRequest) + branch VITE_SPA na LP preview page (iframe sandboxed com entryRoute)

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 08-04-PLAN.md — Export ZIP VITE_SPA (ListObjectsV2 + archiver + index.html tematizado + sem CSP) + branch VITE_SPA na LP edit page (ViteSpaLpForm pré-preenchido)

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 08-05-PLAN.md — Aceitação v2.0: UAT renova-turismo (generate→preview→export→edit→duplicate) + verificação de coexistência com Grécia LIQUID (checkpoint humano)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
v1.0 (Fases 1-5) concluído. v2.0 (Fases 6-8) é o milestone ativo.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Engine (Parser + Merge) | 3/3 | Complete   | 2026-06-02 |
| 2. Multi-Tenancy Foundation | 8/8 | Complete   | 2026-06-17 |
| 3. Template Authoring + Brand Config | 4/4 | Complete   | 2026-06-08 |
| 4. LP Generation, Assets, Preview & Export | 4/4 | Complete   | 2026-06-17 |
| 5. Catalog & Grécia Acceptance | 6/6 | Complete   | 2026-06-17 |
| 6. Project-Template Ingestion + Type Coexistence | 2/2 | Complete   | 2026-06-19 |
| 7. Isolated Serving + Sandboxed Preview | 0/3 | Not started | — |
| 8. LP Generation, Brand Theming, Export & v2.0 Acceptance | 3/5 | In Progress|  |
