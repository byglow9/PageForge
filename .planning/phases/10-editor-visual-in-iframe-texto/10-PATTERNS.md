# Phase 10: Editor visual in-iframe (texto) - Pattern Map

**Mapped:** 2026-06-25
**Files analyzed:** 5 (3 new, 2 modified)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx` | page (RSC) | request-response | itself (current version) | exact — same file, additive change |
| `apps/web/src/app/w/[slug]/lps/[lpId]/preview/ViteSpaPreviewEditor.tsx` | component (client) | event-driven + request-response | `apps/web/src/components/lps/LpPreview.tsx` | role-match (same toolbar + iframe shell) |
| `apps/web/src/app/serve/[tplId]/[[...path]]/route.ts` | route handler | request-response | itself (current version) | exact — same file, additive change |
| `apps/web/src/lib/overrides/edit-script.ts` | utility | transform | `apps/web/src/lib/overrides/apply-shim.ts` | role-match (same injection architecture) |
| `apps/web/prisma/migrations/0010_lp_serving_read_policy/migration.sql` | migration | CRUD | `apps/web/prisma/migrations/0009_serving_read_policy/migration.sql` | exact — same RLS policy pattern |

---

## Pattern Assignments

---

### `apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx` (RSC page, request-response)

**Change type:** MODIFIED — add `can()` gate, pass `canEdit`/`lpId`/`serveOrigin`/`token` to new `ViteSpaPreviewEditor` client component; replace the static `<iframe>` block in the VITE_SPA branch.

**Analog:** itself (current file read above)

**Imports to add** (lines 1-11 of current file, add new imports):
```typescript
import { can } from "@/lib/workspaces/guards";
// ViteSpaPreviewEditor will be the new default export client wrapper
import { ViteSpaPreviewEditor } from "./ViteSpaPreviewEditor";
```

**Role gate pattern** (from `apps/web/src/lib/workspaces/guards.ts` lines 206-247):
```typescript
// In the VITE_SPA branch, after requireWorkspace(slug):
const canEdit = can(ctx.role, 'lp', 'update');
// can('viewer', 'lp', 'update') → false  (viewer.lp = ["read","preview","export"])
// can('editor', 'lp', 'update') → true
// can('admin',  'lp', 'update') → true
// can('owner',  'lp', 'update') → true
```

**serveOrigin computation** (current file lines 63-67 — copy exactly):
```typescript
const serveOrigin =
  process.env.NODE_ENV === "development"
    ? `http://${lp.templateId}.serve.localhost:${process.env.PORT ?? 3000}`
    : `https://${lp.templateId}.serve.${process.env.SERVE_DOMAIN}`;
```

**Token minting** (current file line 59 — copy exactly):
```typescript
const token = mintServeToken(ctx.workspaceId, lp.templateId!);
```

**Replacement block for VITE_SPA branch** — replaces the current static `<iframe>` JSX (lines 72-113) with:
```typescript
return (
  <ViteSpaPreviewEditor
    lpId={lpId}
    lpName={lp.name}
    slug={slug}
    serveOrigin={serveOrigin}
    entryPath={lp.entryRoute ?? "/"}
    token={token}
    canEdit={canEdit}
  />
);
```

**Security invariant to preserve:** `workspaceId` comes exclusively from `ctx.workspaceId` (requireWorkspace result), never from URL params (T-08-03-02). `token = mintServeToken(ctx.workspaceId, lp.templateId!)` — never from client.

---

### `apps/web/src/app/w/[slug]/lps/[lpId]/preview/ViteSpaPreviewEditor.tsx` (client component, event-driven + request-response)

**Change type:** NEW file

**Primary analog:** `apps/web/src/components/lps/LpPreview.tsx` — same toolbar + iframe shell pattern

**Secondary analog:** `apps/web/src/components/lps/ViteSpaLpForm.tsx` — `router.refresh()` after Server Action + `useTransition` for pending state

**Directive and imports pattern** (from `LpPreview.tsx` lines 1-18 and `ViteSpaLpForm.tsx` lines 1-33):
```typescript
"use client";

