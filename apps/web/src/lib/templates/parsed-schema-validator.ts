/**
 * Local Zod validator for ParsedSchema stored in the DB (jsonb column).
 *
 * This is intentionally a copy of the engine's ParsedSchemaSchema because:
 * 1. The engine's schema.ts is not exported from pageforge-engine's public API
 *    (its index.ts only exports types, not the runtime Zod schemas) to avoid
 *    bundling engine internals into Next.js client components.
 * 2. This validator is used only on the server (Server Actions, RSC pages) to
 *    validate JSON read from the DB before using it — never exported to the client.
 *
 * KEEP IN SYNC with src/engine/schema.ts (FieldTypeSchema, TokenFieldSchema,
 * ParseWarningSchema, ParsedSchemaSchema). If the engine schema changes, this
 * file must be updated accordingly.
 *
 * Usage:
 *   import { ParsedSchemaValidator } from "./parsed-schema-validator";
 *   const result = ParsedSchemaValidator.safeParse(template.schema);
 *   if (result.success) { const fields = result.data.fields; }
 */
import { z } from "zod";

export const FieldTypeValidator = z.enum([
  "text",
  "richtext",
  "image",
  "color",
  "button",
  "repeater",
]);

export const TokenFieldValidator = z.object({
  name: z.string(),
  type: FieldTypeValidator,
  repeater: z.string().nullable(),
  global: z.boolean(),
});

export const ParseWarningValidator = z.object({
  token: z.string(),
  message: z.string(),
});

/**
 * Validates the JSON stored in template.schema (jsonb column) when reading from DB.
 * Use .safeParse() to gracefully handle schema drift across schema_versions.
 *
 * RESEARCH Anti-Pattern: Never cast template.schema as ParsedSchema directly —
 * the DB stores arbitrary JSON; always validate first.
 */
export const ParsedSchemaValidator = z.object({
  fields: z.array(TokenFieldValidator),
  repeaters: z.array(z.string()),
  globals: z.array(z.string()),
  warnings: z.array(ParseWarningValidator),
});

export type ValidatedParsedSchema = z.infer<typeof ParsedSchemaValidator>;
