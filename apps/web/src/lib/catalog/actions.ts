/**
 * Catalog Server Actions — folder CRUD (CAT-02), LP move, tag management (CAT-03).
 *
 * All mutations require an authenticated workspace member with role
 * owner, admin, or editor. workspaceId is always derived from the
 * server session via requireWorkspaceRole — never from client input (T-05-01-01).
 *
 * Security (T-05-01-01 through T-05-01-07):
 * - workspaceId always from requireWorkspaceRole (session-backed).
 * - findById always filters by workspaceId — cross-workspace IDs return null.
 * - viewer role cannot mutate folders/tags/move LPs (requires owner/admin/editor, T-05-01-05).
 * - deleteFolderAction: non-destructive (D-03) — re-parents LPs and subfolders to root
 *   before deleting the folder row (T-05-01-03).
 * - moveLpAction: validates both lpId and folderId against the workspace (T-05-01-02).
 * - setTagsForLpAction: normalizes tag names + caps at 10/LP (T-05-01-07, D-07).
 *
 * Pattern: mirrors lib/lps/actions.ts exactly.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceRole, requireWorkspace } from "@/lib/workspaces/guards";
import { withTenantDb } from "@/lib/db/tenant-db";
import { prisma } from "@/lib/db/prisma";
import {
  CreateFolderSchema,
  RenameFolderSchema,
  DeleteFolderSchema,
  MoveLpSchema,
  SetTagsSchema,
} from "./schema";
import type { ActionResult } from "@/lib/workspaces/actions";
import type { FolderModel as Folder, TagModel as Tag } from "@/generated/prisma/models";

// -----------------------------------------------------------------------
// listFoldersAction
// -----------------------------------------------------------------------

/**
 * List all workspace folders as a flat adjacency list.
 * Tree assembly (parent/children nesting) is done client-side in FolderTree.
 *
 * Any workspace member (including viewers) can list folders.
 */
export async function listFoldersAction(
  slug: string
): Promise<ActionResult<Folder[]>> {
  const ctx = await requireWorkspace(slug);

  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      const folders = await db.folder.list();
      return { ok: true, data: folders };
    });
  } catch {
    return { ok: false, error: "Failed to load folders. Please try again." };
  }
}

// -----------------------------------------------------------------------
// createFolderAction
// -----------------------------------------------------------------------

/**
 * Create a new folder in the workspace.
 *
 * @param slug - Workspace URL slug.
 * @param input - { name, parentId? } — parentId null = top-level (D-02).
 */
export async function createFolderAction(
  slug: string,
  input: { name: string; parentId?: string | null }
): Promise<ActionResult<{ id: string }>> {
  // Gate: owner/admin/editor only (T-05-01-05)
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // Validate
  const parsed = CreateFolderSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = fieldErrors[field] ?? [];
      fieldErrors[field].push(issue.message);
    }
    return { ok: false, error: "Validation failed", fieldErrors };
  }

  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      const folder = await db.folder.create({
        name: parsed.data.name,
        parentId: parsed.data.parentId ?? null,
      });
      revalidatePath(`/w/${slug}/lps`);
      return { ok: true, data: { id: folder.id } };
    });
  } catch {
    return { ok: false, error: "Failed to create folder. Please try again." };
  }
}

// -----------------------------------------------------------------------
// renameFolderAction
// -----------------------------------------------------------------------

/**
 * Rename an existing folder.
 *
 * @param slug - Workspace URL slug.
 * @param input - { folderId, name }.
 */
export async function renameFolderAction(
  slug: string,
  input: { folderId: string; name: string }
): Promise<ActionResult<{ id: string }>> {
  // Gate: owner/admin/editor only (T-05-01-05)
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // Validate
  const parsed = RenameFolderSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = fieldErrors[field] ?? [];
      fieldErrors[field].push(issue.message);
    }
    return { ok: false, error: "Validation failed", fieldErrors };
  }

  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      // Confirm folder belongs to this workspace (T-05-01-01)
      const existing = await db.folder.findById(parsed.data.folderId);
      if (!existing) {
        return { ok: false, error: "Folder not found in this workspace." };
      }

      const updated = await db.folder.update(parsed.data.folderId, {
        name: parsed.data.name,
      });
      revalidatePath(`/w/${slug}/lps`);
      return { ok: true, data: { id: updated.id } };
    });
  } catch {
    return { ok: false, error: "Failed to rename folder. Please try again." };
  }
}

