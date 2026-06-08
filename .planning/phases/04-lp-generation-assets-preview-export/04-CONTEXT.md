# Phase 4: LP Generation, Assets, Preview & Export - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the core promise of PageForge: **selecting a template generates a dynamic form**
(built from the Phase 3 `schema` + per-field metadata overlay) whose **filled values merge
into a previewable, editable, duplicable, and exportable static-HTML landing page**, using
the **Phase 1 engine** (`render(markup, values, brand) → HTML`). Adds **image upload** for
image fields and resolves **brand globals** automatically. Covers GEN-01, GEN-02, GEN-03,
GEN-04, AST-01, LP-01, LP-02, LP-03, LP-04, BRD-02.

In scope:
- A **schema-driven dynamic form**: render one input per field by type (text, rich text,
  image upload, color, button+URL), with **add/remove of items in repeatable blocks**, and
  **required-by-type validation on submit** (the only validation in v1). Globals are
  pre-bound from brand config.
- **Image upload** (AST-01): browser uploads directly to S3-compatible object storage via
  presigned URLs; validated by magic bytes, size/pixel-capped, served from a safe
  tenant-scoped path; uploaded images appear correctly in the generated LP.
- **LP records**: values stored as data, **HTML derived** (regenerated on demand). Each LP
  stores a **snapshot of the template `markup` + `schema_version`** at generation time.
- **Preview** (LP-01) using the **exact same merge pipeline as export** (preview == export).
- **Edit + regenerate** (LP-02): reopen an LP's data, re-render HTML.
- **Duplicate** (LP-03): create an independent variation.
- **Export** (LP-04): download a **self-contained ZIP bundle** (`index.html` + `./assets/`)
  with rewritten relative asset paths and a **strict CSP baked in**.

Out of scope (other phases):
- **Catalog / folders / categories / browse-search** (Phase 5). LPs are saved here, but their
  organization UI is Phase 5.
- The full **Grécia end-to-end acceptance** loop (Phase 5).
- **Advanced validation** (regex, image dimensions/ranges) — v2 VAL-01. v1 = type + required.
- **Platform-hosted LP URLs** — v1 is export/download only (v2 HOST-01).
- Visual/layout details of the form and preview surface — handled by `/gsd-ui-phase` (UI hint: yes).
</domain>

<decisions>
## Implementation Decisions

### Image Storage & Upload (AST-01)
- **D-01:** Image storage uses **S3-compatible object storage** — MinIO locally (Docker
  Compose) and R2/S3 in production, per the CLAUDE.md recommended stack. Bytes stay off the
  app server; portable and scalable. Storage access is **tenant-scoped** (workspace-isolated
  paths/prefixes).
- **D-02:** The browser **uploads directly to the bucket via server-generated presigned PUT
  URLs**. Large image bytes never pass through the Next.js app server.
- **D-03:** Server-side validation (locked by roadmap criterion 2): **magic-bytes** content
  check, **size and pixel caps**, safe tenant-scoped path. Caps are fixed defaults in v1
  (not author-configurable — that leans toward v2 VAL-01).

### Brand Globals — Resolution Policy
- **D-04:** Brand globals are **LIVE**: the LP does NOT store brand values. Every
  preview/export resolves the **current `BrandConfig`** of the workspace and passes it as the
  `brand` argument to `render`. Model = "configure once, reused everywhere." (Resolves the
  STATE.md "globals snapshot-vs-live" blocker → live.)
- **D-05:** When a template references a `brand.*` field that is empty/unset in `BrandConfig`,
  the LP **renders the slot empty/omitted** (the engine already maps `undefined → ''` via
  `strictVariables: false`). No hard error, no block. (A "configure your brand" advisory
  warning is optional planner nice-to-have, not required.)

### Template Markup & Schema-Version Reconciliation
- **D-06:** Each LP stores a **snapshot of the template `markup` and `schema_version`** taken
  at generation time. Preview/export render against this **snapshot markup**, NOT the live
  template. Editing a template does **not** alter existing LPs — protects layout fidelity (a
  project constraint) and keeps each LP self-sufficient. (Resolves the STATE.md
  "schema-change reconciliation" blocker.)
- **D-07:** **Deliberate asymmetry vs. D-04:** markup/schema are **snapshotted** (layout
  stability), brand globals are **live** (intentional small values meant to propagate). This
  is by design, not an inconsistency.
- **D-08:** When a user reopens an LP whose source template has since advanced to a newer
  `schema_version`, the saved values are **reconciled by field name** — keep values for fields
  that still exist (match by `name`), drop values for removed fields, default new fields —
  mirroring the Phase 3 metadata-overlay reconciliation (Phase 3 D-05). Surface the
  differences to the user. Pulling the new template version into an LP is the moment the
  snapshot is refreshed.

### Generation, Identity & Export
- **D-09:** **Export bundle = self-contained ZIP** (`index.html` + `./assets/`), via `archiver`
  (CLAUDE.md "Mode b"): download referenced images server-side, rewrite `src` to relative
  `./assets/...`, stream the ZIP. Satisfies criterion 5 "working asset paths" + portability.
