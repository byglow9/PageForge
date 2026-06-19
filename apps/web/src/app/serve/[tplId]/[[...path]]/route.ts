/**
 * Serving Route Handler — GET /serve/[tplId]/[[...path]]
 *
 * Reached via proxy.ts rewrite: requests to {tplId}.serve.* hosts are rewritten
 * to /serve/{tplId}{pathname} before the filesystem router processes them.
 *
 * Security design (T-07-02-01 through T-07-02-08):
 *
 *   Token authorization (index.html only — MVP tradeoff per RESEARCH.md Open Question 1):
 *   - index.html and extensionless paths (SPA routes → index.html): require HMAC token in ?t=
 *   - Assets (.js/.css/.png/etc.): token NOT required — non-enumerable tplId UUID is implicit secret
 *   - Rationale: browsers load <script src="/assets/..."> without query params
 *
 *   Token validation (D-05, T-07-02-01, T-07-02-02, T-07-02-03):
 *   - verifyServeToken checks HMAC signature, expiry, returns {workspaceId, templateId}
 *   - claims.templateId !== tplId (URL) → 403 (cross-tenant rejection)
 *
 *   Type guard (D-08, T-07-02-06):
 *   - assertViteSpaKind(template.kind) throws if kind !== 'VITE_SPA'
 *   - LIQUID templates → 403 "Type boundary violation"
 *
 *   S3 streaming (D-04, T-07-02-07):
 *   - GetObjectCommand → Body.transformToWebStream() — stream consumed exactly once
 *   - Content-Type from file extension (MIME map), never from Body bytes (Pitfall 4 prevention)
 *
 *   SPA fallback (D-07):
 *   - Extensionless path → serve index.html (React Router handles client-side)
 *   - Missing asset (.js/.css/etc.) → 404 (no fallback for assets)
 *
 *   Security headers (D-03, T-07-02-05, T-07-02-08):
 *   - Content-Security-Policy: frame-ancestors — HTTP header (NOT meta tag — Pitfall 6)
 *   - Cache-Control: no-store (ephemeral tokens, no public cache)
 *   - X-Content-Type-Options: nosniff
 *   - No Set-Cookie for PageForge session cookies on isolated origin
 *
 *   S3 key convention (Phase 6 — do NOT deviate):
 *   workspaces/{workspaceId}/project-templates/{tplId}/dist/{s3Path}
 */
import { NextResponse } from "next/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { verifyServeToken } from "@/lib/serve/token";
import {
  assertViteSpaKind,
  resolveServePath,
  getContentType,
} from "@/lib/serve/serve-vite-spa";
import { prisma } from "@/lib/db/prisma";

// -----------------------------------------------------------------------
// S3 client singleton — module-level, initialized once per cold start
// Do NOT import from project-templates/actions.ts or lps/actions.ts —
// those are "use server" modules; the route handler must own its singleton.
// -----------------------------------------------------------------------
const s3Client = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

