/**
 * Schema convention tests — D-14, WS-05
 *
 * Purpose: fail when any tenant-owned Prisma model lacks a `workspaceId` field.
 *
 * This is a guardrail test (D-14) that enforces the workspace-id-on-every-table
 * convention. Phases 3-5 must add new tenant-owned models to the `TENANT_OWNED_MODELS`
 * list below when they are introduced. The test will fail immediately if those
 * models are added to the schema without a workspaceId field.
 *
 * Current models (Phase 2):
 *   - TenantIsolationProbe  (phase 2 exemplar)
 *
 * Future models to add when introduced:
 *   - Template      (Phase 3)
 *   - LandingPage   (Phase 4)
 *   - BrandConfig   (Phase 3)
 *   - Asset         (Phase 4)
 *   - Folder        (Phase 5)
 *   - CatalogItem   (Phase 5)
 *
 * How to add a new model:
 *   1. Add the model to the Prisma schema with `workspaceId String` (and FK).
 *   2. Add the model name to TENANT_OWNED_MODELS below.
 *   3. Run tests — they should pass.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// -----------------------------------------------------------------------
// Tenant-owned models list
// Phases 3-5 MUST add models here when they introduce them.
// -----------------------------------------------------------------------

/**
 * List of tenant-owned Prisma model names.
 *
 * The convention test reads the Prisma schema and fails if any of these
 * models do NOT have a `workspaceId` field.
 *
 * Phase 2 models: TenantIsolationProbe
 * Future (add before implementing): Template, LandingPage, BrandConfig, Asset, Folder, CatalogItem
 */
const TENANT_OWNED_MODELS: string[] = [
  "TenantIsolationProbe",
  // ---- Phase 3: add these when introducing the models ----
  "Template",
  "BrandConfig",
  // ---- Phase 4: add these when introducing the models ----
  // "LandingPage",
  // "Asset",
  // ---- Phase 5: add these when introducing the models ----
  // "Folder",
  // "CatalogItem",
];

// -----------------------------------------------------------------------
// Schema reader
// -----------------------------------------------------------------------

function readPrismaSchema(): string {
  const schemaPath = path.join(
    __dirname,
    "../prisma/schema.prisma"
  );
  return fs.readFileSync(schemaPath, "utf-8");
}

/**
 * Parse model blocks from a Prisma schema string.
 *
 * Returns a map of { modelName → model block text }.
 */
function parseModelBlocks(schema: string): Map<string, string> {
  const models = new Map<string, string>();

  // Match each `model <Name> { ... }` block
  const modelRegex = /model\s+(\w+)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = modelRegex.exec(schema)) !== null) {
    const modelName = match[1];
    const modelBody = match[2];
    models.set(modelName, modelBody);
  }

  return models;
}

/**
 * Check if a model block contains a `workspaceId` field.
 */
function hasWorkspaceIdField(modelBody: string): boolean {
  // Match `workspaceId` as a field name (e.g. "  workspaceId String")
  return /\bworkspaceId\s+\w+/.test(modelBody);
}

// -----------------------------------------------------------------------
// Schema convention tests
// -----------------------------------------------------------------------

