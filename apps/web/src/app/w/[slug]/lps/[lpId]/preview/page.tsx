/**
 * LP preview page — /w/[slug]/lps/[lpId]/preview
 *
 * RSC page: fetches LP and renders based on kind:
 * - LIQUID: renders HTML server-side via renderLp(), passes to LpPreview srcdoc.
 * - VITE_SPA: mints a serve token, renders a cross-origin sandboxed iframe
 *   pointing to the isolated serving origin (D-04, D-06, T-08-03-03).
 *
 * Architecture:
 * - renderLp() is called server-side for LIQUID only. It must NOT be imported
 *   in a Client Component (T-04-02-01 + Pitfall 1).
 * - mintServeToken() is called server-side; token embedded in iframe src — never
 *   generated client-side (T-08-03-03).
 * - workspaceId comes exclusively from the session result of requireWorkspace()
 *   — never from URL params.
 *
 * Security:
 * - requireWorkspace: any member can preview (lp.preview).
 * - db.lp.findById filters by workspaceId (T-04-02-04: IDOR prevention).
 * - VITE_SPA: sandbox="allow-scripts" only (no allow-same-*): iframe origin is
 *   opaque — document.cookie/localStorage inaccessible to the SPA (T-08-03-03).
 * - Token scoped to {workspaceId, templateId} — NOT lpId (T-08-03-04).
 */
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/workspaces/guards";
import { withTenantDb } from "@/lib/db/tenant-db";
import { renderLp } from "@/lib/lps/render";
import { LpPreview } from "@/components/lps/LpPreview";
import { mintServeToken } from "@/lib/serve/token";
import { Badge } from "@/components/ui/badge";

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

  // Branch: VITE_SPA LPs are served via the isolated origin (iframe), not renderLp().
  // renderLp() would throw a type guard error for VITE_SPA (reciprocal guard, D-08).
  if (lp.kind === "VITE_SPA") {
    // Mint serve token scoped to {workspaceId, templateId} — NOT lpId (T-08-03-04).
    // workspaceId from session (requireWorkspace above), never from URL params.
    const token = mintServeToken(ctx.workspaceId, lp.templateId!);

    // Construct isolated serving origin (D-01 / D-02, mirrors project-templates preview):
    // - Dev:  http://{templateId}.serve.localhost:{PORT}
    // - Prod: https://{templateId}.serve.{SERVE_DOMAIN}
    const serveOrigin =
      process.env.NODE_ENV === "development"
        ? `http://${lp.templateId}.serve.localhost:${process.env.PORT ?? 3000}`
        : `https://${lp.templateId}.serve.${process.env.SERVE_DOMAIN}`;

    // entryPath: persisted entry route (e.g. "/grecia") or root "/" if absent (D-01).
    const entryPath = lp.entryRoute ?? "/";

    return (
      <div className="px-8 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">{lp.name}</h1>
          <Badge variant="outline">Vite SPA</Badge>
        </div>
        {lp.entryRoute && (
          <p className="text-sm text-gray-500">Route: {lp.entryRoute}</p>
        )}
        {/* sandbox="allow-scripts" only (T-08-03-03):
            Omitting allow-same-origin keeps the iframe origin opaque — document.cookie
            and localStorage are inaccessible to the SPA's JavaScript.
            DO NOT add allow-same-* flags — that would expose the PageForge session. */}
        <iframe
          src={`${serveOrigin}${entryPath}?t=${token}`}
          sandbox="allow-scripts"
          style={{ width: "100%", height: "80vh", border: "none" }}
          title={`Preview: ${lp.name}`}
        />
        <div className="flex justify-end">
          <a
            href={`/w/${slug}/lps`}
            className="text-sm text-gray-700 underline underline-offset-4 hover:text-gray-900"
          >
            Back to catalog
          </a>
        </div>
      </div>
    );
  }

  // LIQUID path: render LP server-side (preview == export guarantee — same pipeline as export)
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
