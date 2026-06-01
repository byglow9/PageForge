# Feature Research

**Domain:** Template-based landing page generator SaaS (multi-tenant, for marketing/travel agencies)
**Researched:** 2026-06-01
**Confidence:** HIGH (PROJECT.md scope is explicit and well-reasoned; competitor patterns verified via multiple sources)

## Positioning Note (read this first)

PageForge is **not** a drag-and-drop visual builder (Webflow / Unbounce / Instapage / Framer / Carrd). It is a **form-driven content-fill engine over hand-authored templates** — closer to the WordPress ACF Repeater + Meta Box "duplicate the page, change the custom fields" pattern, or a headless-CMS content model (Plasmic CMS, Builder.io data models) without the visual editor.

This distinction drives the entire feature categorization:
- Visual-builder features (free-form canvas, on-canvas editing, drag-drop) are **anti-features** for v1 — they are explicitly out of scope per PROJECT.md and would dissolve the core value (layout fidelity guaranteed by the template author).
- The competitive edge is **speed + layout fidelity + clean HTML export**, where visual builders are notoriously weak (Unbounce/Instapage export "basic HTML" but design must be rebuilt — a recurring complaint).

The "engine" is the token parser: `markup + token schema → dynamic form → fill values → merge → static HTML`. Every feature below hangs off that pipeline.

## Feature Landscape

### Table Stakes (Users Expect These)

Missing these = the product doesn't deliver its own promise.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Token parsing of template markup (`{{token}}` → typed schema) | Core engine; nothing works without it | HIGH | The single highest-risk component. Must handle scoping for repeater blocks (e.g. `{{#each days}}...{{/each}}`). Recommend a battle-tested engine (Handlebars/Liquid/Nunjucks) over a hand-rolled parser. "data + templates = final site" is the universal SSG pattern. |
| Auto-generated dynamic form from schema | The whole UX promise ("fill a form, get a LP") | HIGH | Form structure is derived, not hand-built. Must render nested forms for repeater blocks with add/remove item controls. |
| 6 field types: text, rich text, image upload, color, button+URL, repeater | Explicitly required to cover the real "Grécia" template | HIGH (repeater), MEDIUM (image, rich text), LOW (text, color, button) | Repeater is the make-or-break type (9 itinerary days, 6 cards, 5 differentials, 3 testimonials). Rich text needs a constrained editor (no arbitrary HTML — fidelity risk). |
| Static HTML generation (merge values + markup) | The deliverable itself | MEDIUM | Deterministic merge. Must inline/resolve image URLs and global brand tokens. |
| Live preview of rendered LP | Users won't trust output they can't see | MEDIUM | Render in sandboxed iframe (srcdoc). Preview = the same generation path as export, to avoid drift. |
| Edit/reopen LP data and regenerate | Campaigns get revised constantly | MEDIUM | Persist the filled values (not just the HTML); regenerate on demand. HTML is a derived artifact. |
| Export/download final HTML | v1's only delivery mechanism (no hosting) | LOW–MEDIUM | Self-contained output (assets referenced or bundled as zip). This is where dedicated builders fail — clean export is a genuine table-stakes win here. |
| Duplicate an LP | Variations are the daily agency workflow | LOW | Deep-copy filled values into a new LP record. Trivial once values are stored as data. |
| Catalog of LPs with folders + categories | Agencies produce dozens of LPs; findability is mandatory | MEDIUM | Folders = hierarchy/organization only (no per-folder permissions in v1). Categories = flat tags/taxonomy. |
| Multi-tenant workspaces with isolation | B2B agencies; data must not leak across tenants | HIGH | Tenant scoping is foundational — every query is workspace-scoped. Retrofitting is painful; build in from phase 1. |
| Team roles / RBAC (per workspace) | Teams collaborate; standard B2B expectation | MEDIUM | Standard trio is Admin/Editor/Viewer scoped per workspace. A user's role in Workspace A grants nothing in Workspace B. |
| Member invitation flow | How teams actually form; drives activation | MEDIUM | Email invite → accept → role assignment. Core to onboarding/growth. |
| Global brand/contact settings per workspace | Real template reuses WhatsApp/logo/color many times | MEDIUM | Define once, inject into tokens. Prevents copy-paste errors across many LPs. |
| Image upload + storage | Image is one of the 6 field types (11 images in ref template) | MEDIUM | Needs object storage + URL resolution in generated HTML. |
| Template authoring/management UI (CRUD) | Templates are the input asset; must be manageable | MEDIUM | Paste/edit markup, see parsed schema, validate tokens before saving. |
| Template-level token validation (parse errors surfaced) | Author needs to know if markup is malformed | MEDIUM | "Unclosed repeater", "unknown field type" feedback at author time, not generation time. |

