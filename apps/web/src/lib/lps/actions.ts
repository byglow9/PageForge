/**
 * LP Server Actions.
 *
 * All mutations require an authenticated workspace member with role
 * owner, admin, or editor. workspaceId is always derived from the
 * server session via requireWorkspaceRole — never from client input.
 *
 * Architecture:
 * - generateLpAction calls renderLp() from lib/lps/render.ts server-side.
 *   render/renderLp is NOT imported directly from pageforge-engine here —
 *   it lives in lib/lps/render.ts (Pitfall 1 from Phase 3: importing render
 *   in a "use server" file bundles sanitize-html into the client bundle
 *   and breaks the build).
 * - workspaceId is always from requireWorkspaceRole, never from client input.
 * - LP CRUD (generate, update, duplicate, delete, list, get) follows the same
 *   shape as template actions.
 *
 * Security (T-04-02-01 through T-04-02-06):
 * - workspaceId is always derived from requireWorkspaceRole (session-backed).
 * - findById always filters by workspaceId — cross-workspace IDs return null.
 * - viewer role cannot mutate LPs (requires owner/admin/editor).
 * - slug forging is blocked by requireWorkspaceRole's membership validation.
 *
 * Image field values:
 * - Image fields store { publicUrl: string; s3Key: string } objects in input.values
 *   (set by ImageUploadField in Plan 03). The engine expects plain URL strings
 *   for image tokens, NOT objects. extractImageFieldValues() unwraps the objects:
 *   - Returns a `renderValues` copy with ImageFieldValues replaced by publicUrl strings.
 *   - Returns an `assets` array of { publicUrl, s3Key } for LpAsset bulk-create.
 *   generateLpAction passes renderValues (not raw values) to renderLp().
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceRole, requireWorkspace } from "@/lib/workspaces/guards";
import { withTenantDb } from "@/lib/db/tenant-db";
import { GenerateLpSchema, UpdateLpSchema } from "./schema";
import { renderLp } from "./render";
import type { ActionResult } from "@/lib/workspaces/actions";
import type { TokenField } from "pageforge-engine";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

/** Shape of an image field value submitted by ImageUploadField (Plan 03). */
interface ImageFieldValue {
  publicUrl: string;
  s3Key: string;
}

function isImageFieldValue(v: unknown): v is ImageFieldValue {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).publicUrl === "string" &&
    typeof (v as Record<string, unknown>).s3Key === "string"
  );
}

// -----------------------------------------------------------------------
// extractImageFieldValues — internal helper
// -----------------------------------------------------------------------

/**
 * Walk top-level and repeater-array values, extracting ImageFieldValue objects.
 *
 * Returns:
 * - renderValues: a copy of values where each ImageFieldValue is replaced by its publicUrl string
 *   (what the engine expects for image tokens).
 * - assets: flat list of { publicUrl, s3Key } for LpAsset bulk-create.
 */
function extractImageFieldValues(values: Record<string, unknown>): {
  renderValues: Record<string, unknown>;
  assets: Array<{ publicUrl: string; s3Key: string }>;
} {
  const renderValues: Record<string, unknown> = {};
  const assets: Array<{ publicUrl: string; s3Key: string }> = [];

  for (const [key, value] of Object.entries(values)) {
    if (isImageFieldValue(value)) {
      // Top-level image field
      renderValues[key] = value.publicUrl;
      assets.push({ publicUrl: value.publicUrl, s3Key: value.s3Key });
    } else if (Array.isArray(value)) {
      // Repeater array — walk each item
      renderValues[key] = value.map((item) => {
        if (typeof item === "object" && item !== null) {
          const newItem: Record<string, unknown> = {};
          for (const [itemKey, itemValue] of Object.entries(
            item as Record<string, unknown>
          )) {
            if (isImageFieldValue(itemValue)) {
              newItem[itemKey] = itemValue.publicUrl;
              assets.push({ publicUrl: itemValue.publicUrl, s3Key: itemValue.s3Key });
            } else {
              newItem[itemKey] = itemValue;
            }
          }
          return newItem;
        }
        return item;
      });
    } else {
      renderValues[key] = value;
    }
  }

  return { renderValues, assets };
}

// -----------------------------------------------------------------------
// reconcileLpValues — internal helper (D-08 schema version reconciliation)
// -----------------------------------------------------------------------

type FieldType = TokenField["type"];

function defaultForType(type: FieldType): unknown {
  if (type === "button") return { label: "", url: "" };
  return "";
}

/**
 * Reconcile LP values when a new template version is applied (D-08).
 *
 * Rules:
 * - Keep values for fields still present in newFields (match by field.name).
 * - Default new fields with defaultForType(type).
 * - Drop fields not in newFields (prevents stale values from polluting render scope — T-04-02-06).
 *
 * Acceptance proof:
 * reconcileLpValues([{name:"title",type:"text",...},{name:"body",type:"richtext",...}],
 *                   {title:"Old",removed_field:"x"})
 * → {title:"Old", body:""} — "title" kept, "removed_field" dropped, "body" defaulted.
 */
