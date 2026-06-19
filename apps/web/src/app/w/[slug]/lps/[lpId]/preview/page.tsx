/**
 * LP preview page — /w/[slug]/lps/[lpId]/preview
 *
 * RSC page: fetches LP, renders HTML server-side, passes to LpPreview iframe.
 *
 * Architecture:
 * - renderLp() is called server-side in this RSC. It must NOT be imported
 *   in a Client Component (T-04-02-01 + Pitfall 1).
 * - Preview == export guarantee: both paths call renderLp() identically.
 * - The rendered HTML is passed as a string to LpPreview's srcdoc attribute.
 *
 * Security:
 * - requireWorkspace: any member can preview (lp.preview).
 * - db.lp.findById filters by workspaceId (T-04-02-04).
 * - sandbox="allow-same-origin" on iframe blocks scripts (T-04-02-01).
 */
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/workspaces/guards";
import { withTenantDb } from "@/lib/db/tenant-db";
import { renderLp } from "@/lib/lps/render";
import { LpPreview } from "@/components/lps/LpPreview";

interface LpPreviewPageProps {
  params: Promise<{ slug: string; lpId: string }>;
}

export default async function LpPreviewPage({ params }: LpPreviewPageProps) {
  const { slug, lpId } = await params;

  // Any member can preview (viewer has lp.preview)
  const ctx = await requireWorkspace(slug);

  // Fetch LP — findById filters by workspaceId (T-04-02-04: IDOR prevention)
  const lp = await withTenantDb({ workspaceId: ctx.workspaceId }, (db) =>
    db.lp.findById(lpId)
  );

  if (!lp) {
    redirect(`/w/${slug}/lps`);
  }

  // Render LP server-side (preview == export guarantee — same pipeline as export)
  let html: string;
  try {
    html = await withTenantDb({ workspaceId: ctx.workspaceId }, (db) =>
      renderLp(
        {
          markupSnapshot: lp.markupSnapshot,
          values: lp.values as Record<string, unknown>,
          kind: lp.kind ?? "LIQUID",
        },
        db
      )
    );
  } catch {
    // Render failed — show fallback error UI
    return (
      <div className="px-8 py-6 flex flex-col items-center justify-center min-h-[400px] text-center">
        <p className="text-base text-gray-700 mb-4">
          Preview failed to render. Try refreshing.
        </p>
        <a
          href={`/w/${slug}/lps/${lpId}/preview`}
          className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Refresh
        </a>
      </div>
    );
  }

  return (
    <LpPreview
      html={html}
      lp={{ id: lp.id, name: lp.name }}
      slug={slug}
    />
  );
}
