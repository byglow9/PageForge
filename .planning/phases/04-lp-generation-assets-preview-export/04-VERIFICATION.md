---
phase: 04-lp-generation-assets-preview-export
verified: 2026-06-09T17:05:00Z
status: verified
human_verified: 2026-06-23
human_verified_result: "APPROVED — all 5 human-verification items (T1–T5) passed manual UAT by workspace owner"
score: 10/10
overrides_applied: 0
human_verification:
  - test: "End-to-end LP generation: select template, fill form (all field types including image upload), click Generate LP, confirm redirect to preview page, confirm rendered iframe shows layout-faithful HTML"
    expected: "LP rendered in srcdoc iframe, brand globals resolved from live BrandConfig, image uploaded to MinIO and shown correctly"
    why_human: "Requires running application with MinIO running, real template in DB, and a browser to verify visual output"
  - test: "Repeater add/remove: on the generation form, use the '+ Add' button in a repeater block to add 2 items, fill fields, remove one, generate LP, confirm only 1 repeater item appears in the preview HTML"
    expected: "Repeater items correctly reflected in rendered LP"
    why_human: "Interaction-dependent behavior requiring browser form manipulation"
  - test: "Edit mode + schema version mismatch (D-08): create an LP, then bump the template's schemaVersion (edit the template), reopen the LP edit page, verify the 'Template updated' alert appears with 'Apply new version' button, click it, confirm values are reconciled and LP saves"
    expected: "Alert shown, reconcileLpValues runs, LP updates to new snapshot without losing compatible field values"
    why_human: "Requires two-step state mutation across sessions; schema version bump is write operation"
  - test: "Export ZIP: from LP preview toolbar click Export ZIP, unzip the downloaded file, open index.html in browser, verify: (a) images render from ./assets/ relative paths, (b) <head> contains CSP meta tag with 'default-src none', (c) layout matches preview"
    expected: "Self-contained ZIP with working relative asset paths and strict CSP; preview == export fidelity"
    why_human: "Requires filesystem inspection of downloaded ZIP and visual comparison against browser preview"
  - test: "Image upload pixel cap: upload a PNG larger than 5000x5000 px via the ImageUploadField, confirm the field transitions to the error state with the pixel-cap message, and the S3 object is deleted"
    expected: "validateUploadedImageAction returns error, S3 object deleted via DeleteObjectCommand, field shows error state"
    why_human: "Requires a 5000+ px test image and a running MinIO instance to confirm S3 deletion"
---

# Phase 04: LP Generation, Assets, Preview & Export — Verification Report

**Phase Goal:** Deliver the core promise — selecting a template generates a dynamic form whose filled values merge into a previewable, editable, duplicable, and exportable static-HTML landing page, with image upload and globals resolved automatically.
**Verified:** 2026-06-09T17:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Selecting a template opens a dynamic form from its schema, supporting all field types and add/remove of repeatable blocks, with required validation; globals pre-bound from brand config | VERIFIED | `LpForm.tsx:157-163` derives schema via `deriveZodSchema()`; `schema-derive.ts:46-143` handles all field types; `RepeaterBlock.tsx:68` uses `useFieldArray` with append/remove; `BrandGlobalsPanel.tsx` shown at `LpForm.tsx:304`; required validation via `schema-derive.ts:54,59` |
| 2 | User can upload images for image fields (magic-bytes validated, size/pixel-capped, tenant-scoped path) and they appear in the generated LP | VERIFIED | `requestPresignedUploadAction` (`actions.ts:484-539`) validates magic bytes via dynamic `file-type` import (`actions.ts:506`); pixel cap via `validateUploadedImageAction` (`actions.ts:557-609`); tenant path `workspaces/${ctx.workspaceId}/lps/assets/` (`actions.ts:518`); `ImageUploadField.tsx` wired in `LpForm.tsx:421` and `RepeaterBlock.tsx:237`; `extractImageFieldValues` unwraps `{publicUrl, s3Key}` for `renderLp` (`actions.ts:90-127`) |
| 3 | User can preview a rendered LP at any time, using the exact same merge pipeline as export (preview == export) | VERIFIED | Preview RSC (`preview/page.tsx:46`) and export route (`route.ts:182`) both call `renderLp()` from `lib/lps/render.ts`; `render.ts` has NO `"use server"` directive (comments only at lines 4-5); `LpPreview.tsx:65-66` uses `srcDoc={html}` with `sandbox="allow-same-origin"` |
| 4 | User can reopen and edit an LP's data and regenerate its HTML, and can duplicate a variation (values as data, HTML derived) | VERIFIED | Edit page (`edit/page.tsx`) re-parses from `markupSnapshot`, fetches live brand, passes to `LpForm mode="edit"`; D-08 mismatch alert at `LpForm.tsx:307-335`; `duplicateLpAction` creates `"Copy of ${origin.name}"` independent copy (`actions.ts:309-315`); `reconcileLpValues` exported from `reconcile.ts:33` and called from `LpForm.tsx:223` |
| 5 | User can export/download LP as self-contained HTML bundle with working asset paths and strict CSP baked in | VERIFIED | `route.ts` extracts S3 URLs via `extractS3ImageUrls()` (3 patterns: img src, style attr, style block); rewrites to `./assets/{filename}`; injects CSP meta `default-src 'none'` (`route.ts:53`); streams via `archiver.ZipArchive` + `Readable.toWeb()` (`route.ts:237,252`); auth gate: `auth.api.getSession` + member IDOR check (`route.ts:151-175`) |

