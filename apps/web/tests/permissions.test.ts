/**
 * RBAC permission matrix tests — D-08, D-09, D-10, D-11
 *
 * Tests prove:
 * 1. Owner has full access to all resources (workspace delete, member management, content).
 * 2. Admin can manage members and settings but not delete the workspace.
 * 3. Editor can manage content but cannot manage members or workspace settings.
 * 4. Viewer can only read/preview/export; cannot create, edit, or duplicate.
 * 5. Guards module exports all required functions.
 * 6. Permission matrix is consistent between guards.ts and permissions.ts.
 *
 * Security contract: these tests document what the server-side guards enforce.
 * UI hiding of buttons is a UX convenience; the guard itself is the authority.
 */

import { describe, it, expect } from "vitest";
import { can } from "@/lib/workspaces/guards";
import { RoleSchema, ROLES } from "@/lib/auth/permissions";
import type { Role } from "@/lib/auth/permissions";

// -----------------------------------------------------------------------
// Helper: assert multiple actions on a resource
// -----------------------------------------------------------------------

function canAll(role: Role, resource: string, actions: string[]): boolean {
  return actions.every((action) => can(role, resource, action));
}

function canNone(role: Role, resource: string, actions: string[]): boolean {
  return actions.every((action) => !can(role, resource, action));
}

// -----------------------------------------------------------------------
// Owner role — D-08: full access
// -----------------------------------------------------------------------

describe("owner role — full workspace access (D-08)", () => {
  it("can read, update, and delete the workspace", () => {
    expect(can("owner", "workspace", "read")).toBe(true);
    expect(can("owner", "workspace", "update")).toBe(true);
    expect(can("owner", "workspace", "delete")).toBe(true);
  });

  it("can invite, remove, update roles, and read members (D-09)", () => {
    expect(can("owner", "member", "invite")).toBe(true);
    expect(can("owner", "member", "remove")).toBe(true);
    expect(can("owner", "member", "updateRole")).toBe(true);
    expect(can("owner", "member", "read")).toBe(true);
  });

  it("can create, read, update, delete, and duplicate templates", () => {
    expect(canAll("owner", "template", ["create", "read", "update", "delete", "duplicate"])).toBe(true);
  });

  it("can create, read, update, delete, duplicate, preview, and export LPs", () => {
    expect(canAll("owner", "lp", ["create", "read", "update", "delete", "duplicate", "preview", "export"])).toBe(true);
  });

  it("can read and update brand config", () => {
    expect(can("owner", "brand", "read")).toBe(true);
    expect(can("owner", "brand", "update")).toBe(true);
  });

  it("can create, read, and delete assets", () => {
    expect(canAll("owner", "asset", ["create", "read", "delete"])).toBe(true);
  });
});

// -----------------------------------------------------------------------
// Admin role — D-08: manage members and settings; no workspace delete
// -----------------------------------------------------------------------

describe("admin role — member management and settings (D-08, D-09)", () => {
  it("can read and update workspace settings but NOT delete", () => {
    expect(can("admin", "workspace", "read")).toBe(true);
    expect(can("admin", "workspace", "update")).toBe(true);
    expect(can("admin", "workspace", "delete")).toBe(false);
  });

  it("can invite, remove, update roles, and read members (D-09)", () => {
    expect(can("admin", "member", "invite")).toBe(true);
    expect(can("admin", "member", "remove")).toBe(true);
    expect(can("admin", "member", "updateRole")).toBe(true);
    expect(can("admin", "member", "read")).toBe(true);
  });

  it("can create, read, update, delete, and duplicate templates", () => {
    expect(canAll("admin", "template", ["create", "read", "update", "delete", "duplicate"])).toBe(true);
  });

  it("can perform all LP actions including preview and export", () => {
    expect(canAll("admin", "lp", ["create", "read", "update", "delete", "duplicate", "preview", "export"])).toBe(true);
  });

  it("can read and update brand config", () => {
    expect(can("admin", "brand", "read")).toBe(true);
    expect(can("admin", "brand", "update")).toBe(true);
  });
});

