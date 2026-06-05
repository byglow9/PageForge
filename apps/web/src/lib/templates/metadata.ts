/**
 * Metadata overlay reconciliation for template fields.
 *
 * The MetadataOverlay is an app-level overlay keyed by field name that carries
 * label (string) and required (boolean) per field (D-04). The engine ParsedSchema
 * stays pure and is never mutated — the overlay is stored separately.
 *
 * No "use server" — this is a pure utility module with no side effects.
 */
import type { TokenField } from "pageforge-engine";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

/**
 * Field-level authoring metadata stored alongside the engine's ParsedSchema.
 *
 * label: human-readable display name for the field in the generated form.
 * required: whether the field must be filled before a LP can be saved/generated.
 *
 * Per D-04: MetadataOverlay is defined as an app-level overlay keyed by field name,
 * carrying label (string) and required (boolean). The engine ParsedSchema stays
 * pure and is never mutated.
 */
export interface FieldMeta {
  label: string;
  required: boolean;
}

/**
 * Overlay mapping field names to their authoring metadata.
 * Only non-global fields appear in the overlay — brand.* tokens are excluded (D-05).
 */
export type MetadataOverlay = Record<string, FieldMeta>;

// -----------------------------------------------------------------------
// reconcileMetadataOverlay
// -----------------------------------------------------------------------

/**
 * Reconcile a MetadataOverlay against a new set of parsed token fields.
 *
 * Algorithm (D-05):
 * - For each field in the new schema:
 *   - If field.global === true: skip (brand.* tokens must not appear in overlay)
 *   - If field.name exists in existing overlay: preserve the existing FieldMeta
 *   - Otherwise: create a default (label = field.name, required = false)
 * - Fields that were in the existing overlay but are no longer in the new
 *   schema are implicitly dropped (not carried over).
 *
 * @param fields   - The new set of TokenField[] from the engine's ParsedSchema.
 * @param existing - The current MetadataOverlay to reconcile against.
 * @returns A new MetadataOverlay aligned with the current field set.
 */
export function reconcileMetadataOverlay(
  fields: TokenField[],
  existing: MetadataOverlay
): MetadataOverlay {
  const result: MetadataOverlay = {};

  for (const field of fields) {
    // D-05: brand.* global fields must not appear in the overlay
    if (field.global) {
      continue;
    }

    // Preserve existing metadata if the field is still present (matched by name).
    // Create a default entry (label = field.name, required = false) for new fields.
    result[field.name] = existing[field.name] ?? {
      label: field.name,
      required: false,
    };
  }

  return result;
}
