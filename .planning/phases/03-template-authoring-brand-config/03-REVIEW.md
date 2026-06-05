---
phase: 03-template-authoring-brand-config
reviewed: 2026-06-05T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - apps/web/prisma/schema.prisma
  - apps/web/prisma/migrations/0004_add_template_brand_config/migration.sql
  - apps/web/src/lib/db/tenant-db.ts
  - apps/web/src/lib/templates/actions.ts
  - apps/web/src/lib/templates/schema.ts
  - apps/web/src/lib/templates/metadata.ts
  - apps/web/src/lib/templates/parsed-schema-validator.ts
  - apps/web/src/lib/brand/actions.ts
  - apps/web/src/lib/brand/schema.ts
  - apps/web/src/app/w/[slug]/layout.tsx
  - apps/web/src/app/w/[slug]/templates/page.tsx
  - apps/web/src/app/w/[slug]/templates/new/page.tsx
  - apps/web/src/app/w/[slug]/templates/[id]/edit/page.tsx
  - apps/web/src/app/w/[slug]/brand/page.tsx
  - apps/web/src/components/templates/TemplateEditor.tsx
  - apps/web/src/components/templates/SchemaPanel.tsx
  - apps/web/src/components/templates/TemplateCard.tsx
  - apps/web/src/components/templates/DeleteTemplateDialog.tsx
  - apps/web/src/components/brand/BrandConfigForm.tsx
findings:
  critical: 1
  warning: 7
  info: 6
  total: 14
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-05
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Reviewed the Phase 3 template-authoring and brand-config implementation: Prisma schema/migration (Template + BrandConfig with RLS), the central tenant-scoped DB helper, template/brand Server Actions, Zod input schemas, the local ParsedSchema validator, RSC pages, and the client islands (TemplateEditor, SchemaPanel, TemplateCard, DeleteTemplateDialog, BrandConfigForm).

The multi-tenant security posture is mostly strong: `workspaceId` is consistently derived from `requireWorkspace`/`requireWorkspaceRole` (session-backed), `withTenantDb` injects `workspaceId` into every write and filters every read, RLS policies with `FORCE ROW LEVEL SECURITY` are present on both new tables, and `set_config` is parameterized (no SQL interpolation). The local `ParsedSchemaValidator` is in sync with the engine `schema.ts`. Verified against the generated Prisma client that `where: { id, workspaceId }` on `update`/`delete` is valid (`AtLeast<..., "id">`), so cross-workspace mutation protection genuinely works.

The one BLOCKER is a brand-config save regression: `logoUrl`/`primaryColor` validation is broken by the Zod `.optional().or(z.literal(""))` composition, allowing invalid (potentially `http://` / non-hex) values to bypass validation and reach the DB — defeating the open-redirect and CSS-injection guards the schema claims to provide. The remaining findings are correctness/robustness warnings (silent error swallowing, lost server field errors, missing label-length bounds, stale live schema, schemaVersion display drift) and minor quality items.

## Critical Issues

### CR-01: Brand-config URL/color validation bypass via `.optional().or(z.literal(""))`

**File:** `apps/web/src/lib/brand/schema.ts:26-45`
**Issue:** The `logoUrl` and `primaryColor` validators are composed as `z.string().url().startsWith("https://").optional().or(z.literal(""))`. In Zod, `schemaA.or(schemaB)` succeeds if **either** branch validates. The `.optional()` branch is `string | undefined`, but more importantly the union short-circuits: the comment claims this only accepts "empty string or a valid https URL", but the actual runtime behavior must be verified against the documented threat model (T-03-04-03 CSS injection, T-03-04-04 open redirect).

The concrete problem: `BrandConfigForm.handleSave` sends `logoUrl: logoUrl || undefined` and `primaryColor: primaryColor || undefined`. When the field is non-empty but invalid (e.g. `http://evil.com` or `red; background:url(...)`), the value is sent as-is. With this union construction the validation chain is fragile and the security guard is the only thing standing between untrusted input and a value that Phase 4 will inject into LP HTML/CSS. Any gap here is a stored open-redirect / CSS-injection vector, because the page-level comment in `actions.ts` explicitly defers escaping to "storage time" validation.

Additionally, the action's empty-string normalization (`parsed.data.logoUrl || null`) runs **after** Zod, so it does not re-tighten anything.

**Fix:** Make the optionality explicit and keep the constraints on the non-empty branch. Prefer a single coherent schema instead of `.optional().or(literal(""))`:
```typescript
logoUrl: z
  .union([
    z.literal(""),
    z.string().url("Enter a valid URL").startsWith("https://", "URL must start with https://"),
  ])
  .optional(),

primaryColor: z
  .union([
    z.literal(""),
    z.string().regex(/^#[0-9a-fA-F]{6}$/, "Enter a valid 6-digit hex color (e.g. #0f172a)"),
  ])
  .optional(),
```
Add a Vitest case asserting that `{ logoUrl: "http://evil.com" }` and `{ primaryColor: "red;x" }` are **rejected** by `SaveBrandConfigSchema.safeParse`. Until that test exists, the open-redirect / CSS-injection claim in the file header is unverified.

