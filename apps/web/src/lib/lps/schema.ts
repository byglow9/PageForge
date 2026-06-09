/**
 * Zod schemas for LP Server Action input validation.
 *
 * workspaceId is never in the payload — always derived from the server session
 * via requireWorkspace() or requireWorkspaceRole(). This is a hard security
 * requirement (T-04-01-05): never accept workspaceId from the client.
 *
 * Per D-06: required (boolean) is the only field-level validation beyond type
 * in v1; no regex or range validators are defined here. The dynamic per-field
 * Zod schema used by the RHF resolver lives in schema-derive.ts.
 */
import { z } from "zod";

// -----------------------------------------------------------------------
// GenerateLpSchema
// -----------------------------------------------------------------------

export const GenerateLpSchema = z.object({
  /** ID of the source template. */
  templateId: z.string().cuid("Invalid template ID"),

  /** User-provided LP name (D-11). */
  name: z
    .string()
    .min(1, "Landing page name is required")
    .max(128, "Landing page name must be 128 characters or less")
    .trim(),

  /**
   * Filled field values. Keys are field names; values are strings, objects
   * (button type), or arrays (repeater type). Validated at runtime by
   * deriveZodSchema in the form; here we only validate the outer container.
   */
  values: z.record(z.string(), z.unknown()),
});

export type GenerateLpInput = z.infer<typeof GenerateLpSchema>;

// -----------------------------------------------------------------------
// UpdateLpSchema
// -----------------------------------------------------------------------

export const UpdateLpSchema = z.object({
  /** Required: the LP ID to update. */
  id: z.string().cuid("Invalid LP ID"),

  /** New human-readable name (optional on update). */
  name: z.string().min(1).max(128).trim().optional(),

  /** Updated field values (optional on update). */
  values: z.record(z.string(), z.unknown()).optional(),

  /**
   * Updated markup snapshot (optional — only set when user applies a new template version, D-08).
   * When provided, schemaVersion should also be updated.
   */
  markupSnapshot: z.string().min(1).optional(),

  /**
   * Updated schema version (optional — only set alongside markupSnapshot on D-08 version pull).
   */
  schemaVersion: z.number().int().positive().optional(),
});

export type UpdateLpInput = z.infer<typeof UpdateLpSchema>;
