---
phase: "10"
plan: "02"
subsystem: overrides/edit-script
tags: [edit-mode, iframe, postMessage, serve-route, vite-spa, tdd]
dependency_graph:
  requires: ["10-01"]
  provides: ["buildEditScript", "injectEditScript", "serve-route-edit-injection"]
  affects: ["apps/web/src/app/serve/[tplId]/[[...path]]/route.ts", "apps/web/src/lib/overrides/edit-script.ts"]
tech_stack:
  added: []
  patterns:
    - "IIFE edit script builder following apply-shim.ts injection architecture"
    - "Dynamic import for optional edit-mode module (keeps hot path lean)"
    - "FNV-1a 32-bit hash (inline, dependency-free) for originalHash"
    - "Case-insensitive </head> insertion via toLowerCase().indexOf() + slice on original"
    - "findUnique LP lookup with workspaceId from HMAC token (cross-tenant safe)"
key_files:
  created:
    - apps/web/src/lib/overrides/edit-script.ts
    - apps/web/src/lib/overrides/edit-script.test.ts
  modified:
    - apps/web/src/app/serve/[tplId]/[[...path]]/route.ts
decisions:
  - "editMode and lpIdParam declared as let at function scope (not inside if block) so they are accessible in the HTML path section after the if/else — TypeScript scoping requirement"
  - "Dynamic import('@/lib/overrides/edit-script') used in serve route (not static) to keep module off the hot path for all non-edit requests"
  - "Rename local variable in computePath from 'parent' to 'par' to avoid shadowing the global window.parent used in sendToParent"
metrics:
  duration: "~4 minutes"
  completed: "2026-06-26T12:51:00Z"
  tasks_completed: 2
  files_changed: 3
---

# Phase 10 Plan 02: Edit Script Factory + Serve Route Injection Summary

Edit script IIFE factory (buildEditScript/injectEditScript) with verbatim pathToNode copy from apply-shim.ts, computePath using childNodes, FNV-1a hash, full postMessage protocol; serve route wired to inject the script when ?edit=1&lpId= present, using findUnique for per-LP disambiguation.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create edit-script.ts + unit tests (32 tests) | cb8f4aa | edit-script.ts, edit-script.test.ts |
| 2 | Wire edit script injection into serve route + swap findUnique | 25651ef | route.ts |

## What Was Built

### Task 1: edit-script.ts + edit-script.test.ts

`buildEditScript(dashboardOrigin: string): string` — returns a `<script>` IIFE containing:
- `pathToNode`: character-for-character copy of apply-shim.ts lines 128-138 (same function the apply-shim uses, ensuring roundtrip path fidelity)
- `computePath`: reverse walk using `Array.prototype.indexOf.call(parent.childNodes, current)` — NOT parent.children (Pitfall 1: text nodes count in indices)
- `fnv1a`: inline FNV-1a 32-bit hash (0x811c9dc5 basis) for `originalHash` computation
- Full postMessage protocol: sends IFRAME_READY, ELEMENT_SELECTED, ELEMENT_CHANGED, PENDING_EDITS, EDIT_DISCARDED; receives EDIT_MODE_ENTER, EDIT_MODE_EXIT, REQUEST_SAVE, REQUEST_DISCARD
- hover/click/contentEditable lifecycle with savedStylesMap for style save/restore
- `event.origin === dashboardOrigin` validation on all incoming messages (T-10-02-06)
- dashboardOrigin embedded via JSON.stringify (T-10-02-02)

`injectEditScript(html: string, editScript: string): string` — identical strategy to injectOverrides in apply-shim.ts: case-insensitive </head> detection, slice on original html, prepend fallback.

32 unit tests covering all acceptance criteria.

### Task 2: serve route modifications

Three additive changes to route.ts:
1. `let editMode = false; let lpIdParam: string | null = null;` declared at function scope, set inside the `isHtmlRequest` branch after HMAC token verification
2. LP lookup swap: `findUnique` when lpIdParam present (workspaceId always from token claims, T-10-02-04), fallback to existing `findMany` + single-LP fail-safe when lpIdParam absent
3. Edit script injection: dynamic import of `@/lib/overrides/edit-script` when `editMode && lpIdParam`; `editableHtml` passed to NextResponse (replaces `finalHtml`)

## Verification Results

```
pnpm vitest run src/lib/overrides/edit-script.test.ts  → 32/32 passed
pnpm vitest run tests/serve-vite-spa.test.ts           → 20/20 passed
pnpm tsc --noEmit                                       → 0 errors
grep -c "editMode" route.ts                             → 5 matches
grep -c "buildEditScript|injectEditScript" route.ts     → 3 matches
grep -c "findUnique" route.ts                           → 5 matches
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Renamed local variable in computePath to avoid window.parent shadowing**
- **Found during:** Task 1
- **Issue:** The plan's code example used `var parent = current.parentNode` inside computePath. In the IIFE, `parent` also refers to `window.parent` (used in sendToParent). While JavaScript function scope prevents actual shadowing of `sendToParent`'s usage, using `var parent` inside computePath is confusing and could cause issues in strict environments.
- **Fix:** Renamed the local variable to `var par = current.parentNode` in computePath's while loop body. All references to `parent.childNodes` in computePath were updated to `par.childNodes`.
- **Files modified:** apps/web/src/lib/overrides/edit-script.ts
- **Commit:** cb8f4aa

**2. [Rule 1 - Bug] editMode/lpIdParam scoped at function level, not inside if block**
- **Found during:** Task 2
- **Issue:** The plan says to add params "after the HMAC token is verified and workspaceId extracted from claims" (inside the `if (isHtmlRequest)` block). But they need to be accessible at the injection point (~150 lines later in the same function), which is outside the if block scope in TypeScript.
- **Fix:** Declared with `let` before the `if (isHtmlRequest)` block, set inside the block. This matches how `workspaceId` itself is declared (as `let workspaceId: string;` at function scope).
- **Files modified:** apps/web/src/app/serve/[tplId]/[[...path]]/route.ts
- **Commit:** 25651ef

## Known Stubs

None. Both functions are fully implemented and wired.

## Threat Flags

No new threat surface found beyond what is documented in the plan's threat model. The serve route modification does not introduce new network endpoints — it extends the existing GET /serve/[tplId] handler with a conditional code path gated on existing URL params. The edit-script.ts module is a pure string builder with no side effects.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| apps/web/src/lib/overrides/edit-script.ts | FOUND |
| apps/web/src/lib/overrides/edit-script.test.ts | FOUND |
| .planning/phases/10-editor-visual-in-iframe-texto/10-02-SUMMARY.md | FOUND |
| Commit cb8f4aa (Task 1) | FOUND |
| Commit 25651ef (Task 2) | FOUND |
