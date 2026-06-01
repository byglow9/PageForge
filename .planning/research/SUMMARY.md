# Project Research Summary

**Project:** PageForge
**Domain:** Multi-tenant template-driven static-HTML landing-page generator SaaS (token markup + dynamic form + merge → static HTML; beachhead = travel/tourism agencies)
**Researched:** 2026-06-01
**Confidence:** HIGH

## Executive Summary

PageForge is a **form-driven content-fill engine over hand-authored templates** — *not* a drag-and-drop visual builder. Experts build this category as a **schema-centric pipeline**: a parser turns token markup into a typed schema, the schema drives an auto-generated dynamic form, the filled values merge back into the markup, and the result is exported as static HTML. One artifact — the **token schema** — is the contract that wires together all three product pillars (template authoring, LP generation, catalog). The closest real-world analogues are WordPress ACF/Meta Box "duplicate-the-page-and-fill-custom-fields" and headless-CMS content models, minus the visual editor. The competitive moat is **speed + guaranteed layout fidelity + clean self-contained HTML export** — precisely where visual builders (Unbounce/Instapage/Webflow) are weak.

The recommended approach is a TypeScript full-stack monolith (Next.js App Router 16 + Postgres 16 `jsonb` + Prisma + Zod + React Hook Form `useFieldArray` for repeaters + better-auth's organization plugin for workspaces/RBAC). The single load-bearing decision is the **rendering/merge engine**, because it executes **user-authored (untrusted) markup**. Two credible engine strategies emerged from research and **they conflict** — this is the most important open decision (see Gaps): STACK recommends **LiquidJS** (a real, no-eval template engine with native `{% for %}` loops, designed for Shopify's untrusted-template threat model), while ARCHITECTURE and PITFALLS lean toward a **logic-less Mustache-style substitution engine** (closed token grammar: substitute + iterate repeaters + escape, nothing else) to shrink the SSTI attack surface to near zero. Both avoid the catastrophic anti-pattern (EJS/Pug/Handlebars/`eval` on user markup → RCE); they differ on whether to trust a hardened general engine or build a deliberately minimal one.

The dominant risk profile is **security of untrusted input**, not feature complexity. The five must-design-from-day-one risks are: SSTI→RCE via the token engine, stored XSS from filled values in the *customer's shipped page*, mutation-XSS via rich text, multi-tenant leakage (dropped `workspace_id`/IDOR), and image-upload abuse (SVG XSS, polyglots, bombs). The repeater field type is simultaneously the product's keystone differentiator and a top engineering hazard (schema drift, 0/1/N rendering, nested escaping). Two architectural constraints are non-negotiable and un-retrofittable: **multi-tenancy must be in migration #1** (`workspace_id` everywhere + RLS backstop), and **the canonical state is `markup + values + brand_config`** — generated HTML is a reproducible cache, never the source of truth.

## Key Findings

### Recommended Stack

A single TypeScript codebase (Next.js App Router) hosts the dashboard, the dynamic form UI, server-side rendering for preview, and the export endpoints — keeping all merge/render of untrusted templates server-side. Postgres `jsonb` stores the per-template schema and per-LP filled values (no rigid column-per-field), with relational integrity for tenancy/RBAC/catalog. See `STACK.md` for full version matrix and installation. The one cross-document tension is the engine choice (LiquidJS vs. logic-less substitution) — captured under Gaps.

