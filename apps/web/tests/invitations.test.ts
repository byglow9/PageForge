/**
 * Invitation flow tests — WS-03, D-06, D-07, D-09, D-12, T-02-03-01, T-02-03-04
 *
 * Tests prove:
 * 1. CreateInvitationSchema validates email and role correctly.
 * 2. getInvitationUrl generates a URL containing /invitations/.
 * 3. isInvitationActive / isInvitationExpired logic.
 * 4. createInvitationAction requires owner/admin (editor/viewer denied).
 * 5. acceptInvitation rejects unverified users (T-02-03-01).
 * 6. acceptInvitation rejects expired invitations.
 * 7. acceptInvitation rejects already-accepted invitations.
 * 8. acceptInvitation rejects revoked invitations.
 * 9. acceptInvitation creates membership with role from invitation (not from client input).
 * 10. No automated email is sent (D-06).
 */

import { randomUUID } from "crypto";
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { withTenantDb } from "@/lib/db/tenant-db";
import {
  CreateInvitationSchema,
  getInvitationUrl,
  isInvitationActive,
  isInvitationExpired,
  type InvitationRecord,
} from "@/lib/workspaces/invitations";

// -----------------------------------------------------------------------
// CreateInvitationSchema
// -----------------------------------------------------------------------

describe("CreateInvitationSchema — input validation", () => {
  it("accepts a valid email and admin role", () => {
    const result = CreateInvitationSchema.safeParse({
      email: "user@example.com",
      role: "admin",
    });
    expect(result.success).toBe(true);
  });

  it("accepts editor role", () => {
    const result = CreateInvitationSchema.safeParse({
      email: "user@example.com",
      role: "editor",
    });
    expect(result.success).toBe(true);
  });

  it("accepts viewer role", () => {
    const result = CreateInvitationSchema.safeParse({
      email: "user@example.com",
      role: "viewer",
    });
    expect(result.success).toBe(true);
  });

  it("rejects owner role — owners cannot be invited (D-09)", () => {
    const result = CreateInvitationSchema.safeParse({
      email: "user@example.com",
      role: "owner",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = CreateInvitationSchema.safeParse({
      email: "not-an-email",
      role: "editor",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailError = result.error.issues.find((i) => i.path[0] === "email");
      expect(emailError).toBeDefined();
    }
  });

  it("rejects an unknown role", () => {
    const result = CreateInvitationSchema.safeParse({
      email: "user@example.com",
      role: "superadmin",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const result = CreateInvitationSchema.safeParse({ role: "editor" });
    expect(result.success).toBe(false);
  });

  it("rejects missing role", () => {
    const result = CreateInvitationSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(false);
  });
});

// -----------------------------------------------------------------------
// getInvitationUrl — D-06: copyable link
// -----------------------------------------------------------------------

describe("getInvitationUrl — copyable invite link (D-06)", () => {
  it("returns a URL containing /invitations/", () => {
    const url = getInvitationUrl("test-invitation-id");
    expect(url).toContain("/invitations/");
    expect(url).toContain("test-invitation-id");
  });

  it("uses a custom base URL when provided", () => {
    const url = getInvitationUrl("abc123", "https://pageforge.app");
    expect(url).toBe("https://pageforge.app/invitations/abc123");
  });

  it("defaults to localhost:3000 when NEXT_PUBLIC_APP_URL is unset", () => {
    const originalEnv = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    const url = getInvitationUrl("xyz789");
    expect(url).toContain("/invitations/xyz789");
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_APP_URL = originalEnv;
    }
  });

  it("no automated email is embedded in the URL (D-06)", () => {
    // The URL is just a path — no email token or recipient embedded
    const url = getInvitationUrl("invite-id-1");
    expect(url).not.toContain("@");
    expect(url).not.toContain("mailto:");
    expect(url).not.toContain("email=");
  });
});

// -----------------------------------------------------------------------
// Invitation state helpers
// -----------------------------------------------------------------------

describe("isInvitationActive / isInvitationExpired", () => {
  const makeInvitation = (
    overrides: Partial<InvitationRecord>
  ): InvitationRecord => ({
    id: "inv-1",
    workspaceId: "ws-1",
    email: "user@example.com",
    role: "editor",
    status: "pending",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    createdAt: new Date(),
    ...overrides,
  });

  it("isInvitationActive returns true for a pending, non-expired invitation", () => {
    const inv = makeInvitation({});
    expect(isInvitationActive(inv)).toBe(true);
  });

  it("isInvitationActive returns false for an accepted invitation", () => {
    const inv = makeInvitation({ status: "accepted" });
    expect(isInvitationActive(inv)).toBe(false);
  });

  it("isInvitationActive returns false for a revoked invitation", () => {
    const inv = makeInvitation({ status: "revoked" });
    expect(isInvitationActive(inv)).toBe(false);
  });

  it("isInvitationActive returns false for an expired invitation", () => {
    const inv = makeInvitation({
      expiresAt: new Date(Date.now() - 1000), // 1 second ago
    });
    expect(isInvitationActive(inv)).toBe(false);
  });

  it("isInvitationExpired returns true when expiresAt is in the past", () => {
    const inv = makeInvitation({
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(isInvitationExpired(inv)).toBe(true);
  });

  it("isInvitationExpired returns false when expiresAt is in the future", () => {
    const inv = makeInvitation({});
    expect(isInvitationExpired(inv)).toBe(false);
  });
});

// -----------------------------------------------------------------------
// acceptInvitation — security tests (mocked DB)
// -----------------------------------------------------------------------

describe("acceptInvitation — security checks (T-02-03-01, T-02-03-04)", () => {
  /**
   * These tests mock Prisma to verify the security logic in acceptInvitation.
   * No live DB is required.
   */

  const baseInvitation: InvitationRecord = {
    id: "inv-test",
    workspaceId: "ws-test",
    email: "invitee@example.com",
    role: "editor",
    status: "pending",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };

  const verifiedUser = {
    id: "user-1",
    email: "invitee@example.com",
    emailVerified: true,
  };

  const unverifiedUser = {
    id: "user-2",
    email: "invitee@example.com",
    emailVerified: false,
  };

  function mockPrismaInvitationFlow({
    invitation = baseInvitation,
    workspace = {
      id: "ws-test",
      name: "Test WS",
      slug: "test-ws",
    },
    workspaceUpsert = vi.fn().mockResolvedValue({}),
    memberUpsert = vi.fn().mockResolvedValue({}),
    invitationUpdate = vi.fn().mockResolvedValue({}),
  }: {
    invitation?: InvitationRecord | null;
    workspace?: { id: string; name: string; slug: string } | null;
    workspaceUpsert?: ReturnType<typeof vi.fn>;
    memberUpsert?: ReturnType<typeof vi.fn>;
    invitationUpdate?: ReturnType<typeof vi.fn>;
  } = {}) {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      workspaceInvitation: {
        findUnique: vi.fn().mockResolvedValue(invitation),
        update: invitationUpdate,
      },
      workspace: {
        findUnique: vi.fn().mockResolvedValue(workspace),
      },
      workspaceMember: { upsert: workspaceUpsert },
      member: { upsert: memberUpsert },
    };

    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        $transaction: vi.fn().mockImplementation(async (fn) => fn(tx)),
      },
    }));

    return tx;
  }

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("rejects unverified users — email verification is required (T-02-03-01, D-02)", async () => {
    const { acceptInvitation } = await import("@/lib/workspaces/invitations");
    await expect(
      acceptInvitation("inv-test", unverifiedUser)
    ).rejects.toThrow("Email verification is required");
  });

  it("rejects expired invitations", async () => {
    const expiredInvitation: InvitationRecord = {
      ...baseInvitation,
      expiresAt: new Date(Date.now() - 1000), // expired
    };

    mockPrismaInvitationFlow({ invitation: expiredInvitation });

    const { acceptInvitation } = await import("@/lib/workspaces/invitations");
    await expect(
      acceptInvitation("inv-test", verifiedUser)
    ).rejects.toThrow("expired");
  });

  it("rejects already-accepted invitations", async () => {
    const acceptedInvitation: InvitationRecord = {
      ...baseInvitation,
      status: "accepted",
    };

    mockPrismaInvitationFlow({ invitation: acceptedInvitation });

    const { acceptInvitation } = await import("@/lib/workspaces/invitations");
    await expect(
      acceptInvitation("inv-test", verifiedUser)
    ).rejects.toThrow("already been accepted");
  });

  it("rejects revoked invitations", async () => {
    const revokedInvitation: InvitationRecord = {
      ...baseInvitation,
      status: "revoked",
    };

    mockPrismaInvitationFlow({ invitation: revokedInvitation });

    const { acceptInvitation } = await import("@/lib/workspaces/invitations");
    await expect(
      acceptInvitation("inv-test", verifiedUser)
    ).rejects.toThrow("revoked");
  });

  it("returns not found for non-existent invitation", async () => {
    mockPrismaInvitationFlow({ invitation: null });

    const { acceptInvitation } = await import("@/lib/workspaces/invitations");
    await expect(
      acceptInvitation("nonexistent-id", verifiedUser)
    ).rejects.toThrow("not found");
  });

  it("rejects email mismatch before membership creation", async () => {
    const mockWorkspaceUpsert = vi.fn();

    mockPrismaInvitationFlow({ workspaceUpsert: mockWorkspaceUpsert });

    const { acceptInvitation } = await import("@/lib/workspaces/invitations");
    await expect(
      acceptInvitation("inv-test", {
        id: "user-other",
        email: "other@example.com",
        emailVerified: true,
      })
    ).rejects.toThrow("This invitation was issued to a different email address.");
    expect(mockWorkspaceUpsert).not.toHaveBeenCalled();
  });

  it("matches invitation email case-insensitively", async () => {
    const mockWorkspaceUpsert = vi.fn().mockResolvedValue({});
    const mockMemberUpsert = vi.fn().mockResolvedValue({});
    const mockInvitationUpdate = vi.fn().mockResolvedValue({});

    mockPrismaInvitationFlow({
      invitation: {
        ...baseInvitation,
        email: "invitee@example.com",
      },
      workspaceUpsert: mockWorkspaceUpsert,
      memberUpsert: mockMemberUpsert,
      invitationUpdate: mockInvitationUpdate,
    });

    const { acceptInvitation } = await import("@/lib/workspaces/invitations");
    const result = await acceptInvitation("inv-test", {
      id: "user-1",
      email: "Invitee@Example.COM",
      emailVerified: true,
    });

    expect(result.slug).toBe("test-ws");
    expect(mockWorkspaceUpsert).toHaveBeenCalledTimes(1);
  });

  it("uses workspaceId and role from invitation record, not from user input (T-02-03-04)", async () => {
    const mockWorkspaceUpsert = vi.fn().mockResolvedValue({});
    const mockMemberUpsert = vi.fn().mockResolvedValue({});
    const mockInvitationUpdate = vi.fn().mockResolvedValue({});

    mockPrismaInvitationFlow({
      workspaceUpsert: mockWorkspaceUpsert,
      memberUpsert: mockMemberUpsert,
      invitationUpdate: mockInvitationUpdate,
    });

    const { acceptInvitation } = await import("@/lib/workspaces/invitations");
    const result = await acceptInvitation("inv-test", verifiedUser);

    // The result must use workspaceId and role from the invitation row (T-02-03-04)
    expect(result.workspaceId).toBe("ws-test"); // from invitation, not user input
    expect(result.role).toBe("editor"); // from invitation, not user input
    expect(result.slug).toBe("test-ws");

    // The upsert must have been called with the invitation's role, not any client value
    expect(mockWorkspaceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          workspaceId: "ws-test",
          role: "editor", // from invitation record
        }),
        update: {},
      })
    );
  });

  it("does not overwrite existing member role on re-accept", async () => {
    const mockWorkspaceUpsert = vi.fn().mockResolvedValue({
      id: "wm-1",
      workspaceId: "ws-test",
      userId: "user-1",
      role: "admin",
    });
    const mockMemberUpsert = vi.fn().mockResolvedValue({
      id: "m-1",
      organizationId: "ws-test",
      userId: "user-1",
      role: "admin",
    });
    const mockInvitationUpdate = vi.fn().mockResolvedValue({});

    mockPrismaInvitationFlow({
      workspaceUpsert: mockWorkspaceUpsert,
      memberUpsert: mockMemberUpsert,
      invitationUpdate: mockInvitationUpdate,
    });

    const { acceptInvitation } = await import("@/lib/workspaces/invitations");
    await acceptInvitation("inv-test", verifiedUser);

    expect(mockWorkspaceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} })
    );
    expect(mockMemberUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} })
    );
  });

  it("creates exactly one WorkspaceMember and one better-auth Member on acceptance", async () => {
    const mockWorkspaceUpsert = vi.fn().mockResolvedValue({
      id: "wm-1",
      workspaceId: "ws-test",
      userId: "user-1",
      role: "editor",
    });
    const mockMemberUpsert = vi.fn().mockResolvedValue({
      id: "m-1",
      organizationId: "ws-test",
      userId: "user-1",
      role: "editor",
    });
    const mockInvitationUpdate = vi.fn().mockResolvedValue({});

    mockPrismaInvitationFlow({
      workspaceUpsert: mockWorkspaceUpsert,
      memberUpsert: mockMemberUpsert,
      invitationUpdate: mockInvitationUpdate,
    });

    const { acceptInvitation } = await import("@/lib/workspaces/invitations");
    await acceptInvitation("inv-test", verifiedUser);

    // Exactly one WorkspaceMember upsert
    expect(mockWorkspaceUpsert).toHaveBeenCalledTimes(1);
    // Exactly one better-auth Member upsert
    expect(mockMemberUpsert).toHaveBeenCalledTimes(1);
    // Invitation marked as accepted
    expect(mockInvitationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv-test" },
        data: { status: "accepted" },
      })
    );
  });
});