### Differentiators (Competitive Advantage)

Where PageForge wins vs the visual-builder incumbents.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Guaranteed layout fidelity | Output always matches the designer's template — impossible to "break the layout" by typing too much | MEDIUM | This is the core differentiator vs free-form builders where non-designers wreck layouts. Constraint = feature. Requires the template to handle variable content lengths gracefully (a constraint already noted in PROJECT.md). |
| Form-fill speed for non-designers | A marketer ships a campaign LP in minutes without touching code or a canvas | LOW | Emergent from the architecture, not a feature to build — but it IS the pitch. |
| Clean, self-contained static HTML export | Portable output you can host anywhere; the thing Unbounce/Instapage do badly | MEDIUM | Lean into this. Consider a downloadable zip with assets. |
| Global brand kit propagation | Change WhatsApp/logo/primary color once → all new LPs inherit | MEDIUM | Mirrors agency "brand kit + reusable modules" expectation. Powerful for travel agencies running many campaigns under one brand. |
| Repeater blocks with arbitrary item count | Templatizes sections that competitors force you to copy-paste (itineraries, card grids) | HIGH | The hard-but-high-value feature. ACF Repeater / Instablocks validate demand. |
| Vertical focus (travel/tourism) reference template | Out-of-box "Grécia" template proves value instantly for the beachhead market | LOW | Seeding one excellent end-to-end template is worth more than 50 mediocre ones for v1 validation. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Visual drag-and-drop builder | "Every competitor has one" | Dissolves the core value (fidelity), 10x the build, competes head-on with Webflow/Framer | Form-driven authoring stays the moat; revisit only if validated |
| Platform hosting / public URLs for LPs | Users want a live link | Big operational surface (DNS, SSL, CDN, uptime, abuse) | v1 = export only (explicitly out of scope per PROJECT.md); hosting = future milestone |
| Advanced field validation (regex, image dimensions/weight, numeric ranges) | "Make it foolproof" | Scope explosion; validation UI complexity; low v1 payoff | v1 = type-only validation (per PROJECT.md) |
| Per-folder / per-member granular permissions | "Restrict who sees what" | Authorization complexity multiplies; folders become security objects | Permissions at workspace level only; folders = organization (per PROJECT.md) |
| Cross-workspace shared/global template marketplace | "Reuse templates across clients" | Tenant-isolation and ownership/versioning complexity | Templates are per-workspace in v1 (per PROJECT.md); revisit post-PMF |
| Arbitrary raw-HTML rich-text field | "Let me paste anything" | Breaks layout fidelity + XSS risk in preview/export | Constrained rich-text (bold/italic/links/lists) with sanitization |
| A/B testing + analytics | "That's what LP tools do" | Requires hosting (which is out of scope) + tracking infra | Out of scope per PROJECT.md; depends on hosting milestone |
| AI page generation (Smart Builder style) | Hot market feature | Distracts from proving the core templating loop; quality/fidelity unproven | Defer; the deterministic template engine is the differentiator |
| WYSIWYG visual field-mapping (click element → bind token) | "Easier than writing tokens" | Significant editor build; PROJECT.md explicitly defers | Markup + `{{token}}` authoring in v1 |

## Feature Dependencies