**Score: 10/10 truths verified** (5 roadmap SCs + all plan must-haves confirmed)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/docker-compose.yml` | MinIO service | VERIFIED | `minio` service defined, ports 9000/9001, image `minio/minio:latest` |
| `apps/web/.env.example` | S3 env vars | VERIFIED | S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_BASE_URL, S3_FORCE_PATH_STYLE all present |
| `apps/web/next.config.ts` | transpilePackages file-type | VERIFIED | `transpilePackages: ["pageforge-engine", "file-type"]` |
| `apps/web/prisma/schema.prisma` | LandingPage + LpAsset models | VERIFIED | `model LandingPage` (line 245), `model LpAsset` (line 265), `@@map("landing_page")`, `@@map("lp_asset")`; Workspace has `landingPages LandingPage[]` (line 151) and `lpAssets LpAsset[]` (line 152) |
| `apps/web/src/lib/db/tenant-db.ts` | TenantLpHelpers + TenantAssetHelpers | VERIFIED | `TenantLpHelpers` (line 139), `TenantAssetHelpers` (line 177), both in `TenantClient` (lines 207-209); all helpers enforce `workspaceId` scope in every query |
| `apps/web/src/lib/lps/render.ts` | renderLp() without "use server" | VERIFIED | Exported at line 42; NO `"use server"` directive (lines 4-5 are comments only); brand scope keys `logo`, `primary_color`, `whatsapp` at lines 52-54 |
| `apps/web/src/lib/lps/schema.ts` | GenerateLpSchema + UpdateLpSchema | VERIFIED | Both exported; `name` min(1) max(128) trim() validated |
| `apps/web/src/lib/lps/schema-derive.ts` | deriveZodSchema(fields, overlay) | VERIFIED | Exported at line 35; handles text, richtext, image (union with `{publicUrl,s3Key}`), color, button, repeaters |
| `apps/web/src/lib/lps/reconcile.ts` | reconcileLpValues (D-08) | VERIFIED | Exported at line 33; keeps matching fields, defaults new fields by type, drops removed fields |
| `apps/web/src/lib/lps/actions.ts` | 6 LP actions + 2 image actions | VERIFIED | `generateLpAction`, `updateLpAction`, `duplicateLpAction`, `deleteLpAction`, `listLpsAction`, `getLpAction`, `requestPresignedUploadAction`, `validateUploadedImageAction`; `"use server"` at line 32 |
| `apps/web/src/components/lps/LpForm.tsx` | Dynamic form (generate + edit) | VERIFIED | `"use client"`; `deriveZodSchema` + `zodResolver` + `useFieldArray`; all field types handled; D-08 mismatch alert; brand globals panel; sticky submit bar |
| `apps/web/src/components/lps/RepeaterBlock.tsx` | Collapsible repeater with useFieldArray | VERIFIED | `"use client"`; `useFieldArray` with `append`/`remove`; expanded by default; all field types rendered including ImageUploadField |
| `apps/web/src/components/lps/RichTextField.tsx` | Tiptap editor via Controller | VERIFIED | `"use client"`; inner `RichTextEditor` owns `useEditor` (not in Controller render prop); `immediatelyRender: false` (line 35); 5 toolbar buttons |
| `apps/web/src/components/lps/ImageUploadField.tsx` | Drag/drop upload with presigned PUT | VERIFIED | `"use client"`; XHR upload (`line 139`); 4 states (idle/uploading/uploaded/error); `requestPresignedUploadAction` + `validateUploadedImageAction`; stores `{publicUrl, s3Key}` object |
| `apps/web/src/components/lps/BrandGlobalsPanel.tsx` | Read-only brand globals display | VERIFIED | Shows logo, primary_color, whatsapp; "(not configured)" fallback; link to `/w/${slug}/brand` |
| `apps/web/src/components/lps/LpCard.tsx` | LP card with all actions | VERIFIED | Preview/Edit links; kebab with Duplicate, Export ZIP (`/api/lps/${lp.id}/export`), Delete; `DeleteLpDialog` with confirmation |
| `apps/web/src/components/lps/LpPreview.tsx` | Preview iframe | VERIFIED | `srcDoc={html}`; `sandbox="allow-same-origin"`; Export ZIP anchor to `/api/lps/${lp.id}/export`; Back/Edit toolbar |
| `apps/web/src/app/w/[slug]/lps/page.tsx` | LP list page | VERIFIED | `requireWorkspace`; `listLpsAction`; `LpCard` grid; empty state "No landing pages yet" |
| `apps/web/src/app/w/[slug]/lps/new/page.tsx` | Template picker page | VERIFIED | RSC shell with `TemplatePickerForm` client island; shadcn Select; "Select a template…" placeholder |
| `apps/web/src/app/w/[slug]/lps/new/[templateId]/page.tsx` | LP generation form page | VERIFIED | `requireWorkspaceRole`; `ParsedSchemaValidator.safeParse`; fetches live brand config; passes to `LpForm mode="generate"` |
| `apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx` | LP preview RSC page | VERIFIED | `requireWorkspace`; `renderLp()` called server-side; `LpPreview` receives html string; render failure fallback UI |
| `apps/web/src/app/w/[slug]/lps/[lpId]/edit/page.tsx` | LP edit RSC page | VERIFIED | `requireWorkspaceRole`; `parse()` only (not render) from pageforge-engine; source template fetched for D-08; values Zod-validated; `LpForm mode="edit"` |
| `apps/web/src/app/api/lps/[lpId]/export/route.ts` | ZIP export route handler | VERIFIED | `auth.api.getSession` + member IDOR check; `renderLp()`; `extractS3ImageUrls` (3 patterns); `rewriteImageSrcs`; `injectCsp`; `ZipArchive` + `Readable.toWeb()`; `slugify` for filename |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `preview/page.tsx` | `lib/lps/render.ts` | `renderLp({markupSnapshot, values}, db)` | WIRED | `render.ts` imported at page line 20; called at line 46 |
| `export/route.ts` | `lib/lps/render.ts` | `renderLp({markupSnapshot, values}, db)` | WIRED | `render.ts` imported at route line 34; called at line 182 |
| `render.ts` | `pageforge-engine` | `import { render }` | WIRED | Line 17; brand scope passed as `{logo, primary_color, whatsapp}` |
| `LpForm.tsx` | `lib/lps/schema-derive.ts` | `deriveZodSchema(fields, overlay) → zodResolver` | WIRED | Imported at line 30; called via `useMemo` at line 159 |
| `LpForm.tsx` | `lib/lps/actions.ts` | `generateLpAction` / `updateLpAction` | WIRED | Imported at line 31; called in `onSubmit` at lines 257/276 |
| `RepeaterBlock.tsx` | `react-hook-form` | `useFieldArray({control, name})` | WIRED | Imported at line 23; used at line 68 |
| `ImageUploadField.tsx` | `lib/lps/actions.ts` | `requestPresignedUploadAction` + `validateUploadedImageAction` | WIRED | Both imported at line 29; called at lines 119 and 182 |
| `ImageUploadField.tsx` | S3 bucket | `XHR PUT to presignedUrl` | WIRED | `new XMLHttpRequest()` at line 139; PUT at line 159 |
| `tenant-db.ts` | `prisma/landing_page` | `tx.landingPage.create/findFirst/findMany/update/delete` | WIRED | All 5 operations present in `lp:` block (lines 349-397) |
| `actions.ts` | `lib/lps/render.ts` | `import { renderLp }` (NOT pageforge-engine directly) | WIRED | Line 38 imports from `./render`; no direct `pageforge-engine` render import confirmed |
| `LpCard.tsx` + `LpPreview.tsx` | `export/route.ts` | `href=/api/lps/${id}/export` | WIRED | `LpCard.tsx:158`, `LpPreview.tsx:52` |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `LpPreview.tsx` | `html` prop | RSC `preview/page.tsx` → `renderLp()` → LiquidJS merge | DB query (`db.lp.findById`) + engine render | FLOWING |
| `LpForm.tsx` | `initialValues` | RSC `edit/page.tsx` → `db.lp.findById(lpId)` | DB query | FLOWING |
| `BrandGlobalsPanel.tsx` | `brand` prop | RSC pages → `db.brandConfig.findFirst()` | DB query | FLOWING |
| `LpCard.tsx` | `lp` prop | RSC `lps/page.tsx` → `listLpsAction` → `db.lp.list()` | DB query | FLOWING |
| `export/route.ts` | `html` | `renderLp()` with LP from `prisma.landingPage.findUnique` | DB query + engine render | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: No runnable entry points tested automatically (app server required). TypeScript compilation passed (tsc --noEmit exits 0, confirmed). Vitest suite passes: **118/118 tests** (engine layer). LP-specific logic tested via code inspection.

| Behavior | Result | Status |
|----------|--------|--------|
| `tsc --noEmit` on apps/web | Exit 0, no output | PASS |
| Vitest suite (engine) | 118 passed, 6 test files | PASS |
| `reconcileLpValues` exported from `reconcile.ts` | Line 33 confirms | PASS |
| `renderLp` has no `"use server"` directive | Lines 4-5 are comments, not directives | PASS |
| `requestPresignedUploadAction` uses dynamic file-type import | `await import("file-type")` at line 506 | PASS |
| `imageSize` imported statically (synchronous per plan spec) | Static import at line 42 | PASS |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GEN-01 | 04-01, 04-02 | Selecting a template opens a dynamic form from its schema | SATISFIED | `lps/new/[templateId]/page.tsx` → `LpForm`; schema derived from stored `ParsedSchema` via `deriveZodSchema` |
| GEN-02 | 04-02, 04-03 | Form supports text, rich text, image upload, color, button+URL | SATISFIED | `LpForm.tsx` handles all 5 types (`richtext` → `RichTextField`, `image` → `ImageUploadField`, `color` → Input+swatch, `button` → label+URL, `text` → Input); same in `RepeaterBlock.tsx` |
| GEN-03 | 04-02 | User can add/remove items in repeatable blocks | SATISFIED | `RepeaterBlock.tsx:68` uses `useFieldArray` with `append`/`remove`; "+ Add {Label}" button at line 115; × remove at line 153 |
| GEN-04 | 04-02 | System validates required fields by type on submit | SATISFIED | `deriveZodSchema` builds per-type Zod schema with `required` flag from overlay; `zodResolver` in `useForm` enforces at submit; `min(1)` for text/richtext, regex for color, url for button/image |
| AST-01 | 04-03 | User can upload images, stored and scoped to workspace | SATISFIED | `ImageUploadField` → `requestPresignedUploadAction` → tenant-scoped S3 key `workspaces/{workspaceId}/lps/assets/`; `LpAsset` records created in `generateLpAction` |
| LP-01 | 04-02 | User can preview a rendered LP at any time | SATISFIED | `preview/page.tsx` RSC calls `renderLp()` server-side; passes html to `LpPreview` with `srcDoc` + `sandbox="allow-same-origin"` |
| LP-02 | 04-02 | User can reopen and edit an LP's data and regenerate its HTML | SATISFIED | `edit/page.tsx` fetches LP, re-parses from `markupSnapshot`, passes to `LpForm mode="edit"`; `updateLpAction` persists new values |
| LP-03 | 04-02 | User can duplicate an existing LP to create a variation | SATISFIED | `duplicateLpAction`: `"Copy of ${origin.name}"`, same `values + markupSnapshot + schemaVersion`; independent copy (D-12) |
| LP-04 | 04-04 | User can export/download LP as self-contained HTML bundle | SATISFIED | `GET /api/lps/[lpId]/export`: renders LP, downloads S3 images, rewrites to `./assets/`, injects CSP, streams ZIP via `archiver.ZipArchive` |
| BRD-02 | 04-01, 04-02 | Templates reference global brand values; generated LPs use them automatically | SATISFIED | `render.ts:47-55` fetches live `BrandConfig` from DB via `db.brandConfig.findFirst()`; maps to engine scope keys `logo`, `primary_color`, `whatsapp`; `BrandGlobalsPanel` shows live values read-only in form |

**All 10 requirements SATISFIED.**

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/lps/actions.ts` | 208-209 | `mimeType: "image/jpeg"` placeholder + `fileSize: 0` placeholder in `generateLpAction` LpAsset bulk-create | INFO | Not user-visible; only affects `LpAsset` metadata record (not rendered HTML). The comment notes this is "best-effort in v1" and size is enforced at upload time. No follow-up issue number but the PLAN.md explicitly noted this as a known v1 limitation. Not a blocker. |

