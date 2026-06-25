# Phase 10: Editor visual in-iframe (texto) - Research

**Researched:** 2026-06-25
**Domain:** Cross-origin iframe editing, postMessage protocol, DOM path computation, RLS O-2 fix
**Confidence:** HIGH — all findings grounded in actual codebase reads (serve route, apply-shim.ts, schema.ts, guards.ts, migrations)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Controle do modo edição fica numa barra de ferramentas acima da preview, no dashboard (fora do iframe). Botão "Editar" ↔ "Concluir". Sinaliza modo ativo com banner/borda destacando a preview. Toggle vive no parent; iframe recebe ativação por postMessage.
- **D-02:** Gating por papel: owner/admin/editor veem e ativam o modo edição; viewer não vê o controle nem consegue ativar. Reusar RBAC já existente (`can(role, ...)` / `requireWorkspaceRole`), resolvido server-side.
- **D-03:** Apenas elementos de texto (folhas) são selecionáveis nesta fase. Feedback visual: outline ao passar o mouse (hover) + realce forte no elemento selecionado.
- **D-04:** A "casca" do modo edição (seleção, toolbar, canal postMessage, salvar/descartar) deve ser arquitetada para extensão: imagem/link (Fase 11) e controle de cor plugam depois sem retrabalho — o enum `type` do override já prevê `image`/`href`.
- **D-05:** Edição in-place dentro do iframe (script injetado torna o elemento selecionado `contentEditable`), WYSIWYG fiel ao layout. O valor editado sobe do iframe para o dashboard via `postMessage` (allowlist de origem) e o dashboard persiste via `updateLpAction`.
- **D-06:** Modelo em lote: várias edições são acumuladas e um botão "Salvar alterações" persiste tudo de uma vez via `updateLpAction`. "Descartar" reverte os elementos não salvos ao conteúdo original e não persiste nada (EDIT-07).
- **D-07:** Após salvar, a preview reflete o novo texto após re-mount do SPA + reaplicação do apply-shim. Decidir no planning se é reload do iframe ou reaplicação otimista — preferir o caminho que garanta preview==export.

### Claude's Discretion
- Mecânica exata de cálculo do `path` do nó (índice de filhos a partir da raiz) e do `originalHash` — deve casar exatamente com o que o apply-shim da Fase 9 espera (ler `apply-shim.ts`). Researcher/planner definem.
- Protocolo concreto das mensagens `postMessage` (shape, tipos de evento, handshake) e a allowlist de origem (derivada do host de serve cross-origin).
- Como injetar o script de edição só em modo edição e só para papéis autorizados (provável parâmetro no serve route, análogo ao apply-shim), sem expor o modo edição no host público/export.

### Deferred Ideas (OUT OF SCOPE)
- Imagem (EDIT-04) e link/href (EDIT-05) → Fase 11. A casca do editor desta fase deve prepará-los.
- Controle de UI de cor por LP (EDIT-06) → Fase 11 (dado + aplicação já existem da Fase 9).
- Reposicionar/mover elementos → fora do roadmap atual; backlog.
- Hardening (MutationObserver re-apply, drift por originalHash, sanitização server-side completa, aceitação E2E) → Fase 12.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EDIT-01 | Usuário com papel owner/admin/editor pode entrar em "modo edição" na preview de uma LP VITE_SPA | `can(role, 'lp', 'update')` already in `guards.ts`; preview page RSC passes `canEdit` prop; ViteSpaPreviewEditor client component controls toolbar visibility |
| EDIT-02 | Usuário pode clicar em um elemento da LP para selecioná-lo para edição (com destaque visual da seleção) | Edit script injected into iframe HTML adds click/hover listeners to text-leaf elements; sends ELEMENT_SELECTED via postMessage |
| EDIT-03 | Usuário pode editar o texto de um elemento selecionado inline e salvar | contentEditable on selected node; capture textContent on blur; accumulate in pendingEdits Map; save via updateLpAction (already handles overrides) |
| EDIT-07 | Usuário pode descartar/cancelar uma edição não salva antes de persistir | Parent sends REQUEST_DISCARD to iframe; iframe restores original textContent from localEdits Map; parent clears pendingEdits state |
</phase_requirements>

---

## Summary

Phase 10 builds the visual in-iframe text editor on top of the override infrastructure from Phase 9. The core challenge is the cross-origin postMessage bridge between the dashboard parent (dashboard origin) and the SPA iframe (serve subdomain origin). All six research unknowns are now resolved with codebase-grounded answers.

**Critical blocker confirmed (O-2):** The `landing_page` table is missing a `serving_read` RLS policy in migration 0009. `servingRead()` sets only `app.serving='on'` but the `tenant_isolation` policy on `landing_page` requires `app.current_workspace_id`, which is never set inside `servingRead`. Consequently `landingPage.findMany(...)` in the serve route always returns zero rows, so overrides are never applied in the serve preview today. This means preview ≠ export for any LP with overrides. Fix: migration 0010 adds one `serving_read` SELECT policy to `landing_page`, matching the exact pattern used by migration 0009 for `template` and `brand_config`.

The DOM path algorithm in `apply-shim.ts` is a child-index walk starting from `document.body` over `childNodes` (including text nodes, not just element nodes). The edit script must generate paths using the identical walk in reverse. The postMessage allowlist origin is already available as the `DASHBOARD_ORIGIN` env var (currently used for `Content-Security-Policy: frame-ancestors`). The role gate is enforced at two independent levels: server-rendered UI (no edit button for viewer) and `requireWorkspaceRole` inside `updateLpAction` (authoritative server-side check).

**Primary recommendation:** Fix O-2 in Wave 0 (migration 0010) before any editor code; implement the postMessage protocol and edit script injection in Wave 1; build the preview page Client Component wrapper in Wave 2; integrate save/discard in Wave 3.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Edit toolbar (Enter/Exit edit mode, Save, Discard buttons) | Frontend Client (dashboard) | — | Lives in parent outside iframe; requires React state for edit mode, pending edits |
| Role gate for edit mode | Frontend Server (RSC) | API (Server Action) | RSC determines `canEdit` prop at render time; Server Action is the authoritative persistence gate |
| Edit script injection | Frontend Server (serve route handler) | — | Must be injected server-side into the HTML string before returning the iframe response; cannot be injected client-side |
| Hover/click/contentEditable UI | Browser / Client (iframe) | — | Runs inside the SPA as an injected script; manipulates the already-compiled Vite SPA's DOM |
| postMessage bridge | Browser / Client (both sides) | — | Both parent (dashboard window) and iframe use `window.postMessage` and `window.addEventListener('message', ...)` |
| Override persistence | API / Backend (Server Action) | Database | `updateLpAction` validates and writes to `LandingPage.values`; already implemented and role-gated |
| Serve route LP lookup (O-2 fix) | Database | — | RLS policy gap on `landing_page`; fix is a migration; no code logic change needed in serve route |

