// Next.js 16 proxy — replaces deprecated middleware.ts. See: nextjs.org/docs/app/api-reference/file-conventions/proxy
//
// Host detection and path rewrite for *.serve.* hosts.
//
// Responsibilities (D-01, D-02):
// - Detect serving hosts: {tplId}.serve.pageforge.com (prod) or {tplId}.serve.localhost (dev)
// - Rewrite matching requests to the internal serve route /serve/{tplId}{pathname}
// - Pass all dashboard requests through unmodified (NextResponse.next())
//
// Security note: this proxy performs NO authorization — it only rewrites the path.
// All security enforcement (token validation, type guard, cross-tenant isolation)
// is handled by the route handler at app/serve/[tplId]/[[...path]]/route.ts.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Regex to detect serving hosts.
 *
 * Matches:
 *   - {tplId}.serve.localhost         (dev — *.localhost)
 *   - {tplId}.serve.localhost:3000    (dev with port)
 *   - {tplId}.serve.pageforge.com     (production)
 *   - any *.serve.* pattern
 *
 * Capture group 1: the tplId subdomain (1–64 chars, alphanumeric + hyphen)
 *
 * D-02: wildcard *.serve.* / *.localhost in dev.
 */
const SERVE_HOST_RE = /^([a-z0-9-]{1,64})\.serve\./i;

/**
 * Next.js 16 proxy function (NOT "middleware" — that convention is deprecated in Next.js 16).
 *
 * For serving hosts (*.serve.*):
 *   Rewrites /path → /serve/{tplId}/path so the filesystem router sees the internal route.
 *
 * For all other hosts (dashboard, API, etc.):
 *   Returns NextResponse.next() — the request is passed through unmodified.
 */
export function proxy(request: NextRequest): NextResponse {
  const host = request.headers.get("host") ?? "";
  const match = SERVE_HOST_RE.exec(host);

  if (match) {
    const tplId = match[1];
    const url = request.nextUrl.clone();

    // Rewrite pathname:
    //   / → /serve/{tplId}                (root — no trailing slash duplication)
    //   /assets/main.js → /serve/{tplId}/assets/main.js
    //   /about → /serve/{tplId}/about
    url.pathname =
      "/serve/" + tplId + (url.pathname === "/" ? "" : url.pathname);

    return NextResponse.rewrite(url);
  }

  // Dashboard or any non-serving host — pass through without modification
  return NextResponse.next();
}

/**
 * Matcher config — required by Next.js to know which requests to run the proxy on.
 *
 * The negative lookahead excludes Next.js internal assets so the proxy never
 * intercepts _next/static, _next/image, or favicon.ico.
 * (Pitfall 2 prevention: without this, Next.js build assets would be misrouted.)
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
