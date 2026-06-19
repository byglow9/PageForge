---
phase: 07-isolated-serving-sandboxed-preview
plan: "02"
subsystem: serve
tags: [proxy, host-routing, s3-streaming, hmac, spa-fallback, type-boundary, csp, security]
dependency_graph:
  requires:
    - apps/web/src/lib/serve/token.ts         # verifyServeToken — created in Plan 01
    - apps/web/src/lib/serve/serve-vite-spa.ts # assertViteSpaKind + resolveServePath + getContentType — Plan 01
    - apps/web/src/lib/db/prisma.ts            # unscoped template lookup for asset requests
  provides:
    - apps/web/src/proxy.ts                               # consumed by Next.js 16 runtime on every request
    - apps/web/src/app/serve/[tplId]/[[...path]]/route.ts # consumed by proxy.ts rewrite
  affects:
    - All incoming requests to Next.js dev server (proxy intercepts before filesystem router)
tech_stack:
  added: []
  patterns:
    - Next.js 16 proxy.ts convention (proxy function, not deprecated middleware)
    - SERVE_HOST_RE regex for *.serve.* host detection (D-01, D-02)
    - NextResponse.rewrite() for internal path rewriting without exposing subdomain
    - MVP token tradeoff — HMAC token required for index.html only; assets authorized by non-enumerable UUID
    - prisma.template.findUnique (unscoped) for asset workspaceId derivation
    - assertViteSpaKind reciprocal type guard before any S3 access (D-08)
    - Body.transformToWebStream() for streaming S3 bytes (single consume — T-07-02-07)
    - frame-ancestors as HTTP response header (not meta tag — Pitfall 6 prevention)
key_files:
  created:
    - apps/web/src/proxy.ts
    - apps/web/src/app/serve/[tplId]/[[...path]]/route.ts
  modified: []
decisions:
  - "D-01 realized: subdomain-per-template origin via proxy.ts rewrite to /serve/{tplId}{pathname}"
  - "D-02 realized: SERVE_HOST_RE=/^([a-z0-9-]{1,64})\\.serve\\./i matches both prod (*.serve.pageforge.com) and dev (*.serve.localhost)"
  - "D-03 realized: handler emits no Set-Cookie for PageForge session; CSP frame-ancestors restricts embedding"
  - "D-04 realized: GetObjectCommand → Body.transformToWebStream() streams S3 bytes; bucket never public"
  - "D-05 realized: verifyServeToken validates HMAC+expiry+scope; claims.templateId !== tplId → 403"
  - "D-07 realized: resolveServePath distinguishes SPA fallback (→ index.html) from asset 404"
  - "MVP token tradeoff adopted: HMAC token required only for index.html requests; assets authorized by non-enumerable tplId UUID in S3 key — post-MVP improvement: serving-session cookie for assets when HTTPS available"
  - "Unscoped prisma.template.findUnique for asset requests: workspaceId cannot be derived from token (no token for assets); UUID non-enumerability is the security boundary"
metrics:
  duration_seconds: 205
  completed_date: "2026-06-19"
  task_count: 2
  file_count: 2
---

# Phase 7 Plan 02: Isolated Serving Layer (proxy.ts + route.ts) Summary

**One-liner:** Next.js 16 proxy.ts with SERVE_HOST_RE host detection + streaming serve route handler with HMAC token validation, VITE_SPA type guard, SPA fallback, and CSP frame-ancestors HTTP header.

## What Was Built

### Task 1: proxy.ts — Host Detection and Rewrite

Created `apps/web/src/proxy.ts` — the Next.js 16 proxy file (the first host-level routing logic in this codebase, replacing the deprecated `middleware.ts` convention).

**Key design decisions:**
- Named `proxy` (not `middleware`) — Next.js 16 changed the convention; using `proxy.ts` + `export function proxy()` per Next.js 16 official docs
- `SERVE_HOST_RE = /^([a-z0-9-]{1,64})\.serve\./i` — matches both `{tplId}.serve.localhost:3000` (dev) and `{tplId}.serve.pageforge.com` (prod); capture group 1 is `tplId`
- Rewrite logic: `url.pathname = '/serve/' + tplId + (url.pathname === '/' ? '' : url.pathname)` — handles root without double slash
- Dashboard host (no match) → `NextResponse.next()` — passes through unmodified
- Matcher: `'/((?!_next/static|_next/image|favicon\\.ico).*)'` — excludes Next.js internal assets (Pitfall 2 prevention: dashboard CSS would break without this)
- Zero business logic, no DB access, no token validation — purely host detection + path rewriting

### Task 2: serve/[tplId]/[[...path]]/route.ts — Streaming Handler