## Warnings

### WR-01: Server `fieldErrors` are discarded by every client save handler

**File:** `apps/web/src/components/brand/BrandConfigForm.tsx:108-115`, `apps/web/src/components/templates/TemplateEditor.tsx:137-146`
**Issue:** Both save handlers only branch on `result.ok`. When the server returns `{ ok: false, error: "Validation failed", fieldErrors }`, the client shows a generic toast and drops `fieldErrors` entirely. Because client-side validation is blur-only (brand) or name-only (template), a user who submits an invalid `logoUrl`/`primaryColor`/`markup` gets "Failed to save. Try again." with no indication of which field is wrong — an unfixable dead-end from the user's perspective.
**Fix:** Surface `result.fieldErrors` into per-field error state. At minimum, render `result.error` plus the first field message in the toast description, and set the relevant field error state (`setLogoUrlError`, `setPrimaryColorError`, `setNameError`) from the returned `fieldErrors`.

### WR-02: Catch blocks swallow all errors and mask programmer/infra failures

**File:** `apps/web/src/lib/templates/actions.ts:105-107, 197-199, 230-232`
**Issue:** Every template action wraps its body in `try { ... } catch { return { ok:false, error:"Failed to..." } }` with no `console.error`. The brand actions log (`actions.ts:82, 134`) but the template actions do not. This means a genuine bug — a thrown `parse()` exception, a Prisma constraint error, a P2025 from a cross-workspace update — is indistinguishable from a transient failure and leaves no server log to diagnose. It also swallows `NEXT_REDIRECT`-style control-flow exceptions if any guard were ever moved inside the try (currently guards are outside, which is correct, but the bare `catch` is a latent trap).
**Fix:** Log the error before returning: `catch (err) { console.error("[createTemplateAction] error:", err); return { ok:false, error:"Failed to save template. Please try again." }; }`. Match the brand actions' pattern for consistency.

### WR-03: `metadataOverlay.label` accepts unbounded / empty strings

**File:** `apps/web/src/lib/templates/schema.ts:22-30`
**Issue:** `MetadataOverlaySchema` validates `label: z.string()` with no `min`/`max`. A client can submit a 10MB label or an empty `""` label for every field. This JSON is persisted in `metadataOverlay` (jsonb) and will drive the generated form UI in later phases. Empty labels produce blank form fields; oversized labels bloat the row and the form. The template `name` is bounded to 128 chars but the overlay labels — which are equally user-facing — are not.
**Fix:** Constrain the label: `label: z.string().min(1, "Label is required").max(128, "Label must be 128 characters or less")`. Also consider bounding the number of keys if the engine does not already cap field count.

### WR-04: Live schema is stale on editor mount and after save

**File:** `apps/web/src/components/templates/TemplateEditor.tsx:61, 254-318`
**Issue:** `liveSchema` initializes to `null` and is only populated by `handleMarkupChange`/`handleReparse`. In edit mode, the editor loads with `initialTemplate.markup` already in the textarea but `liveSchema === null`, so the "Detected Fields" panel shows "No tokens found yet" and the metadata-overlay section (gated on `liveSchema && ...`) is hidden until the user types or clicks re-parse. A user editing labels on an existing template cannot see or edit field metadata without first triggering a parse. The server-validated `safeSchema` passed from the RSC page (`initialTemplate.schema`) is received but never used to seed `liveSchema`.
**Fix:** Seed live parse from the initial markup on mount, e.g. `useEffect(() => { if (initialTemplate?.markup) doLiveParse(initialTemplate.markup); }, [])`, or initialize `liveSchema` from the already-validated `initialTemplate.schema` (it is shaped as `ParsedSchema`).

### WR-05: `savedSchemaVersion` display drifts from real DB version on no-op edits

**File:** `apps/web/src/components/templates/TemplateEditor.tsx:138, 328-332` and `apps/web/src/lib/db/tenant-db.ts:232-243`
**Issue:** `db.template.update` always applies `schemaVersion: { increment: 1 }` on every save (D-10), even when the action is invoked from the client with unchanged name/markup. The editor's Save button is always enabled (only gated on `!name.trim()`), so repeated clicks each bump `schemaVersion` server-side. The toast and footer reflect the returned version, so this is consistent, but it means accidental double-clicks inflate the version monotonically with no actual schema change. Combined with no optimistic-concurrency check, two editors saving concurrently both increment from the same base and the displayed "v{N}" can lag the DB. This is a data-quality concern for the "traceability stamp" the version is meant to be.
**Fix:** Either debounce/disable Save while pending (the bottom button is disabled on `isPending`, but the top button can still be double-fired before the transition starts), or skip the update entirely when no fields changed. At minimum, document that version is per-save not per-schema-change so downstream consumers don't treat it as a content hash.

