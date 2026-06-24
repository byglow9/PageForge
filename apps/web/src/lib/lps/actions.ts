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
import { GenerateLpSchema, UpdateLpSchema, GenerateViteSpaLpSchema, SaveViteSpaOverridesSchema } from "./schema";
import type { GenerateViteSpaLpInput, PfOverride, ViteSpaValues } from "./schema";
import { renderLp } from "./render";
import type { ActionResult } from "@/lib/workspaces/actions";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { imageSize } from "image-size";

// -----------------------------------------------------------------------
// S3 client singleton (module-level, initialized once per cold start)
// Security: credentials come from server-side env vars only (T-04-03-06)
// -----------------------------------------------------------------------

const s3Client = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

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

      // VITE_SPA branch — no LiquidJS rendering, no markup snapshot, no LpAssets.
      // Sentinel values: markupSnapshot: "", schemaVersion: 0, values: {}.
      // entryRoute defaults to null (root '/') — use generateViteSpaLpAction for
      // user-specified routes. This branch handles VITE_SPA templates that happen
      // to land in generateLpAction (e.g. via direct API calls or future integrations).
      if ((template.kind ?? "LIQUID") === "VITE_SPA") {
        const viteLp = await db.lp.create({
          templateId,
          name,
          markupSnapshot: "",
          schemaVersion: 0,
          values: {},
          kind: "VITE_SPA",
          entryRoute: null,
        });
        revalidatePath(`/w/${slug}/lps`);
        return { ok: true, data: { id: viteLp.id } };
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
      await renderLp(
        { markupSnapshot, values: renderValues, kind: template.kind ?? "LIQUID" },
        db
      );

      // Step 7: Create LP record
      const lp = await db.lp.create({
        templateId,
        name,
        markupSnapshot,
        schemaVersion,
        values: values as object, // store original values (with image objects for Plan 03)
        kind: template.kind ?? "LIQUID", // propagate source template kind (WR-04)
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
// generateViteSpaLpAction
// -----------------------------------------------------------------------

/**
 * Generate a new VITE_SPA landing page from a VITE_SPA template.
 *
 * VITE_SPA LPs differ from LIQUID LPs:
 * - No markup snapshot — the SPA dist/ is served as-is from the template reference.
 * - No schema-driven values — sentinel values ({}, "", 0) are stored.
 * - entryRoute: null means root '/'; a path (e.g. '/grecia') maps to a SPA sub-route (D-01, D-07).
 *
 * Security (T-08-02-01, T-08-02-03):
 * - workspaceId derived from session via requireWorkspaceRole — never from client.
 * - templateId resolved through TenantTemplateHelpers (workspaceId-scoped).
 * - entryRoute validated and normalized by GenerateViteSpaLpSchema (T-08-02-02).
 */
export async function generateViteSpaLpAction(
  slug: string,
  input: GenerateViteSpaLpInput
): Promise<ActionResult<{ id: string }>> {
  // Gate: owner/admin/editor only (T-08-02-01)
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // Validate input — entryRoute normalization handled by Zod (T-08-02-02)
  const parsed = GenerateViteSpaLpSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = fieldErrors[field] ?? [];
      fieldErrors[field].push(issue.message);
    }
    return { ok: false, error: "Validation failed", fieldErrors };
  }

  const { templateId, name, entryRoute } = parsed.data;

  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      // Fetch template — workspaceId scoped (T-08-02-03)
      const template = await db.template.findById(templateId);
      if (!template) {
        return { ok: false, error: "Template not found in this workspace." };
      }

      if (template.kind !== "VITE_SPA") {
        return { ok: false, error: "This action only generates VITE_SPA landing pages." };
      }

      // Create LP with sentinel values (D-07, D-08)
      const lp = await db.lp.create({
        templateId,
        name,
        markupSnapshot: "",
        schemaVersion: 0,
        values: {},
        kind: "VITE_SPA",
        entryRoute: entryRoute ?? null,
      });

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
    /** VITE_SPA only: SPA sub-route; '' or undefined = no change; null = clear to root */
    entryRoute?: string | null;
    /**
     * VITE_SPA only: Override entries to persist into LandingPage.values.
     * Read from raw input — NOT from UpdateLpSchema parsed output (W1: z.object strips unknown keys).
     * Validated separately via SaveViteSpaOverridesSchema inside the VITE_SPA branch.
     */
    overrides?: PfOverride[];
    /**
     * VITE_SPA only: Per-LP primary color (#RRGGBB). Takes precedence over workspace brand color.
     * Read from raw input — NOT from UpdateLpSchema parsed output (W1 warning).
     * Validated as hex via SaveViteSpaOverridesSchema before DB write (T-09-01-03).
     */
    primaryColorOverride?: string;
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

  const { id, name, values, markupSnapshot, schemaVersion, entryRoute } = parsed.data;

  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      const existing = await db.lp.findById(id);
      if (!existing) {
        return { ok: false, error: "Landing page not found in this workspace." };
      }

      // VITE_SPA branch — name, entryRoute, and override payload are editable.
      // Override fields (overrides, primaryColorOverride) are read from the RAW input
      // (not parsed.data) because UpdateLpSchema.safeParse strips unknown keys (W1).
      if (existing.kind === "VITE_SPA") {
        // Check if an override payload is present in the raw input (W1 — read from input, not parsed.data)
        const hasOverridePayload =
          input.overrides !== undefined || input.primaryColorOverride !== undefined;

        let valuesUpdate: object | undefined;

        if (hasOverridePayload) {
          // Validate the override payload server-side (T-09-01-01, T-09-01-03)
          const overridesParsed = SaveViteSpaOverridesSchema.safeParse({
            id: input.id,
            overrides: input.overrides,
            primaryColorOverride: input.primaryColorOverride,
          });

          if (!overridesParsed.success) {
            const fieldErrors: Record<string, string[]> = {};
            for (const issue of overridesParsed.error.issues) {
              const field = issue.path[0] as string;
              fieldErrors[field] = fieldErrors[field] ?? [];
              fieldErrors[field].push(issue.message);
            }
            return { ok: false, error: "Validation failed", fieldErrors };
          }

          // Merge with existing values — do not overwrite fields absent from payload
          const existingValues = (existing.values as ViteSpaValues | null) ?? ({} as ViteSpaValues);
          valuesUpdate = {
            overrides: overridesParsed.data.overrides ?? existingValues.overrides ?? [],
            primaryColorOverride:
              overridesParsed.data.primaryColorOverride ?? existingValues.primaryColorOverride,
          };
        }

        const updated = await db.lp.update(id, {
          ...(name !== undefined ? { name } : {}),
          ...(entryRoute !== undefined ? { entryRoute } : {}),
          ...(valuesUpdate !== undefined ? { values: valuesUpdate } : {}),
        });
        revalidatePath(`/w/${slug}/lps/${id}/preview`);
        revalidatePath(`/w/${slug}/lps`);
        return { ok: true, data: { id: updated.id } };
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

      // VITE_SPA branch — copy templateId, entryRoute, kind, and values; no LpAssets.
      // D-12: duplicate is a "full independent copy" — origin.values carries the
      // overrides array + primaryColorOverride, so it MUST be copied (WR-01).
      if (origin.kind === "VITE_SPA") {
        const viteCopy = await db.lp.create({
          templateId: origin.templateId ?? undefined,
          name: `Copy of ${origin.name}`,
          markupSnapshot: "",
          schemaVersion: 0,
          values: (origin.values as object) ?? {},
          kind: "VITE_SPA",
          entryRoute: origin.entryRoute ?? null,
        });
        revalidatePath(`/w/${slug}/lps`);
        return { ok: true, data: { id: viteCopy.id } };
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
      folderId: string | null;
      kind: string;
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
          folderId: lp.folderId,
          kind: lp.kind,
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
    kind: string;
    entryRoute: string | null;
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
          kind: lp.kind,
          entryRoute: lp.entryRoute ?? null,
        },
      };
    });
  } catch {
    return { ok: false, error: "Failed to load landing page. Please try again." };
  }
}

