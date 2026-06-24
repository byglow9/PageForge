---
phase: 09-modelo-de-overrides-runtime-de-aplica-o
reviewed: 2026-06-24T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - apps/web/src/lib/lps/schema.ts
  - apps/web/src/lib/lps/schema.test.ts
  - apps/web/src/lib/lps/actions.ts
  - apps/web/src/lib/brand/theme.ts
  - apps/web/src/lib/brand/theme.test.ts
  - apps/web/src/lib/overrides/apply-shim.ts
  - apps/web/src/lib/overrides/apply-shim.test.ts
  - apps/web/src/app/serve/[tplId]/[[...path]]/route.ts
  - apps/web/src/app/api/lps/[lpId]/export/route.ts
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-06-24
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 9 introduces a runtime override model for VITE_SPA landing pages: overrides are stored as JSON in `LandingPage.values`, injected into `index.html` as a `<script type="application/json">` sentinel plus an inline shim that applies text via `textContent` and color via a CSS variable. The core security posture is sound — text values flow through `textContent` (no innerHTML vector), the JSON blob is unicode-escaped against script-tag breakout, and color values are hex-validated before reaching the HSL converter.

However, two findings are BLOCKER-class. First, the stated **preview == export fidelity guarantee is broken**: the serve route resolves the LP by `findFirst(templateId)` while the export route resolves by the explicit `lpId`, so for any template backing multiple LPs the preview and export inject *different* override sets. Second, the **shim script bypasses the export's own security model** — the VITE_SPA export injects an executable inline `<script>` containing override values, and unlike the LIQUID export path it ships no CSP and applies overrides whose JSON content is escaped for the *application/json* context but whose `textContent` values are then injected into the live DOM in a downloaded, fully-trusted-origin HTML file. Several robustness and isolation warnings follow.

## Critical Issues

### CR-01: Preview and export inject different overrides — fidelity guarantee is false for multi-LP templates

**File:** `apps/web/src/app/serve/[tplId]/[[...path]]/route.ts:250-256` and `apps/web/src/app/api/lps/[lpId]/export/route.ts:271-278`

**Issue:** The phase explicitly promises preview == export. The serve route looks up the LP to inject like this:

```ts
const lp = await servingRead((tx) =>
  tx.landingPage.findFirst({
    where: { templateId: tplId, workspaceId },
    select: { values: true },
    orderBy: { createdAt: "asc" },
  })
);
```