No `TBD`, `FIXME`, `XXX`, or `HACK` markers found in any LP source file.

---

## Human Verification — APPROVED (2026-06-23)

> ✅ All 5 items below were manually tested and **approved by the workspace owner on 2026-06-23**.
> Phase 04 human verification is complete; verification debt cleared.

### 1. End-to-End LP Generation with Image Upload

**Test:** Start docker-compose (MinIO), create a template with all field types (text, richtext, image, color, button, repeater), navigate to `/w/{slug}/lps/new`, select template, fill the form including an image upload, click Generate LP.
**Expected:** LP created, redirected to preview, iframe shows rendered HTML with brand globals resolved, uploaded image displayed correctly.
**Why human:** Requires running Next.js + Postgres + MinIO, browser interaction, and visual inspection of rendered output.

### 2. Repeater Add/Remove in Form

**Test:** In the LP generation form for a template with a repeater, click "+ Add" twice to add 2 items, fill fields, click the × on the first item, generate the LP.
**Expected:** Preview shows exactly 1 repeater item rendered in the LP HTML.
**Why human:** Browser interaction required; visual confirmation of rendered output.

### 3. D-08 Schema Version Mismatch + Apply New Version

**Test:** Create an LP. Edit the source template (adding a new field). Reopen the LP's edit page.
**Expected:** "Template updated" amber alert is shown with "Apply new version" button. Clicking it: (a) calls `reconcileLpValues` (new field gets default, existing fields preserved, removed fields dropped), (b) `updateLpAction` saves new `markupSnapshot` + incremented `schemaVersion`, (c) redirect to preview.
**Why human:** Requires two-step DB state mutation across sessions; schema version delta only detectable at runtime.