// -----------------------------------------------------------------------
// requestPresignedUploadAction (Plan 03 — AST-01, D-01, D-02, D-03)
// -----------------------------------------------------------------------

/**
 * Generate a presigned PUT URL for direct-to-S3 image upload.
 *
 * Security (T-04-03-01 through T-04-03-06):
 * - Server-side magic-bytes validation via file-type (D-03).
 *   Client MIME type string is untrusted; only the actual byte signature matters.
 * - Server-side file size cap (D-03): files > 5 MB are rejected before presigning.
 * - Tenant-scoped S3 key (D-01): path uses workspaceId from session — never from client.
 * - S3 PUT URL restricted to one specific key; expires in 1 hour (T-04-03-02).
 * - App server only receives firstBytes (4100 bytes) + metadata — full image bytes
 *   go directly to S3 via the presigned URL (D-02, T-04-03-05).
 */
export async function requestPresignedUploadAction(
  slug: string,
  input: {
    filename: string;
    contentType: string;
    fileSize: number;
    firstBytes: number[];
  }
): Promise<ActionResult<{ presignedUrl: string; publicUrl: string; key: string }>> {
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // Server-side file size cap (D-03) — guards against bloated uploads
  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
  if (input.fileSize > MAX_BYTES) {
    return {
      ok: false,
      error: "File exceeds the 5 MB limit. Compress or resize the image and try again.",
    };
  }

  // Magic-bytes validation (D-03) — ESM dynamic import required for file-type
  try {
    const { fileTypeFromBuffer } = await import("file-type");
    const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
    const detected = await fileTypeFromBuffer(new Uint8Array(input.firstBytes));
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
      return {
        ok: false,
        error: "File does not appear to be a valid image. Try a different file.",
      };
    }

    // Tenant-scoped S3 key (D-01): workspaceId from session, UUID filename — no client input
    const ext = detected.ext;
    const key = `workspaces/${ctx.workspaceId}/lps/assets/${crypto.randomUUID()}.${ext}`;

    // Build presigned PUT URL (expires 1 hour; Content-Type is signable header to prevent MIME swap)
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      ContentType: input.contentType,
      ContentLength: input.fileSize,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
      signableHeaders: new Set(["content-type"]),
    });

    const publicUrl = `${process.env.S3_PUBLIC_BASE_URL}/${key}`;

    return { ok: true, data: { presignedUrl, publicUrl, key } };
  } catch {
    return { ok: false, error: "Failed to prepare upload. Try again." };
  }
}

