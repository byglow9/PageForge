# Architecture Research

**Domain:** Template-driven static-HTML landing page generator (multi-tenant SaaS)
**Researched:** 2026-06-01
**Confidence:** HIGH (core structure is a well-understood pattern: markup + token-schema + merge engine; verified against template-engine, dynamic-form, multi-tenant RLS, and SSTI security sources)

## Standard Architecture

The system is best understood as a **schema-centric pipeline**, not a CRUD app with a "render" button bolted on. One artifact — the **token schema** — is the contract that connects all three pillars (template authoring, LP generation, catalog). The parser produces the schema; the schema drives the form; the form produces values; values + markup produce static HTML. Every component points at the schema.

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER                            │
├──────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│  │  Template  │  │  Dynamic   │  │  Catalog   │  │  Preview/  │       │
│  │  Authoring │  │   Form     │  │ (folders/  │  │  Export    │       │
│  │   (markup) │  │ (per-schema)│  │ categories)│  │   view     │       │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘       │
├────────┼───────────────┼───────────────┼───────────────┼──────────────┤
│        │          APPLICATION / DOMAIN LAYER            │              │
├────────┼───────────────┼───────────────┼───────────────┼──────────────┤
│  ┌─────▼──────────────┐ │               │      ┌────────▼───────────┐  │
│  │  Schema/Parser     │ │               │      │  Render/Merge      │  │
│  │  (tokens → schema) │ │               │      │  Engine            │  │
│  │  THE CORE ENGINE   │ │               │      │ (markup+values→HTML)│ │
│  └─────┬──────────────┘ │               │      └────────┬───────────┘  │
│        │         ┌──────▼───────┐  ┌─────▼─────┐  ┌──────▼──────────┐  │
│        │         │ Form Gen     │  │ Catalog   │  │ Asset Storage   │  │
│        │         │ (schema→UI   │  │ Service   │  │ (image upload/  │  │
│        │         │  descriptor) │  │           │  │  serve)         │  │
│        │         └──────────────┘  └───────────┘  └─────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Auth / Tenancy (workspace context + RBAC) — wraps ALL of above  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│                              DATA LAYER                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │Workspaces│ │Templates │ │   LP     │ │ Folders/ │ │ Asset blobs  │ │
│  │ /members │ │+ schemas │ │instances │ │categories│ │(object store)│ │
│  │          │ │          │ │+ values  │ │          │ │              │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Schema/Parser** | Parse `{{token}}` markup → typed field schema; detect repeaters/loops, global-value references, duplicate tokens. The motor of the system. | Pure function `parse(markup) → Schema`. No DB, no I/O. Deterministic and unit-testable. |
| **Template Authoring** | CRUD on raw markup; trigger parse; surface parse errors/warnings; let author annotate field metadata (label, type override, help text) on top of the parsed schema. | Form/editor UI + endpoint that calls parser and persists `{markup, schema}` together. |
| **Form Generator** | Turn a stored schema into a UI form descriptor: one input per field, repeater add/remove controls, global-value fields pre-bound to workspace brand config. | Schema → form-descriptor transform (JSON), rendered by a schema-driven form renderer on the client. |
| **Render/Merge Engine** | Merge markup + values + workspace brand config → static HTML string. Iterate repeaters, substitute globals, **auto-escape all values**. | Logic-less, data-only substitution (Mustache-style). NOT a code-executing engine. (See SSTI anti-pattern.) |
| **Asset Storage** | Store uploaded images per workspace; return stable URLs embedded in rendered HTML; handle export bundling. | Object store (S3/compatible) + DB metadata row; tenant-prefixed keys. |
| **Catalog Service** | Organize LP instances into folders/categories; list/filter/duplicate within a workspace. | Standard scoped CRUD; folders are pure organization (no per-folder perms in v1). |
| **Auth / Tenancy** | Authenticate user, resolve active workspace, enforce RBAC, inject tenant context into every query. Cross-cutting. | Middleware that sets workspace context; DB-level row scoping (see Pattern 4). |

