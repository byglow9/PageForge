/**
 * Unit tests for brand/theme.ts
 *
 * TDD — RED phase: tests written before implementation.
 *
 * Covers:
 * - hexToHslTriplet: hex→HSL conversion with reference values
 * - buildBrandStyleTag: CSS style tag builder with null/undefined guard
 * - injectBrandStyle: HTML injection helper with </head> and fallback paths
 */
import { describe, it, expect } from "vitest";
import { hexToHslTriplet, buildBrandStyleTag, injectBrandStyle } from "./theme";

// -----------------------------------------------------------------------
// hexToHslTriplet
// -----------------------------------------------------------------------

describe("hexToHslTriplet", () => {
  it("converts #0d4080 → '213 90% 23%' (reference value from renova-turismo index.css)", () => {
    expect(hexToHslTriplet("#0d4080")).toBe("213 90% 23%");
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