import { useRef, useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PfOverride } from "@/lib/lps/schema";
import { updateLpAction } from "@/lib/lps/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
```

**Toolbar layout pattern** (from `LpPreview.tsx` lines 38-70 — copy the flex shell, adapt content):
```typescript
// Full-viewport flex column, sticky toolbar at top
<div className="flex flex-col h-screen">
  <div className="h-12 px-4 border-b border-border bg-background flex items-center gap-4 sticky top-0 shrink-0 z-10">
    <Link
      href={`/w/${slug}/lps`}
      className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {/* back link */}
    </Link>
    <span className="text-xl font-semibold text-foreground flex-1 truncate">{lpName}</span>
    <Badge variant="outline">Vite SPA</Badge>
    {/* conditional edit controls here */}
  </div>
  {/* ... */}
</div>
```

**Iframe element pattern** (from `preview/page.tsx` lines 98-103 — same sandbox attribute):
```typescript
<iframe
  ref={iframeRef}
  src={iframeSrc}
  sandbox="allow-scripts allow-same-origin"
  className="w-full flex-1 border-0"
  style={{
    height: "calc(100vh - 3rem)",
    outline: isEditMode ? "3px solid #2563eb" : "none",
    outlineOffset: isEditMode ? "-3px" : undefined,
  }}
  title={`Preview: ${lpName}`}
  onLoad={() => setIframeReady(false)} // reset; wait for IFRAME_READY postMessage
/>
```

**postMessage bridge pattern** (derived from RESEARCH.md Unknown 1 — no codebase analog exists yet):
```typescript
// useEffect: register message listener — validate origin before processing
useEffect(() => {
  function handleMessage(event: MessageEvent) {
    if (event.origin !== serveOrigin) return; // allowlist check (RESEARCH Unknown 1)
    const msg = event.data as { type: string; [k: string]: unknown };
    if (!msg?.type) return;
    switch (msg.type) {
      case "IFRAME_READY":    setIframeReady(true); break;
      case "PENDING_EDITS":   handleSaveWithEdits(msg.overrides as PfOverride[]); break;
      case "EDIT_DISCARDED":  setIsEditMode(false); setPendingEdits([]); break;
      case "ELEMENT_SELECTED": /* update selectedPath state for banner hint */ break;
    }
  }
  window.addEventListener("message", handleMessage);
  return () => window.removeEventListener("message", handleMessage);
}, [serveOrigin]); // re-register only if serveOrigin changes (it won't)
```

**Send to iframe helper** (gated on `iframeReady`):
```typescript
const sendToIframe = useCallback((msg: object) => {
  if (iframeRef.current?.contentWindow && iframeReady) {
    iframeRef.current.contentWindow.postMessage(msg, serveOrigin);
  }
}, [serveOrigin, iframeReady]);
```

**Enter edit mode** — changes `iframeSrc` which triggers iframe reload:
```typescript
const handleEnterEdit = () => {
  setIsEditMode(true);
  setIframeReady(false); // will be set true by next IFRAME_READY
};
// iframeSrc is derived state:
const iframeSrc = isEditMode
  ? `${serveOrigin}${entryPath}?t=${token}&edit=1&lpId=${lpId}`
  : `${serveOrigin}${entryPath}?t=${token}`;
```

**After IFRAME_READY in edit mode — send EDIT_MODE_ENTER**:
```typescript
useEffect(() => {
  if (iframeReady && isEditMode) {
    sendToIframe({ type: "EDIT_MODE_ENTER", lpId });
  }
}, [iframeReady, isEditMode, lpId, sendToIframe]);
```

**Save flow** — request pending edits from iframe then call updateLpAction (from `ViteSpaLpForm.tsx` lines 104-137 for the Server Action call shape, adapted):
```typescript
// handleSave: ask iframe for pending edits
const handleSave = () => sendToIframe({ type: "REQUEST_SAVE" });

