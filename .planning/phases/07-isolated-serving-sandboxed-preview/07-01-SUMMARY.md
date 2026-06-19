---
phase: 07-isolated-serving-sandboxed-preview
plan: "01"
subsystem: serve
tags: [hmac, token, spa-routing, mime, type-boundary, security]
dependency_graph:
  requires:
    - apps/web/src/lib/lps/render.ts   # reciprocal guard pattern
    - apps/web/src/lib/project-templates/s3-upload.ts  # MIME map reference
  provides:
    - apps/web/src/lib/serve/token.ts          # consumed by Plans 02 and 03
    - apps/web/src/lib/serve/serve-vite-spa.ts # consumed by Plans 02 and 03
  affects:
    - apps/web/.env.example   # SERVE_TOKEN_SECRET documented
tech_stack:
  added: []
  patterns:
    - createTokenUtils factory for testable secrets without process.env
    - timingSafeEqual for HMAC signature comparison (ASVS V6 / T-07-01-01)
    - fail-fast on missing SERVE_TOKEN_SECRET via ! assertion at module load
    - reciprocal type guard pattern (mirror of renderLp rejection of VITE_SPA)
    - inline MIME map to avoid "use server" import cycle from route handler context
key_files:
  created:
    - apps/web/src/lib/serve/token.ts
    - apps/web/src/lib/serve/serve-vite-spa.ts
    - apps/web/tests/serve-token.test.ts
    - apps/web/tests/serve-vite-spa.test.ts
  modified:
    - apps/web/.env.example  # added SERVE_TOKEN_SECRET placeholder + instructions
decisions:
  - "D-05 implemented: HMAC-SHA256 token scoped to {workspaceId, templateId} + 30-min TTL via createTokenUtils factory"
  - "D-07 implemented: SPA route fallback — extensionless path → index.html+isFallback:true; asset with extension → direct+isFallback:false"
  - "D-08 implemented: assertViteSpaKind() throws 'Type boundary violation' for non-VITE_SPA — reciprocal mirror of renderLp() guard"
  - "Inline MIME map (not imported from s3-upload.ts) — avoids 'use server' boundary crossing when imported from route handler context"
  - "Root '/' path is handled separately before extension detection — isFallback:true even though index.html has an extension"
metrics:
  duration_seconds: 352
  completed_date: "2026-06-19"
  task_count: 2
  file_count: 5
---

# Phase 7 Plan 01: Serve Utility Modules (token.ts + serve-vite-spa.ts) Summary

**One-liner:** HMAC-SHA256 serve token mint/verify with createTokenUtils factory (timingSafeEqual, 30-min TTL) + assertViteSpaKind reciprocal type guard + SPA route fallback resolver + inline MIME map helper.

## What Was Built

### Task 1: lib/serve/token.ts

Created `apps/web/src/lib/serve/token.ts` — the HMAC-SHA256 token utility module for the isolated serving origin's authorization scheme (D-05, PRJ-04, PRJ-06).

**Key design decisions:**
- `createTokenUtils(secret)` factory: enables unit tests to pass a known secret without any `process.env` dependency — resolves Open Question 2 from 07-RESEARCH.md
- `mintServeToken(workspaceId, templateId)` builds `ServeClaims` with `exp = Date.now() + 30min`, serializes to JSON, base64url-encodes, HMAC-SHA256 signs → returns `"${b64}.${sig}"` format
- `verifyServeToken(token)` splits on first dot, recomputes HMAC, uses `timingSafeEqual` (T-07-01-01 ASVS V6), checks expiry (T-07-01-02), returns `ServeClaims | null`
- `timingSafeEqual` length check added before comparison to prevent panic on mismatched buffer lengths
- Top-level `mintServeToken`/`verifyServeToken` use `process.env.SERVE_TOKEN_SECRET!` — fail-fast at module load if absent (T-07-01-03)
- `node:crypto` import (NodeNext convention); no `"use server"` directive

### Task 2: lib/serve/serve-vite-spa.ts

Created `apps/web/src/lib/serve/serve-vite-spa.ts` — type guard, SPA path resolver, and MIME helper (D-07, D-08, PRJ-11).

