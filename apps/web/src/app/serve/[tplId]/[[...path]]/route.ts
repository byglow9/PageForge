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
import type { Prisma } from "@/generated/prisma/client";
import { buildBrandStyleTagForLp, injectBrandStyle } from "@/lib/brand/theme";
import { buildOverrideInjection, injectOverrides } from "@/lib/overrides/apply-shim";
import { ViteSpaValuesSchema } from "@/lib/lps/schema";

// -----------------------------------------------------------------------
// servingRead — cross-workspace read for the isolated serving layer.
//
// The serving handler must read `template` / `brand_config` across workspaces
// (asset requests carry no session; authorization is the HMAC token + UUID).
// Phase 02 enabled FORCE RLS, so the app role cannot read those rows unless a
// context flag is set. Migration 0009 adds a SELECT policy gated on
// `app.serving = 'on'`. We set it transaction-locally (SET LOCAL semantics via
// set_config(..., true)) so the relaxation never leaks to other queries on the
// pooled connection.
// -----------------------------------------------------------------------
function servingRead<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.serving', 'on', true)`;
    return fn(tx);
  });
}

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

    // Phase 10: edit mode signal and LP disambiguation (RESEARCH Unknown 2).
    // Declared at function scope so they are accessible in the HTML path below.
    // These are convenience signals — security gates are the HMAC token (already
    // verified in the HTML branch) and requireWorkspaceRole inside updateLpAction.
    // T-10-02-01: editMode enables DOM manipulation but cannot persist edits.
    // T-10-02-04: lpIdParam used only for WHERE clause with workspaceId from token.
    let editMode = false;
    let lpIdParam: string | null = null;

    if (isHtmlRequest) {
      // Token required for index.html — validate HMAC signature, expiry, scope
      const token = new URL(request.url).searchParams.get("t");
      const claims = token ? verifyServeToken(token) : null;

      // Cross-tenant check (T-07-02-01): claims.templateId must match tplId from URL
      if (!claims || claims.templateId !== tplId) {
        return new NextResponse("Forbidden", { status: 403 });
      }

      workspaceId = claims.workspaceId;

      // Extract edit mode params AFTER token is verified (only relevant for HTML path).
      const searchParams = new URL(request.url).searchParams;
      editMode = searchParams.get("edit") === "1";
      lpIdParam = searchParams.get("lpId");
    } else {
      // Asset request — no token required
      // Derive workspaceId from DB using unscoped prisma lookup (tplId is UUID = non-enumerable)
      // Safe: only reveals that the template exists; no data leak beyond confirming existence
      const template = await servingRead((tx) =>
        tx.template.findUnique({
          where: { id: tplId },
          select: { workspaceId: true, kind: true },
        })
      );

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
    const template = await servingRead((tx) =>
      tx.template.findUnique({
        where: { id: tplId },
        select: { kind: true, workspaceId: true },
      })
    );

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

      // T-08-03-05: index.html path uses transformToString() — stream consumed exactly once.
      // Assets use transformToWebStream() (earlier branch). Never call both on the same body.
      const html = await s3Response.Body!.transformToString();

      // D-04: brand theme is live — read BrandConfig at render time (not snapshotted).
      // workspaceId is trusted: it comes exclusively from verified HMAC claims (T-08-03-02).
      const brand = await servingRead((tx) =>
        tx.brandConfig.findFirst({
          where: { workspaceId },
        })
      );

      // Phase 10: LP lookup — prefer findUnique by lpId when available (RESEARCH Unknown 2).
      // When lpIdParam is present (from ?lpId= URL param), use findUnique for unambiguous
      // per-LP override injection. workspaceId is always from HMAC token claims — never
      // from URL params (T-10-02-04 cross-tenant safety).
      // Fallback (no lpIdParam): preserve the Phase 9 findMany + single-LP fail-safe.
      let lp: { values: unknown } | null;
      if (lpIdParam) {
        lp = await servingRead((tx) =>
          tx.landingPage.findUnique({
            where: { id: lpIdParam!, templateId: tplId, workspaceId },
            select: { values: true },
          })
        );
      } else {
        // Phase 9 fail-safe: when more than one LP matches, render with NO overrides
        // (honest preview) rather than applying one arbitrary LP's overrides (CR-01).
        const lps = await servingRead((tx) =>
          tx.landingPage.findMany({
            where: { templateId: tplId, workspaceId },
            select: { values: true },
            orderBy: { createdAt: "asc" },
          })
        );
        lp = lps.length === 1 ? lps[0] : null;
      }

      // D-05: inject only --primary as HSL triplet (T-08-03-01: hex validated by SaveBrandConfigSchema).
      // Phase 9: LP color override takes precedence over workspace color (buildBrandStyleTagForLp).
      // WR-06: parse lp.values through ViteSpaValuesSchema at the injection boundary instead
      // of an unchecked `as ViteSpaValues` cast. A corrupt/malformed row (or the multi-LP
      // fail-safe lp === null above) degrades to "no overrides / workspace color" rather
      // than emitting invalid CSS (NaN triplet) or a misleading preview.
      const parsedValues = ViteSpaValuesSchema.safeParse(lp?.values);
      const lpValues = parsedValues.success ? parsedValues.data : { overrides: [] };
      const styleTag = buildBrandStyleTagForLp(lpValues.primaryColorOverride, brand?.primaryColor);
      const themedHtml = injectBrandStyle(html, styleTag);

      // Phase 9: Inject override sentinel JSON + apply shim before </head>.
      // lpValues is parsed/defaulted to { overrides: [] } (WR-06), so buildOverrideInjection
      // returns an empty injection when there are no overrides.
      const injection = buildOverrideInjection(lpValues);
      const finalHtml = injectOverrides(themedHtml, injection);

      // Phase 10: inject edit script IIFE when ?edit=1 and ?lpId= are both present.
      // Dynamic import keeps the edit-script module off the hot path for normal requests.
      // HMAC token is already verified above — editMode is a convenience signal, not auth.
      // T-10-02-03: export route never reads ?edit=1 — edit script is never in exports.
      let editableHtml = finalHtml;
      if (editMode && lpIdParam) {
        const { buildEditScript, injectEditScript } = await import(
          "@/lib/overrides/edit-script"
        );
        const editScript = buildEditScript(
          process.env.DASHBOARD_ORIGIN ?? "http://localhost:3000"
        );
        editableHtml = injectEditScript(finalHtml, editScript);
      }

      // Step 9: Return themed HTML response with security headers
      // frame-ancestors as HTTP header (NOT meta tag — Pitfall 6 / T-07-02-08)
      return new NextResponse(editableHtml, {
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