**Core technologies:**
- **Next.js (App Router) 16.2.7 + TypeScript 5.x** — full-stack framework; keeps untrusted-template rendering server-side, RSC powers preview as a server render — dominant TS SaaS default.
- **PostgreSQL 16+ + Prisma 7.8.0** — relational tenancy/RBAC + `jsonb` schema/values hybrid; type-safe ORM feeds the whole pipeline (Drizzle is the SQL-first alternative).
- **LiquidJS 10.27.0** *(STACK recommendation)* — no-eval, no-FS engine with native `{% for %}` repeaters; **contested** by ARCHITECTURE/PITFALLS which prefer a logic-less custom substitution engine — open decision.
- **Zod 4.4.3 + React Hook Form 7.77.0 (`useFieldArray`)** — schema validation + dynamic form runtime; `useFieldArray` is the canonical add/remove-repeater-items solution.
- **better-auth 1.6.13** — first-class organization plugin = workspaces, members, invitations, roles out of the box (vs. hand-rolling on NextAuth).
- **Tiptap 3.24.0 + sanitize-html 2.17.4** — constrained rich-text editor + mandatory server-side allowlist sanitization.
- **@aws-sdk/client-s3 (presigned uploads) + archiver 8.0.0** — direct-to-bucket image upload (S3/R2/B2/MinIO) + streaming ZIP export of `index.html` + assets.

### Expected Features

PageForge's v1 scope maps almost 1:1 to PROJECT.md's Active requirements; the engine pipeline gates nearly everything. See `FEATURES.md` for the full landscape, dependency graph, and competitor analysis.

**Must have (table stakes):**
- Token parsing of markup → typed schema (THE engine; highest-risk component) — without it nothing works.
- Auto-generated dynamic form from schema, incl. repeater add/remove — the core UX promise.
- 6 field types: text, rich text, image upload, color, button+URL, repeater — required to express the real "Grécia" template.
- Static HTML generation (merge) + live preview (same merge path as export) + export/download.
- Edit/regenerate, duplicate LP (values stored as data, HTML is derived).
- Multi-tenant workspaces + RBAC (Admin/Editor/Viewer) + member invitation — B2B baseline, must land first.
- Global brand/contact settings per workspace; image upload + storage; catalog with folders + categories; template authoring/validation UI.

**Should have (competitive):**
- Guaranteed layout fidelity (constraint-as-feature; the moat vs. free-form builders) — differentiator.
- Clean, self-contained static HTML export (where Unbounce/Instapage are weak) — differentiator.
- Global brand-kit propagation; repeater blocks with arbitrary item count; one excellent "Grécia" reference template proving the loop end-to-end.

**Defer (v2+):**
- Platform hosting / public URLs, A/B testing + analytics (depend on hosting), visual/WYSIWYG field-mapping builder, cross-workspace template marketplace, advanced validation rules, AI page generation.

### Architecture Approach

The system is a schema-centric pipeline organized by **domain module, not technical layer**, with a pure, framework-free `core/` holding the two riskiest pieces (parser, merge engine) so they can be exhaustively unit-tested against the real Grécia template before any UI exists. `platform/tenancy/` wraps every module from day one. The schema is parsed once on save, persisted alongside markup with a `schema_version`, and each LP's values are pinned to the version they were authored against. See `ARCHITECTURE.md` for the data model, patterns, and full build order.

**Major components:**
1. **Schema/Parser (`core/parser`)** — pure `parse(markup) → Schema`; detects repeaters, globals, duplicates. The motor.
2. **Render/Merge Engine (`core/render`)** — markup + values + brand config → static HTML; iterate repeaters, resolve globals, auto-escape (logic-less per ARCHITECTURE; LiquidJS per STACK — see Gaps).
3. **Form Generator (`core/form`)** — schema → form descriptor (globals pre-bound from brand config).
4. **Auth/Tenancy (`platform`)** — workspace context + RBAC + RLS backstop, cross-cutting over everything.
5. **Asset Storage, Catalog, Brand, Instances modules** — orchestrate core + persistence, thin by design.

### Critical Pitfalls

From `PITFALLS.md` — note the security risks dominate and stem from one root cause: treating user-authored markup as trusted code.

