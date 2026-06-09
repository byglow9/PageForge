---
phase: 04-lp-generation-assets-preview-export
plan: "04"
subsystem: lp-export
tags:
  - export
  - archiver
  - zip
  - csp
  - ssrf-prevention
  - s3
  - streaming
  - idor
dependency_graph:
  requires:
    - "04-01"  # renderLp(), withTenantDb, TenantClient
    - "04-02"  # LpCard, LpPreview, LpForm, LP catalog pages
  provides:
    - GET /api/lps/[lpId]/export — streaming ZIP route handler
    - LpCard export trigger with loading state + toast
    - LpPreview export trigger with toast
  affects:
    - (none downstream in phase 4)
tech_stack:
  added:
    - "archiver@^8.0.0 — streaming ZIP assembly; ZipArchive (v8 named export)"
    - "@types/archiver@^8.0.0 — TypeScript types for archiver v8"
  patterns:
    - "Readable.toWeb(archive) bridge: Node.js Transform stream → Web ReadableStream for NextResponse"
    - "ZipArchive (named export): archiver v8 no longer ships a factory function; use `new ZipArchive({...})`"
    - "SSRF prevention: filter image URLs against S3_PUBLIC_BASE_URL before server-side fetch"
    - "Anchor-click export trigger in client components (no fetch — streaming downloads)"
key_files:
  created:
    - "apps/web/src/app/api/lps/[lpId]/export/route.ts"
  modified:
    - "apps/web/package.json — archiver + @types/archiver added"
    - "pnpm-lock.yaml — updated with archiver install"
    - "apps/web/src/components/lps/LpCard.tsx — export trigger + loading state + toast"
    - "apps/web/src/components/lps/LpPreview.tsx — export toast + Button import cleanup"
decisions:
  - "archiver v8 uses named export ZipArchive (not the factory function `archiver('zip', ...)`); updated import from `import archiver from 'archiver'` to `import { ZipArchive } from 'archiver'`"
  - "Anchor-click pattern for export: create temp <a download href=...>, click, remove — no fetch needed for streaming downloads; toast shown immediately (UI-SPEC LP-04 immediate feedback)"
  - "Readable.toWeb cast: `archive as unknown as Readable` (not NodeJS.ReadableStream) — matches the toWeb() type signature in @types/node"
  - "SSRF: redirect: 'error' on fetch to block SSRF via open redirects in S3 bucket redirects"
metrics:
  duration: "7 minutes"
  completed_date: "2026-06-09T19:51:26Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 4
---

# Phase 04 Plan 04: ZIP Export Route Handler Summary

**One-liner:** Streaming ZIP export route (`/api/lps/[lpId]/export`) with archiver v8, SSRF-safe S3 image download + src rewriting, strict CSP injection (D-10), and wired export triggers in LpCard and LpPreview with loading state and toast feedback.

## What Was Built

### Task 1: Export Route Handler + archiver install

Installed `archiver@8.0.0` and `@types/archiver@8.0.0`, then created the full streaming ZIP export route at `apps/web/src/app/api/lps/[lpId]/export/route.ts`.

The route implements the complete export pipeline:

1. **Auth (T-04-04-01):** `auth.api.getSession({ headers })` — 401 if no session.
2. **Fetch LP:** `prisma.landingPage.findUnique` — 404 if not found.
3. **IDOR check (T-04-04-02):** `prisma.member.findUnique({ organizationId_userId: {...} })` — 403 if not a workspace member. Uses the authoritative better-auth member table (same pattern as `getWorkspaceContext` in guards.ts).
4. **Render (preview == export D-07):** `renderLp()` from `lib/lps/render.ts` — same utility as the preview RSC page.
5. **Image extraction (T-04-04-03 SSRF):** `extractS3ImageUrls()` — three patterns: `<img src>`, CSS `url()` in style attributes, CSS `url()` in `<style>` blocks. Filtered to only `S3_PUBLIC_BASE_URL` origins.
6. **Image download:** Sequential `fetch(url, { redirect: "error" })` — `redirect: "error"` blocks SSRF via open redirects.
7. **Src rewriting:** `rewriteImageSrcs()` — replaces each absolute S3 URL with `./assets/{filename}`.
8. **CSP injection (D-10):** `injectCsp()` — `<meta http-equiv="Content-Security-Policy">` with `default-src 'none'` baked into `<head>`.
9. **ZIP assembly (D-09):** `new ZipArchive({ zlib: { level: 9 } })` — streaming, no full-ZIP memory buffering (T-04-04-06).
10. **Stream bridge:** `Readable.toWeb(archive as unknown as Readable)` → `NextResponse(webStream as ReadableStream, ...)`.
11. **Filename:** `slugify(lp.name, { lower: true, strict: true })` → `{lp-name-slug}.zip`.