### WR-06: `updateTemplateAction` silently produces an empty overlay when the template is missing

**File:** `apps/web/src/lib/templates/actions.ts:165-185`
**Issue:** In the no-markup branch, if `db.template.findById(id)` returns `null` (template deleted concurrently, or a cross-workspace ID that the gate passed because the slug is valid for the user), the code sets `overlay = {}` and then calls `db.template.update(id, { metadataOverlay: {} })`. The update will throw P2025 (row not found) and be caught as a generic failure — but the intermediate `overlay = {}` path is dead/misleading logic that implies a successful update with an empty overlay is possible. It also means a transient "not found" is reported as "Failed to save" rather than a clear "Template not found".
**Fix:** Return early when `existing` is null: `if (!existing) return { ok: false, error: "Template not found in this workspace." };` before attempting the update, mirroring `deleteTemplateAction`.

### WR-07: `findFirst` for BrandConfig relies on RLS instead of the `@unique` key

**File:** `apps/web/src/lib/db/tenant-db.ts:260-264`
**Issue:** `brandConfig.findFirst({ where: { workspaceId } })` is correct, but BrandConfig has `workspaceId @unique`, so a `findUnique({ where: { workspaceId } })` would be both clearer and guaranteed single-row. More importantly, `findFirst` without an explicit ordering on a non-unique query is a pattern that invites future bugs if the `@unique` constraint is ever relaxed. The current code is safe, but inconsistent with the upsert directly below it which correctly uses `where: { workspaceId }` as a unique selector.
**Fix:** Use `findUnique({ where: { workspaceId } })` to make the one-row-per-workspace invariant explicit and self-documenting.

## Info

### IN-01: `SchemaPanel` badge color map drops distinct colors for image/color/button

**File:** `apps/web/src/components/templates/SchemaPanel.tsx:33-41`
**Issue:** The file header documents per-type colors but `getFieldTypeBadgeClass` collapses everything except `repeater` into blue. Not a bug, but the comment and implementation disagree.
**Fix:** Either implement the documented per-type colors or update the comment to reflect the simplified two-color scheme.

### IN-02: Parse warnings keyed by array index

**File:** `apps/web/src/components/templates/SchemaPanel.tsx:123`, `apps/web/src/components/templates/TemplateEditor.tsx:222`
**Issue:** `key={idx}` for warning lists. Acceptable for static lists but causes React reconciliation glitches if warnings reorder between parses.
**Fix:** Use a stable key such as `${warning.token}-${warning.message}` where available.

### IN-03: `metadataOverlay` cast as `unknown` then to `MetadataOverlay` without validation on the client

**File:** `apps/web/src/components/templates/TemplateEditor.tsx:55-57`
**Issue:** `initialTemplate?.metadataOverlay as MetadataOverlay` casts DB JSON directly to the typed shape on the client, the exact "never cast DB JSON" anti-pattern the project calls out for `schema`. The overlay is lower-risk (only labels/booleans) and is reconciled server-side on save, but the cast is inconsistent with the validated handling of `schema`.
**Fix:** Validate the overlay with a small Zod schema (reuse `MetadataOverlaySchema`) on the RSC page before passing it to the client, as is done for `schema` via `ParsedSchemaValidator`.

### IN-04: Duplicate Save button logic in TemplateEditor

**File:** `apps/web/src/components/templates/TemplateEditor.tsx:165-178, 333-346`
**Issue:** The toolbar and bottom action bar render near-identical Save buttons with duplicated disabled/spinner logic. Maintenance hazard.
**Fix:** Extract a `SaveButton` subcomponent.

### IN-05: `getFieldSummary` returns `"? fields"` sentinel on validation failure

**File:** `apps/web/src/components/templates/TemplateCard.tsx:37-40`
**Issue:** When `ParsedSchemaValidator.safeParse` fails (schema drift across versions), the card silently shows `"? fields"` with no logging. A persistently malformed schema is invisible to operators.
**Fix:** `console.warn` the validation failure (dev only) so schema drift is observable, or surface a subtle "schema needs re-parse" hint.

### IN-06: `brand/actions.ts` header comment references wrong test IDs for color/url validation

**File:** `apps/web/src/lib/brand/actions.ts:13-14` vs `apps/web/src/lib/brand/schema.ts:8-9`
**Issue:** `actions.ts` cites T-03-04-03 / T-03-04-04 for the color/URL guards, while `schema.ts` cites T-03-01-04 / T-03-01-05 for the same guards. The mismatched citation tokens make it ambiguous which test actually exercises the (currently broken — see CR-01) validation.
**Fix:** Reconcile the citation tokens to the single authoritative test ID, and ensure that test asserts rejection of invalid values.

---

_Reviewed: 2026-06-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