---

## Standard Stack

All libraries are already installed. Phase 10 adds no new dependencies.

### Core (already in project)

| Library | Version | Purpose in Phase 10 |
|---------|---------|----------------------|
| Next.js App Router | 16.2.7 | RSC page mints token + resolves role; Client Component manages edit state + postMessage |
| React | 19 | `useState`, `useEffect`, `useRef` for the ViteSpaPreviewEditor Client Component |
| TypeScript | 5.x | Type-safe message protocol shapes; `PfOverride` type from schema.ts |
| Zod | 4.4.3 | `PfOverrideSchema` / `SaveViteSpaOverridesSchema` — already defined in `schema.ts`; edit script output must match |
| better-auth / guards.ts | — | `can(role, 'lp', 'update')` for conditional `canEdit` prop; `requireWorkspaceRole` gates `updateLpAction` |
| shadcn/ui + Tailwind | latest / 4.x | Edit toolbar UI components (Button, Badge, Card) |
| PostgreSQL + Prisma | 16+ / 7.8.0 | Migration 0010 adds `serving_read` policy to `landing_page` |

### Supporting (inline — no npm install)

| Technique | Where | Purpose |
|-----------|-------|---------|
| Inline edit script (IIFE) | Injected in `index.html` by serve route | Text-leaf detection, hover/click handlers, contentEditable, pathToNode, computePath, pendingEdits Map, postMessage sender |
| FNV-1a 32-bit hash (inline JS) | Inside edit script | `originalHash` computation — sync, dependency-free, deterministic |
| `window.postMessage` / `window.addEventListener` | Both parent (dashboard) and iframe | Cross-origin message bridge |

---

## Architecture Patterns

### System Architecture Diagram

```
Dashboard Origin (Next.js App)
┌────────────────────────────────────────────────────────┐
│  /w/[slug]/lps/[lpId]/preview (RSC)                    │
│  - requireWorkspace → ctx.role                         │
│  - can(role,'lp','update') → canEdit                   │
│  - mintServeToken(workspaceId, templateId) → token     │
│  - render ViteSpaPreviewEditor (Client Component)       │
│                                                        │
│  ViteSpaPreviewEditor ("use client")                   │
│  - useState: isEditMode, pendingEdits, selectedPath    │
│  - useRef: iframeRef                                   │
│  - useEffect: window.addEventListener('message', ...)  │
│  ┌──────────────────────────────────────────────┐     │
│  │  EditToolbar                                  │     │
│  │  [Editar] or [Salvar alterações] [Descartar] │     │
│  └──────────────────────────────────────────────┘     │
│  ┌──────────────────────────────────────────────┐     │
│  │  <iframe ref={iframeRef}                      │     │
│  │    src={serveOrigin + path + '?t=' + token   │     │
│  │         + (isEditMode ? '&edit=1&lpId=...' : '')}  │
│  │    sandbox="allow-scripts allow-same-origin" │     │
│  │  />                                           │     │
│  └──────────────────────────────────────────────┘     │
└──────────┬──────────────────────────────┬─────────────┘
  postMessage↑ (event.origin===serveOrigin) │postMessage↓ (targetOrigin=serveOrigin)
             │                              │
Serve Origin (cross-origin subdomain)       │
┌────────────┴──────────────────────────────┴──────────┐
│  GET /serve/[tplId]?t={token}&edit=1&lpId={lpId}     │
│  serve route handler (route.ts)                       │
│  - verifyServeToken → { workspaceId, templateId }     │
│  - servingRead: LP lookup (needs O-2 fix)             │
│  - injectBrandStyle + injectOverrides (existing)      │
│  - IF edit=1: inject editScript IIFE before </head>   │
│                                                       │
│  Vite SPA (index.html after injection)                │
│  ┌────────────────────────────────────────────────┐  │
│  │  <script id="pf-overrides" type="application/json"> │
│  │  <script> // apply-shim (existing Phase 9)     │  │
│  │  <script> // edit-script IIFE (Phase 10, new)  │  │
│  │    - DOMContentLoaded: send IFRAME_READY        │  │
│  │    - EDIT_MODE_ENTER: enable hover+click        │  │
│  │    - click text-leaf: send ELEMENT_SELECTED     │  │
│  │    - contentEditable + blur: update pendingMap  │  │
│  │    - REQUEST_SAVE: send PENDING_EDITS           │  │
│  │    - REQUEST_DISCARD: restore originals         │  │
│  │  </script>                                      │  │
│  │  React SPA mounts ────────────────────────────  │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
           ↓ on save: parent calls updateLpAction
┌──────────────────────────────────────────────────────┐
│  updateLpAction (Server Action)                       │
│  - requireWorkspaceRole([owner,admin,editor])         │
│  - SaveViteSpaOverridesSchema.safeParse               │
│  - db.lp.update({ values: { overrides, ... } })      │
│  - revalidatePath                                     │
└──────────────────────────────────────────────────────┘
```

### Recommended Project Structure (new files only)

```
apps/web/src/
├── app/w/[slug]/lps/[lpId]/preview/
│   ├── page.tsx                         # MODIFIED: RSC passes canEdit + lpId to client comp
│   └── ViteSpaPreviewEditor.tsx         # NEW: "use client" — edit state, postMessage, toolbar
├── app/serve/[tplId]/[[...path]]/
│   └── route.ts                         # MODIFIED: inject editScript when ?edit=1
├── lib/overrides/
│   └── edit-script.ts                   # NEW: buildEditScript(dashboardOrigin) → string (IIFE)
└── prisma/migrations/
    └── 0010_lp_serving_read_policy/
        └── migration.sql                # NEW: serving_read SELECT policy on landing_page
```

---

## Unknown 1: Cross-Origin postMessage Architecture

### Origin Allowlist Derivation

The `DASHBOARD_ORIGIN` env var is already used in the serve route at:
```typescript
// apps/web/src/app/serve/[tplId]/[[...path]]/route.ts:93
"Content-Security-Policy": `frame-ancestors ${process.env.DASHBOARD_ORIGIN ?? "http://localhost:3000"}`,
```

This is exactly the allowlist origin for postMessage:
- **Iframe → parent:** `parent.postMessage(msg, process.env.DASHBOARD_ORIGIN)` (set at injection time into the edit script)
- **Parent → iframe:** `iframeRef.current.contentWindow.postMessage(msg, serveOrigin)` where `serveOrigin` is computed in the RSC