```
Multi-tenant workspaces (isolation)
    └──required by──> RBAC / roles
    └──required by──> Member invitation
    └──required by──> Global brand settings (workspace-scoped)
    └──required by──> Template management (workspace-scoped)
    └──required by──> Catalog / folders / categories (workspace-scoped)

Token parser (markup → typed schema)   [THE ENGINE]
    └──required by──> Dynamic form generation
    │                     └──required by──> Repeater add/remove UI
    └──required by──> Static HTML generation (merge)
                          └──required by──> Preview (same merge path)
                          └──required by──> Export HTML
                          └──required by──> Edit/regenerate

6 field types
    └──required by──> Dynamic form generation (renders per type)
    └──required by──> Static HTML generation (serializes per type)
    └── Image type ──requires──> Image upload + storage
    └── Repeater type ──requires──> nested/scoped token parsing  [hardest path]

Filled LP values (stored as data, not just HTML)
    └──required by──> Edit/regenerate
    └──required by──> Duplicate (deep-copy values)
    └──required by──> Export (re-merge on demand)

Global brand settings ──enhances──> Static HTML generation (token injection)
Reference "Grécia" template ──validates──> entire pipeline end-to-end
```

### Dependency Notes

- **Everything is workspace-scoped:** multi-tenancy must land first or every later feature needs rework. This is the strongest ordering constraint.
- **The token parser gates the entire product:** form generation, preview, generation, export, edit all consume the schema/merge it produces. It is both first and highest-risk.
- **Repeater depends on scoped parsing:** simple `{{token}}` substitution is easy; `{{#each}}` block iteration with nested fields is the hard part. Choosing a mature template engine that already supports block helpers de-risks this substantially.
- **Store values as data, not HTML:** edit, duplicate, and re-export all assume the canonical state is the filled form values; the HTML is a regenerable artifact. Getting this model right unlocks three features cheaply.
- **Image type couples to storage:** the image field can't be completed without an upload + storage path, so they belong in the same phase.

## MVP Definition

### Launch With (v1) — matches PROJECT.md Active scope exactly

- [ ] Multi-tenant workspaces with isolation — foundation for all data
- [ ] RBAC (Admin/Editor/Viewer per workspace) + member invitation — collaboration baseline
- [ ] Template authoring via `{{token}}` markup → typed schema (token parser) — the engine
- [ ] 6 field types incl. repeater — required to express the real template
- [ ] Dynamic form generation w/ repeater add/remove — the core UX
- [ ] Image upload + storage — needed by image field type
- [ ] Global brand/contact settings per workspace — reuse without errors
- [ ] Static HTML generation (merge) — the deliverable
- [ ] Preview (sandboxed iframe, same merge path) — trust
- [ ] Edit/regenerate LP — campaign revisions
- [ ] Duplicate LP — variations
- [ ] Export/download HTML — v1 delivery mechanism
- [ ] Catalog with folders + categories — organization
- [ ] "Grécia" reference template authored end-to-end — proves the loop + validates demand

### Add After Validation (v1.x)

- [ ] Template versioning / "regenerate LP when template changes" — trigger: users edit templates after LPs exist
- [ ] More built-in starter templates beyond Grécia — trigger: beachhead validated, expanding verticals
- [ ] Bulk export of multiple LPs — trigger: agencies asking for batch delivery
- [ ] Constrained additional field types (date, number, select/enum) — trigger: real templates need them
- [ ] Image basic handling (alt text, simple resize/crop) — trigger: fidelity/SEO complaints

### Future Consideration (v2+)

- [ ] Platform hosting + public URLs — defer: large operational surface; separate milestone
- [ ] A/B testing + analytics — defer: depends on hosting
- [ ] Visual field-mapping / WYSIWYG authoring — defer: huge build, validate token authoring first
- [ ] Cross-workspace template sharing / marketplace — defer: isolation + ownership complexity
- [ ] Advanced validation rules — defer: low v1 payoff
- [ ] AI-assisted template/content generation — defer: prove deterministic engine first

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Multi-tenant workspaces + isolation | HIGH | HIGH | P1 |
| Token parser (markup → schema) | HIGH | HIGH | P1 |
| Dynamic form generation | HIGH | HIGH | P1 |
| 6 field types (incl. repeater) | HIGH | HIGH | P1 |
| Static HTML generation (merge) | HIGH | MEDIUM | P1 |
| Preview | HIGH | MEDIUM | P1 |
| Edit / regenerate | HIGH | MEDIUM | P1 |
| Export HTML | HIGH | LOW | P1 |
| RBAC + invitation | HIGH | MEDIUM | P1 |
| Global brand settings | HIGH | MEDIUM | P1 |
| Image upload + storage | HIGH | MEDIUM | P1 |
| Catalog folders + categories | MEDIUM | MEDIUM | P1 |
| Duplicate LP | MEDIUM | LOW | P1 |
| "Grécia" reference template | HIGH | LOW | P1 |
| Template versioning | MEDIUM | MEDIUM | P2 |
| Bulk export | MEDIUM | LOW | P2 |
| Hosting / public URLs | HIGH | HIGH | P3 |
| A/B testing + analytics | MEDIUM | HIGH | P3 |
| Visual builder / field-mapping | MEDIUM | HIGH | P3 |

