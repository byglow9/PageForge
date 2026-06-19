/**
 * Tests for lib/serve/serve-vite-spa.ts — type guard + SPA path resolver + MIME helper
 *
 * Covers:
 * - D-07: SPA route fallback (extensionless path → index.html; asset with extension → direct)
 * - D-08: assertViteSpaKind reciprocal type guard (mirror of renderLp guard in lib/lps/render.ts)
 * - PRJ-11: VITE_SPA never enters the LIQUID path and vice-versa
 */
import { describe, it, expect } from "vitest";
import {
  assertViteSpaKind,
  resolveServePath,
  getContentType,
} from "@/lib/serve/serve-vite-spa";

describe("assertViteSpaKind (07-01, D-08)", () => {
  it("throws 'Type boundary violation' when kind is LIQUID", () => {
    expect(() => assertViteSpaKind("LIQUID")).toThrow("Type boundary violation");
  });

  it("throws 'Type boundary violation' for any non-VITE_SPA kind", () => {
    expect(() => assertViteSpaKind("UNKNOWN")).toThrow("Type boundary violation");
    expect(() => assertViteSpaKind("")).toThrow("Type boundary violation");
  });

  it("does NOT throw when kind is VITE_SPA", () => {
    expect(() => assertViteSpaKind("VITE_SPA")).not.toThrow();
  });
});

describe("resolveServePath (07-01, D-07)", () => {
  it("root '/' returns index.html with isFallback:true", () => {
    expect(resolveServePath("/")).toEqual({ s3Path: "index.html", isFallback: true });
  });

  it("extensionless path '/about' returns index.html with isFallback:true (SPA route)", () => {
    expect(resolveServePath("/about")).toEqual({
      s3Path: "index.html",
      isFallback: true,
    });
  });

  it("extensionless nested path '/products/123' returns index.html with isFallback:true", () => {
    expect(resolveServePath("/products/123")).toEqual({
      s3Path: "index.html",
      isFallback: true,
    });
  });

  it("asset path '/assets/main.abc123.js' returns the path as-is with isFallback:false", () => {
    expect(resolveServePath("/assets/main.abc123.js")).toEqual({
      s3Path: "assets/main.abc123.js",
      isFallback: false,
    });
  });

  it("explicit '/index.html' (has extension) returns index.html with isFallback:false", () => {
    expect(resolveServePath("/index.html")).toEqual({
      s3Path: "index.html",
      isFallback: false,
    });
  });

  it("CSS asset path returns as-is with isFallback:false", () => {
    expect(resolveServePath("/assets/style.css")).toEqual({
      s3Path: "assets/style.css",
      isFallback: false,
    });
  });

  it("leading slash is stripped from the returned s3Path", () => {
    const result = resolveServePath("/assets/foo.js");
    expect(result.s3Path).not.toMatch(/^\//);
  });
});

describe("getContentType (07-01)", () => {
  it("returns text/html for .html extension", () => {
    expect(getContentType("index.html")).toBe("text/html");
  });

  it("returns application/javascript for .js extension", () => {
    expect(getContentType("chunk.abc.js")).toBe("application/javascript");
  });

  it("returns application/javascript for .mjs extension", () => {
    expect(getContentType("module.mjs")).toBe("application/javascript");
  });

  it("returns text/css for .css extension", () => {
    expect(getContentType("style.css")).toBe("text/css");
  });

  it("returns application/json for .json extension", () => {
    expect(getContentType("manifest.json")).toBe("application/json");
  });

  it("returns image/png for .png extension", () => {
    expect(getContentType("logo.png")).toBe("image/png");
  });

  it("returns image/svg+xml for .svg extension", () => {
    expect(getContentType("icon.svg")).toBe("image/svg+xml");
  });

  it("returns font/woff2 for .woff2 extension", () => {
    expect(getContentType("font.woff2")).toBe("font/woff2");
  });

  it("returns application/octet-stream for unknown extension", () => {
    expect(getContentType("data.unknown.xyz")).toBe("application/octet-stream");
  });

  it("returns application/octet-stream for extensionless file", () => {
    expect(getContentType("noextension")).toBe("application/octet-stream");
  });
});
