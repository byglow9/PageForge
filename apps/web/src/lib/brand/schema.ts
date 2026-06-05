/**
 * Zod schemas for brand config input validation.
 *
 * All brand config mutation inputs are validated here before reaching the database.
 *
 * Security:
 * - primaryColor validated against /^#[0-9a-fA-F]{6}$/ to prevent CSS injection
 *   (T-03-01-04: stored color value is safe; Phase 4 must also sanitize before LP HTML injection).
 * - logoUrl must start with https:// to prevent open redirect via http:// URLs
 *   (T-03-01-05: scheme validation at server action boundary).
 *
 * Per D-06: required (boolean) is the only field-level validation beyond type in v1.
 */
import { z } from "zod";

// -----------------------------------------------------------------------
// SaveBrandConfigSchema
// -----------------------------------------------------------------------

export const SaveBrandConfigSchema = z.object({
  /**
   * Workspace logo URL. Must use https:// scheme to prevent insecure content.
   * Optional — accepts an empty string (field cleared) or a valid https:// URL.
   * T-03-01-05: logoUrl must start with https:// to prevent open redirect.
   */
  logoUrl: z
    .string()
    .url("Enter a valid URL")
    .startsWith("https://", "URL must start with https://")
    .optional()
    .or(z.literal("")),

  /**
   * Primary brand color as a 6-digit hex string (e.g. #0f172a).
   * T-03-01-04: regex prevents CSS injection via malformed color strings.
   * Optional — accepts an empty string (field cleared) or a valid hex color.
   */
  primaryColor: z
    .string()
    .regex(
      /^#[0-9a-fA-F]{6}$/,
      "Enter a valid 6-digit hex color (e.g. #0f172a)"
    )
    .optional()
    .or(z.literal("")),

  /**
   * WhatsApp contact number (international format recommended).
   * Max 32 characters. Optional — used in brand.* token substitution.
   */
  whatsapp: z
    .string()
    .max(32, "WhatsApp number must be 32 characters or less")
    .optional(),
});

export type SaveBrandConfigInput = z.infer<typeof SaveBrandConfigSchema>;
