---
phase: "10"
plan: "03"
subsystem: editor/preview-parent
tags: [edit-mode, iframe, postMessage, vite-spa, rbac, client-component]
dependency_graph:
  requires: ["10-01", "10-02"]
  provides: ["ViteSpaPreviewEditor", "preview-page-canEdit"]
  affects:
    - apps/web/src/app/w/[slug]/lps/[lpId]/preview/ViteSpaPreviewEditor.tsx
    - apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx
tech_stack:
  added: []
  patterns:
    - "postMessage bridge with event.origin allowlist (T-10-03-02)"
    - "stable ref pattern for calling latest handler from a stale-closure useEffect"
    - "useTransition wrapping Server Action call for non-blocking pending state"
    - "iframeSrc as derived state: change triggers iframe reload → IFRAME_READY handshake"
    - "canEdit dual-gate: RSC-level prop (UI gate) + Server Action requireWorkspaceRole (authoritative)"
key_files:
  created:
    - apps/web/src/app/w/[slug]/lps/[lpId]/preview/ViteSpaPreviewEditor.tsx
  modified:
    - apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx
decisions:
  - "handleSaveWithEdits called via stable ref in postMessage listener to avoid stale closure without re-registering the listener on every render"
  - "ELEMENT_CHANGED sets pendingEdits with originalHash='' (dirty-count only); correct hashes come from iframe via PENDING_EDITS on save"
  - "Editar button disabled only during edit-mode transition (isEditMode && !iframeReady); always enabled in view mode — Pitfall 5 prevention"
  - "Badge import removed from page.tsx (was only used in the static VITE_SPA block now replaced by ViteSpaPreviewEditor)"
metrics:
  duration: "~4 minutes"
  completed: "2026-06-26T13:03:00Z"
  tasks_completed: 2
  files_changed: 2
---

# Phase 10 Plan 03: ViteSpaPreviewEditor — Dashboard Parent Half Summary

ViteSpaPreviewEditor Client Component with 5-state toolbar, active-edit banner, origin-validated postMessage bridge, startTransition save with router.refresh(), and discard Dialog; preview/page.tsx RSC updated to compute canEdit server-side and render the editor for VITE_SPA LPs.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create ViteSpaPreviewEditor.tsx — full Client Component | 5478e5c | ViteSpaPreviewEditor.tsx |
| 2 | Modify preview/page.tsx RSC: compute canEdit, render ViteSpaPreviewEditor | 61fcbee | page.tsx |

## What Was Built

### Task 1: ViteSpaPreviewEditor.tsx

Full-viewport Client Component (`"use client"`) that is the dashboard parent half of the cross-origin text editor. Implements:

**Props:** `lpId`, `lpName`, `slug`, `serveOrigin`, `entryPath`, `token`, `canEdit` (named export `ViteSpaPreviewEditor`).

**State:** `isEditMode`, `iframeReady`, `pendingEdits: PfOverride[]`, `selectedPath`, `saveError`, `showDiscardDialog`.

**5 toolbar states (per UI-SPEC Component & State Contract):**
1. Viewer (`canEdit=false`): LP name + Vite SPA badge + back link only — no edit controls.
2. View mode: `Editar` button (enabled in view mode regardless of iframeReady; Pitfall 5 prevention). Tooltip shows loading message when `!iframeReady`.
3. Edit mode — clean: `Concluir` ghost button exits without dialog.
4. Edit mode — dirty: blue tint dirty count badge (`N alterações não salvas`) + `Descartar` (outline) + `Salvar alterações` (primary). All disabled while `isPending`.
5. Saving: same as dirty with `Salvando…` text, all controls disabled.

**postMessage bridge:**
- Listener registered once (`[serveOrigin]` dep); validates `event.origin === serveOrigin` before dispatching (T-10-03-02).
- Handles: `IFRAME_READY`, `ELEMENT_SELECTED`, `ELEMENT_CHANGED`, `PENDING_EDITS`, `EDIT_DISCARDED`.
- `sendToIframe` uses `serveOrigin` as targetOrigin (never `'*'`); gated on `iframeReady`.
- `PENDING_EDITS` handler invoked via stable ref (avoids stale closure without re-registering listener).

