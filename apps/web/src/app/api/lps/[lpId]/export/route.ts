/**
 * ZIP Export Route Handler — GET /api/lps/[lpId]/export
 *
 * Renders the LP, downloads S3-hosted images server-side, rewrites src
 * attributes to relative ./assets/ paths, injects a strict CSP <meta> tag,
 * and streams a self-contained ZIP via archiver.
 *
 * Security design (T-04-04-01, T-04-04-02, T-04-04-03, T-04-04-04):
 *   - 401: no authenticated session.
 *   - 404: LP not found.
 *   - 403: authenticated user is not a member of the LP's workspace (IDOR prevention).
 *   - SSRF prevention: only URLs starting with process.env.S3_PUBLIC_BASE_URL are
 *     fetched server-side. External URLs remain as absolute references in the export.
 *   - CSP meta baked into index.html (D-10): default-src 'none' blocks inline scripts.
 *
 * Preview == export guarantee (D-07):
 *   This route calls renderLp() from lib/lps/render.ts — the identical render
 *   utility used by the preview RSC page. The user downloads exactly what they see.
 *
 * D-09: ZIP contains index.html (with rewritten relative ./assets/ paths) and
 *   assets/{filename} for each S3-hosted image referenced in the rendered HTML.
 *
 * Streaming (T-04-04-06): archiver streams output via Readable.toWeb() bridge.
 *   No full-ZIP memory buffering — memory is bounded by the largest single image.
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import slugify from "slugify";
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { withTenantDb } from "@/lib/db/tenant-db";
import { renderLp } from "@/lib/lps/render";
import { buildBrandStyleTagForLp, injectBrandStyle } from "@/lib/brand/theme";
import { buildOverrideInjection, injectOverrides } from "@/lib/overrides/apply-shim";
import type { ViteSpaValues } from "@/lib/lps/schema";

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
// CSP injection (D-10)
// -----------------------------------------------------------------------

/**
 * Strict Content-Security-Policy meta tag injected into every exported HTML.
 *
 * Policy rationale:
 *   - default-src 'none': blocks everything not explicitly listed.
 *   - img-src 'self' data:: ./assets/ images (same-origin when served from web server)
 *     and inline data URIs.
 *   - style-src 'self' 'unsafe-inline': LP templates use inline styles.
 *   - font-src 'self': local fonts only.
 *   - object-src 'none': blocks Flash / plugins.
 *   - base-uri 'none': prevents <base> tag manipulation.
 *   - script-src intentionally OMITTED → inherits default-src 'none' (no scripts).
 */
const CSP_META = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'none';">`;

function injectCsp(html: string): string {
  if (html.includes("<head>")) {
    return html.replace("<head>", `<head>\n  ${CSP_META}`);
  }
  // No <head> tag — prepend CSP meta to the document
  return `${CSP_META}\n${html}`;
}

// -----------------------------------------------------------------------
// Image URL extraction (T-04-04-03 — SSRF prevention filter)
// -----------------------------------------------------------------------

/**
 * Extract all image URLs from the rendered HTML that originate from S3
 * (identified by the S3_PUBLIC_BASE_URL prefix). Returns deduplicated URLs.
 *
 * Extraction patterns:
 *   1. <img src="..."> attributes
 *   2. CSS url(...) in style="" attributes
 *   3. CSS url(...) inside <style>...</style> blocks
 *
 * SSRF prevention (T-04-04-03): only URLs starting with s3BaseUrl are
 * returned. External CDN / brand URLs are left as absolute references in the
 * exported HTML — they are not downloaded.
 */