- **D-10:** The export HTML has a **strict CSP baked in** (locked by criterion 5). Exact policy
  is planner/researcher detail, but it must be strict (no inline-script execution in the
  exported artifact).
- **D-11:** **The user names the LP at generation time** (readable name entered in/at the
  form). Makes LPs catalog-ready by name from Phase 5 onward.
- **D-12:** **Duplicate (LP-03) = full independent copy**: copies the LP's values + its markup/
  `schema_version` snapshot into a brand-new LP ("Copy of X"). Editing the copy never affects
  the origin. Consistent with the snapshot-on-LP model (D-06).

### Locked Upstream (not re-decided here)
- LP = **values as data, HTML derived** (regenerate on demand) — PROJECT constraint + criterion 4.
- **Preview == export** — same `render` pipeline for both (criterion 3).
- Validation = **type + `required` only** on submit (GEN-04; advanced validation is v2 VAL-01).
- `BrandConfig` is a **fixed field set** (`logoUrl`, `primaryColor`, `whatsapp`) — Phase 3 D-07.

### Claude's Discretion
- Repeater add/remove form interaction (React Hook Form `useFieldArray` is the canonical
  fit per CLAUDE.md); whether repeater blocks render as collapsible sections.
- Preview surface (inline iframe vs. new tab vs. side-by-side) — deferred to `/gsd-ui-phase`.
- Exact Prisma shape for the `LandingPage` model (values jsonb, markup snapshot, schemaVersion,
  name, workspaceId) and asset records; must carry `workspaceId` + live behind `withTenantDb`.
- The storage abstraction interface (MinIO/R2/S3 swap) and presigned-URL route/Server-Action shape.
- Exact strict-CSP policy string for exported HTML.
- Whether to persist generated HTML or always regenerate (regeneration is cheap; PROJECT says
  re-editing = regenerate) — planner's call, but data-derived HTML is the model.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 4: LP Generation, Assets, Preview & Export" — goal, the 5
  success criteria (esp. criterion 2 image upload validation + tenant-scoped path, criterion 3
  preview==export, criterion 4 edit/duplicate with values-as-data, criterion 5 self-contained
  bundle + strict CSP), `**Mode:** mvp`, and the GEN/AST/LP/BRD requirement mapping.
- `.planning/REQUIREMENTS.md` §"LP Generation" (GEN-01 dynamic form, GEN-02 all field types,
  GEN-03 add/remove repeater items, GEN-04 required-by-type validation), §"Assets" (AST-01
  workspace-scoped image upload), §"LP Management" (LP-01 preview, LP-02 edit/regenerate,
  LP-03 duplicate, LP-04 export), §"Brand Settings" (BRD-02 LPs use brand globals).
- `.planning/PROJECT.md` §"Constraints" — static-HTML generation (re-edit = regenerate),
  layout fidelity with variable-size content; §"Key Decisions" — static generation, brand
  globals per workspace.

### Engine integration (Phase 1 — the merge/render contract this phase consumes)
- `src/engine/index.ts` — public surface: `parse(markup) → ParsedSchema`,
  `render(markup, values, brand) → Promise<string>` (HTML), exported types.
- `src/engine/renderer.ts` — `render(markup, values, brand)` signature + per-type sanitization
  (richtext via `sanitizeRichText`, image/button via `sanitizeUrl`, color via
  `sanitizeCssColor`, text auto-escaped by LiquidJS `outputEscape`); repeater items
  preprocessed per item. `strictVariables: false` → undefined values render as `''` (D-05).
- `src/engine/schema.ts` — `ParsedSchema` (`fields[]` with `name`/`type`/`repeater`/`global`,
  `repeaters[]`, `globals[]`, `warnings[]`) — the shape the dynamic form is built from.
- `.planning/phases/01-core-engine-parser-merge/01-CONTEXT.md` — token grammar, D-04 tolerant
  parsing, D-09 `brand.*` resolution at render, security guardrails (SSTI/XSS corpus).

### Template & Brand persistence (Phase 3 — the data this phase reads)
- `apps/web/prisma/schema.prisma` §`model Template` (`markup`, `schema` jsonb,
  `metadataOverlay` jsonb, `schemaVersion`, `workspaceId`) and §`model BrandConfig`
  (`logoUrl`, `primaryColor`, `whatsapp`, `workspaceId @unique`) — the new `LandingPage`/asset
  models follow this tenant-owned pattern.
- `apps/web/src/lib/templates/` (`actions.ts`, `metadata.ts`, `parsed-schema-validator.ts`,
  `schema.ts`) — how templates + metadata overlay + schema are persisted/validated; the form
  consumes `schema.fields` + the metadata overlay (label/required) authored here.
- `apps/web/src/lib/brand/` (`actions.ts`, `schema.ts`) — BrandConfig read path; feeds the
  `brand` argument of `render` (D-04 live resolution).
- `.planning/phases/03-template-authoring-brand-config/03-CONTEXT.md` — D-04/D-05 metadata
  overlay + name-based reconciliation pattern (reused in D-08), D-07 fixed brand field set,
  D-10/D-11 schema_version semantics.