The iframe already knows `DASHBOARD_ORIGIN` at injection time (the serve route injects it as a literal string into the edit script). The parent computes `serveOrigin` at RSC render time (same logic as the iframe `src` construction).

### Message Protocol (Complete Spec)

All messages follow the shape `{ type: string; [key: string]: unknown }`.

**Iframe → Parent messages** (parent validates `event.origin === serveOrigin`):

| Type | Payload | When sent |
|------|---------|-----------|
| `IFRAME_READY` | `{}` | After DOMContentLoaded, edit script loaded |
| `ELEMENT_SELECTED` | `{ path: string; originalHash: string; currentText: string }` | User clicks a text-leaf element |
| `ELEMENT_DESELECTED` | `{}` | User clicks empty space / pressing Escape |
| `PENDING_EDITS` | `{ overrides: PfOverride[] }` | Response to `REQUEST_SAVE` from parent |
| `EDIT_DISCARDED` | `{}` | Response to `REQUEST_DISCARD`; all originals restored |

**Parent → Iframe messages** (iframe validates `event.origin === dashboardOrigin`):

| Type | Payload | When sent |
|------|---------|-----------|
| `EDIT_MODE_ENTER` | `{ lpId: string }` | User clicks "Editar" button |
| `EDIT_MODE_EXIT` | `{}` | User clicks "Concluir" without saving |
| `REQUEST_SAVE` | `{}` | User clicks "Salvar alterações" |
| `REQUEST_DISCARD` | `{}` | User clicks "Descartar" |

### Handshake Sequence

```
Parent loads iframe with src=...?t={token}&edit=1&lpId={lpId}
     ↓ iframe HTML arrives, edit script runs
Iframe →── IFRAME_READY ──→ Parent
     ↓ parent enables "Editar" button
User clicks Editar
Parent →── EDIT_MODE_ENTER ──→ Iframe
     ↓ iframe enables hover+click listeners
User clicks text element
Iframe →── ELEMENT_SELECTED { path, originalHash, currentText } ──→ Parent
     ↓ parent highlights toolbar with selected element info
User edits text (contentEditable), presses blur/Enter
     ↓ iframe captures textContent, stores in pendingMap
User clicks Salvar alterações
Parent →── REQUEST_SAVE ──→ Iframe
Iframe →── PENDING_EDITS { overrides: [...] } ──→ Parent
     ↓ parent calls updateLpAction
Parent: setIsEditMode(false)   // changes iframe src → iframe reloads without ?edit=1
     ↓ reloaded iframe shows overrides via apply-shim (needs O-2 fix)
```

### Why reload iframe on save (not optimistic update)

D-07 says "Após salvar, a preview reflete o novo texto após re-mount do SPA + reaplicação do apply-shim". Reloading the iframe (by removing `&edit=1` from src) is the canonical approach because:
1. It guarantees preview == export (both go through the same apply-shim path)
2. It avoids React state conflicts (fresh mount)
3. The apply-shim already handles all override types; no duplicated rendering logic

Optimistic update (patching text without reload) risks divergence from export. Use iframe reload.

---

## Unknown 2: Edit Script Injection — Serve Route Mechanism

### Signal Mechanism: `?edit=1&lpId={lpId}` URL Params

The cleanest approach — confirmed by reading the serve route:

**In `page.tsx` (RSC):**
```typescript
const canEdit = can(ctx.role, 'lp', 'update'); // owner/admin/editor → true; viewer → false
// Pass canEdit, lpId, serveOrigin, token to ViteSpaPreviewEditor
```

**In `ViteSpaPreviewEditor` (client component):**
```typescript
const iframeSrc = isEditMode
  ? `${serveOrigin}${entryPath}?t=${token}&edit=1&lpId=${lpId}`
  : `${serveOrigin}${entryPath}?t=${token}`;
```

**In `route.ts` (serve route, HTML branch only):**
```typescript
// After HMAC token validation (line 128-136) — token is already verified
const editMode = new URL(request.url).searchParams.get('edit') === '1';
const lpIdParam = new URL(request.url).searchParams.get('lpId');

// Later, when building finalHtml:
if (editMode && lpIdParam) {
  const editScript = buildEditScript(process.env.DASHBOARD_ORIGIN ?? 'http://localhost:3000');
  finalHtml = injectEditScript(finalHtml, editScript);
}
```

### Security Analysis

- The HMAC token is already verified before reaching the edit-injection code. Only requests with valid tokens can get the edit script.
- Even if an external actor crafted `?edit=1`, they'd need a valid HMAC token (impossible without `SERVE_TOKEN_SECRET`).
- The edit script enables DOM manipulation but cannot persist anything — persistence requires calling `updateLpAction` from the parent dashboard, which gates on `requireWorkspaceRole`.
- The `canEdit` prop from the RSC is the UI gate; the Server Action is the authoritative security gate. Both are independent. `&edit=1` in the URL is a convenience signal, not a security mechanism.
- Export route: does NOT add `?edit=1` — edit script is never injected in exports.

### LP Disambiguation (lpId in URL)

With `?lpId={lpId}` in the URL, the serve route can unambiguously look up the correct LP's overrides, replacing the current `findMany` with single-LP fail-safe:

```typescript
// Current (ambiguous when multiple LPs from same template):
const lps = await servingRead((tx) =>
  tx.landingPage.findMany({ where: { templateId: tplId, workspaceId }, ... }));
const lp = lps.length === 1 ? lps[0] : null;

// Phase 10 (with lpId from URL, after O-2 fix):
const lpId = new URL(request.url).searchParams.get('lpId');
const lp = lpId
  ? await servingRead((tx) =>
      tx.landingPage.findUnique({
        where: { id: lpId, templateId: tplId, workspaceId }, // workspaceId from HMAC token — cross-tenant safe
        select: { values: true },
      }))
  : /* fallback: existing findMany logic */ ...;
```

This resolves the per-LP preview disambiguation mentioned in the serve route comment (lines 248-263).

---

## Unknown 3: DOM Path + originalHash — Exact Algorithm

### pathToNode (from apply-shim.ts lines 128–138) — VERIFIED

