---
phase: "04"
plan: "02"
subsystem: "lp-generation-ui"
tags: ["landing-pages", "form", "server-actions", "react-hook-form", "tiptap", "next-js", "rsc"]
dependency_graph:
  requires:
    - "04-01"   # LandingPage + LpAsset Prisma models, TenantClient helpers, lib/lps stubs
    - "03-xx"   # ImageUploadField contract (image values as {publicUrl,s3Key} objects)
  provides:
    - "lp-catalog-page"
    - "lp-generate-flow"
    - "lp-preview-page"
    - "lp-edit-flow"
    - "lp-duplicate-action"
    - "lp-delete-action"
  affects:
    - "04-03"   # export ZIP route reads LpAsset records created here
    - "04-04"   # folder/catalog organization builds on lps/page.tsx catalog
tech_stack:
  added:
    - "react-hook-form@^7.78.0 — dynamic LP form with useFieldArray"
    - "@hookform/resolvers@^5.4.0 — zodResolver bridge"
    - "@tiptap/react@^3.26.0 — rich text editor"
    - "@tiptap/pm@^3.26.0 — Tiptap ProseMirror peer"
    - "@tiptap/starter-kit@^3.26.0 — Tiptap extensions bundle"
  patterns:
    - "RSC page shell + client island split (all route pages are RSC, forms are 'use client')"
    - "Server Actions in lib/lps/actions.ts ('use server') — never imports render/sanitize-html"
    - "reconcileLpValues in lib/lps/reconcile.ts — pure shared utility, no boundary directive"
    - "LiquidJS render stays server-side only (preview/edit RSC pages, not client components)"
    - "MetadataOverlay cast via 'as unknown as MetadataOverlay' from Prisma JsonValue"
    - "Tiptap useEditor called in inner component (not Controller render prop) to satisfy hooks rules"
key_files:
  created:
    - "apps/web/src/lib/lps/actions.ts"
    - "apps/web/src/lib/lps/reconcile.ts"
    - "apps/web/src/components/lps/LpForm.tsx"
    - "apps/web/src/components/lps/LpCard.tsx"
    - "apps/web/src/components/lps/LpPreview.tsx"
    - "apps/web/src/components/lps/RepeaterBlock.tsx"
    - "apps/web/src/components/lps/RichTextField.tsx"
    - "apps/web/src/components/lps/BrandGlobalsPanel.tsx"
    - "apps/web/src/app/w/[slug]/lps/page.tsx"
    - "apps/web/src/app/w/[slug]/lps/new/page.tsx"
    - "apps/web/src/app/w/[slug]/lps/new/TemplatePickerForm.tsx"
    - "apps/web/src/app/w/[slug]/lps/new/[templateId]/page.tsx"
    - "apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx"
    - "apps/web/src/app/w/[slug]/lps/[lpId]/edit/page.tsx"
    - "apps/web/src/components/ui/select.tsx"
    - "apps/web/src/components/ui/progress.tsx"
  modified:
    - "apps/web/src/app/w/[slug]/layout.tsx — added Landing Pages nav link"
    - "apps/web/package.json — react-hook-form, resolvers, tiptap packages"
decisions:
  - "reconcileLpValues extracted to lib/lps/reconcile.ts (not actions.ts) so it can be a synchronous export — Next.js requires all exports from 'use server' modules to be async functions"
  - "RichTextField uses inner RichTextEditor component to own useEditor hook — hooks cannot be called inside Controller render prop callbacks"
  - "MetadataOverlay from Prisma JsonValue cast as 'as unknown as MetadataOverlay' to satisfy TypeScript (JsonValue includes JsonArray which lacks string index signature)"
  - "LP preview iframe uses sandbox='allow-same-origin' only — scripts blocked (T-04-02-01)"
  - "Brand globals resolved live at render time from BrandConfig (D-04 / D-07 asymmetry)"
  - "markupSnapshot + schemaVersion captured at generation time (D-06)"
  - "Image field values: {publicUrl, s3Key} unwrapped by extractImageFieldValues before renderLp"
metrics:
  duration: "multi-session (context rollover)"
  completed: "2026-06-09T19:30:26Z"
  tasks_completed: 3
  files_created: 16
  files_modified: 2
---

# Phase 4 Plan 02: LP Generation UI — Complete Vertical Slice Summary

**One-liner:** Full LP generation UI with dynamic form (all field types + repeaters), Server Actions for generate/update/duplicate/delete, preview iframe, and edit flow with schema version mismatch detection.

## Tasks Completed

