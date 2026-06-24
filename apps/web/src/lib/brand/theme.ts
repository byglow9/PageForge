/**
 * Brand theme utilities — server-only pure module.
 *
 * Provides four functions for injecting workspace brand colors into
 * VITE_SPA landing page HTML:
 *
 * - hexToHslTriplet: converts a #RRGGBB hex color to the shadcn HSL triplet
 *   format "H S% L%" (e.g. "213 90% 23%"). Used to build CSS custom properties
 *   that are compatible with shadcn/ui's --primary variable convention.
 *
 * - buildBrandStyleTag: wraps hexToHslTriplet output in a <style>:root{...}</style>
 *   tag, returning empty string for null/undefined input.
 *
 * - injectBrandStyle: inserts the style tag before </head> in generated LP HTML,
 *   with a prepend fallback if </head> is absent.
 *
 * - buildBrandStyleTagForLp: resolves the effective brand color with LP override
 *   taking precedence over workspace color (Phase 9).
 *
 * Security:
 * - T-08-01-01: primaryColor is validated as /^#[0-9a-fA-F]{6}$/ in BrandConfig
 *   before reaching this module — the resulting triplet contains only digits,
 *   '%', and spaces (no CSS injection vector).
 * - T-09-01-03: primaryColorOverride validated as /^#[0-9a-fA-F]{6}$/ by
 *   SaveViteSpaOverridesSchema before reaching this module.
 * - No "use server" directive — this is a pure utility module, not a Server Action.
 * - No external imports — intentionally dependency-free for testability.
 */

// -----------------------------------------------------------------------
// hexToHslTriplet
// -----------------------------------------------------------------------

/**
 * Convert a 6-digit hex color string to a shadcn HSL triplet.
 *
 * Input:  "#RRGGBB" (already validated by SaveBrandConfigSchema regex)
 * Output: "H S% L%" — no "hsl(" wrapper, matching shadcn CSS var convention
 *         used in renova-turismo/src/index.css:
 *           --primary: 213 90% 23%;
 *
 * Algorithm: standard hex→RGB→HSL, with Math.round for all three components.
 * Reference: D-05 (MVP injects only --primary converted to HSL triplet).
 */
export function hexToHslTriplet(hex: string): string {
  // Parse R, G, B from the hex string (strip leading '#')
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  // Lightness
  const l = (max + min) / 2;

  // Saturation
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
  }

  // Hue
  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h = h * 60;
    if (h < 0) h += 360;
  }

  const hRounded = Math.round(h);
  const sRounded = Math.round(s * 100);
  const lRounded = Math.round(l * 100);

  return `${hRounded} ${sRounded}% ${lRounded}%`;
}

// -----------------------------------------------------------------------
// buildBrandStyleTag
// -----------------------------------------------------------------------

/**
 * Build a <style> tag that sets the --primary CSS custom property.
 *
 * Returns an empty string if primaryColor is null or undefined (no injection
 * when the workspace hasn't configured a brand color — D-05).
 *
 * Output format: '<style>:root{--primary:H S% L%;}</style>'
 * Matches the shadcn convention used by renova-turismo and all VITE_SPA LPs.
 */
export function buildBrandStyleTag(primaryColor: string | null | undefined): string {
  if (!primaryColor) return "";
  const triplet = hexToHslTriplet(primaryColor);
  return `<style>:root{--primary:${triplet};}</style>`;
}

// -----------------------------------------------------------------------
// injectBrandStyle
// -----------------------------------------------------------------------

/**
 * Inject a brand style tag into a generated LP HTML string.
 *
 * Behavior:
 * - If styleTag is empty, returns html unchanged.
 * - If html contains </head>, inserts styleTag immediately before the first
 *   occurrence of </head> (correct position for CSS custom property injection).
 * - If html does not contain </head> (e.g. minimal HTML fragments), prepends
 *   styleTag to the html string as a fallback.
 *
 * Called by the serve, preview, and export pipelines (plans 02–04).
 */
export function injectBrandStyle(html: string, styleTag: string): string {
  if (!styleTag) return html;

  const headCloseTag = "</head>";
  const idx = html.indexOf(headCloseTag);
  if (idx !== -1) {
    return (
      html.slice(0, idx) +
      styleTag +
      "\n" +
      html.slice(idx)
    );
  }

  // Fallback: no </head> found — prepend style tag
  return `${styleTag}\n${html}`;
}

// -----------------------------------------------------------------------
// buildBrandStyleTagForLp
// -----------------------------------------------------------------------

/**
 * Returns a <style> tag setting --primary. LP color (primaryColorOverride) takes
 * precedence over workspace brand color. Returns '' when both are absent/null.
 *
 * Used by the serve route and export route (Plan 02) to inject the effective brand
 * color into the VITE_SPA index.html, giving per-LP color overrides priority over
 * the workspace-level brand color configured in Brand Settings.
 *
 * Logic: return buildBrandStyleTag(primaryColorOverride ?? workspacePrimaryColor)
 *
 * Security:
 * - primaryColorOverride is validated as #RRGGBB by SaveViteSpaOverridesSchema
 *   before being stored — no CSS injection vector.
 * - workspacePrimaryColor is validated as #RRGGBB by SaveBrandConfigSchema.
 */
export function buildBrandStyleTagForLp(
  primaryColorOverride: string | null | undefined,
  workspacePrimaryColor: string | null | undefined
): string {
  return buildBrandStyleTag(primaryColorOverride ?? workspacePrimaryColor);
}
