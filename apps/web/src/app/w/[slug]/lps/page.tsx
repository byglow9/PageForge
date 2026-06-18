/**
 * LP catalog page — /w/[slug]/lps
 *
 * RSC page. Loads folders, workspace tags, LPs (with folderId), and all LP-tags
 * in parallel at request time. Passes data to CatalogGrid (client component)
 * for client-side folder/search/tag filtering.
 *
 * Layout (UI-SPEC):
 * - Page header "Landing Pages" + "Generate LP" CTA above the two-panel area.
 * - Two-panel row: FolderTree (w-60) left, LP grid (flex-1) right.
 *   Both handled inside CatalogGrid.
 *
 * Security:
 * - requireWorkspace gates access (any workspace member, including viewer).
 * - Only members with lp.create permission see "Generate LP" CTA.
 * - canManage gates FolderTree mutation actions (create/rename/delete folders).
 * - All data fetched server-side; workspaceId comes from session (T-04-02-05).
 */
import Link from "next/link";
import { requireWorkspace, can } from "@/lib/workspaces/guards";
import { listLpsAction } from "@/lib/lps/actions";
import {
  listFoldersAction,
  listWorkspaceTagsAction,
  listAllLpTagsForWorkspaceAction,
} from "@/lib/catalog/actions";
import { CatalogGrid } from "@/components/catalog/CatalogGrid";

interface LpsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function LpsPage({ params }: LpsPageProps) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);

  const canCreate = can(ctx.role, "lp", "create");
  // canManage: owners/admins/editors can create/rename/delete folders
  const canManage = ctx.role !== "viewer";

  // Load all data in parallel (D-08: client-side filtering requires full dataset)
  const [lpsResult, foldersResult, workspaceTagsResult, lpTagsResult] =
    await Promise.all([
      listLpsAction(slug),
      listFoldersAction(slug),
      listWorkspaceTagsAction(slug),
      listAllLpTagsForWorkspaceAction(slug),
    ]);

  const lps = lpsResult.ok ? lpsResult.data : [];
  const folders = foldersResult.ok ? foldersResult.data : [];
  const workspaceTags = workspaceTagsResult.ok ? workspaceTagsResult.data : [];
  const lpTagsMap = lpTagsResult.ok ? lpTagsResult.data : {};

  return (
    <div className="px-8 py-6 flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between shrink-0 rounded-lg border border-gray-200 bg-white/85 px-5 py-4 shadow-sm backdrop-blur-sm">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-gray-900">Landing Pages</h1>
        {canCreate && (
          <Link
            href={`/w/${slug}/lps/new`}
            className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            Generate LP
          </Link>
        )}
      </div>

      {/* Two-panel catalog: FolderTree (left) + LP grid (right) */}
      <CatalogGrid
        lps={lps}
        lpTagsMap={lpTagsMap}
        folders={folders}
        workspaceTags={workspaceTags}
        slug={slug}
        canCreate={canCreate}
        canManage={canManage}
      />
    </div>
  );
}