```javascript
// Source: apps/web/src/lib/overrides/apply-shim.ts:128-138
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

**CRITICAL DETAILS:**
1. Root node is `document.body` (NOT `document.documentElement`)
2. Uses `childNodes` — **includes text nodes, comment nodes, and element nodes**. Text node indices count.
3. Path format: `/0/2/1` — leading slash, indices separated by slashes
4. `split('/').filter(p => p !== '')` strips the leading slash's empty string
5. Path `/0/2/1` walks: `body.childNodes[0]` → `.childNodes[2]` → `.childNodes[1]`

### computePath (reverse algorithm, for edit script)

```javascript
// Source: derived from pathToNode spec [VERIFIED against apply-shim.ts:128-138]
function computePath(node) {
  var parts = [];
  var current = node;
  // Walk up until we reach document.body (the shim root)
  while (current !== document.body && current.parentNode !== null) {
    var parent = current.parentNode;
    var childNodes = Array.from(parent.childNodes); // includes text + comment nodes
    var idx = childNodes.indexOf(current);
    parts.unshift(String(idx));
    current = parent;
    if (current === document.body) break;
  }
  if (current !== document.body) return null; // node is not a descendant of body
  return '/' + parts.join('/');
}
```

**Example:** `document.body.childNodes[0].childNodes[2].childNodes[1]` → path `/0/2/1`

**PITFALL — Text nodes in index count:** If a `<div>` contains:
- childNodes[0]: `Text "  "` (whitespace)
- childNodes[1]: `<h1>Title</h1>` (element)
- childNodes[2]: `Text "  "` (whitespace)

Then `<h1>` has index `1`, not `0`. The edit script MUST use `childNodes` (not `children`) when walking up. Using `children` (element-only) would generate wrong indices.

### originalHash Algorithm

`PfOverrideSchema` requires `z.string().min(1)`. Phase 12 will enforce drift detection but Phase 10 just needs a deterministic, non-empty string of the original text. Use FNV-1a 32-bit — sync, dependency-free, fits inline:

```javascript
// Source: standard FNV-1a algorithm, inline in edit script [ASSUMED - Phase 12 may redefine]
function fnv1a(str) {
  var h = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0; // unsigned 32-bit
  }
  return h.toString(16).padStart(8, '0');
}
// Usage: originalHash = fnv1a(element.textContent || '')
```

This produces an 8-char hex string (e.g., `"a4d3b1c2"`) for any input, deterministic across calls with the same input. When Phase 12 implements drift detection, it will use the same algorithm (or document the migration to a new one).

Note: empty `textContent` yields `fnv1a('')` = `"811c9dc5"` (not empty string) — satisfies `z.string().min(1)`.

---

## Unknown 4: contentEditable on Text Leaf Nodes in a Live React SPA

### Identifying Text Leaf Elements

A "text leaf" node = an element with no child elements (only text nodes at most) that has non-empty visible text content:

```javascript
function isTextLeaf(el) {
  if (el.nodeType !== Node.ELEMENT_NODE) return false;
  var tag = el.tagName.toLowerCase();
  if (['script', 'style', 'noscript', 'head', 'meta', 'link', 'br', 'hr', 'input', 'img'].includes(tag)) return false;
  if (el.children.length > 0) return false;  // has child elements = not a leaf
  var text = (el.textContent || '').trim();
  return text.length > 0;
}
```

### contentEditable Pattern (React-Safe)

The risk: React re-renders can overwrite the contentEditable content if a state change triggers re-render of the component containing the text node. Mitigation: capture `textContent` on `blur` (immediately, before any React re-render) and store it in the edit script's own `pendingMap` (not in the DOM).

```javascript
var pendingMap = {}; // path → { path, originalHash, type, value }
var originalMap = {}; // path → original textContent (for discard)

function activateEditing(el, path, originalHash) {
  // Store original for discard
  if (!originalMap[path]) {
    originalMap[path] = el.textContent || '';
  }

  el.setAttribute('contenteditable', 'true');
  el.focus();

  function handleBlur() {
    var newText = el.textContent || '';
    el.removeAttribute('contenteditable');
    el.removeEventListener('blur', handleBlur);

    // Store edit in pending map (even if same as original — will be filtered on save)
    pendingMap[path] = { path: path, originalHash: originalHash, type: 'text', value: newText };

    // Notify parent of change
    parent.postMessage({ type: 'ELEMENT_CHANGED', path: path, newText: newText }, dashboardOrigin);
  }

  el.addEventListener('blur', handleBlur);

  // Allow pressing Enter to finish editing (don't insert newlines in text leaves)
  function handleKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      el.blur(); // triggers handleBlur
    }
    if (e.key === 'Escape') {
      el.textContent = originalMap[path] || '';
      el.blur();
    }
  }
  el.addEventListener('keydown', handleKeydown);
}
```

**Why capture on `blur` not `input`:** React may re-render between `input` events and overwrite the contentEditable node's DOM, losing the in-progress edit. Capturing on `blur` (end of editing session) minimizes this window. After `blur`, `contentEditable` is removed, so React won't conflict.

**React re-render risk level:** LOW for a served Vite SPA in a preview iframe. The SPA is hydrated but typically doesn't trigger re-renders while being passively viewed (no user interactions that change state). The main risk is if the SPA has timers or WebSocket state that triggers re-renders. For Phase 10, this is acceptable — document as a known limitation.

### Discard Implementation

```javascript
function discardAllEdits() {
  for (var path in originalMap) {
    var node = pathToNode(path);
    if (node) node.textContent = originalMap[path];
  }
  pendingMap = {};
  // Remove any active contentEditable
  document.querySelectorAll('[contenteditable]').forEach(function(el) {
    el.removeAttribute('contenteditable');
  });
  parent.postMessage({ type: 'EDIT_DISCARDED' }, dashboardOrigin);
}
```

---

## Unknown 5: O-2 RLS Dependency — CONFIRMED BLOCKER

### Root Cause (Code-Grounded)

**`servingRead` helper** (`route.ts:64-69`):
```typescript
function servingRead<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.serving', 'on', true)`;
    // NOTE: app.current_workspace_id is NOT set here
    return fn(tx);
  });
}
```

**`landing_page` RLS policies** (from migrations 0005 and 0009):

Migration 0005 (`landing_page`):
```sql
-- Only policy on landing_page:
CREATE POLICY tenant_isolation ON "landing_page"
    USING ("workspaceId" = current_setting('app.current_workspace_id', true)::text)
    WITH CHECK ("workspaceId" = current_setting('app.current_workspace_id', true)::text);