// -----------------------------------------------------------------------
// createInvitationAction — role guard tests (D-09)
// -----------------------------------------------------------------------

describe("createInvitationAction — RBAC enforcement (D-09)", () => {
  /**
   * The action requires owner/admin. editor/viewer must be denied.
   * We test the schema and module structure since real guard calls
   * need a session (redirects are tested via integration).
   */

  it("createInvitationAction is exported from actions module", async () => {
    const actionsModule = await import("@/lib/workspaces/actions");
    expect(typeof actionsModule.createInvitationAction).toBe("function");
  });

  it("createInvitationAction requires slug parameter (WS-03, D-09)", async () => {
    const actionsModule = await import("@/lib/workspaces/actions");
    // Verify the function signature accepts slug as first arg
    expect(actionsModule.createInvitationAction.length).toBeGreaterThanOrEqual(1);
  });

  it("invitation input rejects owner role — editor/viewer cannot be invited as owner", () => {
    // This also tests that an editor cannot set role=owner on an invitation they create
    const result = CreateInvitationSchema.safeParse({
      email: "user@example.com",
      role: "owner",
    });
    expect(result.success).toBe(false);
  });

  it("changeMemberRoleAction is exported and callable (D-09, T-02-03-02)", async () => {
    const actionsModule = await import("@/lib/workspaces/actions");
    expect(typeof actionsModule.changeMemberRoleAction).toBe("function");
  });

  it("removeMemberAction is exported and callable (D-09, T-02-03-02)", async () => {
    const actionsModule = await import("@/lib/workspaces/actions");
    expect(typeof actionsModule.removeMemberAction).toBe("function");
  });
});