// handleSaveWithEdits: called when PENDING_EDITS message arrives
const [isPending, startTransition] = useTransition();
const router = useRouter();
function handleSaveWithEdits(overrides: PfOverride[]) {
  startTransition(async () => {
    const result = await updateLpAction(slug, { id: lpId, overrides });
    if (!result.ok) {
      setSaveError(result.error ?? "Não foi possível salvar as alterações. Tente novamente.");
      return;
    }
    // On success: exit edit mode (iframeSrc reverts to non-edit URL → iframe reloads)
    setIsEditMode(false);
    setPendingEdits([]);
    setIframeReady(false);
    setSaveError(null);
    router.refresh(); // re-renders RSC → re-mints serve token (Pitfall 6 prevention)
  });
}
```

**router.refresh() pattern** (from `ViteSpaLpForm.tsx` line 137 — exact same call):
```typescript
router.refresh(); // triggers RSC re-render; re-mints serve token
```

**Discard flow**:
```typescript
const handleDiscard = () => sendToIframe({ type: "REQUEST_DISCARD" });
// EDIT_DISCARDED message handler sets isEditMode(false), clears pendingEdits
```

**Error state pattern** (no existing analog — use Alert from shadcn):
```typescript
{saveError && (
  <Alert variant="destructive" className="mx-4 mt-2">
    <AlertDescription>{saveError}</AlertDescription>
  </Alert>
)}
```

**Active-edit banner** (UI-SPEC lines 127-129):
```typescript
{isEditMode && (
  <div className="bg-[#eff6ff] border-b border-[#bfdbfe] text-[#1d4ed8] text-sm h-8 px-4 py-1 flex items-center">
    {selectedPath
      ? "Editando texto — Enter para confirmar, Esc para cancelar"
      : "Modo de edição ativo — clique em um texto para editar"}
  </div>
)}
```

**Dirty count badge** (UI-SPEC lines 121-125):
```typescript
{pendingEdits.length > 0 && (
  <Badge className="bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe] font-semibold">
    {pendingEdits.length === 1
      ? "1 alteração não salva"
      : `${pendingEdits.length} alterações não salvas`}
  </Badge>
)}
```

**Discard confirmation dialog** (UI-SPEC lines 135-137):
```typescript
// Use Dialog from shadcn — trigger only when N > 0
<Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Descartar alterações?</DialogTitle>
    </DialogHeader>
    <p className="text-sm text-muted-foreground">
      As {pendingEdits.length} alterações não salvas serão perdidas e o texto original será restaurado.
    </p>
    <DialogFooter>
      <Button variant="ghost" onClick={() => setShowDiscardDialog(false)}>
        Continuar editando
      </Button>
      <Button variant="destructive" onClick={confirmDiscard}>
        Descartar
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### `apps/web/src/app/serve/[tplId]/[[...path]]/route.ts` (route handler, request-response)

**Change type:** MODIFIED — add `?edit=1` + `?lpId=` branch; swap `findMany` for `findUnique` when `lpId` is present; inject editScript IIFE.

**Analog:** itself (current version already read above)

**URL param extraction** — add after token validation (current line 136, after `workspaceId = claims.workspaceId`):
```typescript
// Phase 10: edit mode signal and LP disambiguation (RESEARCH Unknown 2)
const searchParams = new URL(request.url).searchParams;
const editMode = searchParams.get("edit") === "1";
const lpIdParam = searchParams.get("lpId"); // trusted only for LP lookup, not for authz
```

**LP lookup change** — replace current `findMany` block (lines 256-263) with `findUnique` when `lpIdParam` is present:
```typescript
// Phase 10: prefer findUnique by lpId when available (RESEARCH Unknown 2 — LP disambiguation)
const lp = lpIdParam
  ? await servingRead((tx) =>
      tx.landingPage.findUnique({
        where: { id: lpIdParam, templateId: tplId, workspaceId }, // workspaceId from token
        select: { values: true },
      })
    )
  : lps.length === 1 ? lps[0] : null; // fallback: existing findMany logic
```

**Edit script injection** — add after `const finalHtml = injectOverrides(themedHtml, injection)` (current line 280), before the `return new NextResponse(...)`:
```typescript
// Phase 10: inject edit script IIFE when ?edit=1 (HMAC token already verified above)
let editableHtml = finalHtml;
if (editMode && lpIdParam) {
  const { buildEditScript, injectEditScript } = await import("@/lib/overrides/edit-script");
  const editScript = buildEditScript(process.env.DASHBOARD_ORIGIN ?? "http://localhost:3000");
  editableHtml = injectEditScript(finalHtml, editScript);
}
return new NextResponse(editableHtml, {
  headers: buildSecurityHeaders(contentType),
});
```

**Security note:** token is already HMAC-verified before this block (lines 128-136). `editMode` in the URL is a convenience signal, not a security boundary — the authoritative gate is `requireWorkspaceRole` inside `updateLpAction`.

**Injection position relative to apply-shim** — edit script must go AFTER the apply-shim injection (apply-shim fires on DOMContentLoaded too; edit script listens on DOMContentLoaded and must not interfere). The `injectEditScript` function appends to `</head>` just as `injectOverrides` does (see `apply-shim.ts` lines 183-203); since `injectOverrides` runs first and `injectEditScript` runs second, the edit script ends up AFTER the shim in the HTML, which is the required order.

---

### `apps/web/src/lib/overrides/edit-script.ts` (utility, transform)

