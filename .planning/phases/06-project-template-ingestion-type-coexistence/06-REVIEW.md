---
phase: 06-project-template-ingestion-type-coexistence
reviewed: 2026-06-19T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - apps/web/prisma/migrations/0006_kind_discriminator/migration.sql
  - apps/web/prisma/schema.prisma
  - apps/web/src/app/api/lps/[lpId]/export/route.ts
  - apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx
  - apps/web/src/app/w/[slug]/project-templates/new/page.tsx
  - apps/web/src/app/w/[slug]/project-templates/new/ProjectTemplateForm.tsx
  - apps/web/src/components/catalog/CatalogGrid.tsx
  - apps/web/src/components/catalog/LpCatalogCard.tsx
  - apps/web/src/components/templates/TemplateCard.tsx
  - apps/web/src/lib/db/tenant-db.ts
  - apps/web/src/lib/lps/actions.ts
  - apps/web/src/lib/lps/render.ts
  - apps/web/src/lib/project-templates/actions.ts
  - apps/web/src/lib/project-templates/s3-upload.ts
  - apps/web/src/lib/project-templates/schema.ts
  - apps/web/src/lib/project-templates/secret-scan.ts
  - apps/web/src/lib/project-templates/zip-validate.ts
  - apps/web/src/lib/templates/actions.ts
  - apps/web/tests/type-boundary.test.ts
  - apps/web/vitest.config.ts
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: resolved
resolved: 2026-06-19T11:15:00Z
resolution_note: "12 of 13 findings fixed (commits 0f12e68, bff03fe, 72ed9b4, a86e7f9, d4cae0f, 61c3a55, e7c2ef9, 72a00b7). IN-02 (placeholder MIME/size) intentionally deferred to Plan 03 per existing code comments."
---

## Resolution Log (2026-06-19)

| ID | Status | Commit | Note |
|----|--------|--------|------|
| CR-01 | Fixed | a86e7f9 | Tenant-prefix guard on client-supplied S3 key before GetObject/DeleteObject |
| CR-02 | Fixed | 0f12e68 | Fail-closed `parseMb()` with `Number.isFinite(n) && n > 0` |
| WR-01 | Fixed | bff03fe | Defer redirect when findings exist; findings section renders + continue button |
| WR-02 | Fixed | 61c3a55 | Export route returns 409 for VITE_SPA instead of opaque 500 |
| WR-03 | Fixed | a86e7f9 | `generateLpAction` rejects VITE_SPA templates up front |
| WR-04 | Fixed | a86e7f9, d4cae0f | `kind` propagated to `lp.create`; helper accepts `kind` |
| WR-05 | Fixed | 72ed9b4 | Uncompressed-size error message interpolates real limit |
| WR-06 | Fixed | e7c2ef9 | Stream-level byte accounting aborts on actual-size overflow |
| IN-01 | Fixed | a86e7f9 | `ctx` captured (folded into CR-01 fix) |
| IN-02 | Deferred | — | MIME/size placeholders documented as Plan 03 scope |
| IN-03 | Fixed | 61c3a55 | Asset extraction covers single-quoted `src` and `srcset` |
| IN-04 | Fixed | 61c3a55 | Empty slug falls back to `landing-page` |
| IN-05 | Fixed | 72a00b7 | Test asserts rendered HTML content, not just truthiness |


# Phase 6: Code Review Report

**Reviewed:** 2026-06-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 6 adds VITE_SPA project-template ingestion (ZIP upload, validation, secret scan,
multi-file S3 upload) and a `kind` discriminator that coexists with existing LIQUID
templates/LPs. The zip-slip prevention, tenant-scoped S3 prefix construction, RLS
discriminator migration, and the `renderLp()` LIQUID/VITE_SPA type-boundary guard are
well-constructed and hold up to the threat scenarios in scope.