### 4. Export ZIP Integrity Check

**Test:** Generate an LP with an uploaded image. Click "Export ZIP" from the preview toolbar. Unzip the file.
**Expected:** (a) `index.html` present with `<meta http-equiv="Content-Security-Policy" content="default-src 'none'...">` in `<head>`. (b) `assets/{filename}` directory with the image file. (c) `index.html` references `./assets/{filename}` (not the absolute S3 URL). (d) Opening `index.html` locally renders the LP visually identically to the preview.
**Why human:** Requires filesystem inspection of ZIP contents and visual browser comparison.

### 5. Image Pixel Cap Enforcement (D-03)

**Test:** Attempt to upload an image exceeding 5000x5000 px via the ImageUploadField.
**Expected:** After XHR PUT succeeds, `validateUploadedImageAction` runs, detects oversized dimensions, issues `DeleteObjectCommand` to remove the S3 object, and the field transitions to error state with "Image dimensions exceed the 5000×5000 px limit" message.
**Why human:** Requires a 5000+ px test image and a running MinIO instance to verify the S3 DELETE was executed.

---

## Gaps Summary

No gaps found. All 10 must-have requirements (GEN-01, GEN-02, GEN-03, GEN-04, AST-01, LP-01, LP-02, LP-03, LP-04, BRD-02) are implemented with substantive code, properly wired, and data flows verified. The phase goal is observably achieved in the codebase. Status is `human_needed` because 5 behaviors require browser/infrastructure interaction to confirm end-to-end correctness — this is expected for a full-stack feature phase.

---

_Verified: 2026-06-09T17:05:00Z_
_Verifier: Claude (gsd-verifier)_
