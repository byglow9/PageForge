/**
 * Zod schemas for project template (VITE_SPA) input validation.
 *
 * Project templates are different from LIQUID templates — their content comes
 * from a pre-built Vite dist/ ZIP, not from a markup string. The only user-
 * provided metadata is the template name.
 */
import { z } from "zod";

export const CreateProjectTemplateSchema = z.object({
  /** Human-readable template name, 1-128 characters. */
  name: z
    .string()
    .min(1, "Template name is required")
    .max(128, "Template name must be 128 characters or less")
    .trim(),
  // No markup field — project templates derive content from the ZIP dist/
});

export type CreateProjectTemplateInput = z.infer<typeof CreateProjectTemplateSchema>;
