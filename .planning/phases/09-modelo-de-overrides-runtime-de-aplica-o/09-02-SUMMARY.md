---
phase: "09"
plan: "02"
subsystem: lps/overrides
tags: [overrides, apply-shim, serve-route, export-route, xss-safety, tdd]
dependency_graph:
  requires:
    - "09-01"  # PfOverride/ViteSpaValues types + buildBrandStyleTagForLp
  provides:
    - hexToHslTripletShim (apps/web/src/lib/overrides/apply-shim.ts)
    - buildOverrideInjection (apps/web/src/lib/overrides/apply-shim.ts)
    - injectOverrides (apps/web/src/lib/overrides/apply-shim.ts)
    - serve route override injection (apps/web/src/app/serve/[tplId]/[[...path]]/route.ts)
    - export route VITE_SPA override injection (apps/web/src/app/api/lps/[lpId]/export/route.ts)
  affects:
    - Plan 10: postMessage-based lpId context to disambiguate multi-LP serve route
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN for apply-shim module
    - hexToHslTripletShim serialized via Function.prototype.toString() into shimScript (W2 guarantee)
    - B2 sentinel-{} guard pattern for VITE_SPA LP values without overrides
    - escapeJsonForHtml unicode-escape pattern for XSS-safe JSON embedding in HTML (T-09-02-01)
    - per-override try/catch for silent skip of malformed paths (T-09-02-05)
key_files:
  created:
    - apps/web/src/lib/overrides/apply-shim.ts
    - apps/web/src/lib/overrides/apply-shim.test.ts
  modified:
    - apps/web/src/app/serve/[tplId]/[[...path]]/route.ts
    - apps/web/src/app/api/lps/[lpId]/export/route.ts
decisions:
  - "hexToHslTripletShim serialized via .toString() into shimScript string — browser shim and Node-tested helper are provably the same code (W2 preview==export color guarantee)"
  - "escapeJsonForHtml replaces < > & with unicode escapes in the overridesJson blob — outer closing </script> tag of sentinel element is intentionally kept; test checks JSON content portion only"
  - "serve route: findFirst by createdAt asc for multi-LP determinism — multi-LP disambiguation deferred to Phase 10 (postMessage lpId)"
  - "export route: buildBrandStyleTag removed from import (unused after switching to buildBrandStyleTagForLp)"
metrics:
  duration: "313s (5m 13s)"
  completed: "2026-06-24"
  tasks_completed: 2
  files_modified: 4
---

# Phase 9 Plan 02: Runtime Override Apply Shim Summary

**One-liner:** Inline `<script>` apply-shim that reads overrides from a JSON sentinel tag and applies text via `textContent` + color via CSS `--primary` setProperty, wired into both the serve route and export route (preview == export guarantee).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing tests for apply-shim | ba1654b | apply-shim.test.ts (created) |
| 1 (GREEN) | Implement apply-shim module | ccd80e9 | apply-shim.ts (created), apply-shim.test.ts (fixed XSS assertion) |
| 2 | Wire shim injection into serve + export routes | 5a2f0ba | route.ts (serve), route.ts (export) |

## What Was Built

### apply-shim.ts module (apps/web/src/lib/overrides/)

**hexToHslTripletShim**

Identical hex→HSL algorithm to `theme.ts hexToHslTriplet` — exported for:
1. W2 unit tests asserting `hexToHslTripletShim('#06356f') === '213 90% 23%'` (same as theme.ts)
2. Embedding via `.toString()` into the shimScript string — browser and Node-tested helper are provably the same code

**buildOverrideInjection(values: ViteSpaValues | null | undefined)**

Returns `{ shimScript: string; overridesJson: string }`:

- B2 guard: `!values || !values.overrides || values.overrides.length === 0` → returns `{ shimScript: '', overridesJson: '' }` — survives sentinel `{}` where `.overrides === undefined` at runtime
- `overridesJson`: `<script id="pf-overrides" type="application/json">{escaped JSON}</script>` with `escapeJsonForHtml` that unicode-escapes `< > &` (T-09-02-01)
- `shimScript`: inline `<script>` that after `DOMContentLoaded`:
  - reads JSON from `document.getElementById('pf-overrides').textContent`
  - for `type === 'text'`: walks DOM by `/`-separated child index path, sets `node.textContent = value` (NEVER innerHTML — T-09-02-02)
  - for `type === 'color'`: `document.documentElement.style.setProperty('--primary', hexToHslTripletShim(value))`
  - `image` / `href` / unknown: silently skipped per per-override `try/catch` (T-09-02-05)

