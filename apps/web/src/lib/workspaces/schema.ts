/**
 * Zod schemas for workspace input validation.
 *
 * These schemas are the contract between the UI forms/Server Actions and the
 * underlying data layer. All workspace mutation inputs are validated here
 * before reaching the database.
 *
 * Security: workspaceId never comes from client payload — it is derived from
 * the server session and validated against membership (D-12, T-02-02-04).
 */
import { z } from "zod";

// -----------------------------------------------------------------------
// Workspace creation schema
// -----------------------------------------------------------------------

export const CreateWorkspaceSchema = z.object({
  /** Human-readable display name, 1-64 characters. */
  name: z
    .string()
    .min(1, "Workspace name is required")
    .max(64, "Workspace name must be 64 characters or less")
    .trim(),

  /**
   * URL-safe slug used in `/w/{slug}` routing.
   * Lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen.
   * Must be 2-48 characters.
   */
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(48, "Slug must be 48 characters or less")
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
      "Slug must contain only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen"
    ),
});

export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;

// -----------------------------------------------------------------------
// Workspace update schema
// -----------------------------------------------------------------------

export const UpdateWorkspaceSchema = z.object({
  name: z
    .string()
    .min(1, "Workspace name is required")
    .max(64, "Workspace name must be 64 characters or less")
    .trim()
    .optional(),

  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(48, "Slug must be 48 characters or less")
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
      "Slug must contain only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen"
    )
    .optional(),
});

export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>;
