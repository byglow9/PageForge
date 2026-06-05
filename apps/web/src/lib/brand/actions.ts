/**
 * Brand Config Server Actions.
 *
 * Mutations require authenticated session with owner/admin/editor role (D-09).
 * Reads require any workspace membership (viewer can read brand config).
 *
 * Security:
 * - saveBrandConfigAction: requireWorkspaceRole(["owner","admin","editor"]) gates
 *   all writes. Viewer role is redirected before any DB access (T-03-04-02).
 * - workspaceId always from server session via requireWorkspace/requireWorkspaceRole,
 *   never from client input (D-12, T-03-04-01).
 * - Zod validates primaryColor as /^#[0-9a-fA-F]{6}$/ and logoUrl as https:// at
 *   the action boundary — prevents CSS injection (T-03-04-03) and open redirect
 *   (T-03-04-04) at storage time.
 * - whatsapp accepted as free text ≤32 chars (T-03-04-05 — accepted risk; Phase 4
 *   must HTML-escape before LP injection).
 * - upsert uses @unique workspaceId constraint: exactly one BrandConfig per workspace
 *   (D-09, T-03-04-06).
 */
"use server";

import {
  requireWorkspace,
  requireWorkspaceRole,
} from "@/lib/workspaces/guards";
import { withTenantDb } from "@/lib/db/tenant-db";
import { SaveBrandConfigSchema, type SaveBrandConfigInput } from "./schema";
import type { ActionResult } from "@/lib/workspaces/actions";

// -----------------------------------------------------------------------
// saveBrandConfigAction
// -----------------------------------------------------------------------

/**
 * Upsert the brand config for the given workspace.
 *
 * Roles accepted: owner, admin, editor (D-09, T-03-04-02).
 * Uses db.brandConfig.upsert({ where: { workspaceId } }) — exactly one
 * BrandConfig row per workspace (D-09).
 *
 * Empty strings are normalized to null to preserve "not configured" state.
 */
export async function saveBrandConfigAction(
  slug: string,
  input: SaveBrandConfigInput
): Promise<ActionResult<{ id: string }>> {
  // D-09: editor can update brand (permissions.ts: brand: ["read", "update"])
  // T-03-04-02: viewer calling this action will be redirected before any DB write
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // Validate with Zod — T-03-04-03, T-03-04-04
  const parsed = SaveBrandConfigSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = fieldErrors[field] ?? [];
      fieldErrors[field].push(issue.message);
    }
    return { ok: false, error: "Validation failed", fieldErrors };
  }

  // Normalize empty strings to null (preserves "not configured" state)
  const logoUrl = parsed.data.logoUrl || null;
  const primaryColor = parsed.data.primaryColor || null;
  const whatsapp = parsed.data.whatsapp || null;

  try {
    return await withTenantDb(
      { workspaceId: ctx.workspaceId },
      async (db) => {
        // upsert: workspaceId @unique constraint ensures exactly one row per workspace
        const record = await db.brandConfig.upsert({
          logoUrl,
          primaryColor,
          whatsapp,
        });
        return { ok: true, data: { id: record.id } };
      }
    );
  } catch (err: unknown) {
    console.error("[saveBrandConfigAction] error:", err);
    return {
      ok: false,
      error: "Failed to save brand settings. Please try again.",
    };
  }
}

// -----------------------------------------------------------------------
// getBrandConfigAction
// -----------------------------------------------------------------------

/**
 * Get the brand config for the given workspace.
 *
 * All workspace members can read brand config (including viewer).
 * Returns null if no brand config has been set yet.
 *
 * Note: the brand settings page RSC fetches directly via withTenantDb for
 * the initial server render. This action is available for client-side refresh
 * (e.g., post-save reload without full navigation) without a round trip.
 */
export async function getBrandConfigAction(
  slug: string
): Promise<
  ActionResult<{
    logoUrl: string | null;
    primaryColor: string | null;
    whatsapp: string | null;
  } | null>
> {
  // T-03-04-01: all roles including viewer can read; workspaceId from server session
  const ctx = await requireWorkspace(slug);

  try {
    return await withTenantDb(
      { workspaceId: ctx.workspaceId },
      async (db) => {
        const config = await db.brandConfig.findFirst();
        return {
          ok: true,
          data: config
            ? {
                logoUrl: config.logoUrl,
                primaryColor: config.primaryColor,
                whatsapp: config.whatsapp,
              }
            : null,
        };
      }
    );
  } catch (err: unknown) {
    console.error("[getBrandConfigAction] error:", err);
    return {
      ok: false,
      error: "Failed to load brand settings.",
    };
  }
}
