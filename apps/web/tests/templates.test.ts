/**
 * Unit tests for template Zod schemas and action source assertions.
 *
 * Tests verify:
 * 1. CreateTemplateSchema and UpdateTemplateSchema validation behavior
 * 2. Source code assertions — verify action invariants without a live DB
 *    (source assertions will be RED until Plan 03 creates the actions file)
 */

import { describe, it, expect } from "vitest";
import {
  CreateTemplateSchema,
  UpdateTemplateSchema,
} from "@/lib/templates/schema";

// -----------------------------------------------------------------------
// CreateTemplateSchema
// -----------------------------------------------------------------------

describe("CreateTemplateSchema", () => {
  it("accepts a valid name and markup", () => {
    const result = CreateTemplateSchema.safeParse({
      name: "Grécia LP",
      markup: "{{ hero_titulo:text }}",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Grécia LP");
      expect(result.data.markup).toBe("{{ hero_titulo:text }}");
    }
  });

  it("rejects an empty name", () => {
    const result = CreateTemplateSchema.safeParse({
      name: "",
      markup: "{{ hero_titulo:text }}",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find((i) => i.path[0] === "name");
      expect(nameError?.message).toContain("required");
    }
  });

  it("rejects an empty markup", () => {
    const result = CreateTemplateSchema.safeParse({
      name: "My Template",
      markup: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const markupError = result.error.issues.find((i) => i.path[0] === "markup");
      expect(markupError?.message).toContain("required");
    }
  });

  it("rejects a name longer than 128 characters", () => {
    const result = CreateTemplateSchema.safeParse({
      name: "A".repeat(129),
      markup: "{{ hero_titulo:text }}",
    });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from name", () => {
    const result = CreateTemplateSchema.safeParse({
      name: "  My Template  ",
      markup: "{{ hero_titulo:text }}",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("My Template");
    }
  });

  it("accepts optional metadataOverlay", () => {
    const result = CreateTemplateSchema.safeParse({
      name: "My Template",
      markup: "{{ x:text }}",
      metadataOverlay: {
        x: { label: "Campo X", required: true },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts missing metadataOverlay (optional)", () => {
    const result = CreateTemplateSchema.safeParse({
      name: "My Template",
      markup: "{{ x:text }}",
    });
    expect(result.success).toBe(true);
  });
});

// -----------------------------------------------------------------------
// UpdateTemplateSchema
// -----------------------------------------------------------------------

describe("UpdateTemplateSchema", () => {
  it("requires id field", () => {
    const result = UpdateTemplateSchema.safeParse({
      name: "New Name",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const idError = result.error.issues.find((i) => i.path[0] === "id");
      expect(idError).toBeDefined();
    }
  });

  it("rejects an invalid cuid as id", () => {
    const result = UpdateTemplateSchema.safeParse({
      id: "not-a-cuid",
      name: "New Name",
    });
    expect(result.success).toBe(false);
  });

  it("accepts update with only id (all fields optional)", () => {
    // cuid format: starts with 'c', followed by random chars
    const validCuid = "cuid2testcuid2testcuid2testcuid";
    // Use a known-valid cuid format
    const result = UpdateTemplateSchema.safeParse({
      id: "clhvnr7x80000jt08cd3wf1kt", // example valid cuid
    });
    expect(result.success).toBe(true);
  });

  it("accepts update with name and markup", () => {
    const result = UpdateTemplateSchema.safeParse({
      id: "clhvnr7x80000jt08cd3wf1kt",
      name: "Updated Name",
      markup: "{{ new_field:text }}",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name when provided", () => {
    const result = UpdateTemplateSchema.safeParse({
      id: "clhvnr7x80000jt08cd3wf1kt",
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty markup when provided", () => {
    const result = UpdateTemplateSchema.safeParse({
      id: "clhvnr7x80000jt08cd3wf1kt",
      markup: "",
    });
    expect(result.success).toBe(false);
  });
});

// -----------------------------------------------------------------------
// Source code assertions — createTemplateAction + updateTemplateAction
//
// These tests verify invariants in the template actions source code.
// They will FAIL with "file not found" or "does not contain" until Plan 03
// creates apps/web/src/lib/templates/actions.ts.
// That is the expected RED state at this wave.
// -----------------------------------------------------------------------

describe("createTemplateAction source assertions (RED until Plan 03)", () => {
  it("createTemplateAction uses requireWorkspaceRole with owner/admin/editor", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.join(__dirname, "../src/lib/templates/actions.ts"),
      "utf-8"
    );
    // Action must gate access to owner, admin, and editor (not viewer)
    expect(source).toContain('"owner", "admin", "editor"');
    expect(source).toContain("requireWorkspaceRole");
  });

  it("updateTemplateAction contains schemaVersion: { increment: 1 } (D-10)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.join(__dirname, "../src/lib/templates/actions.ts"),
      "utf-8"
    );
    // schemaVersion atomic increment must be present in the update action
    expect(source).toContain("schemaVersion");
    expect(source).toContain("increment");
  });

  it("template actions source calls parse( from pageforge-engine", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.join(__dirname, "../src/lib/templates/actions.ts"),
      "utf-8"
    );
    // parse() from pageforge-engine must be called server-side to derive schema
    expect(source).toContain("parse(");
  });
});
