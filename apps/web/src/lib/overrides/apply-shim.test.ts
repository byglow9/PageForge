/**
 * Unit tests for overrides/apply-shim.ts
 *
 * TDD — covers:
 * - buildOverrideInjection: null/undefined/sentinel-{}/empty-overrides guards (B2)
 * - buildOverrideInjection: text override → shimScript contains DOMContentLoaded + textContent
 * - buildOverrideInjection: color override → shimScript contains --primary + setProperty
 * - buildOverrideInjection: image type silently skipped (no innerHTML)
 * - buildOverrideInjection: XSS safety — </script> in value unicode-escaped in overridesJson
 * - hexToHslTripletShim: W2 color fidelity — same output as theme.ts hexToHslTriplet
 * - injectOverrides: inserts both tags before </head>; no-op when both empty
 */
import { describe, it, expect } from "vitest";
import { buildOverrideInjection, injectOverrides, hexToHslTripletShim } from "./apply-shim";
import type { ViteSpaValues } from "@/lib/lps/schema";

// -----------------------------------------------------------------------
// buildOverrideInjection — guard cases (B2)
// -----------------------------------------------------------------------

describe("buildOverrideInjection — B2 guard cases", () => {
  it("returns empty injection when values is null", () => {
    const result = buildOverrideInjection(null);
    expect(result.shimScript).toBe("");
    expect(result.overridesJson).toBe("");
  });

  it("returns empty injection when values is undefined", () => {
    const result = buildOverrideInjection(undefined);
    expect(result.shimScript).toBe("");
    expect(result.overridesJson).toBe("");
  });

  it("returns empty injection for sentinel {} (no overrides field — B2: .overrides is undefined, must NOT throw)", () => {
    // This is the critical B2 case: VITE_SPA LPs created before any override
    // is saved store values = {} — casting to ViteSpaValues yields {} where
    // .overrides is undefined at runtime (not []).
    const sentinel = {} as ViteSpaValues;
    expect(() => buildOverrideInjection(sentinel)).not.toThrow();
    const result = buildOverrideInjection(sentinel);
    expect(result.shimScript).toBe("");
    expect(result.overridesJson).toBe("");
  });

  it("returns empty injection when overrides is an empty array", () => {
    const result = buildOverrideInjection({ overrides: [] });
    expect(result.shimScript).toBe("");
    expect(result.overridesJson).toBe("");
  });
});

// -----------------------------------------------------------------------
// buildOverrideInjection — text override
// -----------------------------------------------------------------------

describe("buildOverrideInjection — text override", () => {
  const textValues: ViteSpaValues = {
    overrides: [
      { path: "/0/2", originalHash: "abc", type: "text", value: "Hello" },
    ],
  };

  it("returns non-empty shimScript and overridesJson for text override", () => {
    const result = buildOverrideInjection(textValues);
    expect(result.shimScript).not.toBe("");
    expect(result.overridesJson).not.toBe("");
  });

  it("shimScript contains DOMContentLoaded for text override", () => {
    const result = buildOverrideInjection(textValues);
    expect(result.shimScript).toContain("DOMContentLoaded");
  });

  it("shimScript contains textContent for text override (never innerHTML)", () => {
    const result = buildOverrideInjection(textValues);
    expect(result.shimScript).toContain("textContent");
    // textContent is the correct API; innerHTML would be an XSS vector
    expect(result.shimScript).not.toContain("innerHTML");
  });

  it("overridesJson is valid JSON parseable back to the same override array", () => {
    const result = buildOverrideInjection(textValues);
    // Strip the <script ...>...</script> wrapper to get the JSON content
    const jsonContent = result.overridesJson
      .replace(/^<script[^>]*>/, "")
      .replace(/<\/script>$/, "");
    const parsed = JSON.parse(jsonContent);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].path).toBe("/0/2");
    expect(parsed[0].type).toBe("text");
    expect(parsed[0].value).toBe("Hello");
  });
});

// -----------------------------------------------------------------------
// buildOverrideInjection — color override
// -----------------------------------------------------------------------

describe("buildOverrideInjection — color override", () => {
  const colorValues: ViteSpaValues = {
    overrides: [
      { path: "/0", originalHash: "abc", type: "color", value: "#ff0000" },
    ],
  };

  it("shimScript contains --primary for color override", () => {
    const result = buildOverrideInjection(colorValues);
    expect(result.shimScript).toContain("--primary");
  });

  it("shimScript contains setProperty for color override", () => {
    const result = buildOverrideInjection(colorValues);
    expect(result.shimScript).toContain("setProperty");
  });
});

// -----------------------------------------------------------------------
// buildOverrideInjection — image type silently skipped
// -----------------------------------------------------------------------

