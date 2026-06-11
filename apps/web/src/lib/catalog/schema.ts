/**
 * Zod schemas for catalog Server Action input validation.
 *
 * Covers folder CRUD (CAT-02), LP move, and tag management (CAT-03).
 *
 * workspaceId is never in any payload — always derived from the server session
 * via requireWorkspace() or requireWorkspaceRole(). This is a hard security
 * requirement (T-05-01-01): never accept workspaceId from the client.
 *
 * Tag normalization (D-07): trim + case-insensitive (toLowerCase applied in
 * the action layer); max 32 chars per tag; max 10 tags per LP.
 */
import { z } from "zod";

// -----------------------------------------------------------------------
// CreateFolderSchema
// -----------------------------------------------------------------------

export const CreateFolderSchema = z.object({
  /** Folder display name — max 64 chars (enforced in Zod, not DB). */
  name: z
    .string()
    .trim()
    .min(1, "Folder name is required.")
    .max(64, "Folder name must be 64 characters or less."),
  /** Parent folder ID (null = top-level). */
  parentId: z.string().nullable().optional(),
});

export type CreateFolderInput = z.infer<typeof CreateFolderSchema>;

// -----------------------------------------------------------------------
// RenameFolderSchema
// -----------------------------------------------------------------------

export const RenameFolderSchema = z.object({
  /** ID of the folder to rename. */
  folderId: z.string().min(1),
  /** New display name — max 64 chars. */
  name: z
    .string()
    .trim()
    .min(1, "Folder name is required.")
    .max(64, "Folder name must be 64 characters or less."),
});

export type RenameFolderInput = z.infer<typeof RenameFolderSchema>;

// -----------------------------------------------------------------------
// DeleteFolderSchema
// -----------------------------------------------------------------------

export const DeleteFolderSchema = z.object({
  /** ID of the folder to delete. */
  folderId: z.string().min(1),
});

export type DeleteFolderInput = z.infer<typeof DeleteFolderSchema>;

// -----------------------------------------------------------------------
// MoveLpSchema
// -----------------------------------------------------------------------

export const MoveLpSchema = z.object({
  /** ID of the landing page to move. */
  lpId: z.string().min(1),
  /**
   * Target folder ID. null = move to root catalog (D-01).
   * folderId: null is a valid operation — it re-parents the LP to root.
   */
  folderId: z.string().nullable(),
});

export type MoveLpInput = z.infer<typeof MoveLpSchema>;

// -----------------------------------------------------------------------
// SetTagsSchema
// -----------------------------------------------------------------------

export const SetTagsSchema = z.object({
  /** ID of the landing page to tag. */
  lpId: z.string().min(1),
  /**
   * Tag names to assign. D-07: trimmed + max 32 chars each, max 10 tags.
   * Normalization to lowercase is done in the action layer (after dedup).
   */
  tagNames: z
    .array(
      z.string().trim().min(1, "Tag name cannot be empty.").max(32, "Tag name must be 32 characters or less.")
    )
    .max(10, "A landing page can have at most 10 tags."),
});

export type SetTagsInput = z.infer<typeof SetTagsSchema>;