describe("Schema convention: tenant-owned models must have workspaceId (D-14, WS-05)", () => {
  let schema: string;
  let modelBlocks: Map<string, string>;

  schema = readPrismaSchema();
  modelBlocks = parseModelBlocks(schema);

  it("Prisma schema is readable", () => {
    expect(schema.length).toBeGreaterThan(0);
    expect(schema).toContain("model");
  });

  it("schema parser finds at least TenantIsolationProbe model", () => {
    expect(modelBlocks.has("TenantIsolationProbe")).toBe(true);
  });

  it("schema parser correctly identifies workspaceId field presence", () => {
    const blockWithField = "  workspaceId String\n  label String";
    const blockWithoutField = "  label String\n  id String";
    expect(hasWorkspaceIdField(blockWithField)).toBe(true);
    expect(hasWorkspaceIdField(blockWithoutField)).toBe(false);
  });

  // This test runs for each tenant-owned model in the list
  // If the model exists in the schema, it must have a workspaceId field
  // If the model does not exist yet (commented out), the test notes it
  for (const modelName of TENANT_OWNED_MODELS) {
    it(`${modelName} must have a workspaceId field (D-14)`, () => {
      const modelBody = modelBlocks.get(modelName);

      if (modelBody === undefined) {
        // Model not yet in schema — this is OK for deferred models.
        // The test ensures that when the model IS added, it will have workspaceId.
        // For the currently tested list, all models should exist.
        throw new Error(
          `Model "${modelName}" is listed as tenant-owned but does not exist in schema.prisma. ` +
          `Either add the model to the schema with a workspaceId field, or remove it from TENANT_OWNED_MODELS.`
        );
      }

      const hasField = hasWorkspaceIdField(modelBody);
      expect(
        hasField,
        `Model "${modelName}" is listed as tenant-owned but does not have a "workspaceId" field. ` +
        `All tenant-owned models must carry workspaceId (D-14, WS-05).`
      ).toBe(true);
    });
  }
});

// -----------------------------------------------------------------------
// Future models documentation tests
// -----------------------------------------------------------------------

describe("Future tenant-owned models (Phase 3-5 checklist)", () => {
  it("documents Phase 3 models that must have workspaceId: Template, BrandConfig", () => {
    // Contract documentation: when Phase 3 introduces these models,
    // they MUST have workspaceId. Uncomment in TENANT_OWNED_MODELS above.
    const phase3Models = ["Template", "BrandConfig"];
    expect(phase3Models).toHaveLength(2);
    expect(phase3Models).toContain("Template");
    expect(phase3Models).toContain("BrandConfig");
  });

  it("documents Phase 4 models that must have workspaceId: LandingPage, Asset", () => {
    const phase4Models = ["LandingPage", "Asset"];
    expect(phase4Models).toHaveLength(2);
    expect(phase4Models).toContain("LandingPage");
    expect(phase4Models).toContain("Asset");
  });

  it("documents Phase 5 models that must have workspaceId: Folder, CatalogItem", () => {
    const phase5Models = ["Folder", "CatalogItem"];
    expect(phase5Models).toHaveLength(2);
    expect(phase5Models).toContain("Folder");
    expect(phase5Models).toContain("CatalogItem");
  });

  it("all future models enumerated: Template, LandingPage, BrandConfig, Asset, Folder, CatalogItem", () => {
    // This serves as the canonical list of models requiring workspaceId in future phases
    const allFutureModels = [
      "Template",
      "LandingPage",
      "BrandConfig",
      "Asset",
      "Folder",
      "CatalogItem",
    ];
    expect(allFutureModels).toHaveLength(6);
  });
});

// -----------------------------------------------------------------------
// Schema integrity — WorkspaceInvitation is tenant-owned
// -----------------------------------------------------------------------

describe("WorkspaceInvitation has workspaceId (D-14, WS-03)", () => {
  it("WorkspaceInvitation model exists in schema", () => {
    const schema = readPrismaSchema();
    expect(schema).toContain("model WorkspaceInvitation");
  });

  it("WorkspaceInvitation has workspaceId field", () => {
    const schema = readPrismaSchema();
    const models = parseModelBlocks(schema);
    const body = models.get("WorkspaceInvitation");
    expect(body).toBeDefined();
    if (body) {
      expect(hasWorkspaceIdField(body)).toBe(true);
    }
  });
});

describe("WorkspaceMember has workspaceId (D-14, WS-02)", () => {
  it("WorkspaceMember model exists in schema", () => {
    const schema = readPrismaSchema();
    expect(schema).toContain("model WorkspaceMember");
  });

  it("WorkspaceMember has workspaceId field", () => {
    const schema = readPrismaSchema();
    const models = parseModelBlocks(schema);
    const body = models.get("WorkspaceMember");
    expect(body).toBeDefined();
    if (body) {
      expect(hasWorkspaceIdField(body)).toBe(true);
    }
  });
});
