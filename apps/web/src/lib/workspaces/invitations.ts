/**
 * Workspace invitation helpers.
 *
 * Implements copyable invite links (D-06). No automated email is sent in v1.
 *
 * Security design (T-02-03-01, T-02-03-04):
 * - workspaceId and role are ALWAYS read from the server-side invitation record,
 *   never from client input.
 * - Accepting an invitation requires a verified, authenticated user whose email
 *   matches the invitation email.
 * - Expired, accepted, and revoked invitations cannot be accepted.
 *
 * Invite TTL: 7 days (D-07 says expiry is a planner/executor detail).
 */
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { RoleSchema, type Role } from "@/lib/auth/permissions";
import { z } from "zod";

// -----------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------

export const CreateInvitationSchema = z.object({
  /** Email address of the person being invited. */
  email: z.string().email("A valid email address is required"),
  /** Role to assign when the invitation is accepted. */
  role: RoleSchema.exclude(["owner"]), // owners are not invited; they are the creator
});

export type CreateInvitationInput = z.infer<typeof CreateInvitationSchema>;

// -----------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------

/** Invite token TTL in seconds: 7 days. */
const INVITATION_TTL_SECONDS = 7 * 24 * 60 * 60;

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export interface InvitationRecord {
  id: string;
  workspaceId: string;
  email: string;
  role: Role;
  status: "pending" | "accepted" | "revoked";
  expiresAt: Date;
  createdAt: Date;
}

export interface AcceptInvitationResult {
  /** workspaceId of the workspace the user joined. */
  workspaceId: string;
  /** The role assigned from the invitation. */
  role: Role;
  /** The workspace slug for redirect after acceptance. */
  slug: string;
}

// -----------------------------------------------------------------------
// createInvitation
// -----------------------------------------------------------------------

/**
 * Create a pending invitation record for a workspace.
 *
 * Called by createInvitationAction (which enforces the owner/admin guard
 * before calling this helper). The workspaceId comes from the server-side
 * workspace context — never from client input (D-12, T-02-03-04).
 *
 * @param workspaceId - Server-derived workspace ID (from WorkspaceContext).
 * @param input       - Validated email and role (from CreateInvitationSchema).
 * @returns The created invitation record.
 */
