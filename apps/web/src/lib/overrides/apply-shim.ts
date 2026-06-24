/**
 * Override apply shim — runtime injection for VITE_SPA landing pages.
 *
 * This module provides:
 *
 * 1. hexToHslTripletShim — a re-export of theme.ts hexToHslTriplet (single source of
 *    truth, IN-01) that is also serialized into the inline shim script. Because preview
 *    color and export color now share ONE implementation, the browser shim's color
 *    conversion provably matches the server-side brand injection and cannot drift
 *    (W2 guarantee: preview color == export color).
 *
 * 2. buildOverrideInjection — builds the two HTML fragments to embed in index.html:
 *    - overridesJson: <script id="pf-overrides" type="application/json">{...}</script>
 *    - shimScript: inline <script> that runs after DOMContentLoaded and applies each override
 *
 * 3. injectOverrides — inserts both fragments before </head> in the LP HTML string.
 *
 * Security:
 * - T-09-02-01: escapeJsonForHtml unicode-escapes < > & so the JSON blob cannot close
 *   the <script type="application/json"> tag (prevents script tag breakout / XSS).
 * - T-09-02-02: Shim applies values via node.textContent (NEVER innerHTML) — stored XSS
 *   via override value is fully neutralized by design.
 * - T-09-02-03: color override value is validated as /^#[0-9a-fA-F]{6}$/ before storage;
 *   hexToHslTripletShim output is digits + '%' + spaces only — no CSS injection vector.
 * - T-09-02-04: LP lookup in serve route is scoped to workspaceId from verified HMAC token.
 * - T-09-02-05: Each override application is wrapped in try/catch — malformed path silently
 *   skipped; LP renders normally without override rather than crashing.
 * - B2 guard: VITE_SPA LPs created before any override is saved store values = {} (sentinel).
 *   Casting {} to ViteSpaValues yields .overrides === undefined at runtime. The guard
 *   (!values || !values.overrides || values.overrides.length === 0) prevents TypeErrors.
 */

import type { ViteSpaValues } from "@/lib/lps/schema";
import { hexToHslTriplet } from "@/lib/brand/theme";

// -----------------------------------------------------------------------
// hexToHslTripletShim
//
// IN-01: single source of truth. The hex→HSL algorithm lives ONCE in
// theme.ts (hexToHslTriplet). We re-export it here as hexToHslTripletShim
// (preserving the historical export name used by callers and W2 tests) and
// serialize that SAME function into the inline shim script via .toString().
// This makes it structurally impossible for preview color and export color
// to drift — there is now only one implementation.
//
// theme.ts is a pure, dependency-free module with no "use server" directive,
// so importing it here keeps the shim self-contained: the serialized function
// body is fully inlined into the shimScript string (see buildOverrideInjection).
//
// Exported for:
//   1. W2 unit tests that assert shim output == theme.ts output for reference values.
//   2. Embedding the function body (via .toString()) into the shimScript string so
//      the browser shim and Node-tested helper are provably the same code.
// -----------------------------------------------------------------------

export const hexToHslTripletShim = hexToHslTriplet;

// -----------------------------------------------------------------------
// escapeJsonForHtml
//
// Unicode-escape < > & in a JSON string so the embedded JSON blob cannot
// break out of the <script type="application/json"> tag context.
// T-09-02-01: prevents script tag breakout / XSS via override values.
//
// IN-02: single-pass regex (no chained .replace ordering hazard) that also
// escapes the U+2028 / U+2029 line separators, which are valid JSON but can
// break out of inline <script> contexts in some parsers.
// -----------------------------------------------------------------------

function escapeJsonForHtml(json: string): string {
  return json.replace(
    /[<>&\u2028\u2029]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")
  );
}

// -----------------------------------------------------------------------
// buildOverrideInjection
// -----------------------------------------------------------------------

