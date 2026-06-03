/**
 * PageForge role/permission vocabulary.
 *
 * Single source of truth for roles and permission statements.
 * Consumed by better-auth organization plugin (server + client) and by
 * application-level guards. Never define role strings inline elsewhere.
 */
import { createAccessControl } from "better-auth/plugins/access";
import { z } from "zod";

// -----------------------------------------------------------------------
// Role schema — enforced at form/action boundaries
// -----------------------------------------------------------------------

export const RoleSchema = z.enum(["owner", "admin", "editor", "viewer"]);
export type Role = z.infer<typeof RoleSchema>;

export const ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  EDITOR: "editor",
  VIEWER: "viewer",
} as const satisfies Record<string, Role>;

// -----------------------------------------------------------------------
// Permission statements — resources and their allowed actions
// -----------------------------------------------------------------------

/**
 * The statement object defines all resources and actions in the system.
 * Keep this stable; adding a resource here is a deliberate contract change.
 */
export const statement = {
  // Workspace-level management
  workspace: ["read", "update", "delete"],
  // Member management
  member: ["invite", "remove", "updateRole", "read"],
  // Content (future phases)
  template: ["create", "read", "update", "delete", "duplicate"],
  lp: ["create", "read", "update", "delete", "duplicate", "preview", "export"],
  brand: ["read", "update"],
  asset: ["create", "read", "delete"],
} as const;

// -----------------------------------------------------------------------
// Access controller and role definitions
// -----------------------------------------------------------------------

export const ac = createAccessControl(statement);

/**
 * owner — single workspace owner.
 * Full access to all resources. Billing/deletion are future, but the role
 * is distinct from admin so it can be gated separately.
 */
export const owner = ac.newRole({
  workspace: ["read", "update", "delete"],
  member: ["invite", "remove", "updateRole", "read"],
  template: ["create", "read", "update", "delete", "duplicate"],
  lp: ["create", "read", "update", "delete", "duplicate", "preview", "export"],
  brand: ["read", "update"],
  asset: ["create", "read", "delete"],
});

/**
 * admin — manages members and workspace settings (not owner-only destructive ops).
 */
export const admin = ac.newRole({
  workspace: ["read", "update"],
  member: ["invite", "remove", "updateRole", "read"],
  template: ["create", "read", "update", "delete", "duplicate"],
  lp: ["create", "read", "update", "delete", "duplicate", "preview", "export"],
  brand: ["read", "update"],
  asset: ["create", "read", "delete"],
});

/**
 * editor — content only; cannot manage members or workspace settings.
 */
export const editor = ac.newRole({
  workspace: ["read"],
  member: ["read"],
  template: ["create", "read", "update", "delete", "duplicate"],
  lp: ["create", "read", "update", "delete", "duplicate", "preview", "export"],
  brand: ["read", "update"],
  asset: ["create", "read", "delete"],
});

/**
 * viewer — read/preview/export; no create/edit/duplicate.
 */
export const viewer = ac.newRole({
  workspace: ["read"],
  member: ["read"],
  template: ["read"],
  lp: ["read", "preview", "export"],
  brand: ["read"],
  asset: ["read"],
});

// Convenience export for passing to organization plugin
export const roles = { owner, admin, editor, viewer } as const;
