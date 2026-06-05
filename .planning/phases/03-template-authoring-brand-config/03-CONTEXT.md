# Phase 3: Template Authoring + Brand Config - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Let users **author and edit token-markup templates** through the web app and **configure
reusable global brand/contact values** per workspace. This is the **first phase to integrate
the Phase 1 engine (`parse`) into the Next.js app** — on save, the template markup is parsed
into a typed schema and persisted (markup + schema + a `schema_version`) scoped to the
workspace via the Phase 2 tenant-isolation layer. Covers TPL-01, TPL-03, TPL-05, TPL-06,
BRD-01, BRD-02.

In scope:
- A template **authoring/editing UI**: write markup with `{{ token:type }}` annotations and
  `<!-- repeat:name -->` blocks; create, edit, list, and select templates within a workspace.
- **Live parse feedback** while editing (detected fields + warnings), with the authoritative
  parse running on save.
- **Per-field metadata overlay** (friendly label + required flag) layered on top of the
  engine's minimal `ParsedSchema`, persisted with the template — resolves the metadata that
  Phase 1 D-05 explicitly deferred to this phase.
- **Brand/contact config** per workspace: a fixed set of known fields (logo, primary color,
  WhatsApp/contact) that templates reference via `brand.*` tokens. The engine already resolves
  these at render time (Phase 1 D-09).
- Persistence of `markup`, the derived `schema` (JSON), per-field metadata overlay, and an
  incrementing `schema_version`, all on workspace-owned tables behind `withTenantDb` + RLS.

Out of scope (other phases):
- The dynamic form, image upload, LP generation/preview/export (Phase 4). The form *consumes*
  the schema + metadata authored here but is not built here.
- **Image upload (AST-01)** — the brand logo is entered as a **pasted URL** in v1; real upload
  lands in Phase 4. No S3/presigned-URL work in this phase.
- Migrating already-generated LPs when a template's schema changes (LP records are Phase 4).
  Phase 3 only version-stamps templates; it does not reconcile downstream LPs.
- Catalog / folders (Phase 5). Advanced validation beyond type + required (v2 VAL-01).
</domain>

<decisions>
## Implementation Decisions