// -----------------------------------------------------------------------
// validateUploadedImageAction (Plan 03 — D-03 pixel cap, T-04-03-01)
// -----------------------------------------------------------------------

/**
 * Validate an already-uploaded S3 object's pixel dimensions.
 *
 * After the browser PUTs to S3 via the presigned URL, the client calls this
 * action to enforce the server-side pixel cap (5000×5000 px). If the image
 * exceeds the cap, the S3 object is deleted before returning the error.
 *
 * Implementation:
 * - Ranged GET of bytes 0-65535 (enough for JPEG/PNG/WEBP header to read dimensions).
 * - image-size is synchronous; no full-download required.
 * - DeleteObjectCommand issued immediately if cap exceeded (T-04-03-01).
 */
export async function validateUploadedImageAction(
  slug: string,
  input: { key: string }
): Promise<ActionResult<{ width: number; height: number }>> {
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // CR-01: never act on a client-supplied S3 key without verifying it belongs to
  // the caller's workspace. Without this guard an editor in workspace A could pass
  // any other tenant's key and force its deletion (cross-tenant delete/DoS).
  const expectedPrefix = `workspaces/${ctx.workspaceId}/lps/assets/`;
  if (!input.key.startsWith(expectedPrefix)) {
    return { ok: false, error: "Invalid object key." };
  }

  try {
    // Ranged GET — only fetch the image header bytes (first 64 KB)
    const s3Cmd = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: input.key,
      Range: "bytes=0-65535",
    });

    const response = await s3Client.send(s3Cmd);
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // image-size is synchronous — reads dimensions from the header bytes
    const dims = imageSize(buffer);

    const MAX_PX = 5000;
    if (
      !dims ||
      dims.width == null ||
      dims.height == null ||
      dims.width > MAX_PX ||
      dims.height > MAX_PX
    ) {
      // Delete the S3 object to enforce the pixel cap (T-04-03-01)
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: input.key,
        })
      );
      return {
        ok: false,
        error: `Image dimensions exceed the ${MAX_PX}×${MAX_PX} px limit. Resize the image and try again.`,
      };
    }

    return { ok: true, data: { width: dims.width!, height: dims.height! } };
  } catch {
    return {
      ok: false,
      error: "Could not validate image dimensions. Try again.",
    };
  }
}