```

Migration 0009 (only adds policies to `template` and `brand_config` — NOT `landing_page`):
```sql
CREATE POLICY "serving_read" ON "template"   FOR SELECT USING (current_setting('app.serving', true) = 'on');
CREATE POLICY "serving_read" ON "brand_config" FOR SELECT USING (current_setting('app.serving', true) = 'on');
-- landing_page: MISSING
```

**Result:** Inside `servingRead`, `app.current_workspace_id` = null (unset). The `tenant_isolation` policy evaluates `"workspaceId" = null::text` → FALSE for all rows. `landingPage.findMany(...)` in the serve route (lines 256-263) **always returns `[]`**. `lp` is **always `null`**. Overrides are **never applied** in the serve route preview.

The export route works because it uses `set_config('app.current_workspace_id', ${organizationId}, true)` inside its transaction (export route lines 204-208), satisfying `tenant_isolation`.

**Consequence:** For any LP with saved overrides, the serve route preview shows no overrides, but the export ZIP does. This is a preview ≠ export fidelity bug that blocks Phase 10 entirely — the editor writes overrides, but the preview (the editor's feedback channel) never shows them.

### Fix: Migration 0010

```sql
-- Migration: 0010_lp_serving_read_policy
--
-- O-2 fix: servingRead (serve route) sets app.serving='on' but not app.current_workspace_id.
-- The landing_page table has only a tenant_isolation policy (requires app.current_workspace_id).
-- Inside servingRead, app.current_workspace_id is unset → all LP reads return zero rows.
-- The serve route preview therefore never applies overrides → preview ≠ export.
--
-- Fix: add serving_read SELECT policy to landing_page, matching the pattern from
-- migration 0009 for template and brand_config.
--
-- Security: the serve route already WHERE-filters by workspaceId derived from the HMAC
-- token (claims.workspaceId — never from URL params). The RLS policy is permissive
-- for SELECT when serving='on', but the Prisma WHERE clause enforces tenant scoping
-- at the application level. Same pattern as template/brand_config in migration 0009.

CREATE POLICY "serving_read" ON "landing_page"
  FOR SELECT
  USING (current_setting('app.serving', true) = 'on');
```

No change to `servingRead` or the serve route Prisma query is needed — the existing query already has `where: { templateId: tplId, workspaceId }` which provides correct application-level scoping.

---

## Unknown 6: Role Gating Across the Cross-Origin Boundary

### Two Independent Gates

**Gate 1 — UI (server-rendered, RSC):**
```typescript
// In preview page.tsx (RSC):
const ctx = await requireWorkspace(slug);
const canEdit = can(ctx.role, 'lp', 'update'); // false for viewer

// Pass canEdit to ViteSpaPreviewEditor:
// - canEdit=false → no Edit button rendered → no edit=1 in iframe src
// - canEdit=true → Edit button shown → iframe src gets &edit=1&lpId=... when toggled
```

`can()` matrix from `guards.ts`: `viewer.lp` = `["read", "preview", "export"]` — does NOT include `update`. So `can('viewer', 'lp', 'update')` = `false`. Edit button is never rendered for viewers.

**Gate 2 — Server Action (authoritative):**
```typescript
// In updateLpAction (actions.ts:354):
const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);
// → redirects/throws if role is viewer
```

Even if a viewer somehow invoked `updateLpAction` (e.g., via DevTools calling the Server Action endpoint), the `requireWorkspaceRole` call rejects them with a redirect to `/w/${slug}`.

**Why the edit script in the iframe is not a security boundary:**
The iframe lives at a different origin. A viewer would need to:
1. Manually craft `&edit=1` in the iframe URL (requires knowing the HMAC token + serve URL)
2. Get the edit script injected
3. Visually "edit" text in the iframe DOM
4. Manually call `updateLpAction` from DevTools on the parent page

Step 4 is rejected by Gate 2. The UI and server gates are independent; either alone would stop a viewer from persisting edits.

### Why No Authorization Token in the postMessage Is Needed

All save operations happen via `updateLpAction` in the parent dashboard — not from the iframe. The iframe only sends DOM change notifications (pending edits). The parent is responsible for calling `updateLpAction`. Since the parent is a server-rendered RSC page that only includes save buttons for authorized roles, and `updateLpAction` independently re-checks the role server-side, there is no escalation vector via postMessage.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Role checking for edit gate | Custom session parsing in Client Component | `can(role, 'lp', 'update')` from `guards.ts` + RSC `requireWorkspace` | Role is resolved server-side; pass `canEdit` as prop to Client Component |
| Override persistence endpoint | New API route for the editor | `updateLpAction` with `overrides` param | Already validates, role-gates, and merges override arrays (actions.ts:380-427) |
| Cross-origin token auth in iframe | Signed message tokens in postMessage | Origin allowlist (`event.origin === serveOrigin`) | Sufficient for same-user same-session communication; token auth in postMessage is over-engineering |
| DOM-to-override mapping | Custom JSON structure | `PfOverride` schema (`path/originalHash/type/value`) | Already defined in `schema.ts:198-209`; shim already consumes it |
| Hash function | External npm library | Inline FNV-1a 32-bit (8 lines of JS) | No build step in the edit script; must be self-contained |
| Override injection function | Second injection function | `buildOverrideInjection` + `injectOverrides` from `apply-shim.ts` | Already handles JSON escaping (T-09-02-01) and `</head>` injection |

**Key insight:** The entire data model (schema, persistence, apply-shim, override JSON format) is from Phase 9. Phase 10's only net-new code is: the edit script IIFE, the postMessage bridge in the Client Component, the edit toolbar UI, and migration 0010. Everything else reuses Phase 9 infrastructure.

---

## Common Pitfalls

### Pitfall 1: childNodes vs children in Path Computation
**What goes wrong:** Editor computes path using `el.parentNode.children` (element-only) instead of `el.parentNode.childNodes` (all nodes). Path indices diverge from what the apply-shim computed.
**Why it happens:** `children` is more familiar; `childNodes` is less used. `apply-shim.ts:134` uses `childNodes`.
**How to avoid:** In `computePath`, always use `parent.childNodes` when computing the index. Cross-check: `pathToNode(computePath(el)) === el` as a debug assertion during development.
**Warning signs:** Overrides apply to the wrong element; elements appear unchanged after save.

### Pitfall 2: Text Nodes Count in childNodes
**What goes wrong:** The compiled Vite SPA has many whitespace text nodes between elements. An element that appears to be `childNodes[0]` of its parent is actually `childNodes[1]` because `childNodes[0]` is a whitespace text node.
**Why it happens:** Vite/webpack bundles often produce minified HTML without whitespace, but the Vite SPA's HTML template may have whitespace. React's SSR output (if used) adds specific text nodes.
**How to avoid:** Always traverse `childNodes` (not `children`). Test the path computation in the actual LP's iframe before shipping — add a debug mode that logs computed paths.
**Warning signs:** `pathToNode(path)` returns null or returns wrong element.

### Pitfall 3: O-2 Not Fixed Before Testing Editor
**What goes wrong:** Editor saves overrides correctly (updateLpAction succeeds), but reloading the iframe shows no change. This is mistaken for an apply-shim bug or a postMessage bug.
**Why it happens:** O-2 bug causes `landing_page.findMany` to return zero rows in `servingRead`, so overrides are never injected in the serve route's HTML. Only the export route would show overrides correctly.
**How to avoid:** Fix migration 0010 in Wave 0 as a prerequisite. Verify by manually setting an override via `updateLpAction` in a test, then checking that the serve route's HTML contains the `pf-overrides` sentinel.
**Warning signs:** Apply-shim script appears in the served HTML but `#pf-overrides` content is `[]`.