export function reconcileLpValues(
  newFields: TokenField[],
  existingValues: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Top-level fields (non-repeater, non-global)
  for (const field of newFields) {
    if (field.global || field.repeater) continue;
    result[field.name] = existingValues[field.name] ?? defaultForType(field.type);
  }

  // Repeater arrays
  const repeaterNames = [
    ...new Set(
      newFields
        .filter((f) => f.repeater !== undefined && f.repeater !== null)
        .map((f) => f.repeater as string)
    ),
  ];

  for (const rName of repeaterNames) {
    const oldItems = Array.isArray(existingValues[rName])
      ? (existingValues[rName] as unknown[])
      : [];
    const itemFields = newFields.filter((f) => f.repeater === rName);
    result[rName] = oldItems.map((item) => {
      const obj =
        typeof item === "object" && item !== null
          ? (item as Record<string, unknown>)
          : {};
      const newItem: Record<string, unknown> = {};
      for (const f of itemFields) {
        newItem[f.name] = obj[f.name] ?? defaultForType(f.type);
      }
      return newItem;
    });
  }

  return result;
}

// -----------------------------------------------------------------------
// generateLpAction
// -----------------------------------------------------------------------

/**
 * Generate a new landing page from a template.
 *
 * Steps:
 * 1. Gate: owner/admin/editor only.
 * 2. Zod validate input.
 * 3. Fetch template by id.
 * 4. Snapshot markup + schemaVersion (D-06).
 * 5. Extract image field values → renderValues.
 * 6. renderLp(snapshotMarkup, renderValues, db) — D-04 live brand resolution.
 * 7. db.lp.create().
 * 8. Bulk-create LpAsset records (best-effort — failure does NOT abort LP creation).
 * 9. revalidatePath.
 */
export async function generateLpAction(
  slug: string,
  input: { templateId: string; name: string; values: Record<string, unknown> }
): Promise<ActionResult<{ id: string }>> {
  // Step 1: Gate
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // Step 2: Validate input
  const parsed = GenerateLpSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = fieldErrors[field] ?? [];
      fieldErrors[field].push(issue.message);
    }
    return { ok: false, error: "Validation failed", fieldErrors };
  }

  const { templateId, name, values } = parsed.data;

  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      // Step 3: Fetch template
      const template = await db.template.findById(templateId);
      if (!template) {
        return { ok: false, error: "Template not found in this workspace." };
      }

      // Step 4: Snapshot markup + schemaVersion (D-06)
      const markupSnapshot = template.markup;
      const schemaVersion = template.schemaVersion;

      // Step 5: Extract image field values → renderValues
      // (Image fields submit { publicUrl, s3Key } objects; engine expects plain URL strings)
      const { renderValues, assets } = extractImageFieldValues(
        values as Record<string, unknown>
      );

      // Step 6: Render LP server-side (D-04 brand globals resolved live)
      // Note: renderLp is from lib/lps/render.ts (no "use server") — safe import
      await renderLp({ markupSnapshot, values: renderValues }, db);

      // Step 7: Create LP record
      const lp = await db.lp.create({
        templateId,
        name,
        markupSnapshot,
        schemaVersion,
        values: values as object, // store original values (with image objects for Plan 03)
      });

      // Step 8: Bulk-create LpAsset records (best-effort — T-04-02-02)
      if (assets.length > 0) {
        try {
          for (const asset of assets) {
            await db.lpAsset.create({
              landingPageId: lp.id,
              s3Key: asset.s3Key,
              publicUrl: asset.publicUrl,
              filename: asset.s3Key.split("/").at(-1) ?? "image",
              mimeType: "image/jpeg", // placeholder — exact MIME tracked in Plan 03
              fileSize: 0, // placeholder — size enforced at upload time (Plan 03)
            });
          }
        } catch {
          // Best-effort: asset tracking failure must NOT abort LP creation (v1)
        }
      }

      revalidatePath(`/w/${slug}/lps`);
      return { ok: true, data: { id: lp.id } };
    });
  } catch {
    return { ok: false, error: "Failed to generate landing page. Please try again." };
  }
}

// -----------------------------------------------------------------------
// updateLpAction
// -----------------------------------------------------------------------

/**
 * Update an existing landing page (edit mode or schema version upgrade D-08).
 *
 * When markupSnapshot + schemaVersion are provided, this is a D-08 version pull:
 * - The LP's markup snapshot and schema version are refreshed.
 * - Values should be reconciled by the caller using reconcileLpValues().
 */