It selects the *oldest* LP for the template, regardless of which LP the user is previewing. The export route, in contrast, operates on the exact `lpId` from the URL and injects `lp.values` for that specific LP. For any VITE_SPA template that backs more than one LP (the route's own comment cites `/grecia`, `/turquia`), the preview shows LP-A's overrides and color while the export of LP-B contains LP-B's overrides — they are provably different documents. This is a correctness defect in the headline guarantee of the phase, not a future enhancement. The inline comment ("multi-LP disambiguation … arrives in Phase 10") acknowledges the gap but the preview is still shipped as authoritative.

**Fix:** The preview must be scoped to a specific LP, not "first by createdAt". Resolve the LP via the `lpId` carried by the preview context (query param / postMessage / dedicated preview route) and pass it to `buildBrandStyleTagForLp` / `buildOverrideInjection`. If single-LP-per-template is the v1 invariant, enforce it at write time and assert it here; otherwise do not advertise preview==export until the same LP is rendered on both paths. At minimum, fail loudly (or render the SPA with no overrides) when more than one LP matches, rather than silently picking one:

```ts
const lps = await servingRead((tx) =>
  tx.landingPage.findMany({ where: { templateId: tplId, workspaceId }, select: { id: true, values: true } })
);
// resolve the specific previewed LP by id; do not blind-pick lps[0]
```

### CR-02: VITE_SPA export ships an executable inline shim with no CSP, re-opening the injection surface the LIQUID path closes

**File:** `apps/web/src/app/api/lps/[lpId]/export/route.ts:275-281` (and `apply-shim.ts:150-190`)

**Issue:** The LIQUID export path injects a strict `default-src 'none'` CSP meta (`injectCsp`, line 367) precisely to guarantee "no inline-script execution in exported HTML." The VITE_SPA export path intentionally omits CSP (line 307) AND now appends `injectOverrides`, which adds an inline `<script>` (the shim) plus a JSON blob containing attacker-influenceable override `value` strings into a file the user downloads and may host on their own trusted origin. The JSON blob is escaped only for the `<script type="application/json">` parse context (`escapeJsonForHtml` escapes `< > &`). The override `value` is then assigned via `textContent`, which is safe against HTML injection — but the security argument rests entirely on the shim running unmodified. Because there is no CSP and the exported artifact is static, any later transform, a stored override of `type` other than text/color in a future phase, or a regression that swaps `textContent`→`innerHTML` becomes a stored-XSS shipped to every downloaded LP with no defense-in-depth. The export embeds untrusted content into an executable script context that the rest of the export pipeline was designed to forbid.

Additionally, `escapeJsonForHtml` does **not** escape the U+2028 / U+2029 line separators. Inside `<script type="application/json">` that is parsed via `JSON.parse(textContent)` so it is tolerated, but it confirms the escaping is hand-rolled and incomplete rather than using a vetted serializer.

**Fix:** Do not ship an executable shim inside the exported, CSP-free artifact. For export, apply overrides at build time on the server (mutate the DOM/HTML server-side so the downloaded `index.html` already contains the final text and color, no runtime script), OR add a hash-based CSP (`script-src 'sha256-…'`) covering exactly the SPA bundle and the shim so arbitrary inline scripts remain blocked. Either way the downloaded file must not depend on an unconstrained inline script to be correct, and the override-injection security claims should be re-derived for the no-CSP export context, not inherited from the serve context.

## Warnings

### WR-01: `duplicateLpAction` silently drops all overrides and per-LP color for VITE_SPA LPs

**File:** `apps/web/src/lib/lps/actions.ts:464-476`

**Issue:** D-12 states duplicate is a "full independent copy." For VITE_SPA the branch hard-codes `values: {}`, discarding `origin.values` (overrides array + `primaryColorOverride`). The duplicated LP loses every text override and its brand color override — silent data loss relative to the documented "full copy" contract. The LIQUID branch immediately below correctly copies `origin.values`.

**Fix:** Copy the source values:
```ts
const viteCopy = await db.lp.create({
  templateId: origin.templateId ?? undefined,
  name: `Copy of ${origin.name}`,
  markupSnapshot: "",
  schemaVersion: 0,
  values: (origin.values as object) ?? {},
  kind: "VITE_SPA",
  entryRoute: origin.entryRoute ?? null,
});
```

### WR-02: Override merge can persist an `undefined` `primaryColorOverride` key into jsonb

**File:** `apps/web/src/lib/lps/actions.ts:407-411`

**Issue:** The merge builds:
```ts
valuesUpdate = {
  overrides: overridesParsed.data.overrides ?? existingValues.overrides ?? [],
  primaryColorOverride:
    overridesParsed.data.primaryColorOverride ?? existingValues.primaryColorOverride,
};
```
When neither the payload nor the existing row has a color, `primaryColorOverride` is `undefined`. Writing this object to a Prisma jsonb column serializes the key inconsistently (it may be dropped, or stored as JSON `null` depending on the driver path), and downstream `lpValues?.primaryColorOverride` then must treat `null` and `undefined` identically. More importantly, a user who previously set a color and now sends `overrides` only (no color) keeps the old color via `existingValues.primaryColorOverride` — but there is no way to *clear* a color back to workspace default, because absent is defined as "preserve." That is a missing capability, not just a style nit.

**Fix:** Build the object conditionally so absent stays absent, and define an explicit clear sentinel (e.g. `null`) distinct from "preserve":
```ts
valuesUpdate = {
  overrides: overridesParsed.data.overrides ?? existingValues.overrides ?? [],
  ...(overridesParsed.data.primaryColorOverride !== undefined
    ? { primaryColorOverride: overridesParsed.data.primaryColorOverride }
    : existingValues.primaryColorOverride !== undefined
      ? { primaryColorOverride: existingValues.primaryColorOverride }
      : {}),
};
```

### WR-03: `pathToNode` walks `childNodes` including text/comment nodes — paths are fragile and order-dependent on the live SPA

**File:** `apps/web/src/lib/overrides/apply-shim.ts:155-166`

**Issue:** The shim resolves a stored path against `document.body.childNodes`, which includes whitespace text nodes and comment nodes. The override `path` is captured at authoring time against whatever DOM existed then. A React SPA re-renders and hydrates after `DOMContentLoaded`; child node indices (especially with conditional whitespace, Fragments, portals, or hydration timing) are not stable between the authoring snapshot and the served render. Because every miss is swallowed by the per-override try/catch (T-09-02-05), a path that no longer resolves produces a *silently un-applied override* — the LP renders with the original template text and the user is never told their edit didn't take. This is the primary functional risk of the whole feature and it fails closed-to-silent.

**Fix:** Out of scope to fully solve here, but at minimum (a) run the shim after the SPA has mounted (e.g. a `MutationObserver` settle or `requestIdleCallback`/`setTimeout` after framework hydration) rather than on raw `DOMContentLoaded`, since `document.body.childNodes[0]` at DOMContentLoaded is the un-hydrated root; and (b) walk `children` (element nodes) with explicit element-only indexing to match however paths are captured, and assert the captured-side uses the identical traversal. Document the exact traversal contract in one place so author and shim cannot drift.

### WR-04: Export route does not honor `entryRoute` — exported SPA always serves the root, while preview can target a sub-route

**File:** `apps/web/src/app/api/lps/[lpId]/export/route.ts:241-290` and `serve/[tplId]/[[...path]]/route.ts`

**Issue:** A VITE_SPA LP carries an `entryRoute` (e.g. `/grecia`). The export zips the dist tree and the unmodified `index.html`; nothing in the export configures the SPA to boot at `entryRoute`. The downloaded LP opens at the SPA's root route, not the LP's intended page. Combined with CR-01 (preview picks the first LP) the export of a `/turquia` LP is neither the previewed page nor routed to `/turquia`. This undermines the "download exactly what you see" promise for any LP that is not the root entry.

**Fix:** Inject the entry route into the exported index (e.g. a `<base>`/redirect or a small bootstrap that pushes `entryRoute` before the router mounts), or document that export only supports root-route LPs in v1 and block export of non-null `entryRoute` LPs with a clear error.

### WR-05: Export image-download loop can write colliding asset filenames, silently overwriting

**File:** `apps/web/src/app/api/lps/[lpId]/export/route.ts:351-377`

**Issue:** `filename` is derived solely from the URL's last path segment. Two distinct S3 URLs with the same basename (common with per-LP prefixes, or `image.jpg` under different folders) map to the same `assets/{filename}`. `urlToFilename` then maps two URLs to the same name; `rewriteImageSrcs` points both at one file and `archive.append` writes two entries with the same `name`, so the ZIP contains a duplicate/overwritten asset and one image renders wrong. The `asset-${assets.length}` fallback only triggers when there is no basename at all.

**Fix:** Ensure filename uniqueness, e.g. prefix with a short hash of the URL or an incrementing index when a collision is detected:
```ts
let filename = urlObj.pathname.split("/").at(-1) || `asset-${assets.length}`;
if (usedNames.has(filename)) filename = `${assets.length}-${filename}`;
usedNames.add(filename);
```

### WR-06: `getLpAction` returns `values` to any workspace member but `lpValues` typing assumes VITE_SPA shape unsafely across the codebase

**File:** `apps/web/src/lib/lps/actions.ts:633` and serve/export `lp.values as ViteSpaValues`

**Issue:** `lp.values` is cast `as ViteSpaValues` in three places (serve:260, export:272, actions merge:406) without runtime parsing. The schema file itself warns (schema.ts:223-227) that raw `lp.values` is read WITHOUT parsing through `ViteSpaValuesSchema`, and that callers must not assume `overrides` exists. The B2 guard in `buildOverrideInjection` covers the `overrides` access, but `lpValues?.primaryColorOverride` is consumed by `buildBrandStyleTagForLp` with no guarantee it is a valid hex — if a malformed `values` blob ever lands in the DB (e.g. via the `undefined`-key path in WR-02, a future writer, or a manual migration), an arbitrary string reaches `hexToHslTriplet` → `parseInt(NaN)` → `--primary: NaN NaN% NaN%`. The trust boundary is "we control all writers," which the schema comment itself flags as fragile.

**Fix:** Parse on read at the injection boundary with `ViteSpaValuesSchema.safeParse(lp.values)` and fall back to `{ overrides: [] }` on failure, so a corrupt row degrades to "no overrides / workspace color" instead of emitting invalid CSS. This makes the read path defensive and removes the unchecked `as` casts.

## Info

### IN-01: Two copies of `hexToHslTriplet` kept in sync only by comment

**File:** `apps/web/src/lib/brand/theme.ts:45-83` and `apps/web/src/lib/overrides/apply-shim.ts:56-90`

**Issue:** `hexToHslTriplet` and `hexToHslTripletShim` are byte-identical algorithms maintained "in sync manually" (per the doc comment). The W2 fidelity guarantee depends on them never drifting, but nothing enforces it beyond duplicated unit tests. A change to one will silently desync preview color from export color.

**Fix:** Have `theme.ts` import and re-export the shim's pure function (or vice versa) so there is a single source of truth, and serialize that single function into the shim string. The current duplication is a latent fidelity bug.

### IN-02: `escapeJsonForHtml` is dead-simple but order of replacement on `&` is correct only by luck of escaping to `&`

**File:** `apps/web/src/lib/overrides/apply-shim.ts:100-105`

**Issue:** Escaping `<`→`<` etc. before/after `&`→`&` happens to be safe because the replacements emit `\u00XX` (no `<`, `>`, `&` in output). It works, but reads as fragile; a future addition that emits an HTML-significant char would reintroduce double-escaping bugs. Prefer a single regex pass.

**Fix:** `json.replace(/[<>&\u2028\u2029]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"))` — single pass, also covers the U+2028/U+2029 line separators.

### IN-03: `GenerateLpAction` VITE_SPA branch is unreachable-by-design dead-ish code with divergent behavior

**File:** `apps/web/src/lib/lps/actions.ts:182-194`

**Issue:** `generateLpAction` validates input with `GenerateLpSchema`, which requires `templateId` to be a **cuid** (schema.ts:20). VITE_SPA template IDs are UUIDs (schema.ts:109 documents this explicitly). A VITE_SPA template's UUID will fail `GenerateLpSchema`'s cuid check at line 156 and never reach the VITE_SPA branch at line 182. The branch comment claims it handles "VITE_SPA templates that happen to land in generateLpAction" but the validator makes that impossible. Either dead code or a latent inconsistency.

**Fix:** Remove the unreachable VITE_SPA branch from `generateLpAction`, or loosen the `templateId` validator if this entry point is genuinely meant to accept VITE_SPA UUIDs. Keep one documented entry point per kind.

### IN-04: `injectBrandStyle` / `injectOverrides` use first-match `indexOf("</head>")` — case-sensitive and naive

**File:** `apps/web/src/lib/brand/theme.ts:123` and `apps/web/src/lib/overrides/apply-shim.ts:219`

**Issue:** Both helpers match the literal `</head>` (lowercase). Vite production output is reliably lowercase so this works today, but the matcher would silently fall through to the prepend fallback on any `</HEAD>` or `</head >` variant, placing the brand `<style>` and the override shim *before* `<html>` — outside `<head>`. The shim still runs, but the brand `:root` style may be overridden by later in-document styles depending on cascade. Low risk given controlled Vite output, noted for robustness.

**Fix:** Use a case-insensitive search (`html.toLowerCase().indexOf("</head>")` for the index, slice on the original) and document the assumption that input is server-generated Vite HTML.

---

_Reviewed: 2026-06-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
