---
phase: 06-project-template-ingestion-type-coexistence
plan: 02
subsystem: api, storage, ui, testing
tags: [vite-spa, zip-validation, secret-scan, s3-upload, server-actions, vitest, type-boundary]

# Dependency graph
requires:
  - phase: 06-project-template-ingestion-type-coexistence
    plan: 01
    provides: kind discriminator column + TenantTemplateHelpers.create with id/kind params + renderLp() type boundary guard

provides:
  - validateAndExtractZip(buffer): ZipValidationResult with zip-slip, zip-bomb, and index.html checks
  - scanDistFiles(entries): ScanFinding[] — advisory, never blocks
  - uploadDistToS3(entries, workspaceId, templateId, s3Client): void — one PutObjectCommand per entry
  - createProjectTemplateAction(slug, formData): ActionResult<{ id, findings }> — full ingestion pipeline
  - /w/[slug]/project-templates/new page (RSC gate + ProjectTemplateForm client component)
  - V2-11 boundary test: renderLp() throws on VITE_SPA, passes on LIQUID (2 vitest tests)

affects:
  - 06-03 and beyond: VITE_SPA templates are now in the catalog; serving/preview of VITE_SPA is Phase 7
  - vitest.config.ts: added pageforge-engine alias for worktree-safe resolution (existing tests unaffected)

# Tech tracking
tech-stack:
  added:
    - yauzl@^3.4.0 — ZIP extraction with zip-slip prevention; no disk I/O
  patterns:
    - "ZIP validation pipeline: compressed size cap → yauzl extract → zip-slip (path.normalize) → zip-bomb (uncompressedSize) → index.html check"
    - "Secret scan: synchronous regex scan on in-memory text entries; advisory only, never blocks"
    - "S3 multi-file upload: Promise.all per entry, inline MIME map, caller-provided S3 client for testability"
    - "createProjectTemplateAction security ordering: requireWorkspaceRole FIRST, kind hardcoded in server action (never from FormData)"
    - "Vitest worktree alias: explicit pageforge-engine path for worktree environments where pnpm symlink is unavailable"

key-files:
  created:
    - apps/web/src/lib/project-templates/schema.ts
    - apps/web/src/lib/project-templates/zip-validate.ts
    - apps/web/src/lib/project-templates/secret-scan.ts
    - apps/web/src/lib/project-templates/s3-upload.ts
    - apps/web/src/lib/project-templates/actions.ts
    - apps/web/src/app/w/[slug]/project-templates/new/page.tsx
    - apps/web/src/app/w/[slug]/project-templates/new/ProjectTemplateForm.tsx
    - apps/web/tests/type-boundary.test.ts
  modified:
    - apps/web/package.json (yauzl added)
    - apps/web/vitest.config.ts (pageforge-engine alias for worktree resolution)

key-decisions:
  - "yauzl chosen over JSZip/fflate: lazyEntries mode allows per-entry rejection before stream open, which is required for zip-bomb check (reject on uncompressedSize before streaming)"
  - "Secret scan is advisory-only (D6): findings never block upload — baked Supabase anon keys are publishable-by-design; only Stripe live key and AWS AKIA are high-severity"
  - "templateId pre-generated before S3 upload (not after DB write): ensures DB row id equals S3 key prefix so Phase 7 can resolve dist/ files from template.id without an extra lookup"
  - "ZIP goes to Server Action via FormData (not presigned URL): ZIP must be processed server-side for validation/scanning; client-side upload would bypass all security checks"
  - "Vitest pageforge-engine alias: pnpm workspace symlink (../../..) resolves from main repo root, not worktree root; explicit path alias is the worktree-safe solution"

# Metrics
duration: 10min
completed: 2026-06-19
---

# Phase 06 Plan 02: VITE_SPA Ingestion Pipeline Summary

**VITE_SPA ingestion vertical slice complete: ZIP validation → secret scan → S3 upload → DB persist → UI form → V2-11 type boundary test — all security mitigations from the threat register are implemented.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-19T13:19:37Z
- **Completed:** 2026-06-19T13:29:32Z
- **Tasks:** 3
- **Files modified:** 10 (8 created, 2 modified)

## Accomplishments

- **ZIP validation pipeline** (zip-validate.ts): Compressed size cap (50 MB env-var-backed), zip-slip prevention via `path.normalize` + absolute/`..` rejection, zip-bomb prevention via `entry.uncompressedSize` before stream open, `index.html` presence check — all without any disk I/O
- **Secret scanner** (secret-scan.ts): Synchronous regex scan across 5 patterns (SUPABASE_JWT, SUPABASE_URL, STRIPE_LIVE_KEY, AWS_ACCESS_KEY, LOVABLE_APP_URL) on text entries only; returns advisory `ScanFinding[]`, never blocks upload
- **S3 multi-file uploader** (s3-upload.ts): `Promise.all` parallel upload per entry under `workspaces/{wId}/project-templates/{templateId}/dist/`; inline MIME map; caller-provided S3 client
- **Server Action** (actions.ts): Security-critical ordering — `requireWorkspaceRole` first, then ZIP validation, scan, upload, DB persist with `id: templateId` and `kind: 'VITE_SPA'` hardcoded
- **Upload UI**: RSC page gate + `ProjectTemplateForm` client component with warning toast for findings, file input (`accept=".zip"`), direct FormData submission
- **V2-11 boundary test**: 2 vitest tests — VITE_SPA throws "Type boundary violation", LIQUID resolves to truthy string; both pass with Vitest alias fix for worktree resolution

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Ingestion pipeline (schema, zip-validate, secret-scan, s3-upload, actions) | d9d9c1f | 5 new lib files |
| 2 | Upload UI (page.tsx + ProjectTemplateForm.tsx) | 5163d8d | 2 new app files |
| 3 | V2-11 type-boundary test | 96bf5dd | type-boundary.test.ts + vitest.config.ts |

