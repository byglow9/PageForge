/**
 * Workspace Server Actions.
 *
 * All mutations require an authenticated, verified session. workspace_id is
 * always derived from the server-side session or DB lookup — never from client
 * payload (D-12, T-02-02-04).
 *
 * "use server" directive is intentionally absent because this module is used
 * by page-level Server Action files that have the directive. This avoids
 * accidentally exposing internal helpers as callable actions.
 */
"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/prisma";
import {
  CreateWorkspaceSchema,
  UpdateWorkspaceSchema,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
} from "./schema";
import { requireVerifiedUser, requireWorkspaceRole } from "./guards";
import {
  CreateInvitationSchema,
  createInvitation,
  getInvitationUrl,
  type CreateInvitationInput,
} from "./invitations";
import { RoleSchema, type Role } from "@/lib/auth/permissions";

// -----------------------------------------------------------------------
// Action result type
// -----------------------------------------------------------------------

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

// -----------------------------------------------------------------------
// createWorkspaceAction
// -----------------------------------------------------------------------

/**
 * Create a new workspace and immediately assign the authenticated user as owner.
 *
 * This action:
 * 1. Requires a verified server session (rejects unverified users).
 * 2. Validates the input with Zod.
 * 3. Creates the Organization (better-auth) + Workspace (app-level) atomically.
 * 4. Creates a WorkspaceMember record with role "owner" for the creator.
 * 5. Redirects to `/w/{slug}` on success.
 *
 * No code path calls this during signup or login (D-04: explicit creation only).
 *
 * @throws redirect("/w/{slug}") on success — this is Next.js Server Action behavior.
 */
export async function createWorkspaceAction(
  input: CreateWorkspaceInput
): Promise<ActionResult> {
  // Step 1: Require a verified session. Throws/redirects if not authenticated or unverified.
  const user = await requireVerifiedUser();

  // Step 2: Validate input
  const parsed = CreateWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = fieldErrors[field] ?? [];
      fieldErrors[field].push(issue.message);
    }
    return { ok: false, error: "Validation failed", fieldErrors };
  }

  const { name, slug } = parsed.data;

  // Step 3: Check slug uniqueness
  const existing = await prisma.workspace.findUnique({ where: { slug } });
  if (existing) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: { slug: ["This slug is already taken"] },
    };
  }

  // Step 4: Create Workspace + Member in a transaction
  // Generate a shared workspace ID so both workspace and organization share the same PK.
  // better-auth organization plugin uses the organization table for workspace identity;
  // the app-level workspace table mirrors it so tenant-scoped queries stay consistent.
  const workspaceId = randomUUID();

  try {
    await prisma.$transaction(async (tx) => {
      // Create the app-level workspace record with explicit ID
      await tx.workspace.create({
        data: { id: workspaceId, name, slug },
      });

      // Create the org-level organization (for better-auth organization plugin)
      // Organization.id must be explicitly provided (no @default in schema)
      await tx.organization.create({
        data: { id: workspaceId, name, slug },
      });

      // Create better-auth Member record (organizationId = workspaceId)
      // Member.id must be explicitly provided (no @default in schema)
      await tx.member.create({
        data: {
          id: randomUUID(),
          organizationId: workspaceId,
          userId: user.id,
          role: "owner",
        },
      });

      // Create app-level WorkspaceMember (mirrors better-auth member for tenant queries)
      await tx.workspaceMember.create({
        data: {
          workspaceId,
          userId: user.id,
          role: "owner",
        },
      });
    });
  } catch (err: unknown) {
    // Check for unique constraint violation (slug race condition)
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint failed")
    ) {
      return {
        ok: false,
        error: "Validation failed",
        fieldErrors: { slug: ["This slug is already taken"] },
      };
    }
    console.error("[createWorkspaceAction] error:", err);
    return { ok: false, error: "Failed to create workspace. Please try again." };
  }

  // Step 5: Redirect to the new workspace (D-05)
  redirect(`/w/${slug}`);
}

// -----------------------------------------------------------------------
// createInvitationAction
// -----------------------------------------------------------------------

/**
 * Create a pending invitation for a workspace member.
 *
 * Security (D-09, T-02-03-04):
 * - Requires owner or admin role.
 * - workspaceId is derived from the server-side workspace context (requireWorkspaceRole),
 *   never from the client payload.
 * - Returns a copyable URL for /invitations/{id} (D-06).
 * - No automated email is sent in v1 (D-06).
 *
 * @param slug  - The workspace slug (used to derive workspaceId via session + membership).
 * @param input - Validated email and role.
 * @returns ActionResult with the copyable invite URL on success.
 */
export async function createInvitationAction(
  slug: string,
  input: CreateInvitationInput
): Promise<ActionResult<{ inviteUrl: string; invitationId: string }>> {
  // D-09: only owner/admin can invite members
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin"]);

  const parsed = CreateInvitationSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = fieldErrors[field] ?? [];
      fieldErrors[field].push(issue.message);
    }
    return { ok: false, error: "Validation failed", fieldErrors };
  }

  try {
    // workspaceId comes from server-side context only (T-02-03-04)
    const invitation = await createInvitation(ctx.workspaceId, parsed.data);
    const inviteUrl = getInvitationUrl(invitation.id);

    return {
      ok: true,
      data: { inviteUrl, invitationId: invitation.id },
    };
  } catch (err: unknown) {
    console.error("[createInvitationAction] error:", err);
    return { ok: false, error: "Failed to create invitation. Please try again." };
  }
}

// -----------------------------------------------------------------------
// changeMemberRoleAction
// -----------------------------------------------------------------------

