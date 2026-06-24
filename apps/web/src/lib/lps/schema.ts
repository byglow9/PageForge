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

  /**
   * VITE_SPA only: SPA sub-route for the LP (e.g. '/grecia', '/turquia').
   * Normalized: empty string → null (root); missing slash → prepended.
   * null means root '/' — the VITE_SPA app entry point serves the full page.
   * D-08: T-08-01-02: validated max(128), Zod normalizes vazio→null.
   * Note: absent = field not included (no change on update); '' = clear to null.
   */
  entryRoute: z
    .string()
    .max(128, "Entry route must be 128 characters or less")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v !== undefined ? (v ? (v.startsWith("/") ? v : "/" + v) : null) : undefined))
    .optional(),
});

export type UpdateLpInput = z.infer<typeof UpdateLpSchema>;

// -----------------------------------------------------------------------
// GenerateViteSpaLpSchema
// -----------------------------------------------------------------------

/**
 * Input schema for generating a VITE_SPA landing page.
 *
 * VITE_SPA LPs differ from LIQUID LPs in that:
 * - values/markupSnapshot/schemaVersion are sentinel values (D-08)
 * - entryRoute specifies which SPA route to serve (null = root '/')
 *
 * entryRoute normalization:
 * - absent or empty string → null (root '/')
 * - string without leading '/' → '/' prepended (e.g. 'grecia' → '/grecia')
 * - valid path preserved as-is
 *
 * T-08-01-02: max(128) limits the path length; Zod handles normalization.
 * workspaceId is never in the payload — derived from server session (T-04-01-05).
 */
export const GenerateViteSpaLpSchema = z.object({
  /**
   * ID of the source VITE_SPA template.
   * VITE_SPA templates are created via project-template ingestion with an
   * explicit crypto.randomUUID() id (so the DB row id == S3 key prefix), so
   * this is a UUID — NOT a cuid like LIQUID templates. Using .cuid() here made
   * RHF's client-side resolver reject the UUID and silently block submit.
   */
  templateId: z.string().uuid("Invalid template ID"),

  /** User-provided LP name (D-11). */
  name: z
    .string()
    .min(1, "Landing page name is required")
    .max(128, "Landing page name must be 128 characters or less")
    .trim(),

  /**
   * SPA sub-route this LP maps to (e.g. '/grecia', '/turquia').
   * null/absent means root '/' — the SPA entry point.
   * Normalization: empty string → null; missing '/' prefix → '/' prepended.
   * default(null): absent field is treated as null (root route), not undefined.
   * T-08-01-02: max(128) limits path length.
   */
  entryRoute: z
    .string()
    .max(128, "Entry route must be 128 characters or less")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? (v.startsWith("/") ? v : "/" + v) : null))
    .nullable()
    .default(null),
});

export type GenerateViteSpaLpInput = z.infer<typeof GenerateViteSpaLpSchema>;

// -----------------------------------------------------------------------
// EditViteSpaLpSchema
// -----------------------------------------------------------------------

/**
 * Client-side RHF resolver schema for EDITING a VITE_SPA landing page.
 *
 * Edit mode never submits templateId (the LP already references its template),
 * so requiring it — as GenerateViteSpaLpSchema does — made the edit form's
 * resolver fail silently on an empty templateId and block "Save changes".
 * Here templateId is optional; only name + entryRoute are validated.
 * The actual persistence still goes through UpdateLpSchema in updateLpAction.
 */
export const EditViteSpaLpSchema = z.object({
  /** Optional in edit mode — kept only to match the form's field shape. */
  templateId: z.string().optional(),

  /** User-provided LP name (D-11). */
  name: z
    .string()
    .min(1, "Landing page name is required")
    .max(128, "Landing page name must be 128 characters or less")
    .trim(),

  /** SPA sub-route; empty → null (root). Same normalization as generate. */
  entryRoute: z
    .string()
    .max(128, "Entry route must be 128 characters or less")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? (v.startsWith("/") ? v : "/" + v) : null))
    .nullable()
    .default(null),
});

export type EditViteSpaLpInput = z.infer<typeof EditViteSpaLpSchema>;

// -----------------------------------------------------------------------
// PfOverrideSchema
// -----------------------------------------------------------------------

