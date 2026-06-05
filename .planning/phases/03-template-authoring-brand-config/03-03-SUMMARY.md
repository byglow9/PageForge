---
phase: "03"
plan: "03"
subsystem: template-authoring
tags: [templates, server-actions, rsc, shadcn, tailwind, client-components]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [template-create, template-edit, template-delete, template-list]
  affects: [03-04]
tech_stack:
  added: [shadcn/ui, tailwindcss-v4, postcss, class-variance-authority, lucide-react, sonner, next-themes, clsx, tailwind-merge]
  patterns: [server-actions-with-use-server, rsc-page-pattern, client-island-pattern, debounced-live-parse, withTenantDb-tenant-isolation]
key_files:
  created:
    - apps/web/src/lib/templates/actions.ts
    - apps/web/src/lib/templates/parsed-schema-validator.ts
    - apps/web/src/lib/utils.ts
    - apps/web/src/app/globals.css
    - apps/web/postcss.config.mjs
    - apps/web/components.json
    - apps/web/src/app/w/[slug]/templates/page.tsx
    - apps/web/src/app/w/[slug]/templates/new/page.tsx
    - apps/web/src/app/w/[slug]/templates/[id]/edit/page.tsx
    - apps/web/src/components/templates/TemplateEditor.tsx
    - apps/web/src/components/templates/SchemaPanel.tsx
    - apps/web/src/components/templates/TemplateCard.tsx
    - apps/web/src/components/templates/DeleteTemplateDialog.tsx
    - apps/web/src/components/ui/ (13 shadcn components)
  modified:
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/w/[slug]/layout.tsx
    - apps/web/src/lib/templates/actions.ts
    - apps/web/next.config.ts
    - apps/web/package.json
    - pnpm-workspace.yaml
    - src/engine/index.ts (ParsedSchemaSchema was attempted to export but reverted — used local validator instead)
decisions:
  - "Used local ParsedSchemaValidator instead of exporting ParsedSchemaSchema from engine — avoids exposing engine internals and resolves Turbopack .js resolution issues"
  - "Switched build from Turbopack to webpack (next build --webpack) — Turbopack cannot resolve NodeNext .js import extensions without stable extensionAlias support in Next.js 16"
  - "warnings returned from actions as string[] (mapped from ParseWarning.message) — simpler for client consumption"
metrics:
  duration_minutes: 18
  completed_date: "2026-06-05"
  tasks_completed: 3
  files_created: 20
  files_modified: 6
---

# Phase 03 Plan 03: Template Authoring Vertical Slice Summary

Template Server Actions + workspace layout upgrade + template list/new/edit pages + all client components. Complete template authoring CRUD flow: create with live parse feedback, edit with schema version increment, delete with confirmation dialog, list as responsive card grid.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Template Server Actions (create/update/delete/list) | 67e85d8 | Done |
| 2a | Workspace layout + RSC route pages + shadcn init | 69412c4 | Done |
| 2b | Template client components (Editor, SchemaPanel, Card, Dialog) | e290875 | Done |

## What Was Built

**Template Server Actions (`apps/web/src/lib/templates/actions.ts`)**
- `createTemplateAction(slug, input)`: requireWorkspaceRole(owner/admin/editor), parse(markup) server-side (D-02), reconcileMetadataOverlay (D-05), withTenantDb persist
- `updateTemplateAction(slug, input)`: re-parses markup when provided; schemaVersion increment delegated to TenantClient.update (D-10)
- `deleteTemplateAction(slug, templateId)`: findById with workspaceId filter prevents cross-workspace delete (T-03-03-02); returns { ok: false } if not found
- `listTemplatesAction(slug)`: requireWorkspace (any member including viewer); withTenantDb scoped to workspace (T-03-03-01)
- Only `{ parse }` imported from pageforge-engine — never `render` (Pitfall 1, T-03-03-07)

**Workspace Layout (`apps/web/src/app/w/[slug]/layout.tsx`)**
- Replaced inline-style nav with Tailwind 2-column layout: 240px sidebar (bg-gray-100) + flex-1 main area
- Nav links: Templates, Brand Settings, Members
- Role badge, PageForge / workspace breadcrumb

**Template Route Pages (RSC)**
- `/w/[slug]/templates`: requireWorkspace + listTemplatesAction; card grid or empty state (FileCode icon, per UI-SPEC copywriting)
- `/w/[slug]/templates/new`: requireWorkspaceRole(editor+) gate; TemplateEditor create mode
- `/w/[slug]/templates/[id]/edit`: requireWorkspaceRole(editor+) gate; fetch via withTenantDb; ParsedSchemaValidator before passing to client; redirect on null

**TemplateEditor (client island)**
- Monospace textarea (flex-1) + SchemaPanel (w-80) side-by-side
- 400ms debounced live parse using `parse()` from pageforge-engine (advisory only, D-02)
- Save uses `useTransition` + createTemplateAction / updateTemplateAction
- Save-time warnings shown as Alert components (D-03 — never blocks save)
- Metadata overlay: collapsed by default, per-field label + required checkbox
- Toast "Template saved — schema v{N}" on success