**Priority key:** P1 = must have for launch · P2 = add when possible · P3 = future

## Competitor Feature Analysis

| Feature | Visual builders (Webflow/Unbounce/Instapage/Framer/Carrd) | CMS/component tools (Plasmic, Builder.io, ACF/Meta Box/JetEngine) | PageForge Approach |
|---------|-----------------------------------------------------------|------------------------------------------------------------------|--------------------|
| Authoring model | Drag-drop visual canvas | Visual builder + content models / custom fields | Hand-authored markup + `{{token}}` schema (no canvas) |
| Reusable structure | Instablocks, global blocks, symbols | ACF/JetEngine Repeater fields, CMS content types | Repeater field type + reusable template |
| Content fill | Edit on canvas | Form-like field editors / CMS entries | Auto-generated dynamic form (the differentiator) |
| Layout fidelity for non-designers | Easy to break (free-form) | Good (template-bound) | Guaranteed (template-bound, content-only edits) |
| Brand consistency | Brand kit / styles | Global tokens / design tokens | Workspace global brand/contact settings |
| HTML export | "Basic HTML", design must be rebuilt (weak) | Code-export / headless API | Clean self-contained static HTML (strength) |
| Hosting | Built-in hosting + public URLs | Headless (you host) | Export only in v1; hosting deferred |
| Multi-tenant teams/roles | Team plans, workspaces | Org/workspace + roles | Workspace RBAC (Admin/Editor/Viewer) from day 1 |
| Catalog/organization | Projects/folders | CMS collections | Folders + categories (organization only) |
| A/B + analytics | Core feature (esp. Unbounce/Instapage) | Via integrations | Out of scope v1 |

## Sources

- Unbounce / Instapage / Carrd comparisons (feature set, weak HTML export): https://instapage.com/en/comparisons/instapage-vs-carrd-vs-unbounce , https://prismic.io/blog/the-12-best-landing-page-builders-detailed-comparison , https://swipepages.com/blog/instapage-vs-unbounce/ — MEDIUM confidence (vendor/comparison sources, multiple agree)
- ACF Repeater / Meta Box / JetEngine (repeater + duplicate-and-fill pattern): https://www.advancedcustomfields.com/resources/repeater/ , https://docs.metabox.io/tutorials/create-dynamic-landing-page-with-bricks/ , https://crocoblock.com/knowledge-base/jetengine/repeater-custom-meta-field-overview/ — HIGH confidence (official docs)
- Plasmic CMS / Builder.io (typed content models, tokens, headless export): https://docs.plasmic.app/learn/plasmic-cms/ , https://www.plasmic.app/site-builder — MEDIUM confidence (official product docs)
- Static generation pattern (data + templates = site; Handlebars/Liquid/Nunjucks): https://en.wikipedia.org/wiki/Static_site_generator , https://v1-0-0.11ty.dev/docs/languages/handlebars/ — HIGH confidence
- Multi-tenant RBAC (Admin/Editor/Viewer scoped per tenant, invitation flow): https://workos.com/blog/how-to-design-multi-tenant-rbac-saas , https://auth0.com/blog/how-to-choose-the-right-authorization-model-for-your-multi-tenant-saas-application/ — HIGH confidence (authority sources, agree)
- Agency brand-kit + reusable modules expectation: https://unbounce.com/landing-pages/marketing-agencies-landing-pages/ — MEDIUM confidence

---
*Feature research for: template-based landing page generator SaaS*
*Researched: 2026-06-01*