**Save flow:** `REQUEST_SAVE` → iframe sends `PENDING_EDITS {overrides}` → `updateLpAction(slug, { id: lpId, overrides })` inside `startTransition` → `router.refresh()` on success (Pitfall 6 prevention — re-mints serve token).

**Discard flow:** `Descartar` with no edits → `REQUEST_DISCARD` directly. With edits → Dialog opens → confirm → `REQUEST_DISCARD` → iframe sends `EDIT_DISCARDED` → state cleared.

**Active-edit banner:** `bg-[#eff6ff] border-b border-[#bfdbfe] text-[#1d4ed8] h-8` — visible only in `isEditMode`; copy swaps on `selectedPath` (idle vs element-selected).

**Iframe:** `sandbox="allow-scripts allow-same-origin"`; `outline: 3px solid #2563eb` (blue frame) in edit mode; `onLoad={() => setIframeReady(false)}` resets handshake on every reload.

### Task 2: preview/page.tsx

Three targeted changes to the VITE_SPA branch:
1. Imports: `can` added to the `guards` import; `ViteSpaPreviewEditor` imported from `"./ViteSpaPreviewEditor"`. Unused `Badge` import removed.
2. `const canEdit = can(ctx.role, "lp", "update")` added after token/serveOrigin/entryPath computation — synchronous call, no await.
3. Static `<iframe>` block (lines 72-113 of original) replaced with `<ViteSpaPreviewEditor lpId={lpId} lpName={lp.name} slug={slug} serveOrigin={serveOrigin} entryPath={entryPath} token={token} canEdit={canEdit} />`.

LIQUID branch unchanged. Security invariants preserved:
- `workspaceId` from `ctx.workspaceId` (session), never URL params (T-08-03-02).
- `token = mintServeToken(ctx.workspaceId, lp.templateId!)`, never client-supplied.
- `canEdit` from `ctx.role` (server-side role resolution), never from client input.

## Verification Results

```
npx tsc --noEmit                                             → 0 errors (PASS)
grep -c "ViteSpaPreviewEditor" page.tsx                      → 3 (import + JSX + comment)
grep -c "canEdit" page.tsx                                   → 4 (const, prop, 2 comments)
grep 'event.origin.*serveOrigin' ViteSpaPreviewEditor.tsx   → 2 lines (comment + code)
grep '"use client"' ViteSpaPreviewEditor.tsx                 → 1 (first line)
grep 'export function ViteSpaPreviewEditor' tsx              → 1 (named export)
grep 'sandbox="allow-scripts allow-same-origin"' tsx         → 1 (iframe)
grep 'router.refresh()' ViteSpaPreviewEditor.tsx             → 1 (on save success)
grep 'disabled={isEditMode && !iframeReady}' tsx             → 1 (Editar button)
```

## Deviations from Plan

None — plan executed exactly as written.

The `originalHash: ""` in the `ELEMENT_CHANGED` handler is intentional per the plan:
"The final override array (with correct originalHash) comes from the iframe via PENDING_EDITS when saving." Local `pendingEdits` is used only for dirty count badge accuracy.

## Known Stubs

None that block the plan goal. The `originalHash: ""` in ELEMENT_CHANGED is a design decision (dirty-count placeholder only), documented inline. The real hashes are always sent by the iframe via PENDING_EDITS on REQUEST_SAVE.

## Threat Flags

No new threat surface beyond the plan's threat model. ViteSpaPreviewEditor is a Client Component (no new network endpoint). The updateLpAction and serve route were already in the threat register. No new routes, handlers, or auth paths introduced.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| apps/web/src/app/w/[slug]/lps/[lpId]/preview/ViteSpaPreviewEditor.tsx | FOUND |
| apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx (modified) | FOUND |
| .planning/phases/10-editor-visual-in-iframe-texto/10-03-SUMMARY.md | FOUND (this file) |
| Commit 5478e5c (Task 1) | FOUND |
| Commit 61fcbee (Task 2) | FOUND |
| pnpm tsc --noEmit | PASS |
