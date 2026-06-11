---
phase: "05"
plan: "03"
subsystem: grecia-acceptance
status: in-progress
tags: [grecia, e2e, playwright, dropdown-menu, engine-fix, uat-pending]
dependency_graph:
  requires:
    - "05-01"  # FolderContextMenu, catalog actions, FolderTree
    - "05-02"  # CatalogGrid, LpCatalogCard, tag/search layout
    - "04-lp-generation-assets-preview-export"  # LP generate/preview/export pipeline
  provides:
    - "shadcn DropdownMenu on FolderContextMenu (keyboard-accessible)"
    - "Button field {label,url} → URL rendering fix in engine renderer"
    - "Grécia template markup artifact at tests/fixtures/grecia-authored-template.html"
    - "Playwright E2E spec: generate + preview-no-tokens + export-200"
    - "Playwright config at apps/web/playwright.config.ts"
  affects:
    - "apps/web/src/components/catalog/FolderContextMenu.tsx"
    - "apps/web/src/components/catalog/FolderTree.tsx"
    - "apps/web/src/components/ui/dropdown-menu.tsx"
    - "src/engine/renderer.ts"
    - "tests/fixtures/grecia-authored-template.html"
    - "tests/e2e/grecia-acceptance.spec.ts"
    - "apps/web/playwright.config.ts"
tech_stack:
  added:
    - "@playwright/test 1.60.0 (apps/web devDependency)"
    - "shadcn dropdown-menu (Base UI @base-ui/react/menu via base-nova)"
  patterns:
    - "DropdownMenu manages own open state — no external open/onOpenChange props needed"
    - "resolveButtonUrl() helper unwraps {label,url} objects from LpForm button fields before sanitizeUrl()"
    - "Playwright storageState pattern for auth reuse across test suite"
key_files:
  created:
    - apps/web/src/components/ui/dropdown-menu.tsx
    - apps/web/playwright.config.ts
    - tests/e2e/grecia-acceptance.spec.ts
    - tests/fixtures/grecia-authored-template.html
  modified:
    - apps/web/src/components/catalog/FolderContextMenu.tsx
    - apps/web/src/components/catalog/FolderTree.tsx
    - src/engine/renderer.ts
decisions:
  - "DropdownMenuTrigger (Base UI MenuTrigger) renders as a <button> natively — no asChild wrapper needed"
  - "resolveButtonUrl() added to renderer.ts: {label,url} button objects from LpForm resolved to .url; plain strings pass through unchanged (backward compat for fixture tests)"
  - "Playwright config at apps/web level with testDir pointing to ../../tests/e2e (root-level E2E dir)"
  - "E2E tests are environment-dependent: requires running dev server + pre-authored Grécia template + env vars"
metrics:
  duration_minutes: null
  completed_date: null
  tasks_completed: 3
  tasks_total: 4
  files_changed: 7
---

# Phase 5 Plan 03: Grécia Acceptance Anchor Summary (PARTIAL — UAT Pending)

**Status: IN-PROGRESS — Task 4 (UAT checkpoint) awaits human sign-off**

**One-liner:** DropdownMenu on FolderContextMenu (keyboard-accessible), button field rendering fix in engine, Grécia template artifact, and Playwright E2E for generate+preview+export — pipeline ready for human UAT.

## What Was Built

### Task 1 — Install shadcn dropdown-menu + upgrade FolderContextMenu (commit 3140b2a)

- `npx shadcn@latest add dropdown-menu` installed `apps/web/src/components/ui/dropdown-menu.tsx` (uses Base UI `@base-ui/react/menu` via base-nova style — already in package.json).
- `FolderContextMenu.tsx` rewritten to use `DropdownMenu` / `DropdownMenuTrigger` / `DropdownMenuContent` / `DropdownMenuItem` / `DropdownMenuSeparator`.
- `DropdownMenuTrigger` is itself a `<button>` — no `asChild` wrapper needed. `aria-label="Folder options"` and Lucide `MoreHorizontal` icon as children.
- Delete folder item uses `variant="destructive"` + `className="text-red-600 focus:text-red-600 focus:bg-red-50"`.
- `FolderTree.tsx` updated: removed `open`/`onOpenChange` props from `FolderContextMenu` usage; removed `openMenuId`/`onMenuOpenChange` state from `FolderTree` and `FolderNodeProps` (DropdownMenu manages its own open state).
- Keyboard navigation (ArrowUp/Down, Enter, Esc) provided by Radix/Base UI out of the box.
- `npx tsc --noEmit` exits 0.

