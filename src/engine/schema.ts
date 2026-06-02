import { z } from 'zod';

export const FieldTypeSchema = z.enum(['text', 'richtext', 'image', 'color', 'button', 'repeater']);

export const TokenFieldSchema = z.object({
  name: z.string(),           // ex: "hero_titulo"
  type: FieldTypeSchema,      // tipo detectado
  repeater: z.string().nullable(), // nome do repeater pai, ou null para campos top-level
  global: z.boolean(),        // true se brand.*
});

export const ParseWarningSchema = z.object({
  token: z.string(),
  message: z.string(),
});

export const ParsedSchemaSchema = z.object({
  fields: z.array(TokenFieldSchema),
  repeaters: z.array(z.string()),  // nomes únicos de repeaters encontrados
  globals: z.array(z.string()),    // nomes de tokens brand.* (sem o prefixo "brand.")
  warnings: z.array(ParseWarningSchema),
});

export type FieldType = z.infer<typeof FieldTypeSchema>;
export type TokenField = z.infer<typeof TokenFieldSchema>;
export type ParsedSchema = z.infer<typeof ParsedSchemaSchema>;
export type ParseWarning = z.infer<typeof ParseWarningSchema>;