**SchemaPanel (client component)**
- aria-live="polite" region for accessibility
- Field badges: blue-700 (text/richtext/image/color/button), purple-700 (repeater), green-700 (global/brand)
- Warning chips: amber-100/amber-800
- Loader2 spinner while parsing; RefreshCw button (aria-label "Re-parse markup")

**TemplateCard (client component)**
- Card with name + vN badge + "{N} fields · {R} repeater(s)" summary
- Edit Template link + kebab MoreHorizontal menu -> DeleteTemplateDialog
- ParsedSchemaValidator for field count; "? fields" on validation failure
- Optimistic removal (setDeleted) after successful delete

**DeleteTemplateDialog (client component)**
- Radix Dialog via shadcn; copywriting per UI-SPEC contract
- deleteTemplateAction on confirm; toast "Template deleted." on success
- Keeps dialog open on error; toast "Failed to delete. Try again."

**shadcn/ui initialized**
- components.json (neutral preset, base-nova style, cssVariables: true)
- Tailwind CSS v4 + postcss.config.mjs + globals.css with CSS vars
- 13 components installed: button, input, textarea, label, badge, card, separator, dialog, alert, tooltip, switch, skeleton, sonner
- src/lib/utils.ts (cn utility)
- Toaster added to root layout

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `ParsedSchemaSchema` not exported from pageforge-engine**
- **Found during:** Task 1 (build time)
- **Issue:** Plan instructed importing `ParsedSchemaSchema` from `pageforge-engine` but the engine's `index.ts` only exports `parse`, `render`, and type exports. `ParsedSchemaSchema` (a runtime Zod schema) was not exported.
- **Fix:** Created `apps/web/src/lib/templates/parsed-schema-validator.ts` — a local copy of the engine's ParsedSchemaSchema Zod validator. This is architecturally cleaner (avoids exposing engine internals) and avoids the Turbopack `.js` resolution issue that would occur if the export was added.
- **Files modified:** `apps/web/src/lib/templates/parsed-schema-validator.ts` (created), `apps/web/src/lib/templates/actions.ts` (uses ParsedSchemaValidator), `apps/web/src/app/w/[slug]/templates/[id]/edit/page.tsx` (uses ParsedSchemaValidator)

**2. [Rule 3 - Blocking Issue] Turbopack cannot resolve NodeNext `.js` imports in transpiled packages**
- **Found during:** Task 2a (build time)
- **Issue:** Next.js 16 Turbopack (default for `next build`) cannot resolve `'./parser.js'` imports in the engine when `transpilePackages: ["pageforge-engine"]` is active. The Turbopack `extensionAlias` config option is not yet stable. The `experimental.extensionAlias` option exists but did not resolve the `.js` -> `.ts` mapping for Turbopack builds.
- **Fix:** Switched production build to webpack via `next build --webpack` in `apps/web/package.json`. Added `experimental.extensionAlias` for webpack's benefit. Build passes with webpack.
- **Files modified:** `apps/web/package.json`, `apps/web/next.config.ts`

**3. [Rule 3 - Blocking Issue] `pnpm-workspace.yaml` had invalid `msw: "set this to true or false"` value**
- **Found during:** Task 2a (pnpm install failure)
- **Issue:** Shadcn's init process left an invalid value for `msw` in `allowBuilds`, causing `pnpm install` to fail with `ERR_PNPM_IGNORED_BUILDS`.
- **Fix:** Set `msw: false` in `pnpm-workspace.yaml`
- **Files modified:** `pnpm-workspace.yaml`

**4. [Rule 1 - Bug] `warnings` type mismatch — `ParseWarning[]` vs `string[]`**
- **Found during:** Task 2a (webpack typecheck)
- **Issue:** The action return type declared `warnings: string[]` but `schema.warnings` from `parse()` returns `ParseWarning[]` (objects with `token` and `message` fields).
- **Fix:** Map `schema.warnings.map((w) => w.message)` before returning. Client only needs the message string.
- **Files modified:** `apps/web/src/lib/templates/actions.ts`

## Known Stubs

None — all components are fully wired. TemplateCard field count summary shows "? fields" on parse failure (not a stub — intentional graceful fallback per design).

## Threat Flags

No new security surface introduced beyond what was in the plan's threat model.

## Verification Results

- `pnpm --filter @pageforge/web test tests/templates.test.ts`: 16/16 PASS
- `pnpm --filter @pageforge/web build`: All 10 routes compile, zero TypeScript errors
- `grep -rE "import.*\brender\b.*pageforge-engine" apps/web/src/components/`: 0 lines (PASS)
- `grep -E "text-blue-700|text-purple-700|text-green-700|text-amber-800" SchemaPanel.tsx`: Matches found (PASS)
- Workspace layout: Tailwind classes only, no `style={{}}` on replaced nav elements (PASS)

## Self-Check: PASSED

All 12 key files found. All 3 task commits verified (67e85d8, 69412c4, e290875).
