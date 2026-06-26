/**
 * Unit tests for overrides/edit-script.ts
 *
 * Follows the same test pattern as apply-shim.test.ts.
 *
 * TDD — covers:
 * - buildEditScript: <script> wrapper boundaries
 * - buildEditScript: dashboardOrigin embedded via JSON.stringify (safe JS string literal)
 * - buildEditScript: pathToNode verbatim copy — `var parts = path.split('/')` must be present
 * - buildEditScript: computePath uses parent.childNodes (not parent.children) — Pitfall 1
 * - buildEditScript: fnv1a FNV-1a hash with 0x811c9dc5 offset basis
 * - buildEditScript: all postMessage type strings present (iframe→parent + parent→iframe)
 * - buildEditScript: isTextLeaf excludes 'script' tag
 * - buildEditScript: no ES6 import statements in the IIFE body
 * - injectEditScript: inserts before </head> (lowercase)
 * - injectEditScript: inserts before </HEAD> (uppercase — case-insensitive)
 * - injectEditScript: prepends when no </head>
 * - injectEditScript: slices from original html (preserves casing of content after </head>)
 */
import { describe, it, expect } from "vitest";
import { buildEditScript, injectEditScript } from "./edit-script";

// -----------------------------------------------------------------------
// buildEditScript — wrapper
// -----------------------------------------------------------------------

describe("buildEditScript — <script> wrapper", () => {
  it("returns a string starting with <script>", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result.startsWith("<script>")).toBe(true);
  });

  it("returns a string ending with </script>", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result.trimEnd().endsWith("</script>")).toBe(true);
  });
});

// -----------------------------------------------------------------------
// buildEditScript — dashboardOrigin embedding
// -----------------------------------------------------------------------

describe("buildEditScript — dashboardOrigin via JSON.stringify", () => {
  it("embeds http://localhost:3000 as a quoted JS string literal", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain('"http://localhost:3000"');
  });

  it("embeds http://test as a quoted JS string literal", () => {
    const result = buildEditScript("http://test");
    expect(result).toContain('"http://test"');
  });

  it("does not embed dashboardOrigin as an unquoted value", () => {
    const result = buildEditScript("http://myapp.com");
    // The origin must appear as a JSON string, not a raw identifier
    expect(result).toContain('"http://myapp.com"');
    // No raw unquoted URL (= http://myapp would be a syntax error anyway, but confirm the quoting)
  });
});

// -----------------------------------------------------------------------
// buildEditScript — pathToNode verbatim copy
// -----------------------------------------------------------------------

describe("buildEditScript — pathToNode verbatim copy from apply-shim.ts", () => {
  it("contains 'var parts = path.split' (pathToNode split line from apply-shim.ts:130)", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain("var parts = path.split('/')");
  });

  it("contains the filter function body from pathToNode (apply-shim.ts:130 — exact text)", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain(".filter(function(p) { return p !== ''; })");
  });

  it("contains 'var node = document.body' (pathToNode initialization)", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain("var node = document.body");
  });

  it("contains childNodes null guard from pathToNode (apply-shim.ts:134)", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain("!node || !node.childNodes || isNaN(idx) || idx >= node.childNodes.length");
  });
});

// -----------------------------------------------------------------------
// buildEditScript — computePath uses parent.childNodes
// -----------------------------------------------------------------------

describe("buildEditScript — computePath uses childNodes (Pitfall 1)", () => {
  it("contains 'parent.childNodes' (computePath must use childNodes not children)", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain("parent.childNodes");
  });

  it("contains Array.prototype.indexOf.call for childNodes walk", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain("Array.prototype.indexOf.call");
  });
});

// -----------------------------------------------------------------------
// buildEditScript — fnv1a hash
// -----------------------------------------------------------------------

describe("buildEditScript — fnv1a FNV-1a hash", () => {
  it("contains 0x811c9dc5 (FNV-1a offset basis)", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain("0x811c9dc5");
  });

  it("contains 0x01000193 (FNV-1a prime)", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain("0x01000193");
  });
});

// -----------------------------------------------------------------------
// buildEditScript — postMessage types (iframe → parent)
// -----------------------------------------------------------------------

describe("buildEditScript — iframe→parent postMessage types", () => {
  it("contains IFRAME_READY", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain("IFRAME_READY");
  });

  it("contains ELEMENT_SELECTED", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain("ELEMENT_SELECTED");
  });

  it("contains PENDING_EDITS", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain("PENDING_EDITS");
  });

  it("contains EDIT_DISCARDED", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain("EDIT_DISCARDED");
  });

  it("contains ELEMENT_CHANGED", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain("ELEMENT_CHANGED");
  });
});