Created `apps/web/src/app/serve/[tplId]/[[...path]]/route.ts` — the catch-all route handler that receives all rewritten serving requests.

**Key design decisions:**

**MVP token tradeoff (RESEARCH.md Open Question 1):**
- `index.html` and extensionless SPA routes: HMAC token in `?t=` required → `verifyServeToken(token)` validates signature + expiry + scope
- Assets (.js/.css/.png/etc.): no token required — the non-enumerable `tplId` UUID in the S3 key is the implicit authorization boundary

**Cross-tenant isolation (T-07-02-01):**
- `claims.templateId !== tplId` (from URL) → 403 immediately
- Additional DB check: `template.workspaceId !== workspaceId` (from claims) → 404 for HTML path

**Unscoped prisma lookup for assets:**
- Asset requests have no token → workspaceId cannot be derived from claims
- Solution: `prisma.template.findUnique({ where: { id: tplId } })` unscoped by workspace
- Safe: only confirms the template exists and returns its workspaceId; the non-enumerable UUID prevents enumeration

**Type guard (D-08, T-07-02-06):**
- `assertViteSpaKind(template.kind)` called on both HTML and asset paths before any S3 access
- LIQUID template reaching this handler → 403 "Forbidden — Type boundary violation"

**S3 streaming (T-07-02-07):**
- `GetObjectCommand` → `Body!.transformToWebStream()` — stream consumed exactly once
- Content-Type derived from `getContentType(s3Path)` (MIME map from file extension), never from Body bytes

**Security headers (all on every response):**
- `Content-Security-Policy: frame-ancestors {DASHBOARD_ORIGIN}` — HTTP response header, NOT meta tag (Pitfall 6 prevention / T-07-02-08)
- `Cache-Control: no-store` — ephemeral tokens must not be cached by intermediaries
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- No `Set-Cookie` for PageForge session cookies (D-03)

**SPA fallback (D-07):**
- Extensionless path or root → `s3Path = 'index.html'`, `isFallback = true`
- Missing asset (S3 NoSuchKey) → 404 with no fallback
- Missing index.html on SPA fallback path → 404 with descriptive message

## Test Results

Pre-existing tests from Plan 01 (26 tests) all pass after Task 2 was implemented — no regressions.

## Commits

| Hash | Message | Files |
|------|---------|-------|
| 7029eb5 | feat(07-02): create proxy.ts — host detection and rewrite for *.serve.* hosts | apps/web/src/proxy.ts |
| f86488f | feat(07-02): create serve/[tplId]/[[...path]]/route.ts — token validation + S3 stream + SPA fallback | apps/web/src/app/serve/[tplId]/[[...path]]/route.ts |

## Deviations from Plan

None — plan executed exactly as written.

The plan's step 4 for asset requests described a "separate lookup" approach and identified the unscoped prisma lookup as the correct MVP solution. That's exactly what was implemented: `prisma.template.findUnique({ where: { id: tplId }, select: { workspaceId: true, kind: true } })` for assets, with the type guard and S3 key construction using the returned workspaceId.

## Known Stubs

None — both modules are complete implementations with no placeholder values or hardcoded data.

## Threat Flags

No new threat surface introduced beyond what the plan's `<threat_model>` covers.

All mitigations from the threat register (T-07-02-01 through T-07-02-08) are implemented:
- T-07-02-01: `claims.templateId !== tplId` → 403; DB `template.workspaceId !== workspaceId` → 404
- T-07-02-02: `verifyServeToken` uses `timingSafeEqual` (implemented in Plan 01 token.ts)
- T-07-02-03: `exp` is inside HMAC-signed payload; modifying it → signature mismatch → null → 403
- T-07-02-04: `resolveServePath` strips leading slashes; S3 key prefix prepended server-side; tplId is UUID
- T-07-02-05: No `Set-Cookie` for PageForge session; CSP `frame-ancestors` restricts embedding
- T-07-02-06: `assertViteSpaKind(template.kind)` called before S3 access on both HTML and asset paths
- T-07-02-07: `getContentType(s3Path)` from extension; `Body.transformToWebStream()` called once
- T-07-02-08: `Content-Security-Policy: frame-ancestors` set as HTTP response header in `buildSecurityHeaders()`
- T-07-02-09: Accepted — replay within 30-min TTL is an accepted risk for MVP (documented in plan)
- T-07-02-10: Accepted — proxy reads Host only for routing; authorization in route handler after rewrite

## Self-Check: PASSED

Files created:
- [x] apps/web/src/proxy.ts
- [x] apps/web/src/app/serve/[tplId]/[[...path]]/route.ts

Commits verified:
- [x] 7029eb5 — proxy.ts
- [x] f86488f — route.ts
