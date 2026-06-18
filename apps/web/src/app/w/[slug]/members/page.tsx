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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InviteLinkDialog } from "./InviteLinkDialog";

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

  // Fetch all workspace members from the AUTHORITATIVE better-auth `member`
  // table. The app-level `workspace_member` mirror is RLS-forced and is not
  // populated for reads here, so querying it (without a workspace RLS context)
  // returns zero rows. Per WR-03, membership display/authz must read the
  // authoritative member, not the mirror.
  const members = await prisma.member.findMany({
    where: { organizationId: ctx.workspaceId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch pending invitations
  const invitations = await prisma.workspaceInvitation.findMany({
    where: { workspaceId: ctx.workspaceId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  const canManage = can(ctx.role, "member", "invite");

  return (
    <div className="px-8 py-6 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="text-sm text-muted-foreground">
          Workspace: <span className="font-medium text-foreground">{slug}</span>
          {" — "}Your role:{" "}
          <Badge variant="secondary">{ctx.role}</Badge>
        </p>
      </div>

      {/* Invite form — visible only to owner/admin */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Invite a member</CardTitle>
            <CardDescription>
              Enter an email address and select a role to generate a copyable invite link.
              No email is sent automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={inviteAction} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="invite-email" className="text-sm font-medium leading-none">
                  Email address
                </label>
                <Input
                  id="invite-email"
                  name="email"
                  type="email"
                  placeholder="colleague@example.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="invite-role" className="text-sm font-medium leading-none">
                  Role
                </label>
                <select
                  id="invite-role"
                  name="role"
                  defaultValue="editor"
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="admin">Admin — manages members and settings</option>
                  <option value="editor">Editor — creates and edits content</option>
                  <option value="viewer">Viewer — read and export only</option>
                </select>
              </div>
              <Button type="submit" size="sm">Generate invite link</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Pending invitations — visible only to owner/admin */}
      {canManage && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Expires</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Invite link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invitations.map((inv) => {
                  const inviteUrl = invitationLinks.getInvitationUrl(inv.id);
                  return (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2">{inv.email}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline">{inv.role}</Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {inv.expiresAt.toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-2">
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs break-all">
                          {inviteUrl}
                        </code>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Member list */}
      <Card>
        <CardHeader>
          <CardTitle>Current members</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Role</th>
                {canManage && (
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((member) => {
                const isCurrentUser = member.userId === ctx.userId;
                return (
                  <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2 font-medium">{member.user.name || "(unnamed)"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{member.user.email}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline">{member.role}</Badge>
                    </td>
                    {canManage && (
                      <td className="px-4 py-2">
                        {!isCurrentUser && member.role !== "owner" && (
                          <div className="flex items-center gap-2">
                            <form action={changeRoleAction} className="flex items-center gap-2">
                              <input type="hidden" name="memberId" value={member.id} />
                              <select
                                name="role"
                                defaultValue={member.role}
                                className="h-7 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                              >
                                <option value="admin">Admin</option>
                                <option value="editor">Editor</option>
                                <option value="viewer">Viewer</option>
                              </select>
                              <Button type="submit" size="xs" variant="outline">
                                Change role
                              </Button>
                            </form>
                            <form action={removeAction}>
                              <input type="hidden" name="memberId" value={member.id} />
                              <Button type="submit" size="xs" variant="destructive">
                                Remove
                              </Button>
                            </form>
                          </div>
                        )}
                        {isCurrentUser && (
                          <Badge variant="secondary">(you)</Badge>
                        )}
                        {member.role === "owner" && !isCurrentUser && (
                          <Badge variant="outline">(owner)</Badge>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <InviteLinkDialog inviteUrl={inviteUrl} />
    </div>
  );
}
