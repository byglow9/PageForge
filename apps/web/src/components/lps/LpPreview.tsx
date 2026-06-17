"use client";
/**
 * LpPreview — preview iframe component for landing pages.
 *
 * Architecture:
 * - Receives a server-rendered HTML string via props (from RSC preview page).
 * - Renders in an iframe using srcDoc — no separate URL needed.
 * - sandbox="allow-same-origin" blocks script execution in preview (T-04-02-01).
 *
 * Per UI-SPEC:
 * - Full viewport layout: h-screen flex-col.
 * - Sticky toolbar: h-12, Back link, LP name, Edit button, Export ZIP anchor.
 * - Iframe fills remaining height: calc(100vh - 3rem).
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export interface LpPreviewProps {
  /** Server-rendered HTML string from renderLp() */
  html: string;
  lp: { id: string; name: string };
  slug: string;
}

export function LpPreview({ html, lp, slug }: LpPreviewProps) {
  // Preview safety: in a srcDoc iframe, relative/empty hrefs resolve against the
  // PARENT page URL, so clicking an LP link with an empty href (e.g. an unconfigured
  // brand button) navigated the iframe to the app preview route — loading the whole
  // dashboard shell inside the preview. Inject `<base target="_blank">` so link
  // clicks default to a new tab (silently blocked by the sandbox) instead of
  // hijacking the iframe. Image src/CSS use absolute URLs, so they're unaffected.
  const safeHtml = /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (m) => `${m}<base target="_blank">`)
    : `<base target="_blank">${html}`;

  return (
    <div className="flex flex-col h-screen">
      {/* Preview toolbar */}
      <div className="h-12 px-4 border-b border-gray-200 bg-white flex items-center gap-4 sticky top-0 shrink-0 z-10">
        <Link
          href={`/w/${slug}/lps`}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Landing Pages
        </Link>
        <span className="text-base font-semibold text-gray-900 flex-1 truncate">
          {lp.name}
        </span>
        <Link
          href={`/w/${slug}/lps/${lp.id}/edit`}
          className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Edit
        </Link>
        {/* Export ZIP — anchor with download attribute triggers browser download.
            onClick shows immediate toast feedback (per UI-SPEC LP-04): streaming
            downloads don't emit completion events to the page, so we toast on click. */}
        <a
          href={`/api/lps/${lp.id}/export`}
          download
          onClick={() => toast.success("Export ready — downloading.")}
          className="inline-flex items-center justify-center rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          aria-label={`Export ${lp.name} as ZIP`}
        >
          Export ZIP
        </a>
      </div>

      {/* Preview iframe */}
      <iframe
        title="Landing page preview"
        srcDoc={safeHtml}
        sandbox="allow-same-origin"
        className="w-full flex-1 border-0"
        style={{ height: "calc(100vh - 3rem)" }}
      />
    </div>
  );
}