**Change type:** NEW file

**Analog:** `apps/web/src/lib/overrides/apply-shim.ts` — exact same injection architecture; `buildEditScript`/`injectEditScript` mirror `buildOverrideInjection`/`injectOverrides`.

**File header pattern** (from `apply-shim.ts` lines 1-31 — same JSDoc style):
```typescript
/**
 * Edit script builder — injected into VITE_SPA index.html by the serve route
 * ONLY when ?edit=1 is present (Phase 10 in-iframe text editor).
 *
 * Security:
 * - Script is only injected after HMAC token verification (serve route).
 * - Persistence requires calling updateLpAction from the dashboard parent,
 *   which independently gates on requireWorkspaceRole (dual-gate pattern).
 * - postMessage sends use targetOrigin=dashboardOrigin (never '*').
 * - pathToNode is IDENTICAL to apply-shim.ts:128-138 — must stay in sync.
 */
```

**No "use server" directive** — this is a pure utility module exporting string-building functions. Same pattern as `apply-shim.ts` (no directive).

**Imports pattern** (from `apply-shim.ts` lines 33-35 — minimal imports, no external deps):
```typescript
// No imports needed — buildEditScript is a pure string builder.
// The IIFE it generates is self-contained (no import() at runtime in the browser).
```

**`buildEditScript` function** — mirrors `buildOverrideInjection` in shape (returns a string):
```typescript
export function buildEditScript(dashboardOrigin: string): string {
  // Use JSON.stringify to safely embed dashboardOrigin as a JS string literal
  // (prevents injection if dashboardOrigin contains quotes — same pattern as
  // escapeJsonForHtml in apply-shim.ts for the JSON sentinel)
  const dashboardOriginLiteral = JSON.stringify(dashboardOrigin);

  return `<script>
/* PageForge edit-mode script — injected by serve route only when ?edit=1 */
(function() {
  'use strict';
  var dashboardOrigin = ${dashboardOriginLiteral};
  /* ... IIFE body from RESEARCH.md Code Examples section ... */
})();
</script>`;
}
```

**`injectEditScript` function** — copy the `injectOverrides` pattern (from `apply-shim.ts` lines 183-203) but simplified (single string, not two fragments):
```typescript
export function injectEditScript(html: string, editScript: string): string {
  // Same strategy as injectOverrides: case-insensitive indexOf('</head>'), slice and insert.
  // IN-04 same pattern: toLowerCase() + slice on ORIGINAL html preserves document casing.
  const idx = html.toLowerCase().indexOf("</head>");
  if (idx !== -1) {
    return html.slice(0, idx) + editScript + "\n" + html.slice(idx);
  }
  // Fallback: no </head> found — prepend (same as injectOverrides fallback)
  return `${editScript}\n${html}`;
}
```

**IIFE internals — pathToNode** (from `apply-shim.ts` lines 128-138 — MUST BE IDENTICAL):
```javascript
// COPY EXACTLY from apply-shim.ts lines 128-138:
function pathToNode(path) {
  try {
    var parts = path.split('/').filter(function(p) { return p !== ''; });
    var node = document.body;
    for (var i = 0; i < parts.length; i++) {
      var idx = parseInt(parts[i], 10);
      if (!node || !node.childNodes || isNaN(idx) || idx >= node.childNodes.length) return null;
      node = node.childNodes[idx];
    }
    return node || null;
  } catch(e) { return null; }
}
```

**IIFE internals — computePath** (reverse of pathToNode — RESEARCH.md Unknown 3, uses `childNodes` not `children`):
```javascript
// CRITICAL: uses parent.childNodes (all node types) NOT parent.children (elements only)
// Pitfall 1 from RESEARCH.md: childNodes includes text nodes; wrong NodeList = wrong index
function computePath(node) {
  var parts = [];
  var current = node;
  while (current !== document.body && current.parentNode !== null) {
    var parent = current.parentNode;
    var idx = Array.prototype.indexOf.call(parent.childNodes, current);
    parts.unshift(String(idx));
    current = parent;
    if (current === document.body) break;
  }
  if (current !== document.body) return null;
  return '/' + parts.join('/');
}
```

**IIFE internals — FNV-1a hash** (RESEARCH.md Unknown 3 — inline, no npm dep):
```javascript
function fnv1a(str) {
  var h = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
// fnv1a('') = '811c9dc5' — satisfies z.string().min(1) (PfOverrideSchema)
```