/**
 * Build the two HTML fragments to embed in a VITE_SPA index.html for override injection.
 *
 * @param values - The LP's values field cast to ViteSpaValues, or null/undefined.
 * @returns { shimScript, overridesJson } — both empty strings if no overrides present.
 *
 * B2 guard: if values is null/undefined, or if values.overrides is undefined (sentinel {}),
 * or if values.overrides is an empty array, returns { shimScript: '', overridesJson: '' }.
 * This ensures override-free LPs (including all existing VITE_SPA LPs created before
 * Phase 9) render without TypeError.
 *
 * shimScript content:
 * - Reads override data from document.getElementById('pf-overrides').textContent
 * - Parses JSON in a try/catch (malformed JSON does not crash the LP)
 * - For each override on DOMContentLoaded:
 *   * type === 'text': pathToNode(path).textContent = value (NEVER innerHTML — T-09-02-02)
 *   * type === 'color': document.documentElement.style.setProperty('--primary', hexToHslTripletShim(value))
 *   * unknown type (image, href, etc.): silently skipped per try/catch — T-09-02-05
 */
export function buildOverrideInjection(
  values: ViteSpaValues | null | undefined
): { shimScript: string; overridesJson: string } {
  // B2 guard: sentinel {} has .overrides === undefined at runtime
  if (!values || !values.overrides || values.overrides.length === 0) {
    return { shimScript: "", overridesJson: "" };
  }

  // Build the JSON sentinel tag with unicode-escaped content (T-09-02-01)
  const rawJson = JSON.stringify(values.overrides);
  const escapedJson = escapeJsonForHtml(rawJson);
  const overridesJson = `<script id="pf-overrides" type="application/json">${escapedJson}</script>`;

  // Serialize the single source-of-truth function (theme.ts hexToHslTriplet, re-exported
  // as hexToHslTripletShim) and bind it to a stable name inside the shim. Binding to a
  // const decouples the shim's call site from whatever name .toString() emits, so the
  // shim keeps working regardless of the underlying function's declared name (IN-01).
  // This embeds the exact same code that the Node-tested helper runs (W2 guarantee).
  const hexFnSource = hexToHslTripletShim.toString();

  // Build the inline shim script
  // The entire handler is wrapped in try/catch; each individual override also has
  // its own try/catch (T-09-02-05: malformed path silently skipped).
  const shimScript = `<script>
(function() {
  try {
    var hexToHslTripletShim = ${hexFnSource};

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

    document.addEventListener('DOMContentLoaded', function() {
      try {
        var sentinel = document.getElementById('pf-overrides');
        if (!sentinel) return;
        var overrides = JSON.parse(sentinel.textContent || '[]');
        if (!Array.isArray(overrides)) return;
        for (var i = 0; i < overrides.length; i++) {
          try {
            var ov = overrides[i];
            if (ov.type === 'text') {
              var node = pathToNode(ov.path);
              if (node) node.textContent = ov.value;
            } else if (ov.type === 'color') {
              document.documentElement.style.setProperty('--primary', hexToHslTripletShim(ov.value));
            }
            // image / href and any other unknown types: silently skipped (T-09-02-05)
          } catch(e) { /* per-override error silently swallowed */ }
        }
      } catch(e) { /* DOMContentLoaded handler error silently swallowed */ }
    });
  } catch(e) { /* outer guard silently swallowed */ }
})();
</script>`;

  return { shimScript, overridesJson };
}

// -----------------------------------------------------------------------
// injectOverrides
// -----------------------------------------------------------------------

/**
 * Insert the override sentinel and shim script into a VITE_SPA HTML string.
 *
 * Behavior:
 * - If both shimScript and overridesJson are empty, returns html unchanged (no-op).
 * - Inserts overridesJson first, then shimScript, immediately before </head>.
 * - Uses the same strategy as injectBrandStyle: find html.indexOf('</head>'), slice and insert.
 * - Fallback (no </head>): prepend both tags to html.
 *
 * Called after injectBrandStyle in both the serve route and export route pipelines.
 */
export function injectOverrides(
  html: string,
  injection: { shimScript: string; overridesJson: string }
): string {
  const { shimScript, overridesJson } = injection;

  if (!shimScript && !overridesJson) return html;

  const insertion = `${overridesJson}\n${shimScript}`;
  // IN-04: case-insensitive </head> search (matches injectBrandStyle). Slice on
  // the ORIGINAL html so the document's casing is preserved. A </HEAD> variant
  // must not fall through to the prepend fallback, which would place the shim
  // outside <head>.
  const idx = html.toLowerCase().indexOf("</head>");

  if (idx !== -1) {
    return html.slice(0, idx) + insertion + "\n" + html.slice(idx);
  }

  // Fallback: no </head> found — prepend to html
  return `${insertion}\n${html}`;
}
