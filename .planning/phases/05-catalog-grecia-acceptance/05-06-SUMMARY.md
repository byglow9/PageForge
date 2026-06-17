---
phase: 05-catalog-grecia-acceptance
plan: "06"
subsystem: ui
tags: [react, react-hook-form, next.js, base-ui, tailwind, vitest, liquidjs]

requires:
  - phase: 05-catalog-grecia-acceptance
    provides: LP form, repeater blocks, image upload field, template picker, workspace shell layout

provides:
  - Composite React keys (fieldId) for all repeater field-type branches — prevents key collisions
  - ImageUploadField edit-mode hydration from existing {publicUrl, s3Key} field value
  - TemplatePickerForm SelectValue render function showing template name instead of raw cuid
  - Dashboard page wrapper padding (px-8 py-6) without touching shared <main>
  - Confirmed LpForm _lpName guard + renderer.ts resolveImageUrl (all three image points) sound; engine corpus 118/118 green

affects: [lps, templates, workspace-shell]

tech-stack:
  added: []
  patterns:
    - "Base UI SelectValue children render function: pass (value) => label lookup to render human-readable text in trigger"
    - "ImageUploadField hydration via useEffect on field.value — seed preview without calling onChange (preserves stored value as source of truth)"
    - "Composite repeater key pattern: key={fieldId} where fieldId = repeaterName.index.field.name"

key-files:
  created: []
  modified:
    - apps/web/src/components/lps/RepeaterBlock.tsx
    - apps/web/src/components/lps/ImageUploadField.tsx
    - apps/web/src/app/w/[slug]/lps/new/TemplatePickerForm.tsx
    - apps/web/src/app/w/[slug]/page.tsx

key-decisions:
  - "Shell padding via page-wrapper (px-8 py-6 on /w/[slug]/page.tsx) not shared <main> — avoids double-padding self-padded pages like /lps"
  - "ImageUploadField hydration: useEffect seeding local previewUrl from field.value without calling onChange — stored {publicUrl,s3Key} remains RHF source of truth, no data-loss risk on save-without-reupload"
  - "SelectValue render function preferred over mapping value in SelectTrigger children — keeps selection logic self-contained in the value slot"

patterns-established:
  - "Repeater field React keys must be composite (repeaterName.index.field.name) not field.name alone — prevents collisions when field names repeat across repeater blocks"
  - "Upload field edit hydration: check field.value on mount via useEffect, set local state only, never call onChange during hydration"

requirements-completed: [GEN-04, CAT-04]

duration: 20min
completed: 2026-06-17
---

# Phase 05 Plan 06: LP Form / Render + Shell Gap Closure Summary

**Composite repeater keys, ImageUploadField edit hydration, template picker single-label, dashboard padding, and engine corpus confirmation — all UAT gaps from Tests 10, 11, 12, 1 closed**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-17T10:00:00Z
- **Completed:** 2026-06-17T10:23:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Fixed duplicate React keys in repeater field branches — all four branches (richtext, button, image, text/fallback) now use the composite `fieldId` (`repeaterName.index.field.name`) instead of `field.name`, eliminating key collisions when the Grécia template reuses field names (titulo, texto) across multiple repeater blocks
- Fixed ImageUploadField edit-mode data-loss: a `useEffect` inside the Controller render seeds `previewUrl` and `uploadState` from the existing `field.value` (`{publicUrl,s3Key}` or plain string) without calling `onChange` — saving an edited LP without re-uploading the hero image now preserves the original image (UAT 12 data-loss risk closed)
- Fixed template picker showing raw cuid next to the template name by using Base UI `SelectValue` children render function to map the selected ID to the human-readable label
- Added `px-8 py-6` to the dashboard page wrapper (`/w/[slug]/page.tsx`) — page-wrapper approach avoids double-padding the `/lps` page that already sets its own padding
- Confirmed LpForm `_lpName` guard (reads from `getValues`, works for both generate and edit modes, strips `_lpName` from `fieldValues`) and `renderer.ts` `resolveImageUrl` applied at all three image points (repeater ~line 90, top-level ~line 157, brand ~line 179); engine corpus 118/118 green