**injectOverrides(html, injection)**

- No-op when both fields empty (override-free LPs)
- Inserts `overridesJson` then `shimScript` before `</head>` (same strategy as `injectBrandStyle`)
- Fallback: prepend to html when `</head>` absent

### Serve Route Changes (apps/web/src/app/serve/[tplId]/[[...path]]/route.ts)

- Replaced `buildBrandStyleTag` import with `buildBrandStyleTagForLp` (LP color precedence)
- Added LP lookup: `servingRead → tx.landingPage.findFirst({ where: { templateId, workspaceId }, orderBy: { createdAt: 'asc' } })`
- Pipeline: `injectBrandStyle → injectOverrides → finalHtml` returned in `NextResponse`
- Comment added: multi-LP disambiguation via Phase 10 `postMessage` lpId

### Export Route Changes (apps/web/src/app/api/lps/[lpId]/export/route.ts)

- Replaced `buildBrandStyleTag` → `buildBrandStyleTagForLp` in VITE_SPA `index.html` block
- Added `buildOverrideInjection + injectOverrides` after theming: `finalHtml` fed to `archiver`
- Removed now-unused `buildBrandStyleTag` import
- LIQUID export path, S3 key conventions, security headers, and CSP injection all unchanged

## Tests

- `apply-shim.test.ts`: 21 tests — all passing
  - B2 guard cases (null/undefined/sentinel-{}/empty array)
  - Text override: DOMContentLoaded + textContent + no innerHTML
  - Color override: --primary + setProperty
  - Image type: silently skipped (no innerHTML)
  - XSS safety: `</script>` in value unicode-escaped in JSON content portion
  - W2 color fidelity: `#06356f → '213 90% 23%'`, `#0d4080 → '213 82% 28%'`
  - injectOverrides: both tags before `</head>`; no-op when empty

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] XSS test assertion too broad for outer closing tag**
- **Found during:** Task 1 GREEN verification
- **Issue:** Test `expect(result.overridesJson).not.toContain("</script>")` also matched the legitimate outer closing `</script>` tag of the sentinel `<script type="application/json">` element, causing a false failure
- **Fix:** Updated assertion to extract JSON content portion only (strip outer `<script ...>` and `</script>` wrapper), then assert the VALUE's `</script>` is unicode-escaped in the content portion. The outer closing tag is intentional.
- **Files modified:** apps/web/src/lib/overrides/apply-shim.test.ts
- **Commit:** ccd80e9

## Known Stubs

None. The shim module is fully implemented and wired. Override-free LPs return empty injection (B2 safe). No placeholder data or TODO stubs.

## Threat Surface Scan

All threat model items mitigated as planned:

| Threat ID | Status |
|-----------|--------|
| T-09-02-01 | Mitigated: escapeJsonForHtml unicode-escapes `< > &` in JSON blob |
| T-09-02-02 | Accepted: textContent (never innerHTML) — no XSS vector by design |
| T-09-02-03 | Mitigated: primaryColorOverride validated as #RRGGBB before storage; hexToHslTripletShim output is digits+%+spaces only |
| T-09-02-04 | Mitigated: LP lookup scoped to workspaceId from verified HMAC token (servingRead RLS flag) |
| T-09-02-05 | Mitigated: per-override try/catch — malformed path silently skipped |
| T-09-02-06 | Accepted: Array length unbounded in Phase 9; Phase 12 will cap |

No new threat surface introduced beyond what was planned.

## Self-Check

### Created files exist
- `apps/web/src/lib/overrides/apply-shim.ts` — FOUND
- `apps/web/src/lib/overrides/apply-shim.test.ts` — FOUND
- `apps/web/src/app/serve/[tplId]/[[...path]]/route.ts` (modified) — FOUND
- `apps/web/src/app/api/lps/[lpId]/export/route.ts` (modified) — FOUND

### Commits exist
- ba1654b — FOUND (test: RED apply-shim)
- ccd80e9 — FOUND (feat: apply-shim GREEN)
- 5a2f0ba — FOUND (feat: serve + export routes wired)

## Self-Check: PASSED