### Tenant isolation (Phase 2 — the layer all new tables & storage paths live behind)
- `apps/web/src/lib/db/tenant-db.ts` — `withTenantDb` / `withWorkspaceTenantDb`: mandatory
  data layer. The `LandingPage` + asset tables MUST be accessed through tenant-scoped helpers,
  never the raw client.
- `apps/web/src/lib/workspaces/guards.ts` — `requireWorkspace` / `requireWorkspaceRole` /
  `WorkspaceContext`; workspaceId + role come from the server session, never client input.
- `apps/web/src/lib/auth/permissions.ts` — role gating (who can generate/edit/delete/export LPs).

### Tech stack
- `CLAUDE.md` — recommended stack for this phase: **React Hook Form** (`useFieldArray` for
  repeaters) + **Zod 4** + `@hookform/resolvers` (form runtime + validation), **LiquidJS** (the
  render motor, already wired in `src/engine`), **@aws-sdk/client-s3** + `s3-request-presigner`
  (presigned image upload), **sanitize-html** (already used by the engine), **archiver** (ZIP
  export), **shadcn/ui + Tailwind** (form/preview UI — introduced in Phase 3), **MinIO** via
  Docker Compose for local S3 emulation.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/engine` (`render`)** — the merge motor is done and security-hardened; Phase 4 calls
  `render(snapshotMarkup, values, liveBrand)` for both preview and export (preview == export).
  No re-implementation — Phase 4 builds the form that produces `values` and the export that
  bundles the output.
- **Phase 3 `Template` + `BrandConfig`** — the form reads `Template.schema` + `metadataOverlay`
  to build inputs; `BrandConfig` feeds the live `brand` arg. New `LandingPage`/asset models
  plug into the same tenant-owned pattern.
- **`withTenantDb` / `requireWorkspace` / `requireWorkspaceRole`** — established Phase 2 helpers;
  LP + asset tables and all LP Server Actions go through them.
- **`apps/web/src/lib/{templates,brand,workspaces}/`** — the established feature-module shape
  (Server Actions + Zod schema + guards); an `lp/` (or `landing-pages/`) module should mirror it.

### Established Patterns
- **Next.js App Router**, workspace-scoped routes under `apps/web/src/app/w/[slug]/...`
  (e.g. `templates/`, `brand/`, `members/`). LP generation/edit/preview pages belong under the
  same `w/[slug]` segment.
- **Server Actions + Zod at the boundary** (see `lib/templates/actions.ts` + `schema.ts`).
- **shadcn/ui + Tailwind** dashboard component layer (introduced Phase 3) — reuse for the form,
  but defer form/preview visual design to `/gsd-ui-phase`.
- Tenant-owned tables use `@@map`, `workspaceId`, RLS-backed `withTenantDb`.

### Integration Points
- `Template` (markup + schema + metadata) → **snapshotted into the LP** at generation (D-06).
- `BrandConfig` → resolved **live** and passed as `render`'s `brand` arg every preview/export (D-04).
- Image upload → presigned PUT to S3-compatible bucket → image URL stored in LP values → on
  export, downloaded + rewritten to `./assets/` in the ZIP (D-09).
- `render` output → preview surface (LP-01) AND export ZIP (LP-04) — identical pipeline.

</code_context>

<specifics>
## Specific Ideas

- The form is the consumer side of the schema authored in Phase 3 — wrapping a block in
  `<!-- repeat:name -->` (Phase 3) must surface here as an add/remove repeater group, the way
  the real Grécia template needs (9 itinerary days, 6 "included" cards, 5 differentiators,
  3 testimonials).
- "Configure once, reference by `brand.<field>`" — brand stays live (D-04) so a workspace-wide
  brand change (new WhatsApp, new logo) propagates to every LP's next preview/export without
  re-editing each LP.
- Each LP should be **self-sufficient and stable**: snapshot the markup so a template edit
  never silently breaks a shipped/old LP (D-06), but allow an explicit "update to new version"
  that reconciles by name (D-08).
- Export should produce a **portable, offline-openable** folder (ZIP with `./assets/`), the way
  a marketing user expects to hand off an LP (D-09).

</specifics>

<deferred>
## Deferred Ideas

- **Catalog organization** (folders, categories, browse/search) — Phase 5 (CAT-01..04). LPs are
  saved here; organizing them is Phase 5.
- **Grécia end-to-end acceptance** — Phase 5 (the v1 acceptance anchor).
- **Advanced field validation** (regex, image dimensions/ranges, numeric) — v2 VAL-01. v1 is
  type + required only.
- **Author-configurable image caps** — v1 uses fixed default size/pixel caps (leans v2 VAL-01).
- **"Configure your brand" advisory warning** when a template uses unset `brand.*` — optional
  planner nice-to-have, not required (D-05 renders empty by default).
- **Platform-hosted LP URLs** — v2 HOST-01; v1 is export/download only.
- **Form/preview visual design** — handled by `/gsd-ui-phase` (UI hint: yes), not decided here.

None of the above blocks Phase 4.

</deferred>

---

*Phase: 4-LP Generation, Assets, Preview & Export*
*Context gathered: 2026-06-08*