**In-iframe highlight CSS values** (UI-SPEC lines 148-154 — inline styles, NO Tailwind):
```javascript
// Hover: 2px dashed blue-500, offset 2px, pointer cursor
el.style.outline = '2px dashed #3b82f6';
el.style.outlineOffset = '2px';
el.style.cursor = 'pointer';

// Selected: 2px solid blue-600, offset 2px, blue tint bg
el.style.outline = '2px solid #2563eb';
el.style.outlineOffset = '2px';
el.style.backgroundColor = 'rgba(37,99,235,0.08)';

// Active contentEditable: add cursor:text + box-shadow ring
el.style.cursor = 'text';
el.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.25)';

// Cleanup: restore saved inline values (MUST save originals before setting)
el.style.outline = savedStyles.outline;      // usually ''
el.style.outlineOffset = savedStyles.outlineOffset;
el.style.backgroundColor = savedStyles.backgroundColor;
el.style.cursor = savedStyles.cursor;
el.style.boxShadow = savedStyles.boxShadow;
```

**Save inline styles before overwriting** (UI-SPEC line 158 requirement — restore author styles on cleanup):
```javascript
// Before applying any highlight, save the element's existing inline styles:
var savedStyles = {
  outline: el.style.outline,
  outlineOffset: el.style.outlineOffset,
  backgroundColor: el.style.backgroundColor,
  cursor: el.style.cursor,
  boxShadow: el.style.boxShadow,
};
```

---

### `apps/web/prisma/migrations/0010_lp_serving_read_policy/migration.sql` (migration, CRUD)

**Change type:** NEW file

**Analog:** `apps/web/prisma/migrations/0009_serving_read_policy/migration.sql` — exact same RLS policy pattern applied to `landing_page` table.

**Full migration file** (copy the exact pattern from migration 0009, applying to `landing_page`):
```sql
-- Migration: 0010_lp_serving_read_policy
--
-- O-2 fix (RESEARCH.md Unknown 5): servingRead sets app.serving='on' but NOT
-- app.current_workspace_id. The landing_page table has only a tenant_isolation
-- policy (requires app.current_workspace_id). Inside servingRead, this setting
-- is unset → all LP reads return zero rows → serve route preview never applies
-- overrides → preview ≠ export.
--
-- Fix: add serving_read SELECT policy to landing_page, matching the exact pattern
-- from migration 0009 for template and brand_config.
--
-- Security: serve route already WHERE-filters by workspaceId from the HMAC token
-- claims (never from URL params). The RLS policy is permissive for SELECT when
-- serving='on', but the Prisma WHERE clause enforces tenant scoping at the
-- application level — same dual-layer pattern as migration 0009.

CREATE POLICY "serving_read" ON "landing_page"
  FOR SELECT
  USING (current_setting('app.serving', true) = 'on');
```

**Migration directory naming convention** (from existing migration dir names — `NNNN_snake_case_description`):
```
apps/web/prisma/migrations/0010_lp_serving_read_policy/migration.sql
```

---

## Shared Patterns

### Authentication / Role Gate
**Source:** `apps/web/src/lib/workspaces/guards.ts`
**Apply to:** `preview/page.tsx` (RSC role resolution), `ViteSpaPreviewEditor.tsx` (receives `canEdit` prop)

```typescript
// RSC (page.tsx): resolve role and derive canEdit prop
const ctx = await requireWorkspace(slug);       // lines 159-167 — any member
const canEdit = can(ctx.role, 'lp', 'update');  // lines 206-247 — false for viewer

// Server Action (updateLpAction, already in place): authoritative gate
const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);  // lines 176-187
```

### HTML Injection Before `</head>`
**Source:** `apps/web/src/lib/overrides/apply-shim.ts` lines 183-203 (`injectOverrides`)
**Apply to:** `edit-script.ts` (`injectEditScript` — identical strategy)

```typescript
// Pattern: case-insensitive indexOf, slice-and-insert, fallback to prepend
const idx = html.toLowerCase().indexOf("</head>");
if (idx !== -1) {
  return html.slice(0, idx) + insertion + "\n" + html.slice(idx);
}
return `${insertion}\n${html}`;
```

### Server Action Call Pattern
**Source:** `apps/web/src/lib/lps/actions.ts` lines 329-444 (`updateLpAction` VITE_SPA branch)
**Apply to:** `ViteSpaPreviewEditor.tsx` save handler