describe("buildOverrideInjection — image type (Phase 9 skip)", () => {
  it("shimScript does NOT contain innerHTML when type is image (image silently skipped in Phase 9)", () => {
    const imageValues: ViteSpaValues = {
      overrides: [
        { path: "/0", originalHash: "abc", type: "image", value: "https://example.com/img.jpg" },
      ],
    };
    const result = buildOverrideInjection(imageValues);
    expect(result.shimScript).not.toContain("innerHTML");
  });
});

// -----------------------------------------------------------------------
// buildOverrideInjection — XSS safety
// -----------------------------------------------------------------------

describe("buildOverrideInjection — XSS safety", () => {
  it("overridesJson unicode-escapes </script> to prevent script tag breakout", () => {
    // The value '<script>alert(1)</script>' must be unicode-escaped so the embedded
    // JSON blob cannot break out of the <script type="application/json"> context.
    const xssValues: ViteSpaValues = {
      overrides: [
        {
          path: "/0",
          originalHash: "abc",
          type: "text",
          value: '<script>alert(1)</script>',
        },
      ],
    };
    const result = buildOverrideInjection(xssValues);
    // The literal '</script>' from the value must NOT appear in overridesJson
    expect(result.overridesJson).not.toContain("</script>");
    // Instead it should be unicode-escaped
    expect(result.overridesJson).toContain("\\u003c/script\\u003e");
  });

  it("overridesJson unicode-escapes < and > characters", () => {
    const xssValues: ViteSpaValues = {
      overrides: [
        { path: "/0", originalHash: "abc", type: "text", value: "<b>bold</b>" },
      ],
    };
    const result = buildOverrideInjection(xssValues);
    expect(result.overridesJson).not.toContain("<b>");
    expect(result.overridesJson).toContain("\\u003cb\\u003e");
  });
});

// -----------------------------------------------------------------------
// hexToHslTripletShim — W2 color fidelity
// -----------------------------------------------------------------------

describe("hexToHslTripletShim — W2 color fidelity (must match theme.ts hexToHslTriplet)", () => {
  it("converts #06356f → '213 90% 23%' — same as theme.ts reference", () => {
    // This is the canonical renova-turismo brand color. The shim's inlined
    // hex→HSL must produce the IDENTICAL output to ensure preview color == brand color.
    expect(hexToHslTripletShim("#06356f")).toBe("213 90% 23%");
  });

  it("converts #0d4080 → '213 82% 28%' — same as theme.ts reference", () => {
    expect(hexToHslTripletShim("#0d4080")).toBe("213 82% 28%");
  });

  it("converts #ffffff → '0 0% 100%'", () => {
    expect(hexToHslTripletShim("#ffffff")).toBe("0 0% 100%");
  });

  it("converts #000000 → '0 0% 0%'", () => {
    expect(hexToHslTripletShim("#000000")).toBe("0 0% 0%");
  });

  it("converts #ff0000 → '0 100% 50%'", () => {
    expect(hexToHslTripletShim("#ff0000")).toBe("0 100% 50%");
  });
});

// -----------------------------------------------------------------------
// injectOverrides
// -----------------------------------------------------------------------

describe("injectOverrides", () => {
  it("inserts both overridesJson and shimScript before </head>", () => {
    const html = "<html><head></head><body/></html>";
    const injection = {
      shimScript: "<script>x</script>",
      overridesJson: '<script id="pf-overrides" type="application/json">[]</script>',
    };
    const result = injectOverrides(html, injection);
    expect(result).toContain('<script id="pf-overrides"');
    expect(result).toContain("<script>x</script>");
    // Both appear before </head>
    const headClose = result.indexOf("</head>");
    const jsonPos = result.indexOf('<script id="pf-overrides"');
    const shimPos = result.indexOf("<script>x</script>");
    expect(jsonPos).toBeLessThan(headClose);
    expect(shimPos).toBeLessThan(headClose);
  });

  it("returns html unchanged when both shimScript and overridesJson are empty", () => {
    const html = "<html><head></head><body/></html>";
    const result = injectOverrides(html, { shimScript: "", overridesJson: "" });
    expect(result).toBe(html);
  });

  it("inserts before </head> using same pattern as injectBrandStyle", () => {
    const html = "<html><head><title>T</title></head><body/></html>";
    const injection = {
      shimScript: "<script>s</script>",
      overridesJson: '<script id="pf-overrides" type="application/json">[]</script>',
    };
    const result = injectOverrides(html, injection);
    // The content should come before </head>
    expect(result.indexOf("</head>")).toBeGreaterThan(result.indexOf('<script id="pf-overrides"'));
    expect(result.indexOf("</head>")).toBeGreaterThan(result.indexOf("<script>s</script>"));
  });
});