export async function createInvitation(
  workspaceId: string,
  input: CreateInvitationInput
): Promise<InvitationRecord> {
  const { email, role } = input;

  const expiresAt = new Date(Date.now() + INVITATION_TTL_SECONDS * 1000);

  const invitation = await prisma.workspaceInvitation.create({
    data: {
      id: randomUUID(),
      workspaceId, // always from server context (D-12)
      email,
      role,
      expiresAt,
      status: "pending",
    },
  });

  return {
    id: invitation.id,
    workspaceId: invitation.workspaceId,
    email: invitation.email,
    role: invitation.role as Role,
    status: invitation.status as "pending" | "accepted" | "revoked",
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
}

// -----------------------------------------------------------------------
// getInvitationUrl
// -----------------------------------------------------------------------

/**
 * Build the copyable invite URL for a given invitation ID.
 *
 * The URL routes to `/invitations/{id}` which presents the accept UI.
 * No token is embedded in the URL — the ID alone is the lookup key, and
 * the invitation record is validated server-side on acceptance.
 *
 * @param invitationId - The invitation's UUID.
 * @param baseUrl      - The app's base URL (e.g. "https://pageforge.app").
 *                       Falls back to NEXT_PUBLIC_APP_URL or "http://localhost:3000".
 * @returns The full invitation URL string.
 */
export function getInvitationUrl(
  invitationId: string,
  baseUrl?: string
): string {
  const base =
    baseUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  return `${base}/invitations/${invitationId}`;
}

// -----------------------------------------------------------------------
// lookupInvitation
// -----------------------------------------------------------------------

/**
 * Look up an invitation by ID.
 *
 * Returns the invitation record or null if not found.
 * Does NOT validate expiry or status — callers must check those.
 */
export async function lookupInvitation(
  invitationId: string
): Promise<InvitationRecord | null> {
  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) return null;

  return {
    id: invitation.id,
    workspaceId: invitation.workspaceId,
    email: invitation.email,
    role: invitation.role as Role,
    status: invitation.status as "pending" | "accepted" | "revoked",
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
}

// -----------------------------------------------------------------------
// Invitation state validation helpers
// -----------------------------------------------------------------------

/** Returns true if the invitation has not expired. */
export function isInvitationActive(invitation: InvitationRecord): boolean {
  return invitation.status === "pending" && invitation.expiresAt > new Date();
}

/** Returns true if the invitation has expired (past TTL). */
export function isInvitationExpired(invitation: InvitationRecord): boolean {
  return invitation.expiresAt <= new Date();
}

// -----------------------------------------------------------------------
// acceptInvitation
// -----------------------------------------------------------------------

/**
 * Accept an invitation and create a workspace membership.
 *
 * Security requirements (T-02-03-01, T-02-03-04):
 * 1. The calling user must be authenticated and email-verified.
 * 2. The invitation must exist, be pending, and not be expired.
 * 3. The workspaceId and role are read from the invitation record ONLY —
 *    never from any client-supplied parameter.
 * 4. A duplicate membership is silently treated as already accepted
 *    (idempotent — the user may have refreshed after a partial success).
 * 5. The accepting user's email must match the invitation email.
 *
 * @param invitationId - The invitation ID from the URL (not trusted beyond lookup).
 * @param user         - Verified, authenticated user context.
 * @returns AcceptInvitationResult with workspaceId, role, and slug for redirect.
 * @throws Error with a descriptive message for invalid/expired/accepted invitations.
 */
export async function acceptInvitation(
  invitationId: string,
  user: { id: string; email: string; emailVerified: boolean }
): Promise<AcceptInvitationResult> {
  // Security: verified email is mandatory (T-02-03-01, D-02)
  if (!user.emailVerified) {
    throw new Error("Email verification is required to accept invitations.");
  }

  // Look up the invitation — workspaceId and role come from the DB row only
  const invitation = await lookupInvitation(invitationId);

  if (!invitation) {
    throw new Error("Invitation not found.");
  }

  if (invitation.status === "revoked") {
    throw new Error("This invitation has been revoked.");
  }

  if (invitation.status === "accepted") {
    throw new Error("This invitation has already been accepted.");
  }

  if (isInvitationExpired(invitation)) {
    throw new Error("This invitation has expired.");
  }

  if (
    invitation.email.trim().toLowerCase() !== user.email.trim().toLowerCase()
  ) {
    throw new Error("This invitation was issued to a different email address.");
  }

  // Security: workspaceId and role come from the invitation row (T-02-03-04)
  const { workspaceId, role } = invitation;

  // Look up the workspace slug for redirect
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    throw new Error("The workspace associated with this invitation no longer exists.");
  }

  // Create membership in a transaction — mark invitation accepted atomically
  await prisma.$transaction(async (tx) => {
    // Create app-level WorkspaceMember.
    // Use upsert for idempotency: if the user is already a member, do not
    // overwrite their existing role.
    await tx.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: user.id,
        },
      },
      create: {
        workspaceId,
        userId: user.id,
        role, // role from the invitation record (not from client) — T-02-03-04
      },
      update: {},
    });

    // Create better-auth organization Member record
    // Use upsert so re-accepts don't crash
    await tx.member.upsert({
      where: {
        organizationId_userId: {
          organizationId: workspaceId,
          userId: user.id,
        },
      },
      create: {
        id: randomUUID(),
        organizationId: workspaceId,
        userId: user.id,
        role, // from invitation record only (T-02-03-04)
      },
      update: {},
    });

    // Mark invitation as accepted
    await tx.workspaceInvitation.update({
      where: { id: invitationId },
      data: { status: "accepted" },
    });
  });

  return {
    workspaceId,
    role,
    slug: workspace.slug,
  };
}

// -----------------------------------------------------------------------
// revokeInvitation
// -----------------------------------------------------------------------

/**
 * Revoke a pending invitation.
 *
 * The workspaceId must match the invitation's workspaceId — callers must
 * supply this from their server-side WorkspaceContext (never from client input).
 *
 * @param invitationId - The invitation to revoke.
 * @param workspaceId  - The workspace context (server-derived).
 */
export async function revokeInvitation(
  invitationId: string,
  workspaceId: string
): Promise<void> {
  const invitation = await lookupInvitation(invitationId);

  if (!invitation) {
    throw new Error("Invitation not found.");
  }

  if (invitation.workspaceId !== workspaceId) {
    // Security: prevent revoking invitations from other workspaces
    throw new Error("Invitation not found.");
  }

  if (invitation.status !== "pending") {
    throw new Error("Only pending invitations can be revoked.");
  }

  await prisma.workspaceInvitation.update({
    where: { id: invitationId },
    data: { status: "revoked" },
  });
}