// -----------------------------------------------------------------------
// Editor role — D-08, D-11: content only; cannot manage members or settings
// -----------------------------------------------------------------------

describe("editor role — content only (D-08, D-11)", () => {
  it("can only READ the workspace — cannot update or delete settings (D-11)", () => {
    expect(can("editor", "workspace", "read")).toBe(true);
    expect(can("editor", "workspace", "update")).toBe(false);
    expect(can("editor", "workspace", "delete")).toBe(false);
  });

  it("can only READ members — cannot invite, remove, or change roles (D-09, D-11)", () => {
    expect(can("editor", "member", "read")).toBe(true);
    expect(can("editor", "member", "invite")).toBe(false);
    expect(can("editor", "member", "remove")).toBe(false);
    expect(can("editor", "member", "updateRole")).toBe(false);
  });

  it("can create, read, update, delete, and duplicate templates (content access)", () => {
    expect(canAll("editor", "template", ["create", "read", "update", "delete", "duplicate"])).toBe(true);
  });

  it("can create, read, update, delete, duplicate, preview, and export LPs", () => {
    expect(canAll("editor", "lp", ["create", "read", "update", "delete", "duplicate", "preview", "export"])).toBe(true);
  });

  it("can read and update brand config", () => {
    expect(can("editor", "brand", "read")).toBe(true);
    expect(can("editor", "brand", "update")).toBe(true);
  });

  it("can create, read, and delete assets", () => {
    expect(canAll("editor", "asset", ["create", "read", "delete"])).toBe(true);
  });
});

// -----------------------------------------------------------------------
// Viewer role — D-08, D-10: read/preview/export only
// -----------------------------------------------------------------------

describe("viewer role — read/preview/export only (D-08, D-10)", () => {
  it("can only READ the workspace — no update or delete", () => {
    expect(can("viewer", "workspace", "read")).toBe(true);
    expect(can("viewer", "workspace", "update")).toBe(false);
    expect(can("viewer", "workspace", "delete")).toBe(false);
  });

  it("can only READ members — no member management (D-09)", () => {
    expect(can("viewer", "member", "read")).toBe(true);
    expect(can("viewer", "member", "invite")).toBe(false);
    expect(can("viewer", "member", "remove")).toBe(false);
    expect(can("viewer", "member", "updateRole")).toBe(false);
  });

  it("can only READ templates — no create, update, delete, or duplicate (D-10)", () => {
    expect(can("viewer", "template", "read")).toBe(true);
    expect(can("viewer", "template", "create")).toBe(false);
    expect(can("viewer", "template", "update")).toBe(false);
    expect(can("viewer", "template", "delete")).toBe(false);
    expect(can("viewer", "template", "duplicate")).toBe(false);
  });

  it("can read, preview, and export LPs but NOT create, edit, or duplicate (D-10)", () => {
    // D-10: viewer can preview/export
    expect(can("viewer", "lp", "read")).toBe(true);
    expect(can("viewer", "lp", "preview")).toBe(true);
    expect(can("viewer", "lp", "export")).toBe(true);
    // D-10: viewer cannot create/edit/duplicate
    expect(can("viewer", "lp", "create")).toBe(false);
    expect(can("viewer", "lp", "update")).toBe(false);
    expect(can("viewer", "lp", "delete")).toBe(false);
    expect(can("viewer", "lp", "duplicate")).toBe(false);
  });

  it("can read brand config but NOT update it (D-10)", () => {
    expect(can("viewer", "brand", "read")).toBe(true);
    expect(can("viewer", "brand", "update")).toBe(false);
  });

  it("can only read assets — cannot create or delete (D-10)", () => {
    expect(can("viewer", "asset", "read")).toBe(true);
    expect(can("viewer", "asset", "create")).toBe(false);
    expect(can("viewer", "asset", "delete")).toBe(false);
  });
});

