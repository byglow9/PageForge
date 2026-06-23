/**
 * Unit tests for brand/theme.ts and lps/schema.ts (VITE_SPA schemas)
 *
 * TDD — covers:
 * - hexToHslTriplet: hex→HSL conversion with reference values
 * - buildBrandStyleTag: CSS style tag builder with null/undefined guard
 * - injectBrandStyle: HTML injection helper with </head> and fallback paths
 * - GenerateViteSpaLpSchema: Zod schema behavior including entryRoute normalization
 * - UpdateLpSchema: entryRoute extension behavior
 */
import { describe, it, expect } from "vitest";
import { hexToHslTriplet, buildBrandStyleTag, injectBrandStyle } from "./theme";
import { GenerateViteSpaLpSchema, UpdateLpSchema } from "@/lib/lps/schema";

// -----------------------------------------------------------------------
// hexToHslTriplet
// -----------------------------------------------------------------------

describe("hexToHslTriplet", () => {
  it("converts #0d4080 → '213 82% 28%' (standard RGB→HSL algorithm output)", () => {
    // Note: renova-turismo index.css uses --primary: 213 90% 23% which was
    // hand-authored at #06356f, not derived from #0d4080. The correct conversion
    // of #0d4080 by the standard algorithm is 213 82% 28%.
    expect(hexToHslTriplet("#0d4080")).toBe("213 82% 28%");
  });

  it("converts #06356f → '213 90% 23%' (the actual renova-turismo brand color)", () => {
    // This is the hex value that the renova-turismo CSS --primary was designed for
    expect(hexToHslTriplet("#06356f")).toBe("213 90% 23%");
  });

  it("converts #ffffff → '0 0% 100%'", () => {
    expect(hexToHslTriplet("#ffffff")).toBe("0 0% 100%");
  });

  it("converts #000000 → '0 0% 0%'", () => {
    expect(hexToHslTriplet("#000000")).toBe("0 0% 0%");
  });
});

// -----------------------------------------------------------------------
// buildBrandStyleTag
// -----------------------------------------------------------------------

describe("buildBrandStyleTag", () => {
  it("returns the <style> tag for #0d4080", () => {
    expect(buildBrandStyleTag("#0d4080")).toBe(
      "<style>:root{--primary:213 82% 28%;}</style>"
    );
  });

  it("returns the <style> tag for #06356f (renova-turismo brand color)", () => {
    expect(buildBrandStyleTag("#06356f")).toBe(
      "<style>:root{--primary:213 90% 23%;}</style>"
    );
  });

  it("returns empty string when primaryColor is null", () => {
    expect(buildBrandStyleTag(null)).toBe("");
  });

  it("returns empty string when primaryColor is undefined", () => {
    expect(buildBrandStyleTag(undefined)).toBe("");
  });
});

// -----------------------------------------------------------------------
// injectBrandStyle
// -----------------------------------------------------------------------

describe("injectBrandStyle", () => {
  it("injects <style> before </head> when html contains </head>", () => {
    const html = "<html><head></head><body/></html>";
    const styleTag = "<style>:root{--primary:0 0% 0%;}</style>";
    const result = injectBrandStyle(html, styleTag);
    expect(result).toBe(
      "<html><head><style>:root{--primary:0 0% 0%;}</style>\n</head><body/></html>"
    );
  });

  it("prepends <style> to html when html does not contain </head>", () => {
    const html = "<html><body/></html>";
    const styleTag = "<style>x</style>";
    expect(injectBrandStyle(html, styleTag)).toBe(
      "<style>x</style>\n<html><body/></html>"
    );
  });

  it("returns html unchanged when styleTag is empty", () => {
    expect(injectBrandStyle("<html>", "")).toBe("<html>");
  });
});

// -----------------------------------------------------------------------
// GenerateViteSpaLpSchema
// -----------------------------------------------------------------------

describe("GenerateViteSpaLpSchema", () => {
  it("parses minimal input and defaults entryRoute to null", () => {
    const result = GenerateViteSpaLpSchema.parse({
      templateId: "cm1234567890abcdefghi",
      name: "Test LP",
    });
    expect(result.entryRoute).toBeNull();
  });

  it("passes entryRoute '/grecia' through unchanged", () => {
    const result = GenerateViteSpaLpSchema.parse({
      templateId: "cm1234567890abcdefghi",
      name: "Test LP",
      entryRoute: "/grecia",
    });
    expect(result.entryRoute).toBe("/grecia");
  });

  it("normalizes empty string entryRoute to null", () => {
    const result = GenerateViteSpaLpSchema.parse({
      templateId: "cm1234567890abcdefghi",
      name: "Test LP",
      entryRoute: "",
    });
    expect(result.entryRoute).toBeNull();
  });

  it("prepends '/' to entryRoute without leading slash", () => {
    const result = GenerateViteSpaLpSchema.parse({
      templateId: "cm1234567890abcdefghi",
      name: "Test LP",
      entryRoute: "grecia",
    });
    expect(result.entryRoute).toBe("/grecia");
  });
});

// -----------------------------------------------------------------------
// UpdateLpSchema — entryRoute extension
// -----------------------------------------------------------------------

describe("UpdateLpSchema — entryRoute", () => {
  it("normalizes empty string entryRoute to null", () => {
    const result = UpdateLpSchema.parse({
      id: "cm1234567890abcdefghi",
      entryRoute: "",
    });
    expect(result.entryRoute).toBeNull();
  });

  it("absent entryRoute is omitted from the result (undefined, not null)", () => {
    const result = UpdateLpSchema.parse({
      id: "cm1234567890abcdefghi",
    });
    expect(result.entryRoute).toBeUndefined();
  });
});