// -----------------------------------------------------------------------
// deleteFolderAction
// -----------------------------------------------------------------------

/**
 * Delete a folder non-destructively (D-03).
 *
 * Before deleting the folder row, re-parents:
 * 1. All direct child LPs (folderId → null).
 * 2. All direct child Folders (parentId → null).
 *
 * This is done inside the same withTenantDb transaction using $executeRaw
 * for the batch updates to keep it atomic (T-05-01-03).
 *
 * @param slug - Workspace URL slug.
 * @param input - { folderId }.
 */
export async function deleteFolderAction(
  slug: string,
  input: { folderId: string }
): Promise<ActionResult> {
  // Gate: owner/admin/editor only (T-05-01-05)
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // Validate
  const parsed = DeleteFolderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  const { folderId } = parsed.data;
  const { workspaceId } = ctx;

  try {
    // Non-destructive delete: re-parent LPs and subfolders to root in same tx, then delete folder.
    // Use a raw Prisma $transaction to run the batch re-parenting + delete atomically (T-05-01-03, D-03).
    await prisma.$transaction(async (tx) => {
      // Set the RLS transaction-local workspace ID
      await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${workspaceId}, true)`;

      // Confirm folder belongs to this workspace before deleting (T-05-01-01)
      const existing = await tx.folder.findFirst({
        where: { id: folderId, workspaceId },
      });
      if (!existing) {
        throw new Error("FOLDER_NOT_FOUND");
      }

      // 1. Re-parent direct child LPs to root (folderId → null) — D-03
      await tx.$executeRaw`
        UPDATE landing_page
        SET folder_id = NULL
        WHERE workspace_id = ${workspaceId}
          AND folder_id = ${folderId}
      `;

      // 2. Re-parent direct child Folders to root (parentId → null) — D-03
      await tx.$executeRaw`
        UPDATE folder
        SET parent_id = NULL
        WHERE workspace_id = ${workspaceId}
          AND parent_id = ${folderId}
      `;

      // 3. Delete the folder row
      await tx.folder.delete({
        where: { id: folderId, workspaceId },
      });
    });

    revalidatePath(`/w/${slug}/lps`);
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "FOLDER_NOT_FOUND") {
      return { ok: false, error: "Folder not found in this workspace." };
    }
    return { ok: false, error: "Failed to delete folder. Please try again." };
  }
}

// -----------------------------------------------------------------------
// moveLpAction
// -----------------------------------------------------------------------

/**
 * Move an LP to a folder (or back to root).
 *
 * @param slug - Workspace URL slug.
 * @param input - { lpId, folderId } — folderId null = move to root (D-01).
 */
export async function moveLpAction(
  slug: string,
  input: { lpId: string; folderId: string | null }
): Promise<ActionResult<{ id: string; folderName: string | null }>> {
  // Gate: owner/admin/editor only (T-05-01-05)
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // Validate (T-05-01-02)
  const parsed = MoveLpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      // Confirm LP belongs to this workspace (T-05-01-02)
      const lp = await db.lp.findById(parsed.data.lpId);
      if (!lp) {
        return { ok: false, error: "Landing page not found in this workspace." };
      }

      // Confirm target folder belongs to this workspace (T-05-01-02)
      let folderName: string | null = null;
      if (parsed.data.folderId !== null) {
        const folder = await db.folder.findById(parsed.data.folderId);
        if (!folder) {
          return { ok: false, error: "Folder not found in this workspace." };
        }
        folderName = folder.name;
      }

      // Update the LP's folderId (null = root, D-01)
      const updated = await db.lp.update(parsed.data.lpId, {
        folderId: parsed.data.folderId,
      });

      revalidatePath(`/w/${slug}/lps`);
      return { ok: true, data: { id: updated.id, folderName } };
    });
  } catch {
    return { ok: false, error: "Failed to move landing page. Please try again." };
  }
}

// -----------------------------------------------------------------------
// setTagsForLpAction
// -----------------------------------------------------------------------

/**
 * Replace all tags on an LP with the provided tag names.
 *
 * Tag names are normalized (trim + toLowerCase) and deduplicated before upsert.
 * D-07: max 10 tags per LP; max 32 chars per tag.
 * T-05-01-07: tags rendered as React text nodes (not dangerouslySetInnerHTML).
 *
 * @param slug - Workspace URL slug.
 * @param input - { lpId, tagNames[] }.
 */
export async function setTagsForLpAction(
  slug: string,
  input: { lpId: string; tagNames: string[] }
): Promise<ActionResult<{ tagIds: string[] }>> {
  // Gate: owner/admin/editor only (T-05-01-05)
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // Validate (D-07)
  const parsed = SetTagsSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = fieldErrors[field] ?? [];
      fieldErrors[field].push(issue.message);
    }
    return { ok: false, error: "Validation failed", fieldErrors };
  }

  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      // Confirm LP belongs to this workspace
      const lp = await db.lp.findById(parsed.data.lpId);
      if (!lp) {
        return { ok: false, error: "Landing page not found in this workspace." };
      }

      // Normalize tag names: trim + toLowerCase + unique (D-07)
      const uniqueNormalizedNames = [
        ...new Set(parsed.data.tagNames.map((n) => n.trim().toLowerCase()).filter((n) => n.length > 0)),
      ];

      // Upsert each tag by normalized name; collect tagIds
      const tagIds: string[] = [];
      for (const name of uniqueNormalizedNames) {
        const tag = await db.tag.upsertByName(name);
        tagIds.push(tag.id);
      }

      // Replace all LP tags atomically (delete+insert)
      await db.tag.setTagsForLp(parsed.data.lpId, tagIds);

      revalidatePath(`/w/${slug}/lps`);
      return { ok: true, data: { tagIds } };
    });
  } catch {
    return { ok: false, error: "Failed to save tags. Please try again." };
  }
}

// -----------------------------------------------------------------------
// listTagsForLpAction
// -----------------------------------------------------------------------

/**
 * List all tags assigned to a single LP.
 *
 * Any workspace member can list LP tags.
 *
 * @param slug - Workspace URL slug.
 * @param lpId - The landing page ID.
 */
export async function listTagsForLpAction(
  slug: string,
  lpId: string
): Promise<ActionResult<Tag[]>> {
  const ctx = await requireWorkspace(slug);

  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      const tags = await db.tag.listForLp(lpId);
      return { ok: true, data: tags };
    });
  } catch {
    return { ok: false, error: "Failed to load tags. Please try again." };
  }
}

// -----------------------------------------------------------------------
// listWorkspaceTagsAction
// -----------------------------------------------------------------------

/**
 * List all tags in the workspace vocabulary (for FilterBar pills).
 *
 * Any workspace member can list workspace tags (D-05/D-06).
 *
 * @param slug - Workspace URL slug.
 */
export async function listWorkspaceTagsAction(
  slug: string
): Promise<ActionResult<Tag[]>> {
  const ctx = await requireWorkspace(slug);

  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      const tags = await db.tag.listWorkspaceTags();
      return { ok: true, data: tags };
    });
  } catch {
    return { ok: false, error: "Failed to load tags. Please try again." };
  }
}

// -----------------------------------------------------------------------
// listAllLpTagsForWorkspaceAction
// -----------------------------------------------------------------------

/**
 * Load all LP-tag assignments for the workspace in a single query.
 *
 * Returns a map of lpId → TagModel[] for efficient lookup by the catalog page
 * (avoids N+1 queries when rendering the LP grid with tag chips).
 *
 * T-05-02-05: Tags are workspace-level metadata; all workspace members have
 * lp.read; no PII exposed; scoped to workspaceId from session.
 *
 * @param slug - Workspace URL slug.
 */
export async function listAllLpTagsForWorkspaceAction(
  slug: string
): Promise<ActionResult<Record<string, Tag[]>>> {
  const ctx = await requireWorkspace(slug);

  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      // Load all lp_tag rows for the workspace including the tag relation.
      // This is a single query joining lp_tag + tag for the workspace.
      const lpTagsMap = await db.tag.listAllForWorkspace();

      // Group by lpId → TagModel[]
      const result: Record<string, Tag[]> = {};
      for (const { landingPageId, tag } of lpTagsMap) {
        if (!result[landingPageId]) {
          result[landingPageId] = [];
        }
        result[landingPageId].push(tag);
      }
      return { ok: true, data: result };
    });
  } catch {
    return { ok: false, error: "Failed to load tags. Please try again." };
  }
}