## Task Commits

1. **Task 1: Composite repeater keys + ImageUploadField edit hydration** - `05dc58f` (fix)
2. **Task 2: Template picker single-control + shell padding** - `b91ca5d` (fix)
3. **Task 3: Review + confirm LpForm/renderer.ts inline fixes** - `fb46b4e` (chore, review-only)

## Files Created/Modified

- `apps/web/src/components/lps/RepeaterBlock.tsx` — Changed `key={field.name}` to `key={fieldId}` on all four field-type branch outer wrappers
- `apps/web/src/components/lps/ImageUploadField.tsx` — Added `useEffect` import; added edit-mode hydration effect inside Controller render (no onChange called)
- `apps/web/src/app/w/[slug]/lps/new/TemplatePickerForm.tsx` — SelectValue now uses children render function `(value) => templates.find(t => t.id === value)?.name` to show label not raw cuid
- `apps/web/src/app/w/[slug]/page.tsx` — Added `className="px-8 py-6"` to the root wrapper div

## Decisions Made

- **Page-wrapper padding (not shared `<main>`):** Adding padding to the dashboard page wrapper avoids double-padding the `/lps` two-panel layout that manages its own `px-8 py-6` and relies on `h-full` flex. The `<main>` remains padding-free; pages that need padding add it themselves.
- **Hydration without onChange:** The `useEffect` seeds only local React state (`previewUrl`, `uploadState`) — never `field.onChange` — so the RHF form value (`{publicUrl,s3Key}`) remains unchanged during hydration. This is critical: form submission sends the stored object, not the local preview state, so saving without re-uploading preserves the original image.
- **SelectValue render function:** Base UI `SelectValue` renders the raw value (cuid) by default. Passing a `children` render function `(value: string | null) => ...` is the canonical Base UI API for mapping a value to a human-readable label in the trigger.

## Deviations from Plan

None — plan executed exactly as written. Task 3 was a review pass; both inline fixes were already committed and confirmed sound without modification.

## Issues Encountered

None. TypeScript clean (`npx tsc --noEmit` no errors on targeted files); engine corpus 118/118 on `pnpm test`.

## Threat Model Verification

| Threat | Status |
|--------|--------|
| T-05-06-01: renderer.ts image url resolution → sanitizeUrl | Confirmed: resolveImageUrl output passes through sanitizeUrl at all three image points |
| T-05-06-02: ImageUploadField edit hydration data-loss | Mitigated: useEffect hydrates preview only; stored {publicUrl,s3Key} unchanged; save-without-reupload preserves image |
| T-05-06-03: template picker cuid display | Accepted/fixed cosmetically: cuid is non-sensitive; now displays template name via render function |

## UAT Gap Closure Summary

| UAT Test | Gap | Status |
|----------|-----|--------|
| Test 10 — Repeater duplicate keys | `key={field.name}` collided across repeater blocks | Fixed: composite `key={fieldId}` |
| Test 10 — Template picker cuid overlay | SelectValue rendered raw cuid alongside styled name | Fixed: render function maps value→name |
| Test 11 — Image fields [object Object] | resolveImageUrl not applied (already committed in 8674702) | Confirmed: applied at repeater/top-level/brand |
| Test 12 — Hero image lost on edit save | ImageUploadField showed empty dropzone; save without reupload lost image | Fixed: useEffect hydration; no onChange on hydration |
| Test 1 — Dashboard flush to edges | `<main>` had no padding; dashboard content flush | Fixed: page-wrapper px-8 py-6 |

## Next Phase Readiness

- All five UAT gaps from 05-UAT.md Tests 1, 10, 11, 12 are closed
- Engine corpus 118/118 green
- TypeScript clean
- Phase 05 gap-closure plans complete

---
*Phase: 05-catalog-grecia-acceptance*
*Completed: 2026-06-17*
