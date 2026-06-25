/**
 * Workspace dashboard page — /w/[slug]
 *
 * Real dashboard with live Prisma counts and role-gated shortcut links.
 * The workspace context (membership and role) is validated by requireWorkspace.
 *
 * D-05: Active workspace resolved from /w/{slug} + server session membership.
 */
import Link from "next/link";
import { FileText, LayoutTemplate, Palette, Users } from "lucide-react";
import { requireWorkspace, can } from "@/lib/workspaces/guards";
import { prisma } from "@/lib/db/prisma";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface WorkspacePageProps {
  params: Promise<{ slug: string }>;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { slug } = await params;

  // Session-validated context — workspaceId is sourced from DB, not URL.
  const ctx = await requireWorkspace(slug);

  // Fetch all counts in parallel; workspaceId from session context (T-i1c-01).
  const [templateCount, lpCount, memberCount] = await Promise.all([
    prisma.template.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.landingPage.count({ where: { workspaceId: ctx.workspaceId } }),
    // Member uses organizationId — authoritative better-auth table (T-i1c-02).
    prisma.member.count({ where: { organizationId: ctx.workspaceId } }),
  ]);

  const canAuthorTemplates = can(ctx.role, "template", "create");
  const canEditBrand = can(ctx.role, "brand", "update");

  return (
    <div className="px-8 py-6 space-y-8">
      {/* Page header */}
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>

      {/* Metric cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{templateCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Landing Pages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{lpCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{memberCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Role card */}
      <Card className="max-w-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Your role
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-bold capitalize text-gray-900">{ctx.role}</p>
        </CardContent>
      </Card>

      {/* Shortcut links */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Quick access
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Landing Pages — always visible */}
          <Link
            href={`/w/${slug}/lps`}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50 transition-colors"
          >
            <FileText className="h-5 w-5 text-gray-500 shrink-0" aria-hidden="true" />
            <span className="text-sm font-medium text-gray-900">Landing Pages</span>
          </Link>

          {/* Members — always visible */}
          <Link
            href={`/w/${slug}/members`}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50 transition-colors"
          >
            <Users className="h-5 w-5 text-gray-500 shrink-0" aria-hidden="true" />
            <span className="text-sm font-medium text-gray-900">Members</span>
          </Link>

          {/* Templates — canAuthorTemplates only */}
          {canAuthorTemplates && (
            <Link
              href={`/w/${slug}/templates`}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50 transition-colors"
            >
              <LayoutTemplate className="h-5 w-5 text-gray-500 shrink-0" aria-hidden="true" />
              <span className="text-sm font-medium text-gray-900">Templates</span>
            </Link>
          )}

          {/* Brand Settings — canEditBrand only */}
          {canEditBrand && (
            <Link
              href={`/w/${slug}/brand`}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50 transition-colors"
            >
              <Palette className="h-5 w-5 text-gray-500 shrink-0" aria-hidden="true" />
              <span className="text-sm font-medium text-gray-900">Brand Settings</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