1. **SSTI → RCE via the token engine** — never feed user markup to a code-executing engine; use a closed token grammar or a no-eval engine, parse to a validated AST, render by walking it; verify `{{constructor.constructor('return 1')()}}` renders inert. *(Phase 1, the engine.)*
2. **Stored XSS in generated/exported HTML** — context-aware encoding per token type/context (text vs. attribute vs. URL vs. color); URL scheme allowlist (reject `javascript:`/`data:`); fuzz every field type and assert preview + export are inert.
3. **Multi-tenant leakage (dropped `workspace_id`/IDOR)** — enforce isolation at a layer that can't be forgotten (RLS + forced data-layer scope); derive tenant from server session only; tenant-prefix cache keys and S3 paths; test cross-tenant access per endpoint.
4. **Rich-text mutation XSS / sanitizer misconfig** — strict tag allowlist, pinned + updated sanitizer, sanitize at save AND render, strict CSP in exported HTML.
5. **Image-upload abuse + repeater schema/render bugs** — magic-byte validation + re-encode, block/sandbox SVG, separate cookieless origin, size/pixel caps; version repeater sub-schemas and render defensively for 0/1/N items.

## Implications for Roadmap

Research strongly converges on one ordering principle: **prove the engine first as a UI-less vertical spike, then build tenancy, then everything else hangs off the schema.** The critical path is parser → merge engine validated against the real Grécia template before investing in UI/catalog. Suggested phases:

### Phase 1: Core Engine — Parser + Merge (UI-less spike)
**Rationale:** Both ARCHITECTURE's build order and PITFALLS' phase mapping put this first; it is the highest-risk, highest-leverage component and gates every other feature. Build pure and framework-free so it is exhaustively testable.
**Delivers:** `parse(markup) → Schema` + `render(markup, values, brand) → static HTML` proven against the real Grécia template (9-day itinerary, repeated cards) with hand-written values — core value provable with zero UI.
**Addresses:** Token parsing, static HTML generation, repeater iteration (FEATURES table stakes).
**Avoids:** SSTI→RCE (Pitfall 1), stored XSS via context-aware escaping (Pitfall 2), repeater rendering bugs (Pitfall 7).
**KEY DECISION GATE:** Resolve LiquidJS vs. logic-less substitution engine here (see Gaps) — this choice defines the entire phase.

### Phase 2: Multi-Tenancy Foundation — Workspaces, Auth, RBAC, Data Model
**Rationale:** Un-retrofittable; must exist before any persisted, scoped data. Orthogonal to the engine, so it can run in parallel with Phase 1 if capacity allows, but it gates all persistence.
**Delivers:** Workspaces + members + roles (Admin/Editor/Viewer) + invitation flow; `workspace_id` on every table; RLS backstop + tenant-context middleware.
**Uses:** better-auth organization plugin, Postgres RLS, Prisma migrations (STACK).
**Implements:** Auth/Tenancy cross-cutting component (ARCHITECTURE Pattern 4).
**Avoids:** Multi-tenant leakage / IDOR (Pitfall 5).

### Phase 3: Template Authoring + Brand Config
**Rationale:** Persists markup + parsed schema (depends on Phase 1 parser + Phase 2 tenancy); brand config is small and needed before globals work in real LPs.
**Delivers:** Template CRUD with parse-on-save, author-time validation (unclosed repeater / unknown type surfaced), workspace-level brand/contact settings.
**Addresses:** Template management, template-level token validation, global brand settings (FEATURES).

### Phase 4: Dynamic Form Generation + LP Instances (edit / duplicate / generate)
**Rationale:** Depends on stored schemas (Phase 3) and the merge engine (Phase 1). Storing values-as-data unlocks edit, duplicate, and regenerate cheaply.
**Delivers:** Schema → form descriptor → dynamic form (incl. repeater add/remove via `useFieldArray`); LP values CRUD, generate, duplicate, edit/regenerate.
**Uses:** React Hook Form `useFieldArray`, Zod (STACK).
**Avoids:** Schema drift / version-pinning bugs (Pitfall 7), preview≠export drift (same render path).

