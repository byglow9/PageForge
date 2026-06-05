/**
 * Unit tests for reconcileMetadataOverlay (D-05).
 *
 * reconcileMetadataOverlay is a pure function with no DB or server dependencies,
 * so no mocking is needed.
 *
 * Tests verify all four behaviors specified in D-05:
 * 1. Keeps metadata for fields that still exist (matched by name)
 * 2. Drops metadata for fields that are no longer in the new schema
 * 3. Creates default entries (label = field.name, required = false) for new fields
 * 4. Excludes brand.* global fields (field.global === true) from the overlay
 */

import { describe, it, expect } from "vitest";
import {
  reconcileMetadataOverlay,
  type FieldMeta,
  type MetadataOverlay,
} from "@/lib/templates/metadata";
import type { TokenField } from "pageforge-engine";

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function makeField(
  name: string,
  options: { global?: boolean; repeater?: string | null } = {}
): TokenField {
  return {
    name,
    type: "text",
    repeater: options.repeater ?? null,
    global: options.global ?? false,
  };
}

// -----------------------------------------------------------------------
// reconcileMetadataOverlay (D-05)
// -----------------------------------------------------------------------

describe("reconcileMetadataOverlay (D-05)", () => {
  it("creates defaults (label = field.name, required = false) for new fields", () => {
    const fields: TokenField[] = [
      makeField("hero_titulo"),
      makeField("hero_subtitulo"),
    ];
    const existing: MetadataOverlay = {};

    const result = reconcileMetadataOverlay(fields, existing);

    expect(result).toEqual({
      hero_titulo: { label: "hero_titulo", required: false },
      hero_subtitulo: { label: "hero_subtitulo", required: false },
    });
  });

  it("keeps metadata for fields that still exist (matched by name)", () => {
    const fields: TokenField[] = [
      makeField("hero_titulo"),
      makeField("hero_subtitulo"),
    ];
    const existing: MetadataOverlay = {
      hero_titulo: { label: "Título do Hero", required: true },
      hero_subtitulo: { label: "Subtítulo", required: false },
    };

    const result = reconcileMetadataOverlay(fields, existing);

    // Existing metadata is preserved exactly
    expect(result["hero_titulo"]).toEqual({ label: "Título do Hero", required: true });
    expect(result["hero_subtitulo"]).toEqual({ label: "Subtítulo", required: false });
  });

  it("drops metadata for fields removed from the new schema", () => {
    const fields: TokenField[] = [
      makeField("hero_titulo"),
      // hero_subtitulo is no longer in the schema
    ];
    const existing: MetadataOverlay = {
      hero_titulo: { label: "Título do Hero", required: true },
      hero_subtitulo: { label: "Subtítulo removido", required: false },
    };

    const result = reconcileMetadataOverlay(fields, existing);

    // hero_subtitulo must be dropped (not carried over)
    expect(result["hero_titulo"]).toEqual({ label: "Título do Hero", required: true });
    expect(result["hero_subtitulo"]).toBeUndefined();
    expect(Object.keys(result)).toHaveLength(1);
  });

  it("excludes brand.* global fields (field.global === true)", () => {
    const fields: TokenField[] = [
      makeField("hero_titulo"),
      makeField("brand.logo", { global: true }),
      makeField("brand.cor_primaria", { global: true }),
      makeField("hero_subtitulo"),
    ];
    const existing: MetadataOverlay = {};

    const result = reconcileMetadataOverlay(fields, existing);

    // Only non-global fields appear in the overlay
    expect(result["hero_titulo"]).toBeDefined();
    expect(result["hero_subtitulo"]).toBeDefined();
    expect(result["brand.logo"]).toBeUndefined();
    expect(result["brand.cor_primaria"]).toBeUndefined();
    expect(Object.keys(result)).toHaveLength(2);
  });
});