Two genuinely blocking problems exist. First, `validateUploadedImageAction`
(`lib/lps/actions.ts`) accepts an arbitrary S3 `key` from the client and will issue a
`DeleteObjectCommand` against it without verifying the key belongs to the caller's
workspace — a cross-tenant object-deletion / DoS primitive available to any editor.
Second, the size-limit env parsing in `zip-validate.ts` silently disables the
zip-bomb and compressed-size caps if the env var is non-numeric (`parseInt` → `NaN`,
and every `> NaN` comparison is `false`), defeating the very controls the file exists
to enforce.

Several correctness/robustness defects round out the findings: the project-template
upload form navigates away before the secret-scan findings it just stored can render;
the export route and LP-generation path throw an unhandled "Type boundary violation"
when a VITE_SPA record reaches them, surfacing as opaque 500s/generic errors instead of
a handled state; and a hardcoded "200 MB" string in an error message diverges from the
configurable limit.

## Critical Issues

### CR-01: Cross-tenant S3 object deletion via unscoped `key` in `validateUploadedImageAction`

**File:** `apps/web/src/lib/lps/actions.ts:564-616`
**Issue:** The action gates on `requireWorkspaceRole(slug, ...)` but then trusts
`input.key` verbatim. It issues a ranged `GetObjectCommand` and, if the pixel cap is
exceeded, a `DeleteObjectCommand` on that exact key. The key is never checked against
the caller's tenant prefix (`workspaces/{ctx.workspaceId}/`). An authenticated editor in
workspace A can pass any key from workspace B (or any other tenant's asset key) and force
its deletion by supplying a key that points at an over-sized image, or simply enumerate
and probe other tenants' objects. This breaks the tenant-isolation guarantee that the
rest of the codebase carefully maintains, and `validateUploadedImageAction` does not even
capture the `ctx` returned by the guard.
**Fix:**
```ts
const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

const expectedPrefix = `workspaces/${ctx.workspaceId}/lps/assets/`;
if (!input.key.startsWith(expectedPrefix)) {
  return { ok: false, error: "Invalid object key." };
}
// ...proceed with GetObject/DeleteObject only after the prefix check
```
Apply the same prefix guard anywhere a client-supplied S3 key is acted on.

### CR-02: Non-numeric size-limit env vars silently disable zip-bomb / compressed-size caps

**File:** `apps/web/src/lib/project-templates/zip-validate.ts:29-43, 82-90`
**Issue:** `MAX_COMPRESSED_BYTES` and `MAX_UNCOMPRESSED_BYTES` are computed with
`parseInt(process.env.X ?? "50") * 1024 * 1024`. `parseInt` returns `NaN` for any
non-numeric value (e.g. `"50MB"`, `"unlimited"`, an accidental empty string after a
config edit). `NaN * 1024 * 1024` is `NaN`, and every `length > NaN` / `totalUncompressed
> NaN` comparison evaluates to `false` — so a misconfigured env var disables the
compressed-size cap and the zip-bomb cap entirely, with no error. This is a fail-open
security control: a single bad env value removes the protection the module exists to
provide.
**Fix:**
```ts
function parseMb(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
const MAX_COMPRESSED_MB = parseMb(process.env.PROJECT_TEMPLATE_MAX_ZIP_MB, 50);
const MAX_UNCOMPRESSED_MB = parseMb(process.env.PROJECT_TEMPLATE_MAX_UNCOMPRESSED_MB, 200);
const MAX_COMPRESSED_BYTES = MAX_COMPRESSED_MB * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = MAX_UNCOMPRESSED_MB * 1024 * 1024;
```
Use the resolved numeric values in the error strings too (see WR-05).

## Warnings

### WR-01: Secret-scan findings are stored then immediately discarded by navigation

**File:** `apps/web/src/app/w/[slug]/project-templates/new/ProjectTemplateForm.tsx:43-52`
**Issue:** On success with findings, the handler calls `setFindings(result.data.findings)`,
shows a warning toast, and then unconditionally calls `router.push(...)` in the same tick.
The component unmounts on navigation, so the "Security Warnings" `<section>` (lines
109-121) that renders `findings` never appears — the user is redirected away before they
can read which baked credentials were detected. This defeats the advisory purpose of the
secret scan (T-06-08). The toast text even says "Review the findings below," but there is
nothing below to review.
**Fix:** Do not redirect when findings exist; let the user read them and provide an
explicit "Continue to templates" action. Alternatively, persist findings (query param /
state) so the destination page can surface them.
```ts
if (result.data.findings.length > 0) {
  setFindings(result.data.findings);
  toast.warning(`Template created with ${result.data.findings.length} security warning(s).`);
  return; // stay on page so findings render; user navigates manually
}
toast.success("Project template created.");
router.push(`/w/${slug}/templates`);
```

### WR-02: VITE_SPA records hitting the export route produce an opaque 500

**File:** `apps/web/src/app/api/lps/[lpId]/export/route.ts:178-190`
**Issue:** The route calls `renderLp({ ..., kind: lp.kind ?? "LIQUID" }, db)` for any LP.
`renderLp` throws "Type boundary violation" for `kind === "VITE_SPA"`
(`lib/lps/render.ts:50-54`). That throw is caught by the route's generic `catch` (line
265) and returned as a 500 "Export failed". A VITE_SPA LP (which is a valid record per the
new discriminator) cannot be exported through this path, and the failure is indistinguishable
from a real server error. The boundary is correctly enforced, but the caller does not handle
the documented rejection.
**Fix:** Branch on `lp.kind` before rendering and return a clear response (e.g. 409 with a
message that VITE_SPA export uses a different path, or route to the VITE_SPA serve/export
flow). Do not let the boundary error fall through to a 500.