### Phase 5: Image Field + Asset Pipeline
**Rationale:** The image field type can't be completed without upload + storage; slots alongside Phase 4 but carries its own security surface.
**Delivers:** Presigned S3-compatible upload, tenant-prefixed keys, URL resolution in HTML, magic-byte validation + re-encode, SVG handling.
**Avoids:** Image-upload abuse — SVG XSS, MIME spoof, polyglots, bombs (Pitfall 6).

### Phase 6: Preview, Export, and Render Sandboxing
**Rationale:** Preview emerges nearly free once merge works; export bundling builds on assets + instances. Sandboxing the render process pairs with the Phase 1 engine.
**Delivers:** Sandboxed-iframe preview (same pipeline as export), self-contained ZIP export (HTML + assets, relative paths, CSP), isolated render with time/memory/output caps.
**Avoids:** Unsandboxed render / SSRF / resource exhaustion (Pitfall 4), broken export asset paths, missing CSP (Pitfalls 2/4).

### Phase 7: Catalog — Folders + Categories
**Rationale:** Pure organization over existing instances; lowest risk; build late. Folders are organization-only (no per-folder permissions in v1).
**Delivers:** Folders (nestable), categories (tags), list/filter/duplicate within a workspace; "Grécia" template authored end-to-end as the validation milestone.
**Addresses:** Catalog with folders + categories (FEATURES table stakes).

### Phase Ordering Rationale

- **Engine-first, UI-less spike:** ARCHITECTURE's explicit critical path (1→2 prove the thesis) and PITFALLS' Phase-1 SSTI mapping both demand the parser+merge be proven before anything consumes it.
- **Tenancy can parallelize but must precede persistence:** every later feature is workspace-scoped; retrofitting is the classic SaaS rewrite (Pitfall 5 / Anti-Pattern 4).
- **Schema-as-contract drives grouping:** authoring (writes schema) → form/instances (read schema) → preview/export (consume merge) follows the data flow; values-as-data co-locates edit/duplicate/regenerate.
- **Security co-located with the feature that introduces the surface:** image abuse with the asset pipeline, mXSS with rich text, render sandboxing with preview/export — each pitfall maps to the phase that creates its risk.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Core Engine):** The LiquidJS-vs-logic-less decision is unresolved across documents; needs a focused `/gsd-research-phase` to pick the engine, define the token grammar/syntax (incl. repeater + global syntax), and the AST/escaping security model. Highest-risk, highest-ambiguity phase.
- **Phase 5 (Image pipeline):** Upload security is detailed in PITFALLS but the safe re-encode/validation toolchain and CDN-origin setup may warrant a short spike.
- **Phase 6 (Render sandboxing/export):** Process-isolation approach (worker vs. container), egress lockdown, and self-contained ZIP asset-rewriting have MEDIUM-confidence sources — verify the chosen approach.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Multi-tenancy/RBAC):** Well-documented (better-auth org plugin + Postgres RLS); HIGH-confidence sources.
- **Phase 4 (Dynamic form):** `useFieldArray` + Zod is the canonical, documented pattern.
- **Phase 7 (Catalog):** Standard scoped CRUD; lowest risk.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core stack, templating/sandbox, form-gen verified via Context7 + official docs + npm registry; MEDIUM on image-storage variant and rich-text editor choice. |
| Features | HIGH | PROJECT.md scope is explicit; competitor patterns confirmed across multiple comparison + official-docs sources; v1 maps 1:1 to Active requirements. |
| Architecture | HIGH | Core structure is a well-understood schema+merge pattern; verified against template-engine, dynamic-form, multi-tenant RLS, and SSTI security sources. |
| Pitfalls | HIGH | Security pitfalls verified against OWASP, PortSwigger, published CVEs/advisories; a few domain-specific rendering pitfalls are MEDIUM (reasoned analysis + issue trackers). |

**Overall confidence:** HIGH

### Gaps to Address