/**
 * Data model for a single runtime override entry.
 *
 * Stored inside LandingPage.values.overrides[] (jsonb — no migration required).
 * The shim in Plan 02 reads these entries after React mounts and applies them
 * to the DOM via textContent (text) or CSS var override (color).
 *
 * Fields:
 * - path: deterministic node path from the SPA root (e.g. '/0/2/1/0'). Used by
 *   the shim to locate the exact DOM node to override.
 * - originalHash: hash of the original node content. Stored for Phase 12 drift
 *   detection; NOT checked or enforced in this phase.
 * - type: override type enum. 'text' and 'color' are applied by the Phase 9 shim;
 *   'image' and 'href' are reserved for Phase 11 (enum already extensible).
 * - value: the override value (text: raw string applied via textContent; color:
 *   #RRGGBB hex validated separately; image/href: reserved).
 *
 * Security: value is applied via textContent only — no innerHTML vector.
 * Color values are further validated as #RRGGBB by the hex regex before DB write.
 */
export const PfOverrideSchema = z.object({
  /** Deterministic child-index path from root (e.g. '/0/2/1'). */
  path: z.string().min(1, "Override path must not be empty"),
  /** Hash of original node content (stored for Phase 12 drift detection). */
  originalHash: z.string().min(1, "Original hash must not be empty"),
  /** Override type. 'text' and 'color' are applied by Phase 9 shim. */
  type: z.enum(["text", "color", "image", "href"]),
  /** Override value (plain string — applied via textContent, never innerHTML). */
  value: z.string(),
});

export type PfOverride = z.infer<typeof PfOverrideSchema>;

// -----------------------------------------------------------------------
// ViteSpaValuesSchema
// -----------------------------------------------------------------------

/**
 * Full shape of LandingPage.values for VITE_SPA LPs.
 *
 * The jsonb field was previously unused (sentinel {}) for VITE_SPA LPs.
 * Phase 9 reuses it as-is to store overrides + optional per-LP brand color.
 * No DB migration is needed.
 *
 * IMPORTANT: Plan 02 reads raw lp.values WITHOUT parsing through this schema,
 * so the runtime guard in the shim injection code must NOT assume that
 * overrides exists (the sentinel {} case yields {} not { overrides: [] }).
 * Parse through this schema only when you control the write path.
 *
 * Fields:
 * - overrides: array of PfOverride entries; defaults to [] when parsing {} (sentinel case).
 * - primaryColorOverride: optional per-LP brand color that takes precedence over the
 *   workspace brand color in buildBrandStyleTagForLp.
 */
export const ViteSpaValuesSchema = z.object({
  /** Ordered list of content overrides applied by the shim after React mounts. */
  overrides: z.array(PfOverrideSchema).default([]),
  /**
   * Per-LP primary color override (#RRGGBB). Takes precedence over workspace
   * brand color when set. Absent = fall back to workspace color.
   */
  primaryColorOverride: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a #RRGGBB hex color")
    .optional(),
});

export type ViteSpaValues = z.infer<typeof ViteSpaValuesSchema>;

// -----------------------------------------------------------------------
// SaveViteSpaOverridesSchema
// -----------------------------------------------------------------------

/**
 * Payload accepted by updateLpAction for writing VITE_SPA overrides.
 *
 * This is the server-side validation gate (T-09-01-01): all fields are
 * validated here before any DB write. Absent optional fields mean
 * "do not touch existing value" — the action merges with the existing
 * LandingPage.values row rather than replacing the whole object.
 *
 * Fields:
 * - id: CUID of the LP to update (verified via withTenantDb — cross-tenant
 *   LP IDs return null/404 per T-09-01-02).
 * - overrides: optional array of PfOverride entries. Absent = preserve existing.
 * - primaryColorOverride: optional hex color. Absent = preserve existing.
 */
export const SaveViteSpaOverridesSchema = z.object({
  /** CUID of the landing page to update (T-09-01-02: scoped via withTenantDb). */
  id: z.string().cuid("Invalid LP ID"),
  /** New overrides list; absent = do not overwrite existing overrides. */
  overrides: z.array(PfOverrideSchema).optional(),
  /**
   * New per-LP primary color (#RRGGBB); absent = do not overwrite existing.
   * T-09-01-03: hex regex prevents CSS injection.
   */
  primaryColorOverride: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a #RRGGBB hex color")
    .optional(),
});

export type SaveViteSpaOverridesInput = z.infer<typeof SaveViteSpaOverridesSchema>;
