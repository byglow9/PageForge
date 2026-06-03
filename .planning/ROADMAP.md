# Roadmap: PageForge

## Overview

PageForge delivers its core value — generate a complete, layout-faithful landing page by filling a form, no code — through a schema-centric pipeline. The journey starts where the risk and leverage concentrate: a UI-less spike that proves the token **parser → schema → merge/render** engine against the real "Grécia" travel template, locking the engine decision (LiquidJS vs. logic-less substitution) and baking SSTI/XSS safety in from the first line. Multi-tenancy lands next as an un-retrofittable foundation (workspace isolation + RBAC). On top of those two foundations we build template authoring with all six field types and global brand config, then the end-to-end generation experience (dynamic form, repeaters, image assets, preview, edit, duplicate, export). The final phase adds catalog organization and proves the whole loop by authoring, generating, previewing, editing, duplicating, and exporting the Grécia LP end to end — the v1 acceptance anchor.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Core Engine (Parser + Merge)** - UI-less spike proving token parsing and safe static-HTML merge against the real Grécia template; locks the engine decision. (completed 2026-06-02)
- [ ] **Phase 2: Multi-Tenancy Foundation** - Auth, workspaces, RBAC, and per-workspace isolation across every table and storage path.
- [ ] **Phase 3: Template Authoring + Brand Config** - Author markup templates with all six field types (incl. repeaters) and configure reusable global brand/contact values.
- [ ] **Phase 4: LP Generation, Assets, Preview & Export** - Schema-driven dynamic form (with repeater add/remove + image upload) producing previewable, editable, duplicable, exportable static-HTML LPs.
- [ ] **Phase 5: Catalog & Grécia Acceptance** - Folders, categories, and browse/search over LPs, validated by the full Grécia end-to-end loop.

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
**Plans**: 3 plans
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
**Plans**: 3 plans

Plans:
**Wave 1**
- [ ] 02-01-PLAN.md — Next.js app package, Prisma baseline, better-auth email/password, mandatory email verification, and auth pages

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 02-02-PLAN.md — Explicit workspace creation, slug-derived workspace context, RBAC guards, tenant-scoped data helper, and RLS migration

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 02-03-PLAN.md — Copyable invitation links, account-on-accept, member role management, and final cross-tenant isolation verification

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
**Plans**: TBD (1-3 plans)
**UI hint**: yes

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
**Plans**: TBD (1-3 plans)
**UI hint**: yes

### Phase 5: Catalog & Grécia Acceptance
**Goal**: Organize generated LPs into a browsable, searchable catalog and prove the full pipeline by authoring, generating, previewing, editing, duplicating, and exporting the real Grécia LP end to end.
**Mode:** mvp
**Depends on**: Phase 4 (LP instances exist to organize)
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04
**Success Criteria** (what must be TRUE):
  1. Generated LPs are saved to a catalog and can be organized into (nestable) folders within the workspace.
  2. A user can categorize/tag LPs and browse and search them in the catalog.
  3. The real Grécia template is authorable end to end and used to generate, preview, edit, duplicate, and export a complete LP — the v1 acceptance anchor passes.
**Plans**: TBD (1-3 plans)
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Engine (Parser + Merge) | 3/3 | Complete   | 2026-06-02 |
| 2. Multi-Tenancy Foundation | 0/TBD | Not started | - |
| 3. Template Authoring + Brand Config | 0/TBD | Not started | - |
| 4. LP Generation, Assets, Preview & Export | 0/TBD | Not started | - |
| 5. Catalog & Grécia Acceptance | 0/TBD | Not started | - |
