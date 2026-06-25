/**
 * Workspace dashboard page — /w/[slug]
 *
 * Real dashboard with live Prisma counts and role-gated shortcut links.
 * The workspace context (membership and role) is validated by requireWorkspace.
 *
 * D-05: Active workspace resolved from /w/{slug} + server session membership.
 */
import Link from "next/link";
import {
  Clock,
  Download,
  Eye,
  FileText,
  LayoutTemplate,
  Pencil,
  TriangleAlert,
  Users,
} from "lucide-react";
import { requireWorkspace, can } from "@/lib/workspaces/guards";
import { prisma } from "@/lib/db/prisma";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface WorkspacePageProps {
  params: Promise<{ slug: string }>;
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffDays = Math.floor(diffH / 24);
  return `há ${diffDays} dias`;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { slug } = await params;

  // Session-validated context — workspaceId is sourced from DB, not URL.
  const ctx = await requireWorkspace(slug);

  // Fetch all data in parallel; workspaceId from session context (T-ihz-03).
  const [
    templateCount,
    lpCount,
    memberCount,
    lpWithoutFolderCount,
    recentLps,
    recentTemplates,
    brandConfig,
    pendingInviteCount,
  ] = await Promise.all([
    prisma.template.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.landingPage.count({ where: { workspaceId: ctx.workspaceId } }),
    // Member uses organizationId — authoritative better-auth table.
    prisma.member.count({ where: { organizationId: ctx.workspaceId } }),
    prisma.landingPage.count({
      where: { workspaceId: ctx.workspaceId, folderId: null },
    }),
    prisma.landingPage.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        kind: true,
        folderId: true,
        updatedAt: true,
        folder: { select: { name: true } },
      },
    }),
    prisma.template.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, name: true, kind: true },
    }),
    prisma.brandConfig.findUnique({ where: { workspaceId: ctx.workspaceId } }),
    prisma.workspaceInvitation.count({
      where: { workspaceId: ctx.workspaceId, status: "pending" },
    }),
  ]);

  const canCreateLp = can(ctx.role, "lp", "create");
  const canCreateTemplate = can(ctx.role, "template", "create");
  const canEditBrand = can(ctx.role, "brand", "update");
  const showBrandAlert =
    canEditBrand &&
    (!brandConfig || (!brandConfig.primaryColor && !brandConfig.logoUrl));
  const showInviteAlert = ctx.role !== "viewer" && pendingInviteCount > 0;

  return (
    <div className="px-8 py-6 space-y-8">
      {/* Page header */}
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>

      {/* Setup alerts (T-ihz-01: gated by role) */}
      {(showBrandAlert || showInviteAlert) && (
        <div className="space-y-2">
          {showBrandAlert && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg px-4 py-3 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <TriangleAlert
                  className="h-4 w-4 text-amber-600 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Configure a marca do workspace para personalizar suas LPs.
                </span>
              </div>
              <Link
                href={`/w/${slug}/brand`}
                className="text-amber-700 font-medium hover:underline shrink-0 ml-4"
              >
                Configurar marca
              </Link>
            </div>
          )}
          {showInviteAlert && (
            <div className="border border-blue-200 bg-blue-50 rounded-lg px-4 py-3 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Users
                  className="h-4 w-4 text-blue-600 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  {pendingInviteCount} convite
                  {pendingInviteCount !== 1 ? "s" : ""} pendente
                  {pendingInviteCount !== 1 ? "s" : ""}.
                </span>
              </div>
              <Link
                href={`/w/${slug}/members`}
                className="text-blue-700 font-medium hover:underline shrink-0 ml-4"
              >
                Ver convites
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Section 1: Clickable metric cards */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Visão geral
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link href={`/w/${slug}/templates`} className="group block">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <LayoutTemplate className="h-4 w-4" aria-hidden="true" />
                  Templates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-900">
                  {templateCount}
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/w/${slug}/lps`} className="group block">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  Landing Pages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-900">{lpCount}</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/w/${slug}/members`} className="group block">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  Membros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-900">
                  {memberCount}
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/w/${slug}/lps`} className="group block">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  LPs sem pasta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-900">
                  {lpWithoutFolderCount}
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Section 2: Recent LPs */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Continuar de onde parou
        </h2>
        {recentLps.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Nenhuma LP criada ainda.
            </p>
            {canCreateLp && (
              <Link
                href={`/w/${slug}/lps/new`}
                className="text-sm font-medium text-gray-900 underline"
              >
                Gerar primeira LP
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {recentLps.map((lp) => (
              <div
                key={lp.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center">
                    <span className="font-medium text-sm text-gray-900 truncate">
                      {lp.name}
                    </span>
                    {lp.kind === "VITE_SPA" && (
                      <span className="ml-2 inline-flex items-center rounded text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5">
                        SPA
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    <span>{relativeTime(lp.updatedAt)}</span>
                    {lp.folder && (
                      <>
                        <span>·</span>
                        <span>{lp.folder.name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <Link
                    href={`/w/${slug}/lps/${lp.id}/edit`}
                    className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 rounded px-2 py-1 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <Pencil className="h-3 w-3" aria-hidden="true" />
                    Editar
                  </Link>
                  <Link
                    href={`/w/${slug}/lps/${lp.id}/preview`}
                    className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 rounded px-2 py-1 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <Eye className="h-3 w-3" aria-hidden="true" />
                    Preview
                  </Link>
                  {/* D-ihz-02: plain anchor triggers browser download without client JS */}
                  {/* T-ihz-02: /api/lps/[lpId]/export validates session + membership */}
                  <a
                    href={`/api/lps/${lp.id}/export`}
                    download
                    className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 rounded px-2 py-1 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <Download className="h-3 w-3" aria-hidden="true" />
                    Exportar
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Template quick-start (canCreateLp only) */}
      {canCreateLp && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Começar de um template
          </h2>
          {recentTemplates.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Nenhum template cadastrado.
              </p>
              {canCreateTemplate && (
                <Link
                  href={`/w/${slug}/templates/new`}
                  className="text-sm font-medium text-gray-900 underline"
                >
                  Criar primeiro template
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {recentTemplates.map((t) => (
                <Link
                  key={t.id}
                  href={`/w/${slug}/lps/new/${t.id}`}
                  className="group flex flex-col rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {t.name}
                    </span>
                    {t.kind === "VITE_SPA" && (
                      <span className="ml-2 inline-flex items-center rounded text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5">
                        SPA
                      </span>
                    )}
                  </div>
                  <span className="mt-1 text-xs text-indigo-600 group-hover:underline">
                    Gerar LP →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