### Task 2: Export Triggers in LpCard and LpPreview

**LpCard.tsx:** Replaced `window.location.href` with a full anchor-click pattern:
- `isExporting` state drives loading UI.
- Kebab button shows `Loader2` spinner when `isDuplicating || isExporting`.
- "Export ZIP" menu item shows "Exporting…" label with spinner while exporting; disabled during export.
- `handleExportZip()` creates a temporary `<a download>`, clicks it, removes it, then `toast.success("Export ready — downloading.")`.
- `catch` block fires `toast.error("Export failed. Try again.")`.

**LpPreview.tsx:** Added `toast` import and `onClick={() => toast.success("Export ready — downloading.")}` to the existing `<a href download>` anchor. Removed unused `Button` import.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 3dc9878 | feat(04-04): add ZIP export route handler with archiver streaming, CSP injection, and SSRF-safe image bundling |
| Task 2 | 3aae6a8 | feat(04-04): wire Export ZIP triggers in LpCard and LpPreview with loading state and toast feedback |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] archiver v8 no longer ships a factory function**
- **Found during:** Task 1 TypeScript check
- **Issue:** The plan specified `import archiver from "archiver"; const archive = archiver("zip", {...})` but archiver v8 is a pure ESM package that exports named classes (`ZipArchive`, `TarArchive`, `JsonArchive`) — no default export and no factory function.
- **Fix:** Changed import to `import { ZipArchive } from "archiver"` and instantiation to `new ZipArchive({ zlib: { level: 9 } })`.
- **Files modified:** `apps/web/src/app/api/lps/[lpId]/export/route.ts`
- **Commit:** 3dc9878

**2. [Rule 1 - Bug] Readable.toWeb type cast needed `Readable` not `NodeJS.ReadableStream`**
- **Found during:** Task 1 TypeScript check
- **Issue:** `Readable.toWeb` accepts `stream.Readable`, not `NodeJS.ReadableStream`. The RESEARCH.md pattern had `archive as unknown as NodeJS.ReadableStream` which fails TS2345.
- **Fix:** Changed cast to `archive as unknown as Readable` (Node's `stream.Readable` — the correct type for `Readable.toWeb()`).
- **Files modified:** `apps/web/src/app/api/lps/[lpId]/export/route.ts`
- **Commit:** 3dc9878

## Threat Surface Scan

No new threat surface beyond what the plan's threat model covers. All four T-04-04-xx mitigations are implemented:

| Threat | Implementation | Status |
|--------|---------------|--------|
| T-04-04-01: Unauthenticated route access | `auth.api.getSession` → 401 | Mitigated |
| T-04-04-02: Cross-workspace LP export (IDOR) | `prisma.member.findUnique({ organizationId_userId })` → 403 | Mitigated |
| T-04-04-03: SSRF via image URL | Filter to `S3_PUBLIC_BASE_URL` + `redirect: "error"` on fetch | Mitigated |
| T-04-04-04: Script execution in exported HTML | CSP `default-src 'none'` meta baked in | Mitigated |

## Known Stubs

None — all functionality is fully implemented. The Export ZIP button is end-to-end functional: click in LpCard kebab menu or LpPreview toolbar → server renders LP + downloads S3 images → streams ZIP with rewritten paths + strict CSP.

## Self-Check: PASSED

Files verified present:
- [x] `apps/web/src/app/api/lps/[lpId]/export/route.ts` — FOUND
- [x] `apps/web/src/components/lps/LpCard.tsx` — isExporting state, toast, anchor-click pattern — FOUND
- [x] `apps/web/src/components/lps/LpPreview.tsx` — toast import, onClick handler — FOUND
- [x] `apps/web/package.json` — archiver@^8.0.0 + @types/archiver@^8.0.0 — FOUND
- [x] `pnpm-lock.yaml` — updated — FOUND

Commits verified:
- [x] `3dc9878` feat(04-04): add ZIP export route handler... — FOUND
- [x] `3aae6a8` feat(04-04): wire Export ZIP triggers... — FOUND

Build verified:
- [x] `npx tsc --noEmit` exits 0
- [x] `pnpm build` exits 0 — `/api/lps/[lpId]/export` compiled as dynamic `ƒ` route
