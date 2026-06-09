/**
 * Dynamic Zod schema derivation for LP forms.
 *
 * No "use server" directive — this is a pure utility module with no side effects.
 * It can be imported in both Server Components (RSC) and Client Components.
 *
 * Usage: derive a ZodObject from the stored ParsedSchema.fields + MetadataOverlay,
 * then pass it to zodResolver(deriveZodSchema(fields, overlay)) in LpForm.
 */
import { z } from "zod";
import type { TokenField } from "pageforge-engine";
import type { MetadataOverlay } from "@/lib/templates/metadata";

/**
 * Derive a Zod schema from ParsedSchema fields + MetadataOverlay.
 * Used as the resolver for React Hook Form in LpForm.
 *
 * Field types → Zod shapes:
 *  - text       → z.string()
 *  - richtext   → z.string() (HTML from Tiptap)
 *  - image      → z.string().url() (S3 URL after upload) — optional unless required
 *  - color      → z.string().regex(/^#[0-9a-fA-F]{6}$/)
 *  - button     → z.object({ label: z.string(), url: z.string().url() })
 *  - repeater   → z.array(z.object({ ...itemFields }))
 *  - global     → excluded (pre-bound to brand config, not user-editable)
 */
export function deriveZodSchema(
  fields: TokenField[],
  overlay: MetadataOverlay
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): z.ZodObject<any> {
  // Use a plain Record accumulator (mutable); cast to the correct type when calling z.object()
  const shape: Record<string, z.ZodTypeAny> = {};

  const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

  // Top-level non-repeater, non-global fields
  for (const field of fields) {
    if (field.global || field.repeater) continue;

    const meta = overlay[field.name] ?? { label: field.name, required: false };
    let fieldSchema: z.ZodTypeAny;

    if (field.type === "text") {
      fieldSchema = meta.required
        ? z.string().min(1, "This field is required.")
        : z.string();
    } else if (field.type === "richtext") {
      // Tiptap outputs HTML; treat as string
      fieldSchema = meta.required
        ? z.string().min(1, "This field is required.")
        : z.string();
    } else if (field.type === "image") {
      // After upload, field value = the S3 public URL
      fieldSchema = meta.required
        ? z.string().url("Enter a valid image URL.")
        : z.string().url("Enter a valid image URL.").or(z.literal(""));
    } else if (field.type === "color") {
      fieldSchema = meta.required
        ? z.string().regex(HEX_REGEX, "Enter a valid hex color (e.g. #0f172a).")
        : z
            .string()
            .regex(HEX_REGEX, "Enter a valid hex color (e.g. #0f172a).")
            .or(z.literal(""));
    } else if (field.type === "button") {
      fieldSchema = z.object({
        label: meta.required
          ? z.string().min(1, "This field is required.")
          : z.string(),
        url: z
          .string()
          .url("Enter a valid URL starting with https://.")
          .or(z.literal("")),
      });
    } else {
      // Fallback for unknown types — accept any string
      fieldSchema = z.string();
    }

    shape[field.name] = fieldSchema;
  }

  // Repeater blocks → z.array(z.object({...itemShape}))
  const repeaterNames = [
    ...new Set(
      fields
        .filter((f) => f.repeater !== undefined && f.repeater !== null)
        .map((f) => f.repeater as string)
    ),
  ];

  for (const repeaterName of repeaterNames) {
    const itemFields = fields.filter((f) => f.repeater === repeaterName);
    const itemShape: Record<string, z.ZodTypeAny> = {};

    for (const f of itemFields) {
      const meta = overlay[f.name] ?? { label: f.name, required: false };
      // Apply same type logic for repeater item fields
      if (f.type === "image") {
        itemShape[f.name] = meta.required
          ? z.string().url("Enter a valid image URL.")
          : z.string().url("Enter a valid image URL.").or(z.literal(""));
      } else if (f.type === "color") {
        const HEX = /^#[0-9a-fA-F]{6}$/;
        itemShape[f.name] = meta.required
          ? z.string().regex(HEX, "Enter a valid hex color (e.g. #0f172a).")
          : z
              .string()
              .regex(HEX, "Enter a valid hex color (e.g. #0f172a).")
              .or(z.literal(""));
      } else if (f.type === "button") {
        itemShape[f.name] = z.object({
          label: meta.required
            ? z.string().min(1, "This field is required.")
            : z.string(),
          url: z
            .string()
            .url("Enter a valid URL starting with https://.")
            .or(z.literal("")),
        });
      } else {
        // text, richtext, and unknown types
        itemShape[f.name] = meta.required
          ? z.string().min(1, "This field is required.")
          : z.string();
      }
    }

    shape[repeaterName] = z.array(z.object(itemShape));
  }

  return z.object(shape);
}
