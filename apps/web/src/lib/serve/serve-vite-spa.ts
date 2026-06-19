/**
 * server-only — no 'use server' directive; called from route handler, not Server Action.
 *
 * Reciprocal of lib/lps/render.ts for VITE_SPA templates (D-08):
 * - renderLp() rejects VITE_SPA templates (kind must be LIQUID)
 * - assertViteSpaKind() rejects everything that is NOT VITE_SPA (kind must be VITE_SPA)
 *
 * The symmetry is intentional and enforces strict type separation (PRJ-11):
 * "LIQUID templates can only be rendered via the LIQUID path; VITE_SPA templates
 * can only be served via the isolated VITE_SPA serve path."
 *
 * Also implements:
 * - D-07: SPA route fallback — extensionless path → index.html; asset with extension → direct
 * - MIME map — same values as s3-upload.ts (no new dependency; avoids import cycle with
 *   "use server" boundary when imported from a route handler context)
 */
import path from "node:path";

// -----------------------------------------------------------------------
// Inline MIME map — identical values to s3-upload.ts
// Do NOT import from s3-upload.ts (avoids "use server" boundary crossing
// and potential import cycles from the route handler context).
// -----------------------------------------------------------------------
const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/**
 * Reciprocal type guard for the VITE_SPA serve path (D-08).
 *
 * Throws if `kind` is anything other than 'VITE_SPA'. This mirrors the guard
 * in renderLp() (lib/lps/render.ts) which throws when kind === 'VITE_SPA'.
 *
 * The error message MUST contain the substring "Type boundary violation" exactly
 * as written — Plan 03 tests and type-boundary.test.ts match on this substring.
 *
 * Security: T-07-01-04 — error message reveals the kind value; acceptable because
 * this is server-side only; the error is logged, not returned to the client.
 *
 * @param kind - The template kind from the Template record.
 * @throws Error with "Type boundary violation" if kind !== 'VITE_SPA'
 */
export function assertViteSpaKind(kind: string): void {
  if (kind !== "VITE_SPA") {
    throw new Error(
      `Type boundary violation: only VITE_SPA templates can be served via the isolated serve path. ` +
        `Got kind="${kind}". Use renderLp() for LIQUID templates.`
    );
  }
}

/**
 * Resolve the S3 path and determine if a SPA route fallback applies (D-07).
 *
 * Rules:
 * - If the normalized path has a file extension → it's an asset request; serve directly.
 *   If the S3 object doesn't exist, the calling route handler should return 404.
 * - If the normalized path has NO file extension → it's a SPA route; fall back to index.html.
 *   React Router (or Vite's router) handles client-side routing from there.
 *
 * Edge cases (verified in tests):
 * - '/' (root) → normalized to '' → default to 'index.html' → isFallback: true
 * - '/index.html' (has extension) → served as-is → isFallback: false
 * - '/assets/chunk.abc123.js' (has extension) → served as-is → isFallback: false
 * - '/about' (no extension) → SPA route → 'index.html' → isFallback: true
 *
 * @param requestPath - The request pathname from the URL (may start with '/').
 * @returns { s3Path, isFallback } where s3Path is the relative path within the dist/ prefix.
 */
export function resolveServePath(
  requestPath: string
): { s3Path: string; isFallback: boolean } {
  // Strip leading slashes to get a clean relative path
  const normalized = requestPath.replace(/^\/+/, "");

  // Empty path = root '/' → always SPA fallback (no need to check extension)
  if (!normalized) {
    return { s3Path: "index.html", isFallback: true };
  }

  // Detect file extension — presence means it's an asset request, absence means SPA route
  // Pattern: one or more alphanumeric chars after the final dot
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(normalized);

  if (hasExtension) {
    // Asset request: serve exactly what was requested
    return { s3Path: normalized, isFallback: false };
  } else {
    // SPA route: fall back to index.html for client-side routing
    return { s3Path: "index.html", isFallback: true };
  }
}

/**
 * Get the HTTP Content-Type for a file based on its extension.
 *
 * Uses the same MIME map as s3-upload.ts (duplicated here to avoid the
 * "use server" import boundary — s3-upload.ts is a Server Action module).
 * Falls back to 'application/octet-stream' for unknown/binary types.
 *
 * @param filePath - The file name or path (extension is extracted via path.extname).
 * @returns The MIME type string for the Content-Type header.
 */
export function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] ?? "application/octet-stream";
}