### Pitfall 4: React Re-render Overwriting contentEditable
**What goes wrong:** While user is typing in a contentEditable element, a React state change triggers a component re-render, replacing the DOM node with a new text node. The user's in-progress edit is lost.
**Why it happens:** React keeps a virtual DOM and reconciles it with the real DOM. contentEditable text is not tracked in React state, so React may overwrite it if it re-renders the containing component.
**How to avoid:** Capture `textContent` on `blur` (not on `input`). Remove `contentEditable` immediately on `blur`. For Phase 10, SPA re-renders during passive preview are rare, but document the limitation.
**Warning signs:** Text reverts to original mid-typing; edit is incomplete after blur.

### Pitfall 5: postMessage Before IFRAME_READY
**What goes wrong:** Parent sends `EDIT_MODE_ENTER` to iframe immediately on iframe load (e.g., if `isEditMode` was already `true`). The iframe's edit script hasn't loaded yet and ignores the message.
**Why it happens:** Iframe load time is asynchronous; the iframe fires `load` event on the OUTER window, but the inner React SPA may not have mounted and the edit script's DOMContentLoaded handler may not have run.
**How to avoid:** Parent must wait for `IFRAME_READY` message from iframe before sending any commands. Use a `iframeReady` state boolean in ViteSpaPreviewEditor; gate all postMessage sends on `iframeReady === true`.
**Warning signs:** Edit mode button press has no visual effect in iframe; hover/click listeners not active.

### Pitfall 6: HMAC Token Expiry During Edit Session
**What goes wrong:** User enters edit mode, spends more than 30 minutes editing, saves, iframe reloads — and gets a 403 because the token in the iframe src has expired.
**Why it happens:** `TTL_MS = 30 * 60 * 1000` in `token.ts:31`. The Client Component caches the token from the initial RSC render.
**How to avoid:** After successful save, call `router.refresh()` to re-render the RSC page. The RSC will call `mintServeToken` again with a fresh 30-minute TTL and re-pass it to the Client Component. For Phase 10, this is the recommended solution — router.refresh() re-renders the RSC on the server, re-minting the token.
**Warning signs:** 403 response in network tab after iframe reloads post-save; blank iframe.

