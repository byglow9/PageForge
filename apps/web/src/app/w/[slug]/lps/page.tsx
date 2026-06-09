/**
 * LP list page — /w/[slug]/lps
 *
 * RSC page. Lists all LPs for the workspace or shows empty state.
 *
 * Security:
 * - requireWorkspace gates access (any workspace member, including viewer).
 * - Only members with lp.create permission see "Generate LP" CTA.
 * - listLpsAction uses withTenantDb scoped to ctx.workspaceId (T-04-02-05).
 */
import Link from "next/link";
import { FileText } from "lucide-react";
import { requireWorkspace, can } from "@/lib/workspaces/guards";
import { listLpsAction } from "@/lib/lps/actions";
import { LpCard } from "@/components/lps/LpCard";

interface LpsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function LpsPage({ params }: LpsPageProps) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);

  const result = await listLpsAction(slug);
  const lps = result.ok ? result.data : [];

  const canCreate = can(ctx.role, "lp", "create");

  return (
    <div className="px-8 py-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Landing Pages</h1>
        {canCreate && (
          <Link
            href={`/w/${slug}/lps/new`}
            className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            Generate LP
          </Link>
        )}
      </div>

      {/* LP grid or empty state */}
      {lps.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <FileText
            className="h-12 w-12 text-gray-300 mb-4"
            aria-hidden="true"
          />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No landing pages yet
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Pick a template and fill in the form to generate your first landing page.
          </p>
          {canCreate && (
            <Link
              href={`/w/${slug}/lps/new`}
              className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              Generate LP
            </Link>
          )}
        </div>
      ) : (
        /* LP card grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {lps.map((lp) => (
            <LpCard key={lp.id} lp={lp} slug={slug} />
          ))}
        </div>
      )}
    </div>
  );
}