## Files Created/Modified

- `apps/web/src/lib/project-templates/schema.ts` — CreateProjectTemplateSchema (name only, Zod)
- `apps/web/src/lib/project-templates/zip-validate.ts` — validateAndExtractZip with zip-slip/bomb checks
- `apps/web/src/lib/project-templates/secret-scan.ts` — scanDistFiles with 5 regex patterns
- `apps/web/src/lib/project-templates/s3-upload.ts` — uploadDistToS3 (parallel, tenant-scoped)
- `apps/web/src/lib/project-templates/actions.ts` — createProjectTemplateAction (full pipeline)
- `apps/web/src/app/w/[slug]/project-templates/new/page.tsx` — RSC gate
- `apps/web/src/app/w/[slug]/project-templates/new/ProjectTemplateForm.tsx` — upload form
- `apps/web/tests/type-boundary.test.ts` — V2-11 boundary assertions (2 tests pass)
- `apps/web/package.json` — yauzl added as dependency
- `apps/web/vitest.config.ts` — pageforge-engine alias for worktree-safe test resolution

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pageforge-engine not resolvable in worktree context**
- **Found during:** Task 3 (V2-11 test run)
- **Issue:** pnpm workspace installs `pageforge-engine` as a symlink (`../../..`) from the main repo. In a git worktree, `apps/web/node_modules/pageforge-engine` does not exist — vitest fails with "Cannot find package 'pageforge-engine'"
- **Fix:** Added `"pageforge-engine": path.resolve(__dirname, "../../src/engine/index.ts")` alias to `apps/web/vitest.config.ts`. This resolves the package from the monorepo root (shared across worktrees) without modifying the package.json or pnpm workspace structure.
- **Files modified:** `apps/web/vitest.config.ts`
- **Commit:** 96bf5dd
- **Impact:** Zero impact on main-repo test runs (alias is a no-op when the symlink resolves correctly). All 30 existing vitest tests continue to pass.

## Threat Surface Scan

All security mitigations from the plan's threat model were implemented:

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-06-05 | Zip-slip: `path.normalize` + reject `..` prefix and absolute paths | Implemented in zip-validate.ts |
| T-06-06 | Zip-bomb: `entry.uncompressedSize` accumulation before stream open | Implemented in zip-validate.ts |
| T-06-07 | Compressed size cap: `zipBuffer.length > MAX_COMPRESSED_BYTES` first check | Implemented in zip-validate.ts |
| T-06-08 | Secret scan: 5 regex patterns, advisory findings in ActionResult | Implemented in secret-scan.ts + actions.ts |
| T-06-09 | workspaceId from session only: `requireWorkspaceRole` → `ctx.workspaceId` used everywhere | Implemented in actions.ts |
| T-06-10 | S3 key injection: normalized filenames from zip-validate.ts used as-is in s3-upload.ts | Implemented in s3-upload.ts |
| T-06-11 | Role gate first: `requireWorkspaceRole` is first `await` in action body | Implemented in actions.ts |
| T-06-12 | Type boundary: V2-11 test confirms guard is active | Test passes in type-boundary.test.ts |
| T-06-14 | kind hardcoded: `kind: "VITE_SPA"` in action body, not read from FormData | Implemented in actions.ts |

## Known Stubs

None — all pipeline functions are fully implemented. The upload form wires directly to the Server Action; findings are returned in the ActionResult and rendered in the UI.

Note: VITE_SPA template *serving* (iframe preview, export) is intentionally deferred to Phase 7. The catalog will show VITE_SPA templates with the "Vite SPA" badge (implemented in Plan 01) but clicking "preview" on them will encounter the type boundary guard. This is expected behavior for Phase 6.

## Self-Check: PASSED

- zip-validate.ts exists with path.normalize, uncompressedSize, PROJECT_TEMPLATE_MAX_ZIP_MB: confirmed
- secret-scan.ts exists with SUPABASE_JWT, STRIPE_LIVE_KEY, AKIA, lovable.app: confirmed
- s3-upload.ts exists with "project-templates" in key construction: confirmed
- actions.ts exists with VITE_SPA, requireWorkspaceRole, withTenantDb: confirmed
- page.tsx exists with requireWorkspaceRole and ProjectTemplateForm: confirmed
- ProjectTemplateForm.tsx exists with "use client", createProjectTemplateAction, toast.warning, encType: confirmed
- type-boundary.test.ts exists with "Type boundary violation", "VITE_SPA", "LIQUID": confirmed
- npx vitest run tests/type-boundary.test.ts exits 0 (2 tests pass): confirmed
- npx tsc --noEmit exits clean (no errors in project-templates files): confirmed
- All 3 task commits exist in git log: d9d9c1f, 5163d8d, 96bf5dd: confirmed
