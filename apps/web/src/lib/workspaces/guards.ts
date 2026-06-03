/**
 * Server-side authentication and workspace guards.
 *
 * All guards must be called inside Server Components, Server Actions, or
 * route handlers — never on the client.
 *
 * Security design (D-12, T-02-02-01, T-02-02-02):
 * - The slug from the URL is a routing hint only; it is NEVER trusted without
 *   a membership check against the server session.
 * - workspaceId is always resolved from the server session and DB lookup.
 * - Every workspace data access must go through getWorkspaceContext() or
 *   requireWorkspace() before querying tenant data.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { RoleSchema, type Role } from "@/lib/auth/permissions";

// -----------------------------------------------------------------------
// Context types
// -----------------------------------------------------------------------

export interface UserContext {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export interface WorkspaceContext {
  /** The workspace's canonical UUID (= Organization.id in better-auth). */
  workspaceId: string;
  /** The URL slug — validated against membership. */
  workspaceSlug: string;
  /** The authenticated user's ID. */
  userId: string;
  /** The user's role in this workspace. */
  role: Role;
}

// -----------------------------------------------------------------------
// Session-level guards
// -----------------------------------------------------------------------

/**
 * Require an authenticated session. Redirects to /login if no session exists.
 * Does NOT check email verification.
 */
export async function requireUser(): Promise<UserContext> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.user) {
    redirect("/login");
  }

  return {
    id: session.user.id,
    email: session.user.email,
    emailVerified: session.user.emailVerified,
    name: session.user.name,
  };
}

/**
 * Require an authenticated AND email-verified session.
 * Redirects to /login if no session, or to /verify-email if unverified.
 *
 * This guard must be called at the top of any Server Action or page that
 * creates or manages workspace data (D-02, D-12).
 */
export async function requireVerifiedUser(): Promise<UserContext> {
  const user = await requireUser();

  if (!user.emailVerified) {
    redirect("/verify-email");
  }

  return user;
}

// -----------------------------------------------------------------------
// Workspace-level guards
// -----------------------------------------------------------------------

/**
 * Resolve workspace context from a URL slug for the current session user.
 *
 * This function:
 * 1. Requires a verified session (D-02).
 * 2. Looks up the workspace by slug.
 * 3. Verifies the current user is a member of that workspace.
 * 4. Returns workspaceId, workspaceSlug, userId, and role.
 *
 * Returns null if the workspace does not exist or the user is not a member.
 * Use requireWorkspace() for guards that should redirect on failure.
 *
 * Security: the slug is validated against session membership — it is never
 * trusted as an authoritative source of workspace identity on its own (D-12).
 */
export async function getWorkspaceContext(
  slug: string
): Promise<WorkspaceContext | null> {
  const user = await requireVerifiedUser();

  const workspace = await prisma.workspace.findUnique({
    where: { slug },
  });

  if (!workspace) {
    return null;
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
  });

  if (!membership) {
    return null;
  }

  // Validate the role string against the known role enum
  const roleParsed = RoleSchema.safeParse(membership.role);
  if (!roleParsed.success) {
    // Unknown role stored in DB — treat as unauthorized
    return null;
  }

  return {
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    userId: user.id,
    role: roleParsed.data,
  };
}

/**
 * Require workspace context. Redirects to /workspaces/new if workspace not
 * found or user is not a member.
 *
 * Returns WorkspaceContext for use in workspace pages and actions.
 */
export async function requireWorkspace(slug: string): Promise<WorkspaceContext> {
  const ctx = await getWorkspaceContext(slug);

  if (!ctx) {
    redirect("/workspaces/new");
  }

  return ctx;
}

/**
 * Require workspace membership with one of the specified roles.
 * Redirects to the workspace root if the user's role is not in allowedRoles.
 *
 * Use this guard at the top of actions or pages that require specific roles
 * (e.g., member management requires owner or admin).
 */
export async function requireWorkspaceRole(
  slug: string,
  allowedRoles: Role[]
): Promise<WorkspaceContext> {
  const ctx = await requireWorkspace(slug);

  if (!allowedRoles.includes(ctx.role)) {
    redirect(`/w/${slug}`);
  }

  return ctx;
}

// -----------------------------------------------------------------------
// Permission check helper
// -----------------------------------------------------------------------

/**
 * Check whether a given role has a specific action on a resource.
 *
 * This is a convenience wrapper over the permission matrix defined in
 * permissions.ts. Use it for conditional UI rendering and action-level checks.
 *
 * For authoritative enforcement, use requireWorkspaceRole() which will
 * redirect on failure rather than just returning false.
 *
 * @param role - The role to check (owner | admin | editor | viewer)
 * @param resource - The resource name (workspace | member | template | lp | brand | asset)
 * @param action - The action name (read | update | delete | invite | remove | ...)
 */
export function can(
  role: Role,
  resource: string,
  action: string
): boolean {
  const matrix: Record<string, Record<string, string[]>> = {
    owner: {
      workspace: ["read", "update", "delete"],
      member: ["invite", "remove", "updateRole", "read"],
      template: ["create", "read", "update", "delete", "duplicate"],
      lp: ["create", "read", "update", "delete", "duplicate", "preview", "export"],
      brand: ["read", "update"],
      asset: ["create", "read", "delete"],
    },
    admin: {
      workspace: ["read", "update"],
      member: ["invite", "remove", "updateRole", "read"],
      template: ["create", "read", "update", "delete", "duplicate"],
      lp: ["create", "read", "update", "delete", "duplicate", "preview", "export"],
      brand: ["read", "update"],
      asset: ["create", "read", "delete"],
    },
    editor: {
      workspace: ["read"],
      member: ["read"],
      template: ["create", "read", "update", "delete", "duplicate"],
      lp: ["create", "read", "update", "delete", "duplicate", "preview", "export"],
      brand: ["read", "update"],
      asset: ["create", "read", "delete"],
    },
    viewer: {
      workspace: ["read"],
      member: ["read"],
      template: ["read"],
      lp: ["read", "preview", "export"],
      brand: ["read"],
      asset: ["read"],
    },
  };

  return matrix[role]?.[resource]?.includes(action) ?? false;
}
