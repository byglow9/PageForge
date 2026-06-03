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
import { CreateWorkspaceSchema, type CreateWorkspaceInput } from "./schema";
import { requireVerifiedUser } from "./guards";

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
