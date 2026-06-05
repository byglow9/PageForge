/**
 * Unit tests for SaveBrandConfigSchema and brand action source assertions.
 *
 * Tests verify:
 * 1. SaveBrandConfigSchema validation (hex color regex, https:// URL scheme)
 * 2. Permission matrix for brand resource (editor can update, viewer cannot)
 * 3. Source code assertion — saveBrandConfigAction uses upsert
 *    (source assertion will be RED until Plan 04 creates the brand actions file)
 */

import { describe, it, expect } from "vitest";
import { SaveBrandConfigSchema } from "@/lib/brand/schema";

// -----------------------------------------------------------------------
// SaveBrandConfigSchema
// -----------------------------------------------------------------------

describe("SaveBrandConfigSchema", () => {
  it("accepts empty string for all optional fields (field cleared)", () => {
    const result = SaveBrandConfigSchema.safeParse({
      logoUrl: "",
      primaryColor: "",
      whatsapp: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid https:// logoUrl", () => {
    const result = SaveBrandConfigSchema.safeParse({
      logoUrl: "https://example.com/logo.png",
    });
    expect(result.success).toBe(true);
  });

  it("rejects http:// logoUrl (must start with https://)", () => {
    // T-03-01-05: logoUrl must start with https:// to prevent insecure content
    const result = SaveBrandConfigSchema.safeParse({
      logoUrl: "http://insecure.com/logo.png",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const urlError = result.error.issues.find((i) => i.path[0] === "logoUrl");
      expect(urlError).toBeDefined();
    }
  });

  it("rejects an invalid URL for logoUrl", () => {
    const result = SaveBrandConfigSchema.safeParse({
      logoUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid 6-digit hex primaryColor", () => {
    const result = SaveBrandConfigSchema.safeParse({
      primaryColor: "#0f172a",
    });
    expect(result.success).toBe(true);
  });

  it("accepts uppercase hex digits in primaryColor", () => {
    const result = SaveBrandConfigSchema.safeParse({
      primaryColor: "#AABBCC",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid hex color '#gg0000' (non-hex character)", () => {
    // T-03-01-04: regex /^#[0-9a-fA-F]{6}$/ prevents CSS injection
    const result = SaveBrandConfigSchema.safeParse({
      primaryColor: "#gg0000",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const colorError = result.error.issues.find(
        (i) => i.path[0] === "primaryColor"
      );
      expect(colorError).toBeDefined();
    }
  });

  it("rejects a 3-digit hex color (must be 6 digits)", () => {
    const result = SaveBrandConfigSchema.safeParse({
      primaryColor: "#fff",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a hex color without the # prefix", () => {
    const result = SaveBrandConfigSchema.safeParse({
      primaryColor: "0f172a",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid WhatsApp number", () => {
    const result = SaveBrandConfigSchema.safeParse({
      whatsapp: "+5511999999999",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a whatsapp number longer than 32 characters", () => {
    const result = SaveBrandConfigSchema.safeParse({
      whatsapp: "1".repeat(33),
    });
    expect(result.success).toBe(false);
  });

  it("accepts undefined for all optional fields", () => {
    const result = SaveBrandConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a full valid brand config", () => {
    const result = SaveBrandConfigSchema.safeParse({
      logoUrl: "https://cdn.example.com/logo.png",
      primaryColor: "#0f172a",
      whatsapp: "+5511999999999",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.logoUrl).toBe("https://cdn.example.com/logo.png");
      expect(result.data.primaryColor).toBe("#0f172a");
      expect(result.data.whatsapp).toBe("+5511999999999");
    }
  });
});

// -----------------------------------------------------------------------
// Permission matrix for brand resource
// -----------------------------------------------------------------------

describe("Brand resource permissions (can() matrix)", () => {
  it("can('editor', 'brand', 'update') returns true", async () => {
    const { can } = await import("@/lib/workspaces/guards");
    expect(can("editor", "brand", "update")).toBe(true);
  });

  it("can('viewer', 'brand', 'update') returns false", async () => {
    const { can } = await import("@/lib/workspaces/guards");
    expect(can("viewer", "brand", "update")).toBe(false);
  });

  it("can('owner', 'brand', 'update') returns true", async () => {
    const { can } = await import("@/lib/workspaces/guards");
    expect(can("owner", "brand", "update")).toBe(true);
  });

  it("can('admin', 'brand', 'update') returns true", async () => {
    const { can } = await import("@/lib/workspaces/guards");
    expect(can("admin", "brand", "update")).toBe(true);
  });

  it("can('viewer', 'brand', 'read') returns true", async () => {
    const { can } = await import("@/lib/workspaces/guards");
    expect(can("viewer", "brand", "read")).toBe(true);
  });
});

// -----------------------------------------------------------------------
// Source code assertion — saveBrandConfigAction
//
// This test will FAIL with "file not found" until Plan 04 creates
// apps/web/src/lib/brand/actions.ts. That is the expected RED state.
// -----------------------------------------------------------------------

describe("saveBrandConfigAction source assertions (RED until Plan 04)", () => {
  it("saveBrandConfigAction uses upsert for create-or-update", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.join(__dirname, "../src/lib/brand/actions.ts"),
      "utf-8"
    );
    // upsert must be used (BrandConfig.workspaceId @unique enables this)
    expect(source).toContain("upsert");
  });
});