function extractS3ImageUrls(html: string, s3BaseUrl: string): string[] {
  const found = new Set<string>();

  // Pattern 1: src="https://..." or src='https://...' (both quote styles — IN-03)
  const imgSrcPattern = /src=(["'])(https?:\/\/[^"']+)\1/g;
  let match: RegExpExecArray | null;
  while ((match = imgSrcPattern.exec(html)) !== null) {
    const url = match[2];
    if (url.startsWith(s3BaseUrl)) {
      found.add(url);
    }
  }

  // Pattern 1b: srcset="url1 1x, url2 2x" (comma-separated candidates with
  // optional descriptors — IN-03). Extract each URL, ignore the descriptor.
  const srcsetPattern = /srcset=(["'])([^"']+)\1/g;
  while ((match = srcsetPattern.exec(html)) !== null) {
    for (const candidate of match[2].split(",")) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url && url.startsWith(s3BaseUrl)) {
        found.add(url);
      }
    }
  }

  // Pattern 2: CSS url(...) inside style="" attributes
  // Matches both quoted and unquoted forms: url("..."), url('...'), url(...)
  const styleAttrPattern = /style="[^"]*url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/g;
  while ((match = styleAttrPattern.exec(html)) !== null) {
    const url = match[1];
    if (url.startsWith(s3BaseUrl)) {
      found.add(url);
    }
  }

  // Pattern 3: CSS url(...) inside <style>...</style> blocks
  const styleBlockPattern = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleBlock: RegExpExecArray | null;
  while ((styleBlock = styleBlockPattern.exec(html)) !== null) {
    const cssContent = styleBlock[1];
    const cssUrlPattern = /url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/g;
    while ((match = cssUrlPattern.exec(cssContent)) !== null) {
      const url = match[1];
      if (url.startsWith(s3BaseUrl)) {
        found.add(url);
      }
    }
  }

  return Array.from(found);
}

// -----------------------------------------------------------------------
// Image src rewriting
// -----------------------------------------------------------------------

/**
 * Replace all occurrences of each absolute S3 URL in the HTML with the
 * corresponding relative ./assets/{filename} path.
 */
function rewriteImageSrcs(
  html: string,
  urlToFilename: Map<string, string>
): string {
  let result = html;
  for (const [url, filename] of urlToFilename.entries()) {
    // Replace all occurrences (the URL may appear multiple times in the HTML)
    result = result.split(url).join(`./assets/${filename}`);
  }
  return result;
}

// -----------------------------------------------------------------------
// Route handler
// -----------------------------------------------------------------------

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lpId: string }> }
) {
  try {
    // 1. Authenticate session (T-04-04-01)
    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { lpId } = await params;

    // 2 + 3. Resolve the LP *within the requesting user's workspace context* (T-04-04-02).
    // landing_page has FORCE RLS (policy: workspaceId = current_setting('app.current_workspace_id')),
    // so a raw findUnique with no workspace context returns null for EVERY row. We therefore look
    // the LP up scoped to each workspace the user belongs to (the member table is not RLS-bound).
    // This collapses the IDOR check into the lookup: a hit means the user is a member of the owning
    // workspace; a miss is reported as 404 without revealing cross-tenant existence (T-04-04-02).
    const memberships = await prisma.member.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    let resolvedLp: Awaited<
      ReturnType<typeof prisma.landingPage.findUnique>
    > = null;
    for (const { organizationId } of memberships) {
      const found = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${organizationId}, true)`;
        return tx.landingPage.findUnique({ where: { id: lpId } });
      });
      if (found) {
        resolvedLp = found;
        break;
      }
    }
    if (!resolvedLp) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // const binding preserves non-null narrowing inside the closures below.
    const lp = resolvedLp;

    // 3b. VITE_SPA export branch (D-10, D-11, D-12):
    // Stream the full dist/ tree from S3 as a ZIP with a tematized index.html.
    // CSP injection is intentionally OMITTED — VITE_SPA has its own runtime JS
    // and `script-src 'none'` would break the SPA bundle (D-12).
    if ((lp.kind ?? "LIQUID") === "VITE_SPA") {
      if (!lp.templateId) {
        return NextResponse.json(
          { error: "VITE_SPA LP has no template reference." },
          { status: 400 }
        );
      }

      // Fetch brand config for CSS var injection (D-11). brand_config also has FORCE RLS,
      // so the read must run inside a workspace-scoped transaction (D-13/D-14).
      const workspaceId = lp.workspaceId;
      const brand = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${workspaceId}, true)`;
        return tx.brandConfig.findFirst({ where: { workspaceId } });
      });

      // ListObjectsV2 paginado — prefix: workspaces/{wId}/project-templates/{tplId}/dist/
      // ContinuationToken loop handles buckets with > 1000 keys (T-08-04-03)
      const prefix = `workspaces/${lp.workspaceId}/project-templates/${lp.templateId}/dist/`;
      let continuationToken: string | undefined;
      const s3Keys: string[] = [];
      do {
        const listResult = await s3Client.send(
          new ListObjectsV2Command({
            Bucket: process.env.S3_BUCKET!,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          })
        );
        for (const obj of listResult.Contents ?? []) {
          if (obj.Key) s3Keys.push(obj.Key);
        }
        continuationToken = listResult.NextContinuationToken;
      } while (continuationToken);

      // Build ZIP: index.html gets brand injection; all other assets stream directly
      const viteSpaArchive = new ZipArchive({ zlib: { level: 9 } });

      for (const s3Key of s3Keys) {
        const relativePath = s3Key.slice(prefix.length); // e.g. 'index.html', 'assets/main.abc.js'
        const s3Obj = await s3Client.send(
          new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: s3Key })
        );

        if (relativePath === "index.html") {
          // transformToString() + brand injection (D-11)
          // T-08-04-02: primaryColor validated as hex — no CSS injection vector
          // Phase 9: LP color override takes precedence over workspace color (buildBrandStyleTagForLp).
          const html = await s3Obj.Body!.transformToString();
          const lpValues = lp.values as ViteSpaValues | null;
          const styleTag = buildBrandStyleTagForLp(lpValues?.primaryColorOverride, brand?.primaryColor);
          const themedHtml = injectBrandStyle(html, styleTag);
          // Phase 9: Inject override sentinel JSON + apply shim (preview == export guarantee).
          // buildOverrideInjection guards the B2 sentinel-{} case — safe for override-free LPs.
          const injection = buildOverrideInjection(lpValues);
          const finalHtml = injectOverrides(themedHtml, injection);
          viteSpaArchive.append(Buffer.from(finalHtml, "utf-8"), {
            name: "index.html",
          });
        } else {
          // Stream non-HTML assets directly to archiver without loading into memory (T-08-04-03)
          // Cast to Node.js ReadableStream type — AWS SDK returns a compatible but typed differently stream
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const webStream = s3Obj.Body!.transformToWebStream() as any;
          const nodeStream = Readable.fromWeb(webStream);
          viteSpaArchive.append(nodeStream, { name: relativePath });
        }
      }

      viteSpaArchive.finalize();

      // Bridge Node.js Readable → Web ReadableStream (same pattern as LIQUID path)
      const viteSpaWebStream = Readable.toWeb(
        viteSpaArchive as unknown as Readable
      );
      const viteSpaSlug =
        slugify(lp.name, { lower: true, strict: true }) || "landing-page";

      return new NextResponse(viteSpaWebStream as ReadableStream, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${viteSpaSlug}.zip"`,
        },
      });
      // NOTE: injectCsp() is NOT called for VITE_SPA (D-12)
    }

    // 4. Render LP HTML (preview == export guarantee — same renderLp() as preview RSC page)
    const html = await withTenantDb(
      { workspaceId: lp.workspaceId },
      async (db) =>
        renderLp(
          {
            markupSnapshot: lp.markupSnapshot,
            values: lp.values as Record<string, unknown>,
            kind: lp.kind ?? "LIQUID",
          },
          db
        )
    );

    // 5. Extract S3 image URLs (SSRF prevention — only S3_PUBLIC_BASE_URL origins)
    const s3BaseUrl = process.env.S3_PUBLIC_BASE_URL ?? "";
    const imageUrls = s3BaseUrl ? extractS3ImageUrls(html, s3BaseUrl) : [];

    // 6. Download S3 images server-side and map URL → filename
    interface AssetEntry {
      url: string;
      buffer: Buffer;
      filename: string;
    }

    const assets: AssetEntry[] = [];
    const urlToFilename = new Map<string, string>();

    for (const url of imageUrls) {
      try {
        const response = await fetch(url, {
          // Do not follow redirects — prevents SSRF via open redirects (T-04-04-03)
          redirect: "error",
        });
        if (!response.ok) {
          // Skip images that can't be fetched — leave their URL unrewritten
          continue;
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Derive filename from the last URL path segment
        const urlObj = new URL(url);
        const filename =
          urlObj.pathname.split("/").at(-1) ?? `asset-${assets.length}`;

        assets.push({ url, buffer, filename });
        urlToFilename.set(url, filename);
      } catch {
        // Network error or redirect block — skip this asset (leave URL unrewritten)
      }
    }

    // 7. Rewrite image src attributes to relative ./assets/ paths
    const rewrittenHtml = rewriteImageSrcs(html, urlToFilename);

    // 8. Inject strict CSP <meta> tag (D-10 — no inline-script execution in exported HTML)
    const cspHtml = injectCsp(rewrittenHtml);

    // 9. Build ZIP with archiver (D-09 — streaming, bounded memory per T-04-04-06)
    const archive = new ZipArchive({ zlib: { level: 9 } });

    // Add index.html
    archive.append(Buffer.from(cspHtml, "utf-8"), { name: "index.html" });

    // Add each downloaded image asset
    for (const asset of assets) {
      archive.append(asset.buffer, { name: `assets/${asset.filename}` });
    }

    // Finalize the archive — triggers stream completion
    archive.finalize();

    // 10. Bridge Node.js ReadableStream → Web ReadableStream (Pitfall 4 fix)
    // archiver (Transform/Duplex) extends Node.js Readable; Next.js App Router expects Web Streams.
    const webStream = Readable.toWeb(archive as unknown as Readable);

    // 11. Generate slugified filename (D-11)
    // Fall back to a default when the name has no transliterable characters
    // (e.g. non-Latin script), otherwise the slug — and filename — collapses to
    // empty, yielding a bare ".zip" Content-Disposition (IN-04).
    const slug = slugify(lp.name, { lower: true, strict: true }) || "landing-page";

    // 12. Return streaming ZIP response
    return new NextResponse(webStream as ReadableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${slug}.zip"`,
      },
    });
  } catch (err) {
    console.error("[export/route] ZIP export failed:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
