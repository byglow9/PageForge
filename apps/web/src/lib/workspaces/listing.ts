/**
 * Workspace listing helper — getUserWorkspaces
 *
 * Reads from the non-RLS better-auth tables (organization + member) using
 * the session user's ID as the only filter. This is the same approach used
 * by getWorkspaceContext in guards.ts: these tables are NOT under FORCE ROW
 * LEVEL SECURITY, so they return rows regardless of whether
 * app.current_workspace_id is set (which it is NOT on the workspace index
 * page, before any workspace context is selected).
 *
 * Security design (T-02-08-02, T-02-08-03):
 * - userId is always sourced from the session (requireVerifiedUser) by the
 *   caller — it is never taken from a URL param or any client-supplied input.
 * - The WHERE clause filters strictly by userId, preventing enumeration of
 *   other users' workspaces.
 * - Does NOT touch prisma.workspace or prisma.workspaceMember (RLS tables).
 */

import { prisma } from "@/lib/db/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserWorkspace {
  /** The workspace's canonical UUID (= Organization.id in better-auth). */
  workspaceId: string;
  /** The human-readable workspace name. */
  name: string;
  /** The URL slug used in /w/{slug} routes. */
  slug: string;
  /** The session user's role in this workspace (owner | admin | editor | viewer). */
  role: string;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Return all workspaces the given user is a member of, sorted by name
 * ascending. Returns an empty array (never throws) when the user has no
 * memberships.
 *
 * @param userId - The authenticated session user's ID. MUST come from the
 *   server session (requireVerifiedUser), never from client input.
 */
export async function getUserWorkspaces(userId: string): Promise<UserWorkspace[]> {
  const members = await prisma.member.findMany({
    where: { userId },
    include: { organization: true },
    orderBy: { organization: { name: "asc" } },
  });

  return members.map((m) => ({
    workspaceId: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
  }));
}