// -----------------------------------------------------------------------
// buildEditScript — postMessage types (parent → iframe)
// -----------------------------------------------------------------------

describe("buildEditScript — parent→iframe expected message types", () => {
  it("contains EDIT_MODE_ENTER", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain("EDIT_MODE_ENTER");
  });

  it("contains EDIT_MODE_EXIT", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain("EDIT_MODE_EXIT");
  });

  it("contains REQUEST_SAVE", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain("REQUEST_SAVE");
  });

  it("contains REQUEST_DISCARD", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain("REQUEST_DISCARD");
  });
});

// -----------------------------------------------------------------------
// buildEditScript — isTextLeaf excludes script
// -----------------------------------------------------------------------

describe("buildEditScript — isTextLeaf tag exclusion", () => {
  it("excludes 'script' tag from text leaf detection", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain("'script'");
  });

  it("excludes 'style' tag from text leaf detection", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain("'style'");
  });
});

// -----------------------------------------------------------------------
// buildEditScript — self-contained IIFE (no imports)
// -----------------------------------------------------------------------

describe("buildEditScript — self-contained IIFE", () => {
  it("does not contain ES6 import statements in the output", () => {
    const result = buildEditScript("http://localhost:3000");
    // The script tag content must not have 'import {' or 'import('
    expect(result).not.toMatch(/\bimport\s*\{/);
    // Note: dynamic import() is a separate check — the IIFE itself should be self-contained
  });

  it("contains 'use strict' inside the IIFE", () => {
    const result = buildEditScript("http://localhost:3000");
    expect(result).toContain("'use strict'");
  });
});

// -----------------------------------------------------------------------
// injectEditScript — inserts before </head>
// -----------------------------------------------------------------------

describe("injectEditScript — </head> insertion", () => {
  it("inserts script immediately before </head> (lowercase)", () => {
    const html = "<html><head><title>Test</title></head><body></body></html>";
    const script = "<script>x</script>";
    const result = injectEditScript(html, script);
    // script must appear in the result
    expect(result).toContain(script);
    // script must appear before </head>
    const headClose = result.indexOf("</head>");
    const scriptPos = result.indexOf(script);
    expect(scriptPos).toBeGreaterThanOrEqual(0);
    expect(scriptPos).toBeLessThan(headClose);
  });

  it("inserts script before </HEAD> (uppercase — case-insensitive)", () => {
    const html = "<html><HEAD><title>Test</title></HEAD><body></body></html>";
    const script = "<script>y</script>";
    const result = injectEditScript(html, script);
    expect(result).toContain(script);
    // script must appear before </HEAD>
    const headClose = result.indexOf("</HEAD>");
    const scriptPos = result.indexOf(script);
    expect(scriptPos).toBeGreaterThanOrEqual(0);
    expect(scriptPos).toBeLessThan(headClose);
  });

  it("preserves the original casing of content after </head>", () => {
    const html = "<html><head></head><body>ORIGINAL_CONTENT</body></html>";
    const script = "<script>z</script>";
    const result = injectEditScript(html, script);
    // Content after </head> must not be lowercased
    expect(result).toContain("ORIGINAL_CONTENT");
    // </head> tag itself must be preserved as-is from the original
    expect(result).toContain("</head><body>ORIGINAL_CONTENT</body></html>");
  });

  it("uses toLowerCase() only for position detection, not for slicing", () => {
    // If we sliced the lowercased string, uppercase would be lost.
    // Verify uppercase characters after </head> are retained.
    const html = "<HTML><HEAD></HEAD><BODY>CAPS</BODY></HTML>";
    const script = "<script>s</script>";
    const result = injectEditScript(html, script);
    expect(result).toContain("</HEAD><BODY>CAPS</BODY></HTML>");
  });
});

// -----------------------------------------------------------------------
// injectEditScript — prepend fallback (no </head>)
// -----------------------------------------------------------------------

describe("injectEditScript — prepend fallback", () => {
  it("prepends script when html has no </head>", () => {
    const html = "<html><body>content</body></html>";
    const script = "<script>prepend</script>";
    const result = injectEditScript(html, script);
    expect(result.startsWith(script)).toBe(true);
  });

  it("still contains original html content when prepending", () => {
    const html = "no-head-here";
    const script = "<script>s</script>";
    const result = injectEditScript(html, script);
    expect(result).toContain("no-head-here");
    expect(result).toContain(script);
  });
});