// -----------------------------------------------------------------------
// Cross-role member management invariant (D-09)
// -----------------------------------------------------------------------

describe("Member management restricted to owner and admin only (D-09)", () => {
  const memberManagementActions = ["invite", "remove", "updateRole"] as const;

  it("owner CAN manage members", () => {
    for (const action of memberManagementActions) {
      expect(can("owner", "member", action)).toBe(true);
    }
  });

  it("admin CAN manage members", () => {
    for (const action of memberManagementActions) {
      expect(can("admin", "member", action)).toBe(true);
    }
  });

  it("editor CANNOT manage members", () => {
    for (const action of memberManagementActions) {
      expect(can("editor", "member", action)).toBe(false);
    }
  });

  it("viewer CANNOT manage members", () => {
    for (const action of memberManagementActions) {
      expect(can("viewer", "member", action)).toBe(false);
    }
  });
});

// -----------------------------------------------------------------------
// Cross-role workspace settings invariant (D-11)
// -----------------------------------------------------------------------

describe("Workspace settings restricted to owner and admin only (D-11)", () => {
  it("owner CAN update workspace settings", () => {
    expect(can("owner", "workspace", "update")).toBe(true);
  });

  it("admin CAN update workspace settings", () => {
    expect(can("admin", "workspace", "update")).toBe(true);
  });

  it("editor CANNOT update workspace settings (D-11)", () => {
    expect(can("editor", "workspace", "update")).toBe(false);
  });

  it("viewer CANNOT update workspace settings (D-11)", () => {
    expect(can("viewer", "workspace", "update")).toBe(false);
  });

  it("only owner can delete workspace", () => {
    expect(can("owner", "workspace", "delete")).toBe(true);
    expect(can("admin", "workspace", "delete")).toBe(false);
    expect(can("editor", "workspace", "delete")).toBe(false);
    expect(can("viewer", "workspace", "delete")).toBe(false);
  });
});

// -----------------------------------------------------------------------
// Permission matrix consistency — permissions.ts vs guards.ts
// -----------------------------------------------------------------------

describe("Permission matrix consistency between permissions.ts and guards.ts", () => {
  it("RoleSchema includes all four roles", () => {
    expect(RoleSchema.options).toContain("owner");
    expect(RoleSchema.options).toContain("admin");
    expect(RoleSchema.options).toContain("editor");
    expect(RoleSchema.options).toContain("viewer");
  });

  it("can() returns false for unknown roles", () => {
    // Type assertion to test unknown role handling
    expect(can("unknown" as Role, "workspace", "read")).toBe(false);
  });

  it("can() returns false for unknown resources", () => {
    expect(can("owner", "billing", "read")).toBe(false);
  });

  it("can() returns false for unknown actions", () => {
    expect(can("owner", "workspace", "purge")).toBe(false);
  });

  it("ROLES constants align with RoleSchema", () => {
    expect(ROLES.OWNER).toBe("owner");
    expect(ROLES.ADMIN).toBe("admin");
    expect(ROLES.EDITOR).toBe("editor");
    expect(ROLES.VIEWER).toBe("viewer");
  });
});

// -----------------------------------------------------------------------
// Guards module — required exports
// -----------------------------------------------------------------------

describe("Guards module exports required functions", () => {
  it("exports all guard functions", async () => {
    const module = await import("@/lib/workspaces/guards");
    expect(typeof module.requireUser).toBe("function");
    expect(typeof module.requireVerifiedUser).toBe("function");
    expect(typeof module.getWorkspaceContext).toBe("function");
    expect(typeof module.requireWorkspace).toBe("function");
    expect(typeof module.requireWorkspaceRole).toBe("function");
    expect(typeof module.can).toBe("function");
  });
});