## Recommended Project Structure

Structure by **domain module**, not by technical layer, so the schema contract stays cohesive and each pillar is independently testable. (Stack-agnostic — STACK.md picks the language; folder intent holds regardless.)

```
src/
├── core/                       # Pure domain logic — NO framework, NO I/O
│   ├── parser/                 # tokens → schema (the engine)
│   │   ├── tokenize.ts         # lexer: find {{...}} incl. repeater/global syntax
│   │   ├── build-schema.ts     # tokens → typed Schema
│   │   └── schema.types.ts     # Schema, Field, FieldType, Repeater types
│   ├── render/                 # schema + values + markup → HTML
│   │   ├── merge.ts            # substitution + repeater iteration + escaping
│   │   └── escape.ts           # context-aware HTML escaping
│   └── form/                   # schema → form descriptor
│       └── to-form-descriptor.ts
├── modules/                    # Application services (orchestrate core + data)
│   ├── templates/              # authoring CRUD, parse-on-save
│   ├── instances/              # LP instances: values CRUD, duplicate, generate
│   ├── catalog/                # folders, categories, listing
│   ├── assets/                 # image upload/serve/export bundling
│   ├── brand/                  # workspace global brand/contact config
│   └── workspaces/             # workspaces, members, roles (RBAC)
├── platform/                   # Cross-cutting infrastructure
│   ├── tenancy/                # workspace context + RLS/scoping helpers
│   ├── auth/                   # authn + role checks
│   └── db/                     # data access, migrations
└── web/                        # HTTP/UI delivery (controllers, routes, pages)
```

### Structure Rationale

- **`core/` is pure and framework-free:** The parser and merge engine are the riskiest, most reusable logic. Keeping them I/O-free makes them exhaustively unit-testable against the real "Grécia" template before any UI exists — this is the single highest-leverage testing decision in the project.
- **`schema.types.ts` is the shared contract:** Parser writes it, form generator reads it, merge engine reads it. One type file prevents drift between the three pillars.
- **`modules/` orchestrate but don't own logic:** They wire core functions to persistence and tenancy. Thin by design.
- **`platform/tenancy/` is separate and mandatory from day one:** Retrofitting tenant isolation is the classic SaaS rewrite. It wraps every module.

## Architectural Patterns

### Pattern 1: Schema as the Single Source of Truth