### WR-03: Generating an LP from a VITE_SPA template fails with a generic error

**File:** `apps/web/src/lib/lps/actions.ts:171-191`
**Issue:** `generateLpAction` fetches a template by id and unconditionally snapshots
`template.markup` and calls `renderLp({ ..., kind: template.kind ?? "LIQUID" }, db)`. For a
VITE_SPA template, `markup` is `""` and `renderLp` throws the type-boundary error, which the
outer `catch` converts to "Failed to generate landing page." There is no guard rejecting LP
generation from a VITE_SPA template up front, so the operation is allowed to begin and then
fails confusingly. A VITE_SPA template should not be a valid source for the LIQUID generate
flow at all.
**Fix:** After `db.template.findById`, reject early:
```ts
if (template.kind === "VITE_SPA") {
  return { ok: false, error: "This template type cannot generate LiquidJS landing pages." };
}
```

### WR-04: `generateLpAction` persists LP with default `kind` instead of the template's kind

**File:** `apps/web/src/lib/lps/actions.ts:194-200` and `lib/db/tenant-db.ts:143-149`
**Issue:** `db.lp.create` does not accept or set `kind`, so every generated LP defaults to
`"LIQUID"` at the DB level regardless of the source template's kind. Combined with WR-03,
the discriminator on `LandingPage` is effectively never written by the generate path —
meaning the `kind` column on LPs cannot be trusted to reflect the originating template, and
downstream branches that key on `lp.kind` (export, preview, catalog badge) will always see
`"LIQUID"`. If VITE_SPA LPs are intended to exist, the create helper must propagate `kind`.
**Fix:** Add `kind` to `TenantLpHelpers.create` and pass `template.kind` from
`generateLpAction` (once WR-03's guard decides VITE_SPA is/ isn't permitted here).

### WR-05: Hardcoded "200 MB" in error message diverges from configurable limit

**File:** `apps/web/src/lib/project-templates/zip-validate.ts:88`
**Issue:** The uncompressed-size error message is the literal string "ZIP total uncompressed
size exceeds the 200 MB limit." but the actual limit comes from
`PROJECT_TEMPLATE_MAX_UNCOMPRESSED_MB`. If that env var is set to anything other than 200,
the message lies to the user. (The compressed-size message at line 41 correctly interpolates
the env value; this one does not.)
**Fix:** Interpolate the resolved limit, e.g. `` `...exceeds the ${MAX_UNCOMPRESSED_MB} MB limit.` `` using the parsed numeric constant from CR-02's fix.

