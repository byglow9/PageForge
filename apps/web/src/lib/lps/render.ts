/**
 * Shared LP render utility — server-only module.
 *
 * IMPORTANT: NO "use server" directive — this is a server-only utility called
 * from RSC pages and route handlers, NOT a Server Action. Adding "use server"
 * would cause Next.js to include this module in the Server Action bundle, which
 * pulls in sanitize-html (a Node-only module) into the client bundle and breaks
 * the build. (Pitfall 1 from 04-RESEARCH.md)
 *
 * This module is the single render path for both preview and export (D-04, D-07):
 * - Preview: RSC page calls renderLp() → passes HTML string to <LpPreview> iframe srcdoc
 * - Export:  Route handler calls renderLp() → processes HTML for ZIP assembly
 *
 * Preview == export guarantee: both paths call renderLp() identically — no
 * divergence between what the user sees and what they download.
 */
import { render } from "pageforge-engine";
import type { TenantClient } from "@/lib/db/tenant-db";

/**
 * Render an LP's HTML from its stored snapshot markup and live brand config.
 *
 * D-04: Brand globals are resolved from the current BrandConfig at render time —
 * the LP never stores brand values directly. This means brand changes propagate
 * immediately to all LP previews and exports.
 *
 * D-06: The markup comes from the LP's markupSnapshot (captured at generation time),
 * not from the live template. Editing the source template does NOT alter existing LPs.
 *
 * Brand scope key mapping (confirmed from src/engine/renderer.ts):
 * The engine strips the "brand." prefix from token names and reads keys from the scope object.
 * Therefore the scope keys must be: logo, primary_color, whatsapp
 * (NOT logoUrl, primaryColor — those are the BrandConfig column names).
 *
 * D-05: render() is called with strictVariables:false via the engine — missing brand.*
 * tokens render as empty string rather than throwing an error.
 *
 * @param lp - LP data: markupSnapshot and values from the LandingPage record.
 * @param db - TenantClient for the current workspace (brand config fetch is scoped).
 * @returns The rendered HTML string.
 */
export async function renderLp(
  lp: { markupSnapshot: string; values: Record<string, unknown> },
  db: TenantClient
): Promise<string> {
  // D-04: Fetch live brand config — brand values are never stored on the LP itself
  const brand = await db.brandConfig.findFirst();

  // D-04: Map BrandConfig column names to engine token scope keys (T-04-01-04)
  // Brand values come from the DB server-side — never from client input
  const brandScope: Record<string, unknown> = {
    logo: brand?.logoUrl ?? "",
    primary_color: brand?.primaryColor ?? "",
    whatsapp: brand?.whatsapp ?? "",
  };

  return render(lp.markupSnapshot, lp.values, brandScope);
}
