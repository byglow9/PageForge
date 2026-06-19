/**
 * Type boundary tests — V2-11, T-06-12
 *
 * These tests assert the guard placed in lib/lps/render.ts by Plan 01:
 * - VITE_SPA templates are rejected before entering the LIQUID render path
 * - LIQUID templates are unaffected by the guard and render normally
 *
 * No DB connection required:
 * - Test 1: throws before any db access (guard fires first)
 * - Test 2: uses a mock db that satisfies the brandConfig.findFirst call
 */
import { describe, it, expect } from "vitest";
import { renderLp } from "@/lib/lps/render";

describe("type boundary (V2-11)", () => {
  it("throws when kind=VITE_SPA is passed to renderLp", async () => {
    await expect(
      renderLp(
        { markupSnapshot: "<h1>Hello</h1>", values: {}, kind: "VITE_SPA" },
        // db is never accessed because the guard throws first
        {} as any
      )
    ).rejects.toThrow("Type boundary violation");
  });

  it("does NOT throw when kind=LIQUID is passed to renderLp", async () => {
    // renderLp requires a live db for brand config — mock brandConfig.findFirst
    const mockDb = { brandConfig: { findFirst: async () => null } } as any;
    const html = await renderLp(
      { markupSnapshot: "{{ title:text }}", values: { title: "Test" }, kind: "LIQUID" },
      mockDb
    );
    // Assert on rendered content, not just truthiness, so a regression that
    // returns an empty/malformed string is caught (IN-05).
    expect(typeof html).toBe("string");
    expect(html).toContain("Test");
  });
});