### Authoring Editor & Parse Feedback
- **D-01:** Authoring uses a **code editor + live side panel**. The editor is a monospace
  code surface (plain `<textarea>` or a lightweight code editor such as CodeMirror — exact
  choice is the planner/researcher's call). A side panel lists **detected fields and parse
  warnings** live (debounced) as the author types.
- **D-02:** The **authoritative parse runs on save** (the persisted schema is the save-time
  parse result). Live feedback is advisory. Surfacing parse warnings for unknown types and
  unclosed repeater blocks directly satisfies roadmap success criterion 2.
- **D-03:** Parsing stays **tolerant** (Phase 1 D-04): unknown/missing types degrade to `text`
  with a warning; the author can still save a template that has warnings. (Whether an unclosed
  repeater is a hard block vs. a loud warning is a planner detail — default to warning unless
  the engine already errors.)

### Per-Field Metadata
- **D-04:** Authoring **enriches the schema with per-field metadata: a friendly `label` and a
  `required` flag** per field. These are stored as an **app-level overlay** keyed by field
  name — the engine's `ParsedSchema` (`name`, `type`, `repeater`, `global`) stays pure and
  minimal. This resolves the metadata Phase 1 D-05 deferred here.
- **D-05:** On **edit/re-parse, the metadata overlay is reconciled** with the newly derived
  field set: keep metadata for fields that still exist (matched by name), drop metadata for
  removed fields, and create defaults (label = field name, required = false) for new fields.
- **D-06:** `required` is the only field-level validation captured in v1 (alongside the
  engine's type). Advanced validation (regex, ranges, image dims) stays v2 (VAL-01).

### Brand / Contact Config
- **D-07:** Brand config is a **fixed set of known fields per workspace: `logo`, `primary_color`,
  `whatsapp` (contact).** These map 1:1 to the `brand.*` tokens the engine resolves
  (`brand.logo`, `brand.primary_color`, `brand.whatsapp` — Phase 1 D-09). Not a free-form
  key-value map in v1.
- **D-08:** The **logo is entered as a pasted URL** in v1 — no image upload here. Real upload
  (AST-01) is Phase 4; the brand field shape should make swapping a URL for an uploaded-asset
  reference cheap later.
- **D-09:** Brand config is **one record per workspace** (configure once, reused everywhere),
  created/edited by `owner`/`admin`/`editor` per the Phase 2 RBAC (editor manages content;
  settings-only actions stay owner/admin — the planner confirms which bucket brand config
  falls in, but content-like brand values lean editor-allowed).

### Schema Versioning
- **D-10:** `schema_version` is a **monotonically incrementing integer per template**. Each
  save re-parses the markup and increments the version; the row persists `markup` + current
  `schema` (JSON) + `schema_version`. It is a **traceability stamp**, not a migration system.
- **D-11:** Phase 3 does **not** migrate or touch downstream LPs on a schema change (LP records
  don't exist until Phase 4). The version simply lets Phase 4 detect "this LP was generated
  against schema_version N of template T."

### Claude's Discretion
- Exact editor library (plain textarea vs. CodeMirror/Monaco) and whether live parse runs
  client-side (if the engine's `parse` is cleanly bundleable) or via a debounced Server Action.
  Note: `parse` does not sanitize (sanitization is a `render`-time concern), so it may be
  bundle-safe client-side — researcher to confirm.
- Exact Prisma schema shape for the `Template` table (and any brand config table): column names,
  whether schema + metadata overlay are one `jsonb` blob or split, indexes. Must carry
  `workspaceId` and live behind `withTenantDb` like every tenant-owned table.
- Template list UI presentation (table vs. cards) and empty-state copy.
- Whether the metadata overlay is stored inline in the same `jsonb` as the schema or separately.
- How `brand.*` token presence in a template surfaces to the author (e.g., showing which brand
  fields a template depends on) — nice-to-have, not required.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 3: Template Authoring + Brand Config" — goal, the 4 success
  criteria (esp. criterion 1 parse-to-schema + `schema_version`, criterion 2 parse warnings,
  criterion 4 brand globals), `**Mode:** mvp`, and the TPL/BRD requirement mapping.
- `.planning/REQUIREMENTS.md` §"Template Authoring" (TPL-01 create via markup, TPL-03 type per
  token, TPL-05 edit, TPL-06 list/select within workspace) and §"Brand Settings" (BRD-01
  configure global brand/contact, BRD-02 templates reference brand globals).
- `.planning/PROJECT.md` §"Key Decisions" — markup-with-tokens authoring; brand/contact global
  config per workspace.

### Engine integration (Phase 1 — the contract this phase consumes)
- `src/engine/index.ts` — public surface: `parse(markup) → ParsedSchema`,
  `render(markup, values, brand) → HTML`, and exported types.
- `src/engine/schema.ts` — `ParsedSchema` shape (`fields[]` with `name`/`type`/`repeater`/
  `global`, `repeaters[]`, `globals[]`, `warnings[]`) — the schema persisted on save; the
  per-field metadata overlay (D-04) sits on top of this.
- `.planning/phases/01-core-engine-parser-merge/01-CONTEXT.md` — D-01..D-09 token grammar
  (inline `:type`, `<!-- repeat:name -->`, `brand.*` namespace), D-04 tolerant parsing,
  **D-05 (per-field metadata deferred to THIS phase)**, D-09 (`brand.logo`/`brand.primary_color`/
  `brand.whatsapp` resolved at render).

### Tenant isolation (Phase 2 — the layer all new tables live behind)
- `apps/web/src/lib/db/tenant-db.ts` — `withTenantDb` / `withWorkspaceTenantDb`: the mandatory
  data layer (D-13/D-14). New `Template`/brand tables MUST be accessed through tenant-scoped
  helpers added here, never the raw `prisma` client.
- `apps/web/src/lib/workspaces/guards.ts` — `requireWorkspace` / `requireWorkspaceRole` /
  `WorkspaceContext`; workspaceId + role come from the server session, never client input.
- `apps/web/src/lib/auth/permissions.ts` — role definitions; gate authoring/brand actions per
  the editor-vs-owner/admin split (Phase 2 D-10/D-11).
- `apps/web/prisma/schema.prisma` — every tenant-owned table carries `workspaceId`; RLS policy
  reads `app.current_workspace_id`. Add the `Template` (and brand config) models following the
  existing `TenantIsolationProbe` pattern.
- `.planning/phases/02-multi-tenancy-foundation/02-CONTEXT.md` — D-10/D-11 RBAC matrix, D-12/D-14
  isolation design that constrains how Phase 3 persists and reads data.

### Tech stack
- `CLAUDE.md` — recommended stack for this phase: **Next.js 16 App Router + Server Actions**,
  **Prisma 7 + Postgres** (`jsonb` for schema + metadata), **Zod 4** for Server Action input
  validation, **shadcn/ui + Tailwind** for the authoring/list UI (not yet installed in
  `apps/web` — first UI-component need lands here), **React Hook Form** noted for Phase 4 forms.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`pageforge-engine` (`src/engine/`)** — pure `parse`/`render` + Zod schemas. Phase 3 is the
  first consumer in the app; `apps/web` does **not** yet depend on it, so wiring the workspace
  dependency (pnpm) and importing `parse` is a net-new integration step.
- **`withTenantDb` / `requireWorkspace` / `requireWorkspaceRole`** — established Phase 2
  helpers; the Template + brand tables plug straight into them (add tenant-scoped helpers
  mirroring `tenantIsolationProbe`).
- **`apps/web/src/lib/workspaces/*`** (actions, guards, schema, listing) — the established
  pattern for a workspace-scoped feature module (Server Actions + Zod schema + guards + listing).
  Template authoring and brand config should follow this same module shape.

### Established Patterns
- App is **Next.js App Router** with routes under `apps/web/src/app/w/[slug]/...` for
  workspace-scoped pages (e.g. `members/page.tsx`). Template authoring + brand config pages
  belong under the same `w/[slug]` segment, behind the layout that resolves workspace context.
- **Server Actions + Zod** at the boundary (see `lib/workspaces/actions.ts` + `schema.ts`).
- Tenant-owned tables use `@@map`, `workspaceId`, and the RLS-backed `withTenantDb` path; no
  raw cross-workspace queries.
- **No shadcn/ui or Tailwind installed yet** in `apps/web` — Phase 3 introduces the dashboard
  component layer for the first time (or chooses a minimal alternative).

### Integration Points
- `parse(markup)` → persisted `schema` JSON + `schema_version`; the metadata overlay (label/
  required) is reconciled against `schema.fields` on every save.
- Brand config record (logo URL, primary_color, whatsapp) → fed as the `brand` argument to the
  engine's `render` in Phase 4; field names align with the `brand.*` tokens.
- The Template table is the artifact Phase 4 reads to build the dynamic form (schema + metadata)
  and to generate/preview/export LPs (markup + brand).
</code_context>

<specifics>
## Specific Ideas

- The authoring editor should make the **6 field types and repeater blocks tangible** —
  detected fields + warnings visible while typing, so an author wrapping an existing block in
  `<!-- repeat:name -->` immediately sees the repeater register (mirrors how the Phase 1
  fixture was tokenized from the real Grécia page).
- Keep the brand fields **named exactly to match `brand.*` tokens** so the mental model is
  "configure once, reference by `brand.<field>`" with no mapping layer.
- Logo-as-URL is a deliberate v1 shortcut: shape the field so Phase 4's uploaded-asset reference
  can replace the URL without a schema migration.
</specifics>

<deferred>
## Deferred Ideas

- **Image upload for the logo (and image fields generally)** — AST-01, Phase 4. v1 uses a
  pasted URL (D-08).
- **Dynamic form generation, preview, export** — Phase 4 consumes the schema + metadata + brand
  authored here.
- **Migrating existing LPs on template schema change** — Phase 4+ concern; Phase 3 only stamps
  `schema_version` (D-11).
- **Free-form / arbitrary brand fields** — v1 is a fixed set (D-07); revisit if templates need
  brand tokens beyond logo/primary_color/whatsapp.
- **Advanced field validation** (regex, ranges, image dims) — v2 VAL-01; v1 captures type +
  `required` only (D-06).
- **Template duplication / versioned schema history UI** — duplication is an LP feature (LP-03,
  Phase 4); template-level history beyond the incrementing integer is not in scope.

None of the above blocks Phase 3.
</deferred>

---

*Phase: 3-Template Authoring + Brand Config*
*Context gathered: 2026-06-05*