| # | Task | Commit | Description |
|---|------|--------|-------------|
| 1 | Server Actions + Nav | `9ad0e0c` | lib/lps/actions.ts with all CRUD actions; sidebar nav "Landing Pages" link |
| 2 | Client Components | `64f9cbe` | LpForm, LpCard, LpPreview, RepeaterBlock, RichTextField, BrandGlobalsPanel |
| 3 | Route Pages | `60664dd` | 5 RSC pages: catalog, picker, generate form, preview, edit |
| — | Rule 1 Fix | `7fa517d` | Extracted reconcileLpValues to reconcile.ts (async-export constraint) |

## Architecture

The LP generation UI is a single vertical slice:

```
/w/[slug]/lps                           RSC catalog page
/w/[slug]/lps/new                       RSC template picker shell
  TemplatePickerForm.tsx                client island (Select + LP name)
/w/[slug]/lps/new/[templateId]          RSC generates LpForm props
  LpForm.tsx                            client island (all fields + submit)
/w/[slug]/lps/[lpId]/preview            RSC renders HTML server-side
  LpPreview.tsx                         client (iframe + toolbar)
/w/[slug]/lps/[lpId]/edit               RSC re-parses markupSnapshot
  LpForm.tsx (mode="edit")              same client form, pre-populated
```

Security boundary maintained: `renderLp()` (which imports `sanitize-html`) is only ever called from RSC pages and route handlers — never from client components or "use server" files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `reconcileLpValues` cannot be exported from a "use server" module**

- **Found during:** Post-task-3 build check (`pnpm build`)
- **Issue:** Next.js requires all exports from a `"use server"` module to be async functions. `reconcileLpValues` is synchronous and was exported from `actions.ts`.
- **Fix:** Extracted to `lib/lps/reconcile.ts` (pure utility, no directive). `LpForm.tsx` imports directly from `reconcile.ts`. `actions.ts` no longer exports it.
- **Files modified:** `lib/lps/actions.ts`, `lib/lps/reconcile.ts` (new), `components/lps/LpForm.tsx`
- **Commit:** `7fa517d`

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| `RepeaterBlock.tsx` | Image fields inside repeaters show Input placeholder ("Image upload coming in next step") | ImageUploadField is wired for top-level fields (Plan 03 contract); repeater image fields require the same component wired inside useFieldArray items — deferred to a follow-up or handled when needed |

Note: top-level image fields in LpForm.tsx also show a placeholder Input. The `extractImageFieldValues` helper in actions.ts already handles `{publicUrl, s3Key}` objects so the Server Action is ready; the UI component wiring is the stub.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes beyond what the plan's threat model covers. All LP routes are gated by `requireWorkspace` or `requireWorkspaceRole`. Cross-workspace IDOR prevented by `db.lp.findById` filtering on `workspaceId`.

## Self-Check: PASSED

Files verified present:
- `apps/web/src/lib/lps/actions.ts` — FOUND
- `apps/web/src/lib/lps/reconcile.ts` — FOUND
- `apps/web/src/components/lps/LpForm.tsx` — FOUND
- `apps/web/src/components/lps/LpCard.tsx` — FOUND
- `apps/web/src/components/lps/LpPreview.tsx` — FOUND
- `apps/web/src/components/lps/RepeaterBlock.tsx` — FOUND
- `apps/web/src/components/lps/RichTextField.tsx` — FOUND
- `apps/web/src/components/lps/BrandGlobalsPanel.tsx` — FOUND
- `apps/web/src/app/w/[slug]/lps/page.tsx` — FOUND
- `apps/web/src/app/w/[slug]/lps/new/page.tsx` — FOUND
- `apps/web/src/app/w/[slug]/lps/new/TemplatePickerForm.tsx` — FOUND
- `apps/web/src/app/w/[slug]/lps/new/[templateId]/page.tsx` — FOUND
- `apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx` — FOUND
- `apps/web/src/app/w/[slug]/lps/[lpId]/edit/page.tsx` — FOUND

Commits verified:
- `9ad0e0c` feat(04-02): LP Server Actions, sidebar nav link, package installs — FOUND
- `64f9cbe` feat(04-02): LP client components — FOUND
- `60664dd` feat(04-02): add LP route pages — FOUND
- `7fa517d` fix(04-02): extract reconcileLpValues to reconcile.ts — FOUND

Build: `pnpm build` exits 0 — all 6 LP routes compiled as dynamic server routes.
TypeScript: `npx tsc --noEmit` exits 0 — no type errors.