// -----------------------------------------------------------------------
// Security headers applied to every response from this handler
// frame-ancestors MUST be an HTTP header — never a meta tag (Pitfall 6)
// -----------------------------------------------------------------------
function buildSecurityHeaders(contentType: string): Record<string, string> {
  return {
    "Content-Type": contentType,
    "Content-Security-Policy": `frame-ancestors ${process.env.DASHBOARD_ORIGIN ?? "http://localhost:3000"}`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

// -----------------------------------------------------------------------
// Route handler
// -----------------------------------------------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tplId: string; path?: string[] }> }
): Promise<NextResponse> {
  try {
    // Step 1: Extract tplId and path segments from dynamic route params
    const { tplId, path: pathSegments = [] } = await params;

    // Join path segments to reconstruct the request path
    // e.g. ['assets', 'main.abc.js'] → 'assets/main.abc.js'
    const requestPath = pathSegments.join("/") || "/";

    // Step 2: Resolve S3 path and determine SPA fallback
    // resolveServePath handles: root → isFallback:true, extensionless → isFallback:true,
    // asset with extension → isFallback:false
    const { s3Path, isFallback } = resolveServePath(requestPath);

    // Step 3: Token authorization (required for index.html / SPA routes only)
    // Assets skip token validation — the non-enumerable tplId UUID is the implicit secret
    const isHtmlRequest = s3Path === "index.html";

    let workspaceId: string;

    if (isHtmlRequest) {
      // Token required for index.html — validate HMAC signature, expiry, scope
      const token = new URL(request.url).searchParams.get("t");
      const claims = token ? verifyServeToken(token) : null;

      // Cross-tenant check (T-07-02-01): claims.templateId must match tplId from URL
      if (!claims || claims.templateId !== tplId) {
        return new NextResponse("Forbidden", { status: 403 });
      }

      workspaceId = claims.workspaceId;
    } else {
      // Asset request — no token required
      // Derive workspaceId from DB using unscoped prisma lookup (tplId is UUID = non-enumerable)
      // Safe: only reveals that the template exists; no data leak beyond confirming existence
      const template = await prisma.template.findUnique({
        where: { id: tplId },
        select: { workspaceId: true, kind: true },
      });

      if (!template) {
        // Template doesn't exist — return 404 for assets
        return new NextResponse("Not Found", { status: 404 });
      }

      // Type guard for assets (D-08, T-07-02-06): must be VITE_SPA
      try {
        assertViteSpaKind(template.kind);
      } catch {
        return new NextResponse("Forbidden — Type boundary violation", {
          status: 403,
        });
      }

      workspaceId = template.workspaceId;

      // Step 5 (asset path): Stream S3 directly — skip redundant DB lookup below
      const s3Key = `workspaces/${workspaceId}/project-templates/${tplId}/dist/${s3Path}`;
      const contentType = getContentType(s3Path);

      try {
        const s3Response = await s3Client.send(
          new GetObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            Key: s3Key,
          })
        );

        // T-07-02-07: Body.transformToWebStream() called exactly once — never read Body before this
        const webStream = s3Response.Body!.transformToWebStream();

        return new NextResponse(webStream, {
          headers: buildSecurityHeaders(contentType),
        });
      } catch (s3Err) {
        // Asset not found in S3 → 404 (no fallback for assets, per D-07)
        const errMessage =
          s3Err instanceof Error ? s3Err.message : String(s3Err);
        if (
          errMessage.includes("NoSuchKey") ||
          errMessage.includes("The specified key does not exist")
        ) {
          return new NextResponse("Not Found", { status: 404 });
        }
        throw s3Err; // Re-throw unexpected S3 errors
      }
    }

    // Step 4 (HTML request path): Fetch template to enforce type guard
    // workspaceId comes from HMAC token claims — trusted server-side value
    const template = await prisma.template.findUnique({
      where: { id: tplId },
      select: { kind: true, workspaceId: true },
    });

    if (!template || template.workspaceId !== workspaceId) {
      // Template not found or workspaceId mismatch (extra cross-tenant guard)
      return new NextResponse("Not Found", { status: 404 });
    }

    // Step 5 (HTML request path): Type guard — reject LIQUID templates (D-08, T-07-02-06)
    try {
      assertViteSpaKind(template.kind);
    } catch {
      return new NextResponse("Forbidden — Type boundary violation", {
        status: 403,
      });
    }

    // Step 6: Construct S3 key using Phase 6 convention (do NOT deviate from this format)
    // workspaceId and tplId are server-derived (token claims + DB) — never from raw URL params
    const s3Key = `workspaces/${workspaceId}/project-templates/${tplId}/dist/${s3Path}`;

    // Step 7: Derive Content-Type from file extension (NEVER read Body bytes — Pitfall 4)
    const contentType = getContentType(s3Path);

    // Step 8: Stream bytes from S3
    try {
      const s3Response = await s3Client.send(
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: s3Key,
        })
      );

      // T-07-02-07: transformToWebStream() called exactly once — stream is consumed once
      const webStream = s3Response.Body!.transformToWebStream();

      // Step 9: Return streaming response with security headers
      // frame-ancestors as HTTP header (NOT meta tag — Pitfall 6 / T-07-02-08)
      return new NextResponse(webStream, {
        headers: buildSecurityHeaders(contentType),
      });
    } catch (s3Err) {
      // index.html missing in S3 → 404 (template ingestion issue)
      // For SPA fallbacks (isFallback=true), index.html must exist if template was ingested
      const errMessage =
        s3Err instanceof Error ? s3Err.message : String(s3Err);
      if (
        errMessage.includes("NoSuchKey") ||
        errMessage.includes("The specified key does not exist")
      ) {
        return new NextResponse(
          isFallback
            ? "Not Found — index.html missing from template dist/"
            : "Not Found",
          { status: 404 }
        );
      }
      throw s3Err; // Re-throw unexpected S3 errors
    }
  } catch (err) {
    // Re-throw Next.js internal errors (redirect, notFound) — must not swallow them
    if (
      err instanceof Error &&
      (err.message.includes("NEXT_REDIRECT") ||
        err.message.includes("NEXT_NOT_FOUND"))
    ) {
      throw err;
    }

    console.error("[serve/route] serving failed:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