/**
 * Change a workspace member's role.
 *
 * Security (D-09, T-02-03-02):
 * - Requires owner or admin role.
 * - Prevents downgrading the only owner.
 * - workspaceId is always from server context.
 *
 * @param slug     - The workspace slug.
 * @param memberId - The WorkspaceMember.id of the member to change.
 * @param newRole  - The new role to assign.
 */
export async function changeMemberRoleAction(
  slug: string,
  memberId: string,
  newRole: Role
): Promise<ActionResult> {
  // D-09: only owner/admin can change roles
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin"]);

  // Validate the new role
  const roleParsed = RoleSchema.safeParse(newRole);
  if (!roleParsed.success) {
    return { ok: false, error: "Invalid role." };
  }

  // Prevent changing to owner role via this action — owner assignment is only at creation
  if (roleParsed.data === "owner") {
    return {
      ok: false,
      error: "Cannot assign owner role via role change. Ownership transfer is not supported in v1.",
    };
  }

  // Look up the target member — must belong to this workspace
  const targetMember = await prisma.workspaceMember.findFirst({
    where: {
      id: memberId,
      workspaceId: ctx.workspaceId, // app-level isolation: ensure member is in this workspace
    },
  });

  if (!targetMember) {
    return { ok: false, error: "Member not found in this workspace." };
  }

  // Prevent downgrading the only owner (T-02-03-02)
  if (targetMember.role === "owner") {
    const ownerCount = await prisma.workspaceMember.count({
      where: { workspaceId: ctx.workspaceId, role: "owner" },
    });
    if (ownerCount <= 1) {
      return {
        ok: false,
        error: "Cannot change the role of the only owner. Assign another owner first.",
      };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Update app-level WorkspaceMember
      await tx.workspaceMember.update({
        where: { id: memberId },
        data: { role: roleParsed.data },
      });

      // Update better-auth Member (keyed by organizationId + userId)
      await tx.member.updateMany({
        where: {
          organizationId: ctx.workspaceId,
          userId: targetMember.userId,
        },
        data: { role: roleParsed.data },
      });
    });

    return { ok: true, data: undefined };
  } catch (err: unknown) {
    console.error("[changeMemberRoleAction] error:", err);
    return { ok: false, error: "Failed to update member role. Please try again." };
  }
}

// -----------------------------------------------------------------------
// removeMemberAction
// -----------------------------------------------------------------------

/**
 * Remove a member from a workspace.
 *
 * Security (D-09, T-02-03-02):
 * - Requires owner or admin role.
 * - Prevents removing the last owner.
 * - workspaceId is always from server context.
 *
 * @param slug     - The workspace slug.
 * @param memberId - The WorkspaceMember.id of the member to remove.
 */
export async function removeMemberAction(
  slug: string,
  memberId: string
): Promise<ActionResult> {
  // D-09: only owner/admin can remove members
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin"]);

  // Look up the target member — must belong to this workspace
  const targetMember = await prisma.workspaceMember.findFirst({
    where: {
      id: memberId,
      workspaceId: ctx.workspaceId, // app-level isolation
    },
  });

  if (!targetMember) {
    return { ok: false, error: "Member not found in this workspace." };
  }

  // Prevent removing the last owner (T-02-03-02)
  if (targetMember.role === "owner") {
    const ownerCount = await prisma.workspaceMember.count({
      where: { workspaceId: ctx.workspaceId, role: "owner" },
    });
    if (ownerCount <= 1) {
      return {
        ok: false,
        error: "Cannot remove the only owner. Assign another owner first.",
      };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Remove app-level WorkspaceMember
      await tx.workspaceMember.delete({
        where: { id: memberId },
      });

      // Remove better-auth Member
      await tx.member.deleteMany({
        where: {
          organizationId: ctx.workspaceId,
          userId: targetMember.userId,
        },
      });
    });

    return { ok: true, data: undefined };
  } catch (err: unknown) {
    console.error("[removeMemberAction] error:", err);
    return { ok: false, error: "Failed to remove member. Please try again." };
  }
}

// -----------------------------------------------------------------------
// updateWorkspaceSettingsAction
// -----------------------------------------------------------------------

/**
 * Update workspace name and/or slug.
 *
 * Security (D-09, D-11):
 * - Requires owner or admin role (editor/viewer cannot change settings).
 * - workspaceId is always from server context.
 *
 * @param slug  - The current workspace slug.
 * @param input - Partial workspace update (name, slug).
 */
export async function updateWorkspaceSettingsAction(
  slug: string,
  input: UpdateWorkspaceInput
): Promise<ActionResult<{ newSlug?: string }>> {
  // D-11: only owner/admin can update workspace settings
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin"]);

  const parsed = UpdateWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = fieldErrors[field] ?? [];
      fieldErrors[field].push(issue.message);
    }
    return { ok: false, error: "Validation failed", fieldErrors };
  }

  const updateData = parsed.data;

  // If slug is changing, check uniqueness
  if (updateData.slug && updateData.slug !== slug) {
    const existing = await prisma.workspace.findUnique({
      where: { slug: updateData.slug },
    });
    if (existing) {
      return {
        ok: false,
        error: "Validation failed",
        fieldErrors: { slug: ["This slug is already taken"] },
      };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: ctx.workspaceId },
        data: updateData,
      });

      // Mirror name/slug to the organization table (better-auth org plugin)
      if (updateData.name !== undefined || updateData.slug !== undefined) {
        await tx.organization.update({
          where: { id: ctx.workspaceId },
          data: updateData,
        });
      }
    });

    return { ok: true, data: { newSlug: updateData.slug } };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint failed")
    ) {
      return {
        ok: false,
        error: "Validation failed",
        fieldErrors: { slug: ["This slug is already taken"] },
      };
    }
    console.error("[updateWorkspaceSettingsAction] error:", err);
    return { ok: false, error: "Failed to update workspace settings. Please try again." };
  }
}