- **Engine choice (LiquidJS vs. logic-less substitution) — THE open decision.** STACK argues LiquidJS is purpose-built for untrusted templates (no eval/FS), gives native `{% for %}` repeaters and filters for free, and reuses a proven, audited parser instead of hand-rolled code you must secure yourself. ARCHITECTURE/PITFALLS argue a **logic-less, data-only substitution engine** (closed token grammar: substitute + iterate + escape, nothing else) minimizes SSTI surface to near zero and keeps the schema contract clean — at the cost of building and maintaining the parser yourself. **Trade-offs:** LiquidJS = less code to own, richer authoring, but a (small, well-modeled) expression surface you must lock down (disable FS tags, cap loops/output, pass values as context never concatenate); custom grammar = maximal safety + full control, but you own the lexer/parser/escaping and must implement repeater/global semantics from scratch. Resolve this at the start of Phase 1; both paths must pass the same SSTI/XSS payload test corpus. Either is defensible — decide based on team appetite for owning parser security vs. hardening a third-party engine.
- **Schema-change vs. existing-LP reconciliation:** version templates and pin LP values to `schema_version`; define whether editing a template freezes the old schema or migrates LPs. Decide the policy in Phase 3/4.
- **Global values: snapshot vs. live at generate time:** document whether brand/contact changes propagate to past LPs on regenerate. Decide in Phase 4 (UX pitfall).
- **Export image mode:** reference S3 URLs vs. self-contained ZIP with rewritten relative paths — research leans ZIP for portability; confirm in Phase 6.
- **MEDIUM-confidence stack picks:** image-storage variant (R2/B2/S3) and rich-text editor (Tiptap vs. Lexical) — low-risk, validate during implementation.

## Sources

### Primary (HIGH confidence)
- `/harttle/liquidjs` (Context7) — LiquidJS "simple, expressive and safe", isomorphic, native `{% for %}` + filters.
- npm registry (2026-06-01) — current versions for next, prisma, zod, react-hook-form, tiptap, sanitize-html, archiver, aws-sdk, better-auth, liquidjs, drizzle.
- OWASP — Testing for SSTI; Multi-Tenant Security Cheat Sheet.
- PortSwigger — SSTI Web Security Academy; mutation-XSS DOMPurify bypass research.
- PayloadsAllTheThings / HackTricks / Black Hat (Kettle) — SSTI→RCE corpus.
- CVE-2025-26791 + DOMPurify advisories — rich-text mXSS arms race.
- AWS / PostgreSQL RLS — multi-tenant data isolation.
- ACF Repeater / Meta Box / JetEngine official docs — repeater + duplicate-and-fill pattern.
- WorkOS / Auth0 — multi-tenant RBAC (Admin/Editor/Viewer per tenant, invitation).
- SVG/file-upload advisories (Plane, Budibase, ImageTragick) — upload abuse.

### Secondary (MEDIUM confidence)
- arxiv.org/html/2405.01118v1 "A Survey of the Overlooked Dangers of Template Engines" — prefer no-code-execution engines over sandboxed-JS.
- hacefresko.com — LiquidJS SSTI requires concatenating user input into the template string (the one anti-pattern to avoid).
- disse.cting.org — Nunjucks sandbox breakout (basis for avoiding Nunjucks as trust boundary).
- Unbounce / Instapage / Carrd / Prismic comparisons — weak HTML export in visual builders.
- Plasmic / Builder.io docs — typed content models / headless export pattern.
- SurveyJS — JSON schema → dynamic form rendering.
- Nile / InstaTunnel — Postgres RLS GUC pattern + connection-pool contamination.
- Next.js static-export asset-path issue #8158 — export path gotchas.

### Tertiary (LOW confidence)
- npmtrends archiver/fflate/jszip comparison — archiver as standard server-side streaming ZIP (validate at export phase).
- Image-storage variant (R2/B2/S3) and Tiptap-vs-Lexical — inference + product docs; validate during implementation.

---
*Research completed: 2026-06-01*
*Ready for roadmap: yes*