**Key design decisions:**
- `assertViteSpaKind(kind)` throws `"Type boundary violation: ..."` for non-VITE_SPA — reciprocal mirror of `renderLp()` guard that throws for VITE_SPA (PRJ-11 enforced at both boundaries)
- `resolveServePath(requestPath)` handles root `/` specially (always `isFallback:true`) before the extension check — prevents `index.html` (has `.html` extension) from being treated as an asset when accessed at root
- `getContentType(filePath)` uses `path.extname` from `node:path` (NodeNext) + inline MIME map (identical to `s3-upload.ts` but copied to avoid `"use server"` import cycle)
- No `"use server"` directive — these are server-only utilities for route handlers, not Server Actions

## Test Results

### serve-token.test.ts (6 tests, all pass)
1. "round-trip valid token" — createTokenUtils round-trip returns correct ServeClaims with future exp
2. "tampered token rejected" — bit-flipped token returns null without throwing
3. "expired token rejected" — crafted token with past exp returns null
4. "wrong-secret rejected" — token from different createTokenUtils secret returns null
5. "scope claims preserved" — workspaceId and templateId unchanged through round-trip
6. "malformed string (no dot separator) returns null"

### serve-vite-spa.test.ts (20 tests, all pass)
- `assertViteSpaKind`: throws for LIQUID, throws for UNKNOWN, does NOT throw for VITE_SPA
- `resolveServePath`: root, extensionless paths (SPA routes), asset paths, explicit index.html, leading slash stripping
- `getContentType`: .html, .js, .mjs, .css, .json, .png, .svg, .woff2, unknown extension, no extension

**Total: 26 new passing tests. Pre-existing test failures (29) are unchanged — all due to `next/headers` import limitation in vitest context, unrelated to this plan.**

## Commits

| Hash | Message | Files |
|------|---------|-------|
| 27a5874 | test(07-01): add failing tests for HMAC serve token mint/verify | serve-token.test.ts |
| 6261c55 | feat(07-01): implement HMAC-SHA256 serve token mint/verify (token.ts) | token.ts, .env.example |
| 73e7c5a | test(07-01): add failing tests for serve-vite-spa type guard + path resolver + MIME helper | serve-vite-spa.test.ts |
| e5ea771 | feat(07-01): implement serve-vite-spa type guard + SPA path resolver + MIME helper | serve-vite-spa.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed root path '/' returning isFallback:false**
- **Found during:** Task 2 GREEN phase
- **Issue:** When `requestPath='/'`, stripping the leading slash gives `''`, which defaults to `'index.html'`. Since `'index.html'` has a `.html` extension, the extension check returned `isFallback:false` — incorrect for root which is a SPA route.
- **Fix:** Added explicit early return for empty normalized path: `if (!normalized) return { s3Path: 'index.html', isFallback: true }` — root always treated as SPA route regardless of the defaulted filename.
- **Files modified:** `apps/web/src/lib/serve/serve-vite-spa.ts`
- **Commit:** e5ea771 (included in same implementation commit)

## Known Stubs

None — both modules are complete implementations. No placeholder values, hardcoded data, or TODOs that affect plan goals.

## Threat Flags

No new threat surface introduced beyond what the plan's `<threat_model>` covers.

- All mitigations from the threat register (T-07-01-01 through T-07-01-05) are implemented:
  - T-07-01-01: `timingSafeEqual` in `verifyServeToken` (with length guard before compare)
  - T-07-01-02: `exp <= Date.now()` check enforces 30-min TTL
  - T-07-01-03: `process.env.SERVE_TOKEN_SECRET!` fails fast at module load
  - T-07-01-04: Error message with kind value is server-side only, not returned to client
  - T-07-01-05: Leading slash stripping is the first operation; S3 prefix is prepended by Plan 02

## Self-Check: PASSED

Files created:
- [x] apps/web/src/lib/serve/token.ts
- [x] apps/web/src/lib/serve/serve-vite-spa.ts
- [x] apps/web/tests/serve-token.test.ts
- [x] apps/web/tests/serve-vite-spa.test.ts
- [x] apps/web/.env.example (modified)

Commits verified:
- [x] 27a5874 — test RED phase token
- [x] 6261c55 — feat GREEN phase token
- [x] 73e7c5a — test RED phase serve-vite-spa
- [x] e5ea771 — feat GREEN phase serve-vite-spa