```typescript
// Shape of the call the editor makes (from actions.ts signature lines 330-352):
const result = await updateLpAction(slug, {
  id: lpId,
  overrides: overrides, // PfOverride[] — validated by SaveViteSpaOverridesSchema
});
// ActionResult<{ id: string }> — check result.ok before proceeding
if (!result.ok) { /* show error */ }
```

### router.refresh() After Server Action
**Source:** `apps/web/src/components/lps/ViteSpaLpForm.tsx` line 137
**Apply to:** `ViteSpaPreviewEditor.tsx` after successful save (re-mints serve token)

```typescript
router.refresh(); // re-renders RSC → mintServeToken called again → fresh 30-min TTL
```

### `useTransition` for Async Server Action Calls
**Source:** `apps/web/src/components/lps/ViteSpaLpForm.tsx` lines 81-83
**Apply to:** `ViteSpaPreviewEditor.tsx` save handler

```typescript
const [isPending, startTransition] = useTransition();
// Wrap Server Action call:
startTransition(async () => {
  const result = await updateLpAction(/* ... */);
});
// isPending: true while Server Action is in-flight → disable Save/Discard buttons
```

### PfOverride Type Import
**Source:** `apps/web/src/lib/lps/schema.ts` lines 198-209
**Apply to:** `ViteSpaPreviewEditor.tsx`, `edit-script.ts`

```typescript
// Type (import in .tsx files):
import type { PfOverride } from "@/lib/lps/schema";
// Shape: { path: string; originalHash: string; type: 'text'|'color'|'image'|'href'; value: string }

// Runtime use in edit script (no import in browser IIFE — inline the shape):
// pendingMap[path] = { path, originalHash, type: 'text', value: newText };
```

### Iframe Toolbar Shell
**Source:** `apps/web/src/components/lps/LpPreview.tsx` lines 38-82
**Apply to:** `ViteSpaPreviewEditor.tsx` (replaces and extends this component)

```typescript
// Full viewport, sticky toolbar, flex-col:
<div className="flex flex-col h-screen">
  <div className="h-12 px-4 border-b border-border bg-background flex items-center gap-4 sticky top-0 shrink-0 z-10">
    {/* toolbar content */}
  </div>
  {/* banner (conditional) */}
  <iframe className="w-full flex-1 border-0" style={{ height: "calc(100vh - 3rem)" }} />
</div>
```

---

## No Analog Found

All 5 files have close analogs. The following patterns within files have NO existing codebase analog (use RESEARCH.md patterns instead):

| Pattern | In File | Reason |
|---------|---------|--------|
| `window.addEventListener('message', ...)` postMessage bridge | `ViteSpaPreviewEditor.tsx` | No existing parent-side postMessage listener in codebase |
| `iframeRef.current.contentWindow.postMessage(...)` sender | `ViteSpaPreviewEditor.tsx` | No existing cross-origin postMessage sender in codebase |
| `IFRAME_READY` handshake gating | `ViteSpaPreviewEditor.tsx` | Pattern unique to this phase — use RESEARCH.md Pitfall 5 |
| `computePath` (reverse childNodes walk) | `edit-script.ts` IIFE | Inverse of `pathToNode`; no existing inverse walk in codebase |
| `fnv1a` inline hash | `edit-script.ts` IIFE | No hash function exists in codebase; inline as per RESEARCH.md Unknown 3 |
| `isTextLeaf` filter | `edit-script.ts` IIFE | No DOM leaf detection in codebase; use RESEARCH.md Unknown 4 |
| `contentEditable` + `blur` capture pattern | `edit-script.ts` IIFE | No existing contentEditable usage; use RESEARCH.md Unknown 4 |

---

## Metadata

**Analog search scope:** `apps/web/src/`, `apps/web/prisma/migrations/`
**Files scanned:** 11 (6 analog reads + 5 new-file context reads)
**Pattern extraction date:** 2026-06-25

**Critical ordering constraint for planner:**
Migration 0010 (O-2 fix) MUST be applied before any editor code is tested. Without it, `landingPage.findMany` inside `servingRead` returns zero rows (RLS blocks all reads), so overrides never appear in the serve preview — making the editor appear broken even when save succeeds. See RESEARCH.md Unknown 5 for the full trace.

**Edit script injection ordering:**
`injectOverrides` (apply-shim) runs first → `injectEditScript` (edit script) runs second. This means the edit script tag appears AFTER the apply-shim tag in the final HTML. Both run on `DOMContentLoaded`; the edit script's `IFRAME_READY` send fires after `DOMContentLoaded` completes, which is the correct handshake order.