export async function updateLpAction(
  slug: string,
  input: {
    id: string;
    name?: string;
    values?: Record<string, unknown>;
    markupSnapshot?: string;
    schemaVersion?: number;
  }
): Promise<ActionResult<{ id: string }>> {
  // Gate
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // Validate
  const parsed = UpdateLpSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = fieldErrors[field] ?? [];
      fieldErrors[field].push(issue.message);
    }
    return { ok: false, error: "Validation failed", fieldErrors };
  }

  const { id, name, values, markupSnapshot, schemaVersion } = parsed.data;

  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      const existing = await db.lp.findById(id);
      if (!existing) {
        return { ok: false, error: "Landing page not found in this workspace." };
      }

      const updated = await db.lp.update(id, {
        ...(name !== undefined ? { name } : {}),
        ...(values !== undefined ? { values: values as object } : {}),
        ...(markupSnapshot !== undefined ? { markupSnapshot } : {}),
        ...(schemaVersion !== undefined ? { schemaVersion } : {}),
      });

      revalidatePath(`/w/${slug}/lps/${id}/preview`);
      revalidatePath(`/w/${slug}/lps`);
      return { ok: true, data: { id: updated.id } };
    });
  } catch {
    return { ok: false, error: "Failed to save. Please try again." };
  }
}

// -----------------------------------------------------------------------
// duplicateLpAction
// -----------------------------------------------------------------------

/**
 * Duplicate a landing page (D-12: full independent copy).
 *
 * Creates "Copy of {origin.name}" with same values + markupSnapshot + schemaVersion.
 * Also copies LpAsset records (best-effort).
 */
export async function duplicateLpAction(
  slug: string,
  lpId: string
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      const origin = await db.lp.findById(lpId);
      if (!origin) {
        return { ok: false, error: "Landing page not found in this workspace." };
      }

      // D-12: Full independent copy — name prefixed with "Copy of"
      const copy = await db.lp.create({
        templateId: origin.templateId ?? undefined,
        name: `Copy of ${origin.name}`,
        markupSnapshot: origin.markupSnapshot,
        schemaVersion: origin.schemaVersion,
        values: origin.values as object,
      });

      // Copy LpAsset records (best-effort)
      try {
        const originAssets = await db.lpAsset.listByLp(lpId);
        for (const asset of originAssets) {
          await db.lpAsset.create({
            landingPageId: copy.id,
            s3Key: asset.s3Key,
            publicUrl: asset.publicUrl,
            filename: asset.filename,
            mimeType: asset.mimeType,
            fileSize: asset.fileSize,
          });
        }
      } catch {
        // Best-effort asset copy — failure does NOT abort duplication
      }

      revalidatePath(`/w/${slug}/lps`);
      return { ok: true, data: { id: copy.id } };
    });
  } catch {
    return { ok: false, error: "Failed to duplicate. Please try again." };
  }
}

// -----------------------------------------------------------------------
// deleteLpAction
// -----------------------------------------------------------------------

/**
 * Delete a landing page from the workspace.
 *
 * LpAsset records are cascade-deleted by the DB FK (onDelete: Cascade).
 */
export async function deleteLpAction(
  slug: string,
  lpId: string
): Promise<ActionResult> {
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      const existing = await db.lp.findById(lpId);
      if (!existing) {
        return { ok: false, error: "Landing page not found in this workspace." };
      }

      await db.lp.delete(lpId);
      revalidatePath(`/w/${slug}/lps`);
      return { ok: true, data: undefined };
    });
  } catch {
    return { ok: false, error: "Failed to delete. Please try again." };
  }
}

// -----------------------------------------------------------------------
// listLpsAction
// -----------------------------------------------------------------------

/**
 * List all landing pages for the workspace.
 *
 * Any workspace member (including viewers) can list LPs.
 */
export async function listLpsAction(
  slug: string
): Promise<
  ActionResult<
    Array<{
      id: string;
      name: string;
      templateId: string | null;
      schemaVersion: number;
      createdAt: Date;
      updatedAt: Date;
    }>
  >
> {
  // Any workspace member can list LPs (viewer has lp.read)
  const ctx = await requireWorkspace(slug);

  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      const lps = await db.lp.list();
      return {
        ok: true,
        data: lps.map((lp) => ({
          id: lp.id,
          name: lp.name,
          templateId: lp.templateId,
          schemaVersion: lp.schemaVersion,
          createdAt: lp.createdAt,
          updatedAt: lp.updatedAt,
        })),
      };
    });
  } catch {
    return { ok: false, error: "Failed to load landing pages. Please try again." };
  }
}

// -----------------------------------------------------------------------
// getLpAction
// -----------------------------------------------------------------------

/**
 * Get a single landing page by ID.
 *
 * Any workspace member (including viewers) can get LPs (lp.preview permission).
 */
export async function getLpAction(
  slug: string,
  lpId: string
): Promise<
  ActionResult<{
    id: string;
    name: string;
    markupSnapshot: string;
    schemaVersion: number;
    values: Record<string, unknown>;
    templateId: string | null;
  }>
> {
  const ctx = await requireWorkspace(slug);

  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      const lp = await db.lp.findById(lpId);
      if (!lp) {
        return { ok: false, error: "Landing page not found in this workspace." };
      }

      return {
        ok: true,
        data: {
          id: lp.id,
          name: lp.name,
          markupSnapshot: lp.markupSnapshot,
          schemaVersion: lp.schemaVersion,
          values: lp.values as Record<string, unknown>,
          templateId: lp.templateId,
        },
      };
    });
  } catch {
    return { ok: false, error: "Failed to load landing page. Please try again." };
  }
}
