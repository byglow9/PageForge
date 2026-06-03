/**
 * Members page — workspace member management.
 *
 * Visible to all workspace members (read-only for editor/viewer).
 * Invite, remove, and role-change controls are only rendered for owner/admin (D-09).
 *
 * Security (D-09, D-12, T-02-03-02):
 * - workspaceId and role are resolved from the server session + membership check.
 * - Invite/remove/role-change actions are gated by requireWorkspaceRole on the server.
 * - The invitation URL is generated server-side; the client only copies/displays it.
 */
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspace } from "@/lib/workspaces/guards";
import { can } from "@/lib/workspaces/guards";
import * as workspaceActions from "@/lib/workspaces/actions";
import * as invitationLinks from "@/lib/workspaces/invitations";
import type { CreateInvitationInput } from "@/lib/workspaces/invitations";
import type { Role } from "@/lib/auth/permissions";

interface MembersPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ inviteUrl?: string }>;
}

export default async function MembersPage({
  params,
  searchParams,
}: MembersPageProps) {
  const { slug } = await params;
  const { inviteUrl } = await searchParams;
  const ctx = await requireWorkspace(slug);

  async function inviteAction(formData: FormData): Promise<void> {
    "use server";
    const email = String(formData.get("email") ?? "");
    const role = String(formData.get("role") ?? "") as CreateInvitationInput["role"];
    const result = await workspaceActions.createInvitationAction(slug, { email, role });
    if (result.ok) {
      redirect(
        `/w/${slug}/members?inviteUrl=${encodeURIComponent(result.data.inviteUrl)}`
      );
    }
    redirect(`/w/${slug}/members`);
  }

  async function changeRoleAction(formData: FormData): Promise<void> {
    "use server";
    const memberId = String(formData.get("memberId") ?? "");
    const role = String(formData.get("role") ?? "") as Role;
    await workspaceActions.changeMemberRoleAction(slug, memberId, role);
    redirect(`/w/${slug}/members`);
  }

  async function removeAction(formData: FormData): Promise<void> {
    "use server";
    const memberId = String(formData.get("memberId") ?? "");
    await workspaceActions.removeMemberAction(slug, memberId);
    redirect(`/w/${slug}/members`);
  }

  // Fetch all workspace members with their user info
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: {
      workspace: false,
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch user display info for each member
  const userIds = members.map((m) => m.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  // Fetch pending invitations
  const invitations = await prisma.workspaceInvitation.findMany({
    where: { workspaceId: ctx.workspaceId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  const canManage = can(ctx.role, "member", "invite");

  return (
    <div>
      <div>
        <h1>Members</h1>
        <p>
          Workspace: <strong>{slug}</strong> — Your role: <strong>{ctx.role}</strong>
        </p>
      </div>

      {/* Invite form — visible only to owner/admin */}
      {canManage && (
        <section>
          <h2>Invite a member</h2>
          {inviteUrl && (
            <p>
              Copyable invite link: <code>{inviteUrl}</code>
            </p>
          )}
          <p>
            Enter an email address and select a role to generate a copyable invite link.
            No email is sent automatically (v1 — D-06).
          </p>
          <form action={inviteAction}>
            <div>
              <label htmlFor="invite-email">Email address</label>
              <input
                id="invite-email"
                name="email"
                type="email"
                placeholder="colleague@example.com"
                required
              />
            </div>
            <div>
              <label htmlFor="invite-role">Role</label>
              <select id="invite-role" name="role" defaultValue="editor">
                <option value="admin">Admin — manages members and settings</option>
                <option value="editor">Editor — creates and edits content</option>
                <option value="viewer">Viewer — read and export only</option>
              </select>
            </div>
            <button type="submit">Generate invite link</button>
          </form>
        </section>
      )}

      {/* Pending invitations — visible only to owner/admin */}
      {canManage && invitations.length > 0 && (
        <section>
          <h2>Pending invitations</h2>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Expires</th>
                <th>Invite link</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => {
                const inviteUrl = invitationLinks.getInvitationUrl(inv.id);
                return (
                  <tr key={inv.id}>
                    <td>{inv.email}</td>
                    <td>{inv.role}</td>
                    <td>
                      {inv.expiresAt.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td>
                      <code>{inviteUrl}</code>
                      {/* Copy button — client-side copy of this URL */}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Member list */}
      <section>
        <h2>Current members</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const user = userMap.get(member.userId);
              const isCurrentUser = member.userId === ctx.userId;
              return (
                <tr key={member.id}>
                  <td>{user?.name ?? "(unknown)"}</td>
                  <td>{user?.email ?? "(unknown)"}</td>
                  <td>
                    <span>{member.role}</span>
                  </td>
                  {canManage && (
                    <td>
                      {/* Role change and remove forms — wired server-side in v1 */}
                      {!isCurrentUser && member.role !== "owner" && (
                        <>
                          <form
                            action={changeRoleAction}
                            style={{ display: "inline" }}
                          >
                            <input type="hidden" name="memberId" value={member.id} />
                            <select name="role" defaultValue={member.role}>
                              <option value="admin">Admin</option>
                              <option value="editor">Editor</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <button type="submit">Change role</button>
                          </form>
                          <form
                            action={removeAction}
                            style={{ display: "inline", marginLeft: "0.5rem" }}
                          >
                            <input type="hidden" name="memberId" value={member.id} />
                            <button type="submit">Remove</button>
                          </form>
                        </>
                      )}
                      {isCurrentUser && <span>(you)</span>}
                      {member.role === "owner" && !isCurrentUser && (
                        <span>(owner)</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
