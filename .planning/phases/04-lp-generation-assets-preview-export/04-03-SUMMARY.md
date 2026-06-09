---
phase: 04-lp-generation-assets-preview-export
plan: "03"
subsystem: lp-image-upload
tags:
  - s3
  - presigned-upload
  - magic-bytes
  - image-validation
  - react-hook-form
  - image-size
dependency_graph:
  requires:
    - 04-01 (LpAsset model, MinIO docker-compose, S3 env vars)
    - 04-02 (LpForm, RepeaterBlock, generateLpAction with extractImageFieldValues)
  provides:
    - requestPresignedUploadAction (magic-bytes + 5MB cap + presigned PUT)
    - validateUploadedImageAction (ranged GET + image-size pixel cap + DeleteObject)
    - ImageUploadField component (4 states: idle/uploading/uploaded/error)
    - schema-derive image field schema updated to {publicUrl, s3Key} object
  affects:
    - 04-04 (export ZIP reads LpAsset records; publicUrl in LP HTML from image fields)
tech_stack:
  added:
    - "@aws-sdk/client-s3@^3.1064.0 — S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand"
    - "@aws-sdk/s3-request-presigner@^3.1064.0 — getSignedUrl"
    - "image-size@^2.0.2 — synchronous pixel dimension detection from buffer"
    - "file-type@^22.0.1 — ESM magic-bytes detection (fileTypeFromBuffer)"
  patterns:
    - "S3Client module-level singleton (one per cold start)"
    - "Dynamic import for file-type ESM: await import('file-type')"
    - "Presigned PUT with signableHeaders: new Set(['content-type']) to prevent MIME swap"
    - "XHR upload with progress event — browser uploads directly to S3 (D-02)"
    - "Ranged GET bytes=0-65535 for pixel cap without full image download"
    - "field.onChange({publicUrl, s3Key}) — stores object not plain URL; generateLpAction unwraps"
    - "Controller pattern for ImageUploadField (same as RichTextField — hooks cannot run inside register)"
key_files:
  created:
    - apps/web/src/components/lps/ImageUploadField.tsx
  modified:
    - apps/web/package.json (4 new packages)
    - pnpm-lock.yaml
    - apps/web/src/lib/lps/actions.ts (requestPresignedUploadAction + validateUploadedImageAction + S3 client)
    - apps/web/src/components/lps/LpForm.tsx (image field replaced with ImageUploadField; slug threaded to RepeaterBlock)
    - apps/web/src/components/lps/RepeaterBlock.tsx (image field replaced with ImageUploadField; slug prop added)
    - apps/web/src/lib/lps/schema-derive.ts (image field schema: z.union([imageFieldValueSchema, z.literal("")]))
decisions:
  - "S3Client singleton is module-level in actions.ts — reused across warm invocations, credentials from server-side env only (T-04-03-06)"
  - "file-type uses dynamic import (await import) because it is ESM-only; avoids transpilePackages-only reliance"
  - "image-size is imported statically (imageSize from 'image-size') — it ships CJS + ESM and works synchronously from a Buffer"
  - "ImageUploadField uses Controller (not register) because it manages its own async upload state; register is synchronous"
  - "validateUploadedImageAction is called after S3 PUT succeeds, before setting 'uploaded' state — pixel cap enforced server-side before any RHF value is set"
  - "slug prop added to RepeaterBlock (non-breaking addition) — required to thread slug through to ImageUploadField for workspace auth"
  - "schema-derive image fields now accept z.union([imageFieldValueSchema, z.literal('')]) — generateLpAction.extractImageFieldValues already handles the {publicUrl, s3Key} object"
metrics:
  duration: "7 minutes"
  completed_date: "2026-06-09T20:20:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 6
---

# Phase 04 Plan 03: Image Upload Vertical Slice Summary

**One-liner:** Presigned PUT image upload with server-side magic-bytes validation, XHR progress tracking, and server-enforced pixel cap (5000x5000 px) via ranged S3 GET + image-size — eliminating all image field placeholder inputs.

## What Was Built

Two interdependent blocks that complete the image field vertical slice:

**1. Server Actions (Task 1):** Installed `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `image-size`, and `file-type`. Added S3Client module-level singleton with MinIO/R2 compatibility (`forcePathStyle`). Added two new exports to `lib/lps/actions.ts`:
- `requestPresignedUploadAction`: validates magic bytes via `fileTypeFromBuffer` (dynamic import for ESM), enforces 5MB cap server-side, constructs tenant-scoped S3 key (`workspaces/{workspaceId}/lps/assets/{uuid}.{ext}`), returns presigned PUT URL with `content-type` as signable header.
- `validateUploadedImageAction`: ranged GET (`bytes=0-65535`) of the uploaded S3 object, runs `imageSize(buffer)` synchronously, issues `DeleteObjectCommand` if dimensions exceed 5000x5000 px before returning the error.

**2. ImageUploadField + Wiring (Task 2):** Created `ImageUploadField.tsx` (Controller-based, 4-state machine) with:
- Idle: dashed drop zone, UploadCloud icon, drag-and-drop with `border-blue-300 bg-blue-50` drag-over state.
- Uploading: compact zone, filename, shadcn Progress bar with XHR upload event, Cancel button.
- Uploaded: green border, 48x48 thumbnail, filename + formatted size, Remove button.
- Error: red border, AlertCircle, specific error message, "Try again" link.

Updated `LpForm.tsx` and `RepeaterBlock.tsx` to render `ImageUploadField` for `type === "image"` fields (replacing placeholder Inputs). Added `slug` prop to `RepeaterBlock` to thread workspace identity to `ImageUploadField`. Updated `schema-derive.ts` to accept `z.union([imageFieldValueSchema, z.literal("")])` instead of `z.string().url()` for image fields.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | bf14580 | feat(04-03): install S3 + image-size packages; add presigned upload + pixel-cap validation actions |
| Task 2 | 123fea2 | feat(04-03): ImageUploadField component; wire into LpForm and RepeaterBlock; update schema-derive for {publicUrl,s3Key} object |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `file-type` package not installed**
- **Found during:** Task 1 TypeScript check
- **Issue:** `file-type` was in `transpilePackages` (from Plan 01) but not in `package.json` dependencies. TypeScript error TS2307: "Cannot find module 'file-type'".
- **Fix:** Ran `pnpm add file-type` to install v22.0.1. The dynamic import pattern (`await import("file-type")`) still satisfies the ESM-only requirement.
- **Files modified:** apps/web/package.json, pnpm-lock.yaml
- **Commit:** bf14580

**2. [Rule 2 - Missing Critical Functionality] `slug` prop missing from RepeaterBlock**
- **Found during:** Task 2 — wiring ImageUploadField into RepeaterBlock
- **Issue:** `ImageUploadField` requires a `slug` prop to call `requestPresignedUploadAction(slug, ...)` with the correct workspace context. `RepeaterBlock` didn't have this prop.
- **Fix:** Added `slug: string` to `RepeaterBlockProps` and threaded it from `LpForm.tsx` (which already has `slug` in its props).
- **Files modified:** apps/web/src/components/lps/RepeaterBlock.tsx, apps/web/src/components/lps/LpForm.tsx
- **Commit:** 123fea2

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| `lib/lps/actions.ts:208-209` | `mimeType: "image/jpeg"` and `fileSize: 0` in `generateLpAction`'s `db.lpAsset.create()` call | Pre-existing from Plan 02. Submitted form values only contain `{publicUrl, s3Key}` — MIME and size were validated at upload time but not persisted to the RHF value. LpAsset records serve as S3 key tracking for export cleanup (Plan 04); MIME/size metadata is cosmetic for v1. |

## Threat Surface Scan

All threats from the plan's threat register are mitigated:

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-04-03-01 | Mitigated | `fileTypeFromBuffer` in `requestPresignedUploadAction`; client MIME check is UX only |
| T-04-03-02 | Mitigated | Presigned URL scoped to `workspaces/{workspaceId}/lps/assets/{uuid}`, expires in 3600s |
| T-04-03-03 | Accept | CORS config is a deployment concern; documented in .env.example |
| T-04-03-04 | Mitigated | publicUrl is an S3 HTTPS URL; `sanitizeUrl()` in engine blocks `javascript:` and `data:` URIs |
| T-04-03-05 | Mitigated | Server only receives 4100 bytes (firstBytes) + metadata; image bytes go direct to S3 |
| T-04-03-06 | Mitigated | S3 key constructed server-side from `ctx.workspaceId` (session-backed, never from client input) |

## Self-Check: PASSED

Files verified:
- [x] `apps/web/src/components/lps/ImageUploadField.tsx` — FOUND
- [x] `apps/web/src/lib/lps/actions.ts` — contains `requestPresignedUploadAction` and `validateUploadedImageAction`
- [x] `apps/web/src/components/lps/LpForm.tsx` — contains `ImageUploadField` import and usage
- [x] `apps/web/src/components/lps/RepeaterBlock.tsx` — contains `ImageUploadField` import and usage; `slug` prop added
- [x] `apps/web/src/lib/lps/schema-derive.ts` — contains `imageFieldValueSchema` with `z.object({publicUrl, s3Key})`

Commits verified:
- [x] `bf14580` feat(04-03): install S3 + image-size packages — FOUND
- [x] `123fea2` feat(04-03): ImageUploadField component — FOUND

TypeScript: `npx tsc --noEmit` exits 0.
Build: `pnpm build` exits 0 — all LP routes compiled as dynamic server routes.