### Task 2-code — Pipeline gap fix + Grécia template artifact (commit 72488e0)

**Gap found and fixed (Rule 1 - Bug):** Button field values submitted by `LpForm` as `{label: string, url: string}` objects were rendered as `"[object Object]"` by the engine renderer. The renderer called `String(raw ?? '')` on button type fields, which stringifies the object rather than extracting the URL.

**Fix applied in `src/engine/renderer.ts`:**
- Added `resolveButtonUrl(value: unknown): string` helper that:
  - Returns the string as-is if the value is already a plain string (backward compat for fixture tests and legacy data).
  - Extracts `.url` if the value is a `{label, url}` object (LpForm submission format).
- Applied in both top-level field processing loop and `processRepeaterItems()`.
- All 118 existing unit tests pass after the fix (including security corpus with `javascript:` / `data:` payloads — `resolveButtonUrl` returns them unchanged, `sanitizeUrl` blocks them as before).

**Grécia template artifact saved:** `tests/fixtures/grecia-authored-template.html`

Ready-to-paste LiquidJS markup covering all 8 required sections (D-11):
1. **Hero**: `seo_titulo`, `hero_imagem:image`, `hero_subtitulo`, `hero_titulo_linha1/2/3`, `hero_descricao:richtext`, `cta_primary_url:button`, `cta_primary_label`
2. **Destaques repeater** (highlight cards): `imagem:image`, `titulo`, `descricao:richtext`
3. **Info cards repeater** (trip facts): `label`, `valor`
4. **Inclusos repeater** (what's included): `titulo`, `texto`
5. **Roteiro repeater** (day-by-day itinerary): `imagem:image`, `imagem_alt`, `dia`, `regiao_en`, `regiao`, `titulo`, `descricao:richtext`, `destaque`
6. **Diferenciais repeater**: `titulo`, `texto`, configurable heading via `diferenciais_titulo`
7. **Depoimentos repeater** (testimonials): `quote:richtext`, `nome`, `localidade`
8. **CTA + Footer**: `inscrevase_*`, `brand.logo:image`, `brand.whatsapp:button`, `brand.instagram:button`, `brand.facebook:button`, `brand.youtube:button`, `brand.phone:text`, `brand.email:text`

Brand globals: `brand.primary_color:color` used in inline CSS for button and badge colors.

**Note on `button` token usage in template:** `{{ cta_primary_url:button }}` tokens are used directly as `href` attributes in the template markup. When the human fills in the LP form, the `cta_primary_url` field renders as two inputs (Button Text + Button URL). Only the URL is inserted into the `href`. This is the correct behavior after the `resolveButtonUrl()` fix.

### Task 3 — Playwright E2E spec (commit f282997)

- Installed `@playwright/test@1.60.0` as devDependency in `apps/web`.
- Created `apps/web/playwright.config.ts`:
  - `testDir: "../../tests/e2e"` (root-level E2E directory)
  - `baseURL` from `BASE_URL` env var (default `http://localhost:3000`)
  - Single `chromium` project; `workers: 1` (sequential, no parallel flakiness)
  - No auto-start server — app must be running with `pnpm dev`
- Created `tests/e2e/grecia-acceptance.spec.ts` with 3 tests:
  - **Test 1 — Generate Grécia LP**: navigates to `/w/{slug}/lps/new`, selects Grécia template from dropdown, fills required fields (title, hero fields, CTA, 1 destaque), submits, asserts LP name in catalog.
  - **Test 2 — Preview renders (no literal tokens)**: navigates to LP preview page, asserts outer page body does not contain `{{`, attempts iframe content check.
  - **Test 3 — ZIP export HTTP 200**: uses Playwright `request` fixture to call `/api/lps/{id}/export` directly, asserts `status === 200` and `content-type` contains `zip` or `octet-stream`.
- Auth pattern: `beforeAll` signs in once, saves `storageState` to `.playwright-auth.json`, each test reuses it (T-05-03-03: credentials from `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` env vars, never hardcoded).

**E2E infrastructure status:** Environment-dependent — tests run against a live dev server. Prerequisites:
1. Running `pnpm dev` from `apps/web`
2. Grécia template already authored in the test workspace (paste `tests/fixtures/grecia-authored-template.html` into `/w/{slug}/templates/new`)
3. Env vars set: `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`, `TEST_WORKSPACE_SLUG`, `BASE_URL`
4. Run: `cd apps/web && pnpm exec playwright test grecia-acceptance`

### Task 4 — UAT Checkpoint (PENDING)

**Status: BLOCKED — awaiting human sign-off**

The 8-item manual UAT verification has not been performed. The plan marks this as a `checkpoint:human-verify` with `gate="blocking"`. Task 4 cannot be self-approved by the executor.

## Deviations from Plan

### [Rule 1 - Bug] Fixed button field {label,url} rendering as "[object Object]"

- **Found during:** Task 2 code review of the engine pipeline
- **Issue:** `schema-derive.ts` stores button field values as `{label: string, url: string}` objects. The `renderer.ts` `processRepeaterItems()` and top-level field loop called `String(fieldValue ?? '')` on button-typed values, which produces `"[object Object]"` instead of extracting the URL. This would cause all button tokens (CTAs, WhatsApp links) to render as `[object Object]` in the LP href attributes.
- **Fix:** Added `resolveButtonUrl()` helper in `src/engine/renderer.ts`. Backward-compatible: plain strings pass through unchanged.
- **Files modified:** `src/engine/renderer.ts`
- **Commit:** 72488e0

### FolderTree openMenuId state removed (not a deviation — cleanup required by spec)

- The plan spec says FolderContextMenu props should be: `folder, onCreateSubfolder, onRename, onDelete` (no `open`/`onOpenChange`). Removing those props required updating `FolderTree.tsx` to eliminate the `openMenuId` state. This is the intended outcome and was done as part of Task 1.

## Known Stubs

None. All components call real Server Actions; template artifact is production-ready markup.

## Threat Flags

- **T-05-03-02 (CSP in ZIP export):** Verified present. The export route at `apps/web/src/app/api/lps/[lpId]/export/route.ts` already injects `Content-Security-Policy` meta via `injectCsp()` before writing `index.html` to the ZIP. This was implemented in Phase 4.

- **T-05-03-03 (Playwright credentials):** Resolved — `grecia-acceptance.spec.ts` reads credentials from `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` env vars only. Never hardcoded.

## Self-Check (Partial — Tasks 1-3 only)

- [x] `apps/web/src/components/ui/dropdown-menu.tsx` — exists, created by shadcn
- [x] `apps/web/src/components/catalog/FolderContextMenu.tsx` — imports from `@/components/ui/dropdown-menu`, uses DropdownMenu
- [x] `apps/web/src/components/catalog/FolderTree.tsx` — openMenuId state removed; FolderNode no longer passes open/onOpenChange
- [x] `src/engine/renderer.ts` — `resolveButtonUrl()` helper exists; applied in top-level and repeater loops
- [x] `tests/fixtures/grecia-authored-template.html` — exists, covers all 8 Grécia sections
- [x] `tests/e2e/grecia-acceptance.spec.ts` — exists, 3 tests for generate + preview + export
- [x] `apps/web/playwright.config.ts` — exists, testDir points to tests/e2e
- [x] `npx tsc --noEmit` exits 0 (clean)
- [x] `pnpm test` passes 118/118 tests (Phase 1 security corpus + all unit tests)
- [x] Commits 3140b2a, 72488e0, f282997 exist in git log
- [ ] Task 4 UAT checkpoint — PENDING human sign-off