### WR-06: Decompressed bytes are buffered without enforcing the cap during streaming

**File:** `apps/web/src/lib/project-templates/zip-validate.ts:98-114`
**Issue:** The zip-bomb cap is checked against the central-directory-declared
`entry.uncompressedSize` *before* opening the stream (line 83-84), but the actual inflate
stream is then read fully into `chunks` with no running byte accounting and no abort if the
real decompressed output exceeds the declared/total size. yauzl validates declared size on
`end`, but a stream-level guard is the defense-in-depth the comment claims. A malicious or
malformed entry that under-declares its size still gets fully buffered into memory before
any mismatch is detected.
**Fix:** Track a running byte total inside the `data` handler and destroy the stream +
resolve with an error once `runningTotal + chunk.length` would exceed `MAX_UNCOMPRESSED_BYTES`,
rather than relying solely on the pre-read declared size.

## Info

### IN-01: `validateUploadedImageAction` discards the guard's return context

**File:** `apps/web/src/lib/lps/actions.ts:568`
**Issue:** `await requireWorkspaceRole(slug, [...])` is called for its side effect but the
returned `ctx` (with `workspaceId`) is not captured — which is precisely why CR-01 was
possible. Capturing it makes the tenant-scoping fix natural and signals intent.
**Fix:** `const ctx = await requireWorkspaceRole(...)` and use `ctx.workspaceId`.

### IN-02: LP-asset MIME type and file size persisted as placeholders

**File:** `apps/web/src/lib/lps/actions.ts:211-212`
**Issue:** `mimeType: "image/jpeg"` and `fileSize: 0` are hardcoded placeholders for every
generated LP asset, regardless of the real upload. Any feature relying on these columns
(cleanup reporting, content-type on re-serve) will read incorrect data.
**Fix:** Carry the real MIME/size through the ImageFieldValue payload (already validated in
`requestPresignedUploadAction`) instead of writing constants.

### IN-03: `extractS3ImageUrls` regex misses `srcset` and single-quoted `src`

**File:** `apps/web/src/app/api/lps/[lpId]/export/route.ts:84, 95`
**Issue:** The `<img>` pattern only matches `src="..."` (double-quoted). Single-quoted
`src='...'` and `srcset="..."` S3 URLs are not extracted, so those images are not bundled
and remain absolute S3 references in the "self-contained" export, breaking offline use.
Not a correctness bug for the common server-rendered output, but a fidelity gap for the
export guarantee.
**Fix:** Extend the patterns to cover single quotes and `srcset`, or parse with an HTML
parser rather than regex.

### IN-04: Export filename can collapse to `.zip` for non-ASCII LP names

**File:** `apps/web/src/app/api/lps/[lpId]/export/route.ts:256-262`
**Issue:** `slugify(lp.name, { strict: true })` strips characters it cannot transliterate;
an LP named entirely in non-Latin script or symbols can produce an empty slug, yielding a
`Content-Disposition` filename of `.zip`.
**Fix:** Fall back to a default when the slug is empty: `const slug = slugify(...) || "landing-page";`

### IN-05: Type-boundary test uses `as any` mock that does not exercise the LIQUID path fully

**File:** `apps/web/tests/type-boundary.test.ts:28-34`
**Issue:** The LIQUID test mocks only `brandConfig.findFirst`. It asserts the call resolves
truthy but does not assert the rendered output, so a regression that returns an empty or
malformed string would still pass. Adequate for the boundary assertion, but weak as a render
regression guard.
**Fix:** Assert on the rendered HTML content (e.g. that `"Test"` appears in the output) to
catch silent render breakage.

---

_Reviewed: 2026-06-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
