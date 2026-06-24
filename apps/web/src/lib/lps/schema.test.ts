/**
 * Unit tests for Phase 9 override Zod schemas.
 *
 * Covers:
 * - PfOverrideSchema: individual override entry validation
 * - ViteSpaValuesSchema: full values blob for VITE_SPA LPs
 * - SaveViteSpaOverridesSchema: action payload for updateLpAction
 */
import { describe, it, expect } from "vitest";
import {
  PfOverrideSchema,
  ViteSpaValuesSchema,
  SaveViteSpaOverridesSchema,
} from "./schema";

// -----------------------------------------------------------------------
// PfOverrideSchema
// -----------------------------------------------------------------------

describe("PfOverrideSchema", () => {
  it("parses a valid text override", () => {
    const result = PfOverrideSchema.parse({
      path: "/0/2/1",
      originalHash: "abc",
      type: "text",
      value: "Olá",
    });
    expect(result.path).toBe("/0/2/1");
    expect(result.type).toBe("text");
    expect(result.value).toBe("Olá");
  });

  it("parses a valid image override (enum value accepted even if shim skips it)", () => {
    const result = PfOverrideSchema.parse({
      path: "/0",
      originalHash: "abc",
      type: "image",
      value: "https://x",
    });
    expect(result.type).toBe("image");
  });

  it("rejects an invalid type enum value", () => {
    const result = PfOverrideSchema.safeParse({
      path: "/0",
      originalHash: "abc",
      type: "invalid",
      value: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty path (min(1) constraint)", () => {
    const result = PfOverrideSchema.safeParse({
      path: "",
      originalHash: "abc",
      type: "text",
      value: "x",
    });
    expect(result.success).toBe(false);
  });
});

// -----------------------------------------------------------------------
// ViteSpaValuesSchema
// -----------------------------------------------------------------------

describe("ViteSpaValuesSchema", () => {
  it("parses { overrides: [] } — primaryColorOverride is optional", () => {
    const result = ViteSpaValuesSchema.parse({ overrides: [] });
    expect(result.overrides).toEqual([]);
    expect(result.primaryColorOverride).toBeUndefined();
  });

  it("parses overrides array with a valid hex primaryColorOverride", () => {
    const result = ViteSpaValuesSchema.parse({
      overrides: [],
      primaryColorOverride: "#ff0000",
    });
    expect(result.primaryColorOverride).toBe("#ff0000");
  });

  it("rejects primaryColorOverride that is not a hex string", () => {
    const result = ViteSpaValuesSchema.safeParse({
      overrides: [],
      primaryColorOverride: "red",
    });
    expect(result.success).toBe(false);
  });

  it("parses {} (sentinel case for fresh VITE_SPA LP) with overrides defaulting to []", () => {
    const result = ViteSpaValuesSchema.parse({});
    expect(result.overrides).toEqual([]);
  });
});

// -----------------------------------------------------------------------
// SaveViteSpaOverridesSchema
// -----------------------------------------------------------------------

describe("SaveViteSpaOverridesSchema", () => {
  it("parses a valid payload with id and empty overrides array", () => {
    const result = SaveViteSpaOverridesSchema.parse({
      id: "cm1234567890abcdefghi",
      overrides: [],
    });
    expect(result.id).toBe("cm1234567890abcdefghi");
    expect(result.overrides).toEqual([]);
  });

  it("parses a payload with only id and primaryColorOverride (overrides optional)", () => {
    const result = SaveViteSpaOverridesSchema.parse({
      id: "cm1234567890abcdefghi",
      primaryColorOverride: "#ff0000",
    });
    expect(result.primaryColorOverride).toBe("#ff0000");
    expect(result.overrides).toBeUndefined();
  });

  it("parses a payload with only id (no mandatory overrides field)", () => {
    const result = SaveViteSpaOverridesSchema.parse({
      id: "cm1234567890abcdefghi",
    });
    expect(result.overrides).toBeUndefined();
  });

  it("rejects an invalid LP ID (not a cuid)", () => {
    const result = SaveViteSpaOverridesSchema.safeParse({
      id: "not-a-cuid",
    });
    expect(result.success).toBe(false);
  });
});