**What:** The parser emits one canonical `Schema` object. Form rendering, validation, and merge all consume it. The schema is persisted *alongside* the template markup so it never needs re-deriving at render time (and so an LP's values stay valid even if the template is later edited — version the schema).

**When to use:** Always, in this system. It is the architecture.
**Trade-offs:** Schema must be re-generated when markup changes, and you must decide how existing LP values reconcile with a changed schema (version the template; new edits use new schema).

**Example:**
```typescript
type FieldType = 'text' | 'richtext' | 'image' | 'color' | 'button' | 'repeater';

interface Field {
  token: string;          // "hero_title"
  type: FieldType;
  label: string;
  global?: boolean;       // bound to workspace brand config
  fields?: Field[];       // present only when type === 'repeater'
}

interface Schema {
  version: number;
  fields: Field[];
}
// parse(markup) => Schema   (pure, deterministic)
```

### Pattern 2: Repeaters as Nested Scopes (layout consistency)

**What:** A repeatable block is authored as a region with a loop boundary and inner tokens, e.g. `{{#itinerary}} ... {{day_title}} ... {{/itinerary}}`. The parser nests inner fields under the repeater. Values store an *array of objects* for that key. The merge engine clones the inner markup once per array item.

**When to use:** Any section with N items (itinerary days, cards, testimonials) — the explicit reason this product exists.
**Trade-offs:** Requires a loop syntax in the markup and array-shaped values. This is the correct trade — fixed numbered tokens (`day1`, `day2`...) do not scale and break templatization.

**Layout consistency is structural, not per-instance:** Because each repeater item renders the *same* inner markup/CSS, layout fidelity comes from the template's CSS (the design system the author wrote once), never from the variable content. The architecture enforces this by:
- The merge engine emitting identical wrapper markup per item (CSS handles overflow, truncation, wrapping).
- Rich-text fields being sanitized to an allow-list of tags so authored CSS still governs typography.
- The template — not the form data — owning all structural HTML/CSS.

### Pattern 3: Global Values via Workspace Brand Config

**What:** Tokens flagged global (e.g. `{{@whatsapp}}`, `{{@logo}}`, `{{@primary_color}}`) resolve from a per-workspace `brand_config` record at merge time, not from per-LP form values. The form generator omits them (or shows them read-only) so they are entered once.

**When to use:** Values repeated across many tokens/LPs (contact, logo, brand color).
**Trade-offs:** Two value sources at merge time (LP values + brand config). The merge engine must layer them; document precedence (LP-local override optional, but v1 can keep globals strictly global).

### Pattern 4: Tenant Context Injection (workspace isolation)

**What:** Every request resolves an active workspace and injects it as query context. Prefer a defense-in-depth combo: (a) `workspace_id` column on every tenant-owned table with mandatory scoping in the data layer, and (b) Postgres Row-Level Security as a backstop so a missed `WHERE` clause cannot leak data.

**When to use:** From the first migration. Multi-tenancy is a constraint in PROJECT.md, not a feature.
**Trade-offs:** RLS requires the app to connect as a non-owner role and to set `app.current_workspace` per transaction; needs `workspace_id` as the leading column in composite indexes or it is dramatically slower. Worth it for the leak-prevention guarantee.

**Example:**
```sql
ALTER TABLE lp_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_isolation ON lp_instances
  USING (workspace_id = current_setting('app.current_workspace')::uuid);
CREATE INDEX ON lp_instances (workspace_id, folder_id);  -- tenant_id leading
```

## Data Model

The pipeline `template authoring → schema → form → values → HTML` maps directly to these entities.

```
workspaces (id, name, created_at)
   │
   ├──< workspace_members (workspace_id, user_id, role)        # RBAC: owner/admin/editor/viewer
   │
   ├──1 brand_configs (workspace_id, whatsapp, logo_asset_id,  # global values
   │                    primary_color, ...)
   │
   ├──< folders (id, workspace_id, parent_id, name)            # catalog org (nestable)
   ├──< categories (id, workspace_id, name)                    # catalog tagging
   │
   ├──< templates (id, workspace_id, name,
   │               markup TEXT,                                # raw token markup
   │               schema JSONB,                               # parsed Schema (Pattern 1)
   │               schema_version INT)
   │      │
   │      └──< lp_instances (id, workspace_id, template_id,
   │                         folder_id, category_id,
   │                         name,
   │                         values JSONB,                     # token → value(s); arrays for repeaters
   │                         schema_version INT,               # which schema these values target
   │                         generated_html TEXT,              # last rendered output (cache)
   │                         created_at, updated_at)
   │
   └──< assets (id, workspace_id, lp_instance_id?, storage_key,# uploaded images
                content_type, size, created_at)
```

**Key modeling decisions:**
- **`templates.schema` is stored, not derived on read.** Parse once on save. Re-parse only when markup changes; bump `schema_version`.
- **`lp_instances.values` is JSONB**, shaped by the schema: scalars for simple fields, arrays-of-objects for repeaters. Schema-driven, so no rigid column-per-field.
- **`lp_instances.schema_version` pins values to the schema they were authored against** — protects existing LPs when a template is later edited.
- **`generated_html` is a cache, not the source of truth.** It is always reproducible from `markup + values + brand_config`. Regeneration on edit/export is cheap and deterministic.
- **Every tenant-owned table carries `workspace_id`** (Pattern 4) — including `assets`, whose storage keys are workspace-prefixed.
- **Duplicating an LP** = copy the `values` + metadata row (and optionally re-point or copy assets). Cheap because values are self-contained JSONB.

## Data Flow

### Authoring → Schema (one time per template)

```
Author writes markup with {{tokens}}, {{#repeaters}}, {{@globals}}
    ↓
POST /templates  →  parser.parse(markup)  →  Schema (JSONB)
    ↓
persist { markup, schema, schema_version } scoped to workspace
    ↓
parse warnings/errors returned to author (unknown type, unclosed repeater, etc.)
```

### Schema → Form → Values → HTML (per LP, repeatable)

```
Open "new LP" → load template.schema
    ↓
form-generator: schema → form descriptor (globals pre-bound from brand_config)
    ↓
user fills form (add/remove repeater items)  →  values (JSONB)
    ↓
save lp_instance { values, schema_version }
    ↓
PREVIEW / EXPORT:
  merge.render(template.markup, values, brand_config)
    → substitute scalars (escaped)
    → for each repeater: clone inner markup per array item
    → resolve {{@globals}} from brand_config
    → sanitize rich-text to tag allow-list
    → static HTML
    ↓
cache as generated_html  →  preview iframe / download / export bundle (HTML + asset URLs)
```

### Re-edit flow

```
Open existing LP → load values → re-render form from schema → edit → re-merge → re-cache HTML
```

## Suggested Build Order

Dependencies flow from the schema contract outward. Build the engine first, in isolation, against the real "Grécia" template.

1. **Schema types + Parser (`core/parser`)** — no dependencies. Foundation everything else reads. Validate against the real Grécia markup (9-day itinerary, repeated cards). *Highest risk, build first, test hardest.*
2. **Merge/Render engine (`core/render`)** — depends on schema types + parser output. Prove markup + hand-written values → correct static HTML for Grécia, including repeaters, globals, and escaping. At this point the core value is provable with zero UI.
3. **Workspaces + Auth + Tenancy (`platform`, `modules/workspaces`)** — foundational and orthogonal; must exist before any persisted, scoped data. Build in parallel with 1–2 if capacity allows, but it gates everything persisted.
4. **Template authoring (`modules/templates`)** — persists markup + schema; depends on parser (1) and tenancy (3).
5. **Brand config (`modules/brand`)** — small; needed before globals fully work in real LPs. Depends on workspaces (3).
6. **Form generator (`core/form`) + dynamic form UI** — depends on schema (1) and authoring (4) to have stored schemas to render.
7. **LP instances (`modules/instances`)** — values CRUD, generate, duplicate. Depends on form (6), merge (2), brand (5).
8. **Asset storage (`modules/assets`)** — image upload/serve; depends on tenancy (3). Can slot in around 6–7 (image field needs it to be fully functional).
9. **Catalog (`modules/catalog`)** — folders/categories over existing instances. Depends on instances (7). Pure organization, lowest risk, build late.
10. **Preview + Export** — preview emerges free once merge (2) works; export bundling (HTML + assets) builds on assets (8) and instances (7).

**Critical path:** 1 → 2 prove the product thesis before investing in UI/tenancy/catalog. Treat steps 1–2 as a vertical spike.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k users | Single monolith + one Postgres + one object-store bucket. Render synchronously on preview/export. Cache `generated_html`. More than sufficient. |
| 1k–100k users | Ensure `workspace_id`-leading composite indexes (RLS perf). Serve assets via CDN. Move large/export renders to a background job if synchronous latency grows. |
| 100k+ users | Consider read replicas; partition large tenants if any single workspace is huge. The merge engine is stateless/pure, so it scales horizontally trivially. |

### Scaling Priorities

1. **First bottleneck: RLS query performance** — missing `workspace_id`-leading composite indexes make tenant-scoped queries orders of magnitude slower. Fix with correct indexes from the start.
2. **Second bottleneck: synchronous render on export of large LPs** — move to a job queue only when it actually hurts; the render is pure and cacheable, so this is easy to defer.

## Anti-Patterns

### Anti-Pattern 1: Using a code-executing template engine for the merge step

**What people do:** Reach for a full programmable template engine (Jinja/EJS/etc.) and feed it tenant-authored markup.
**Why it's wrong:** Template authors are tenant users supplying markup; a logic-capable engine evaluating that markup is a textbook Server-Side Template Injection vector (data exposure, RCE). It also blurs the clean schema contract.
**Do this instead:** A **logic-less, data-only substitution engine** (Mustache-style: substitute, iterate repeaters, nothing else). No arbitrary expressions. Auto-escape all values; sanitize rich text against a tag allow-list.

### Anti-Pattern 2: Fixed numbered tokens instead of repeaters

**What people do:** `{{day1_title}} … {{day9_title}}` to handle the itinerary.
**Why it's wrong:** Breaks the moment a trip has 7 or 12 days; bloats the schema; makes the template non-reusable — defeating the product's purpose.
**Do this instead:** A `repeater` field type with nested inner fields and array-shaped values (Pattern 2).

### Anti-Pattern 3: Deriving the schema at render time

**What people do:** Re-parse markup on every preview/render and never persist the schema.
**Why it's wrong:** Couples render performance to parsing, and leaves existing LP values undefined when a template's markup changes.
**Do this instead:** Parse on save, persist `schema` + `schema_version` alongside markup; pin each LP's values to its `schema_version`.

### Anti-Pattern 4: Bolting tenancy on later

**What people do:** Build single-tenant, add `workspace_id` and RBAC "once it works."
**Why it's wrong:** Touches every table, query, and endpoint — the classic SaaS rewrite. PROJECT.md lists multi-tenancy as a constraint, not a feature.
**Do this instead:** `workspace_id` on every tenant table from migration #1; tenant context middleware + RLS backstop (Pattern 4).

### Anti-Pattern 5: Treating generated HTML as the source of truth

**What people do:** Store rendered HTML and edit it directly.
**Why it's wrong:** Diverges from markup + values; re-generation becomes lossy; duplication/edit semantics break.
**Do this instead:** Treat `generated_html` as a reproducible cache; the truth is `markup + values + brand_config`.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Object storage (S3-compatible) | SDK upload; workspace-prefixed keys; signed/public URLs embedded in HTML | Decide whether export bundles inline assets or links them. |
| (Future) Hosting/publishing | Out of scope v1 (export-only) | Architecture already produces static HTML, so hosting is additive later. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Parser ↔ everything | Shared `Schema` type (direct, in-process) | The single contract; keep it stable and versioned. |
| Modules ↔ core | Direct function calls (core is pure) | Core never imports modules — dependency points inward only. |
| Modules ↔ tenancy | Middleware-injected workspace context | Every scoped query passes through it; never trust client-supplied workspace_id. |
| Merge engine ↔ brand config | Read at render time | Globals resolved from workspace, not LP values. |

## Sources

- [PostgreSQL Row Level Security for multi-tenant isolation — AWS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/) (HIGH)
- [Shipping multi-tenant SaaS using Postgres RLS — Nile](https://www.thenile.dev/blog/multi-tenant-rls) (MEDIUM — `tenant_id` GUC pattern, non-owner role, composite index perf)
- [Server-side template injection — PortSwigger Web Security Academy](https://portswigger.net/web-security/server-side-template-injection) (HIGH — basis for logic-less merge engine decision)
- [Secure coding with template engines — Veracode](https://www.veracode.com/blog/an-introduction-to-secure-coding-with-template-engines/) (MEDIUM — logic-less/sandboxed engine guidance)
- [SurveyJS: JSON schema → dynamic form rendering](https://surveyjs.io/open-source) (MEDIUM — schema-driven form generation pattern)
- [Template engines overview — Full Stack Python](https://www.fullstackpython.com/template-engines.html) (MEDIUM — token-substitution model)
- PROJECT.md (HIGH — domain constraints, field types, repeater requirement, Grécia reference template)

---
*Architecture research for: template-driven static-HTML landing page generator (multi-tenant SaaS)*
*Researched: 2026-06-01*