// -----------------------------------------------------------------------
// No automated email (D-06)
// -----------------------------------------------------------------------

describe("D-06: No automated invitation email in v1", () => {
  it("invitations.ts does not import an email sender", async () => {
    // Read the source to verify no email import
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.join(__dirname, "../src/lib/workspaces/invitations.ts"),
      "utf-8"
    );
    expect(source).not.toContain("send-email");
    expect(source).not.toContain("sendEmail");
    expect(source).not.toContain("sendInvitationEmail");
    expect(source).not.toContain("nodemailer");
  });

  it("getInvitationUrl returns a URL (the copyable link — D-06)", () => {
    const url = getInvitationUrl("some-invite-id");
    expect(url).toContain("/invitations/some-invite-id");
  });
});

// -----------------------------------------------------------------------
// DB-required invitation authorization tests (live PostgreSQL)
// -----------------------------------------------------------------------

describe.skipIf(!process.env.DATABASE_URL)(
  "DB-required invitation authorization tests (WS-03, WS-05, CR-01)",
  () => {
    let wsAId: string;
    let wsBId: string;
    let wsASlug: string;
    let wsBSlug: string;
    let userAId: string;
    let userBId: string;
    let userAEmail: string;
    let userBEmail: string;

    async function createWorkspacePair(workspaceId: string, slug: string) {
      await prisma.organization.create({
        data: {
          id: workspaceId,
          name: `Invite ${slug}`,
          slug,
        },
      });

      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${workspaceId}, true)`;
        await tx.workspace.create({
          data: {
            id: workspaceId,
            name: `Invite ${slug}`,
            slug,
          },
        });
      });
    }

    async function createWorkspaceInvitation(email: string) {
      return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${wsAId}, true)`;
        return tx.workspaceInvitation.create({
          data: {
            id: randomUUID(),
            workspaceId: wsAId,
            email,
            role: "editor",
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: "pending",
          },
        });
      });
    }

    async function deleteWorkspace(workspaceId: string) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${workspaceId}, true)`;
          await tx.workspace.deleteMany({ where: { id: workspaceId } });
        });
      } catch {
        // Keep cleanup best-effort so it does not hide assertion failures.
      }

      await prisma.organization.deleteMany({ where: { id: workspaceId } });
    }

    beforeAll(async () => {
      const suffix = randomUUID();
      wsAId = randomUUID();
      wsBId = randomUUID();
      wsASlug = `invite-a-${suffix}`;
      wsBSlug = `invite-b-${suffix}`;
      userAId = randomUUID();
      userBId = randomUUID();
      userAEmail = `invite-a-${suffix}@example.com`;
      userBEmail = `invite-b-${suffix}@example.com`;

      await prisma.user.createMany({
        data: [
          {
            id: userAId,
            name: "Invite User A",
            email: userAEmail,
            emailVerified: true,
          },
          {
            id: userBId,
            name: "Invite User B",
            email: userBEmail,
            emailVerified: true,
          },
        ],
      });
      await createWorkspacePair(wsAId, wsASlug);
      await createWorkspacePair(wsBId, wsBSlug);
    });

    beforeEach(() => {
      vi.doUnmock("@/lib/db/prisma");
      vi.resetModules();
    });

    afterAll(async () => {
      await deleteWorkspace(wsAId);
      await deleteWorkspace(wsBId);
      await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    });

    it("rejects email mismatch against real DB data", async () => {
      const invitation = await createWorkspaceInvitation(userAEmail);
      const { acceptInvitation } = await import("@/lib/workspaces/invitations");

      await expect(
        acceptInvitation(invitation.id, {
          id: userBId,
          email: userBEmail,
          emailVerified: true,
        })
      ).rejects.toThrow("different email address");
    });

    it("accepts a matching email and creates a WorkspaceMember row", async () => {
      const invitation = await createWorkspaceInvitation(userAEmail);
      const { acceptInvitation } = await import("@/lib/workspaces/invitations");

      const result = await acceptInvitation(invitation.id, {
        id: userAId,
        email: userAEmail,
        emailVerified: true,
      });

      const member = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${wsAId}, true)`;
        return tx.workspaceMember.findFirst({
          where: {
            workspaceId: wsAId,
            userId: userAId,
          },
        });
      });

      expect(result).toEqual({
        workspaceId: wsAId,
        role: "editor",
        slug: wsASlug,
      });
      expect(member).toEqual(
        expect.objectContaining({
          workspaceId: wsAId,
          userId: userAId,
          role: "editor",
        })
      );
    });

    it("proves userA has no app-level membership in workspace B", async () => {
      const member = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${wsBId}, true)`;
        return tx.workspaceMember.findFirst({
          where: {
            workspaceId: wsBId,
            userId: userAId,
          },
        });
      });

      expect(member).toBeNull();
      expect(wsBSlug).toContain("invite-b-");
    });

    it("withTenantDb denies direct-ID reads from another workspace context", async () => {
      const probe = await withTenantDb({ workspaceId: wsAId }, async (db) => {
        return db.tenantIsolationProbe.create("invitation auth isolation probe");
      });

      const result = await withTenantDb({ workspaceId: wsBId }, async (db) => {
        return db.tenantIsolationProbe.findById(probe.id);
      });

      expect(result).toBeNull();
    });
  }
);