### Pitfall 7: ELEMENT_SELECTED Path Computed Before apply-shim Runs
**What goes wrong:** Edit script tries to compute path for a node but the apply-shim has already modified `textContent` of some nodes. The `originalHash` computed by the edit script reflects the OVERRIDDEN text, not the true original.
**Why it happens:** apply-shim runs on `DOMContentLoaded`; edit script also runs on `DOMContentLoaded`. Order depends on script position in HTML.
**How to avoid:** Inject the edit script AFTER the apply-shim in the HTML (it's injected in a later step or at least after the shim block). BUT: capture `originalHash` LAZILY — compute it when the user FIRST CLICKS the element (not at edit script init time). At first-click time, if an override exists for this path, the textContent is the overridden value. The edit script should treat the CURRENTLY DISPLAYED text as the baseline for this edit session. Since overrides merge (not append), saving a new value for an existing path replaces it.
**How to handle existing overrides:** When user edits an already-overridden element, `originalHash` stored in the new override can reflect the currently-displayed text. Phase 12 drift detection will use the stored hash; for Phase 10 it's informational only.

---

## Code Examples

### Edit Script IIFE (core structure)

```javascript
// Source: derived from apply-shim.ts patterns [VERIFIED against apply-shim.ts]
// Injected via buildEditScript() into index.html before </head>
(function() {
  'use strict';
  var dashboardOrigin = '__DASHBOARD_ORIGIN__'; // replaced at injection time
  var editMode = false;
  var selectedEl = null;
  var pendingMap = {}; // path → PfOverride
  var originalMap = {}; // path → original textContent (for discard)

  // FNV-1a 32-bit hash
  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  // pathToNode: IDENTICAL to apply-shim.ts:128-138 (MUST match exactly)
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

  // computePath: reverse of pathToNode — uses childNodes (includes text nodes)
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

  // Text leaf detection
  function isTextLeaf(el) {
    if (el.nodeType !== Node.ELEMENT_NODE) return false;
    var tag = el.tagName.toLowerCase();
    var skipTags = ['script', 'style', 'noscript', 'head', 'meta', 'link', 'br', 'hr', 'input', 'img', 'svg'];
    if (skipTags.includes(tag)) return false;
    if (el.children.length > 0) return false;
    return (el.textContent || '').trim().length > 0;
  }

  // postMessage to parent with origin check
  function sendToParent(msg) {
    try { parent.postMessage(msg, dashboardOrigin); } catch(e) {}
  }

  // Message handler: receive commands from parent
  window.addEventListener('message', function(event) {
    if (event.origin !== dashboardOrigin) return;
    var msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'EDIT_MODE_ENTER') {
      editMode = true;
    } else if (msg.type === 'EDIT_MODE_EXIT') {
      editMode = false;
      if (selectedEl) {
        selectedEl.style.outline = '';
        selectedEl = null;
      }
    } else if (msg.type === 'REQUEST_SAVE') {
      var overrides = Object.values(pendingMap);
      sendToParent({ type: 'PENDING_EDITS', overrides: overrides });
    } else if (msg.type === 'REQUEST_DISCARD') {
      for (var p in originalMap) {
        var node = pathToNode(p);
        if (node) node.textContent = originalMap[p];
      }
      pendingMap = {};
      editMode = false;
      if (selectedEl) { selectedEl.style.outline = ''; selectedEl = null; }
      document.querySelectorAll('[contenteditable]').forEach(function(el) {
        el.removeAttribute('contenteditable');
      });
      sendToParent({ type: 'EDIT_DISCARDED' });
    }
  });

  document.addEventListener('DOMContentLoaded', function() {
    sendToParent({ type: 'IFRAME_READY' });

    document.body.addEventListener('mouseover', function(e) {
      if (!editMode) return;
      if (isTextLeaf(e.target)) {
        e.target.style.outline = '2px dashed #3b82f6';
      }
    });

    document.body.addEventListener('mouseout', function(e) {
      if (!editMode) return;
      if (e.target !== selectedEl) {
        e.target.style.outline = '';
      }
    });

    document.body.addEventListener('click', function(e) {
      if (!editMode || !isTextLeaf(e.target)) return;
      e.stopPropagation();
      var el = e.target;
      var path = computePath(el);
      if (!path) return;

      // Deselect previous
      if (selectedEl && selectedEl !== el) {
        selectedEl.style.outline = '';
        selectedEl.removeAttribute('contenteditable');
      }

      selectedEl = el;
      el.style.outline = '2px solid #2563eb';

      // originalHash: compute from current textContent (lazy — captures overridden value too)
      if (!originalMap[path]) {
        originalMap[path] = el.textContent || '';
      }
      var originalHash = fnv1a(originalMap[path]);

      sendToParent({ type: 'ELEMENT_SELECTED', path: path, originalHash: originalHash, currentText: el.textContent || '' });

      // Activate contentEditable
      el.setAttribute('contenteditable', 'true');
      el.focus();

      el.addEventListener('blur', function handler() {
        el.removeEventListener('blur', handler);
        var newText = el.textContent || '';
        el.removeAttribute('contenteditable');
        pendingMap[path] = { path: path, originalHash: originalHash, type: 'text', value: newText };
        sendToParent({ type: 'ELEMENT_CHANGED', path: path, newText: newText });
      });

      el.addEventListener('keydown', function(ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); }
        if (ev.key === 'Escape') { el.textContent = originalMap[path] || ''; el.blur(); }
      });
    });
  });
})();
```

### Migration 0010 (O-2 fix)

```sql
-- Source: derived from migrations/0009_serving_read_policy/migration.sql pattern [VERIFIED]
-- File: apps/web/prisma/migrations/0010_lp_serving_read_policy/migration.sql
CREATE POLICY "serving_read" ON "landing_page"
  FOR SELECT
  USING (current_setting('app.serving', true) = 'on');
```

### ViteSpaPreviewEditor (Client Component skeleton)

```typescript
// Source: derived from preview/page.tsx patterns [VERIFIED]
// apps/web/src/app/w/[slug]/lps/[lpId]/preview/ViteSpaPreviewEditor.tsx
"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PfOverride } from "@/lib/lps/schema";
import { updateLpAction } from "@/lib/lps/actions";

interface ViteSpaPreviewEditorProps {
  lpId: string;
  slug: string;
  serveOrigin: string;
  entryPath: string;
  token: string;
  canEdit: boolean;
}

export function ViteSpaPreviewEditor({ lpId, slug, serveOrigin, entryPath, token, canEdit }: ViteSpaPreviewEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  const [isEditMode, setIsEditMode] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<PfOverride[]>([]);
  const [saving, setSaving] = useState(false);

  const iframeSrc = isEditMode
    ? `${serveOrigin}${entryPath}?t=${token}&edit=1&lpId=${lpId}`
    : `${serveOrigin}${entryPath}?t=${token}`;

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== serveOrigin) return;
      const msg = event.data;
      if (!msg?.type) return;

      if (msg.type === 'IFRAME_READY') {
        setIframeReady(true);
      } else if (msg.type === 'PENDING_EDITS') {
        // Save flow: call updateLpAction with accumulated overrides
        handleSaveWithEdits(msg.overrides as PfOverride[]);
      } else if (msg.type === 'EDIT_DISCARDED') {
        setIsEditMode(false);
        setPendingEdits([]);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [serveOrigin, lpId, slug]);

  const sendToIframe = useCallback((msg: object) => {
    if (iframeRef.current?.contentWindow && iframeReady) {
      iframeRef.current.contentWindow.postMessage(msg, serveOrigin);
    }
  }, [serveOrigin, iframeReady]);

  const handleEnterEdit = () => {
    setIsEditMode(true); // changes iframeSrc → iframe reloads → IFRAME_READY → sendToIframe EDIT_MODE_ENTER
    setIframeReady(false); // reset: wait for new IFRAME_READY from reloaded iframe
  };

  // After IFRAME_READY and isEditMode, send EDIT_MODE_ENTER
  useEffect(() => {
    if (iframeReady && isEditMode) {
      sendToIframe({ type: 'EDIT_MODE_ENTER', lpId });
    }
  }, [iframeReady, isEditMode, lpId, sendToIframe]);

  const handleSave = () => {
    sendToIframe({ type: 'REQUEST_SAVE' });
  };

  const handleSaveWithEdits = async (overrides: PfOverride[]) => {
    setSaving(true);
    const result = await updateLpAction(slug, { id: lpId, overrides });
    setSaving(false);
    if (result.ok) {
      setIsEditMode(false); // src reverts to non-edit URL → iframe reloads → shows saved overrides
      setPendingEdits([]);
      setIframeReady(false);
      router.refresh(); // re-mints token (prevents expiry on subsequent edits)
    }
  };

  const handleDiscard = () => {
    sendToIframe({ type: 'REQUEST_DISCARD' });
    // EDIT_DISCARDED message will set isEditMode=false
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Edit toolbar */}
      <div className="h-12 px-4 border-b border-gray-200 bg-white flex items-center gap-4 sticky top-0 shrink-0 z-10">
        {/* ... back link, lp name ... */}
        {canEdit && !isEditMode && (
          <button onClick={handleEnterEdit}>Editar</button>
        )}
        {canEdit && isEditMode && (
          <>
            <button onClick={handleDiscard} disabled={saving}>Descartar</button>
            <button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </>
        )}
      </div>
      {/* Edit mode indicator */}
      {isEditMode && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-1 text-sm text-blue-700">
          Modo edição ativo — clique em um texto para editar
        </div>
      )}
      {/* Preview iframe */}
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        sandbox="allow-scripts allow-same-origin"
        className="w-full flex-1 border-0"
        style={{ height: 'calc(100vh - 3rem)', outline: isEditMode ? '3px solid #2563eb' : 'none' }}
        title="Preview"
        onLoad={() => {
          // iframe (re)loaded — reset ready state; wait for IFRAME_READY postMessage
          setIframeReady(false);
        }}
      />
    </div>
  );
}
```

### buildEditScript function (in lib/overrides/edit-script.ts)

```typescript
// apps/web/src/lib/overrides/edit-script.ts
export function buildEditScript(dashboardOrigin: string): string {
  return `<script>
/* PageForge edit-mode script — injected by serve route only when ?edit=1 */
(function() {
  'use strict';
  var dashboardOrigin = ${JSON.stringify(dashboardOrigin)};
  /* ... IIFE from Code Examples above, with dashboardOrigin replaced ... */
})();
</script>`;
}

export function injectEditScript(html: string, editScript: string): string {
  const idx = html.toLowerCase().indexOf('</head>');
  if (idx !== -1) {
    return html.slice(0, idx) + editScript + '\n' + html.slice(idx);
  }
  return `${editScript}\n${html}`;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Preview page: pure RSC, static iframe | Preview page: RSC shell + Client Component for edit state | Phase 10 | Required because edit toolbar needs `useState`/`useEffect` |
| Serve route: only overrides from DB (O-2 broken) | Serve route: LP lookup via `serving_read` policy (O-2 fixed) | Phase 10 (migration 0010) | Preview now shows overrides correctly; preview==export fidelity restored |
| Serve route: LP disambiguation via `findMany` + single-LP guard | Serve route: `findUnique` by `lpId` from URL param | Phase 10 | Enables per-LP preview; eliminates the ambiguous multi-LP case |
| Token claims: `{ workspaceId, templateId, exp }` | Token claims: unchanged (lpId via URL param, not token) | Phase 10 | No token schema change; backward-compatible |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | FNV-1a 32-bit is the right hash algorithm for `originalHash` — Phase 12 will accept this format | Unknown 3 / originalHash | Phase 12 drift detection may require a different algorithm; stored Phase 10 hashes would need re-computation or a migration. Low risk since originalHash is NOT enforced in Phases 10/11. |
| A2 | React does not trigger frequent re-renders in the served Vite SPA during passive viewing | Unknown 4 / Pitfall 4 | If the SPA has timers/WebSockets that re-render components with text nodes, contentEditable edits may be lost mid-typing. Testing against the actual LP SPA is required. |
| A3 | `router.refresh()` re-renders the preview RSC and re-mints the HMAC token | Unknown 2 / Token renewal | If the RSC page is cached aggressively, refresh() may serve a cached version with the same token. Use `revalidatePath` inside `updateLpAction` (already done) to ensure fresh render. |

---

## Environment Availability

Step 2.6 SKIPPED — Phase 10 adds no external tool dependencies. All libraries are already installed. Migration 0010 targets the existing PostgreSQL instance (already running per project setup).

---

## Security Domain

Security enforcement is enabled. ASVS Level 2.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireWorkspace` / `requireWorkspaceRole` in Server Action and RSC |
| V3 Session Management | partial | HMAC serve token (30-min TTL, timingSafeEqual) already in place |
| V4 Access Control | yes | `requireWorkspaceRole(["owner","admin","editor"])` in `updateLpAction`; `can()` for UI gate |
| V5 Input Validation | yes | `SaveViteSpaOverridesSchema` (Zod) validates all incoming overrides before DB write |
| V6 Cryptography | yes | HMAC-SHA256 for serve token; `timingSafeEqual` for comparison |

### Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Viewer enabling edit mode via URL tampering | Elevation of Privilege | UI gate (no Edit button for viewer) + `requireWorkspaceRole` in `updateLpAction` — dual independent gates |
| Cross-origin XSS via postMessage spoofing | Tampering | `event.origin` allowlist on both sides; iframe checks `dashboardOrigin`, parent checks `serveOrigin` |
| Path injection via crafted ELEMENT_SELECTED path | Tampering | Path is computed by iframe's `computePath` (trusted code); even if a malicious path is sent, the parent only passes it to `updateLpAction` which validates via `SaveViteSpaOverridesSchema` (path: `z.string().min(1)`) |
| XSS via edited textContent | Stored XSS | apply-shim uses `node.textContent = value` (NEVER innerHTML) — existing T-09-02-02 mitigation; Phase 12 adds full server-side sanitization |
| CSRF on updateLpAction | Forgery | Next.js Server Actions include CSRF tokens automatically for same-origin calls from the dashboard |
| Edit script injected in export ZIP | Elevation of Privilege | Serve route checks `?edit=1` — export route is a separate handler (`/api/lps/[lpId]/export/route.ts`) that never reads this URL param; no risk of edit script in export |

### Note on Deferred Hardening (Phase 12)

Phase 10 intentionally defers full server-side sanitization of override `value` fields. Currently `value` is `z.string()` (no HTML sanitization), and it is applied exclusively via `node.textContent` which is inherently XSS-safe. Phase 12 will add server-side sanitization via `sanitize-html` or similar, and full `originalHash` drift detection. For Phase 10, the `textContent` write is the operative XSS control (consistent with T-09-02-02 from Phase 9 security audit).

---

## Sources

### Primary (HIGH confidence — verified by direct codebase read)
- `apps/web/src/lib/overrides/apply-shim.ts` — exact `pathToNode` algorithm, `buildOverrideInjection`, `injectOverrides`, `escapeJsonForHtml`
- `apps/web/src/app/serve/[tplId]/[[...path]]/route.ts` — `servingRead` helper, LP lookup code (lines 256-263), DASHBOARD_ORIGIN env var usage
- `apps/web/prisma/migrations/0005_catalog_folders_tags/migration.sql` (lines 180-196) — `landing_page` RLS policy (only `tenant_isolation`, no `serving_read`)
- `apps/web/prisma/migrations/0009_serving_read_policy/migration.sql` — `serving_read` policies for `template` and `brand_config` (confirms `landing_page` is absent)
- `apps/web/src/lib/lps/schema.ts` — `PfOverrideSchema`, `SaveViteSpaOverridesSchema`, `ViteSpaValuesSchema`
- `apps/web/src/lib/lps/actions.ts` — `updateLpAction` VITE_SPA branch (lines 380-427), override validation flow
- `apps/web/src/lib/workspaces/guards.ts` — `can()` matrix (viewer.lp does not include 'update'), `requireWorkspaceRole`
- `apps/web/src/lib/serve/token.ts` — `ServeClaims` shape, TTL, `mintServeToken`/`verifyServeToken`
- `apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx` — current iframe construction, sandbox attribute, token minting

### Secondary (HIGH confidence — derived from code + standard patterns)
- Cross-origin postMessage spec (MDN) — `event.origin` allowlist, `targetOrigin` parameter
- Next.js App Router: `router.refresh()` for RSC re-render after Server Action

---

## Metadata

**Confidence breakdown:**
- O-2 analysis: HIGH — directly traced through code (servingRead → RLS policies → findMany result)
- pathToNode/computePath algorithm: HIGH — read from apply-shim.ts source
- postMessage protocol: HIGH — derived from locked decisions + serve route code
- Edit script injection mechanism: HIGH — consistent with how apply-shim is injected in serve route
- Role gating: HIGH — verified in guards.ts and actions.ts
- originalHash algorithm choice: MEDIUM — FNV-1a is appropriate but Phase 12 may redefine

**Research date:** 2026-06-25
**Valid until:** 2026-07-25 (stable codebase, 30-day validity)
