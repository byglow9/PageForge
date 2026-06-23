/**
 * VITE_SPA template preview page — /w/[slug]/project-templates/[id]/preview
 *
 * RSC page: mints a serve token server-side, renders a cross-origin sandboxed
 * iframe that points to the isolated serving origin for the template's dist/.
 *
 * Architecture:
 * - mintServeToken() is called server-side in this RSC. The token is embedded
 *   in the iframe src attribute in the server-rendered HTML — never generated
 *   client-side (T-07-03-03).
 * - workspaceId comes exclusively from the session result of requireWorkspaceRole()
 *   — never from URL params (T-07-03-03, T-07-03-04).
 * - db.template.findById() is scoped to the session workspaceId — IDOR prevention
 *   (T-07-03-04): templates belonging to other workspaces return null → redirect.
 *
 * Security:
 * - requireWorkspaceRole: all workspace roles (including viewer) can preview.
 * - sandbox="allow-scripts" only (no allow-same-* flags): iframe origin is opaque
 *   (PRJ-05 / SC3) — document.cookie and localStorage inside the iframe are
 *   inaccessible to the SPA's JavaScript.
 * - Serving origin is constructed from the template ID (UUID), which equals the
 *   S3 prefix set in Phase 6 during template upload (D-01 / D-02).
 *
 * Decisions covered: D-01, D-02, D-03, D-06, D-08.
 */
import { redirect } from "next/navigation";
import { requireWorkspaceRole } from "@/lib/workspaces/guards";
import { withTenantDb } from "@/lib/db/tenant-db";
import { mintServeToken } from "@/lib/serve/token";

interface PreviewPageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function PreviewPage({ params }: PreviewPageProps) {
  // Next.js 16: params is a Promise — always await before accessing
  const { slug, id } = await params;

  // Auth gate: any workspace member (owner, admin, editor, viewer) can preview.
  // requireWorkspaceRole redirects to /login if unauthenticated, and to /w/{slug}
  // if the user's role is not in the allowed list (T-07-03-03).
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor", "viewer"]);

  try {
    // Template lookup: scoped to ctx.workspaceId from the session — not from URL params.
    // findById() returns null for IDs belonging to other workspaces (T-07-03-04: IDOR prevention).
    const template = await withTenantDb({ workspaceId: ctx.workspaceId }, (db) =>
      db.template.findById(id)
    );

    if (!template) {
      redirect(`/w/${slug}/templates`);
    }

    // Mint the serve token server-side. The token is scoped to {workspaceId, templateId}
    // with a 30-minute TTL (D-05). workspaceId comes from the session, never from URL params.
    const token = mintServeToken(ctx.workspaceId, id);

    // Construct the isolated serving origin URL (D-01 / D-02):
    // - Dev:  http://{templateId}.serve.localhost:{PORT}
    // - Prod: https://{templateId}.serve.{SERVE_DOMAIN}
    // The templateId (UUID) equals the S3 prefix used in Phase 6 template upload.
    const serveOrigin =
      process.env.NODE_ENV === "development"
        ? `http://${id}.serve.localhost:${process.env.PORT ?? 3000}`
        : `https://${id}.serve.${process.env.SERVE_DOMAIN}`;

    return (
      <div className="page-wrapper flex flex-col gap-6 px-8 py-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-gray-900">{template.name}</h1>
          <p className="text-sm text-gray-500">
            Template preview — content is served from the isolated origin
          </p>
        </div>

        {/* sandbox="allow-scripts" only (PRJ-05 / SC3).
            Omitting the same-origin flag makes the iframe's origin opaque:
            document.cookie and localStorage are inaccessible inside the iframe,
            preventing session cookie theft by the SPA's JavaScript.
            DO NOT add allow-same-* flags — doing so would collapse the opaque
            origin and expose the PageForge session to the served SPA. */}
        <iframe
          src={`${serveOrigin}/?t=${token}`}
          sandbox="allow-scripts"
          style={{ width: "100%", height: "80vh", border: "none" }}
          title={`Preview: ${template.name}`}
        />

        <div className="flex justify-end">
          <a
            href={`/w/${slug}/templates`}
            className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back to templates
          </a>
        </div>
      </div>
    );
  } catch (err) {
    // Re-throw Next.js internal errors (NEXT_REDIRECT, NEXT_NOT_FOUND) — they must
    // not be swallowed; they control Next.js navigation and cannot be caught safely.
    if (
      err instanceof Error &&
      (err.message.includes("NEXT_REDIRECT") || err.message.includes("NEXT_NOT_FOUND"))
    ) {
      throw err;
    }

    // Any other error (DB connection failure, token minting failure, etc.) — show
    // a recovery UI instead of crashing the whole page.
    return (
      <div className="px-8 py-6 flex flex-col items-center justify-center min-h-[400px] text-center">
        <p className="text-base text-gray-700 mb-4">
          Preview failed to load. Try refreshing.
        </p>
        <div className="flex gap-3">
          <a
            href={`/w/${slug}/project-templates/${id}/preview`}
            className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Refresh
          </a>
          <a
            href={`/w/${slug}/templates`}
            className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back to templates
          </a>
        </div>
      </div>
    );
  }
}
