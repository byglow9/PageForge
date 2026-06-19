/**
 * S3 multi-file upload for VITE_SPA project template dist/ bundles.
 *
 * Uploads each extracted ZIP entry as a separate S3 object under the
 * tenant-scoped, non-enumerable prefix:
 *   workspaces/{workspaceId}/project-templates/{templateId}/dist/{normalizedFileName}
 *
 * Security:
 * - T-06-10: entry.fileName is already path.normalize()-d by zip-validate.ts
 *   — cannot contain ".." or be absolute, so the S3 key cannot escape the tenant prefix.
 * - T-06-09: workspaceId comes only from the server session (passed in from actions.ts).
 *   This module never reads workspaceId from any other source.
 * - Does NOT initialize an S3 client — caller (actions.ts) passes it in for testability.
 *
 * Key convention mirrors the existing LP assets convention:
 *   lps:      workspaces/{wId}/lps/assets/{uuid}.ext
 *   project-templates: workspaces/{wId}/project-templates/{templateId}/dist/{fileName}
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import path from "path";
import type { ZipEntry } from "./zip-validate";

/**
 * Inline MIME map for Vite dist/ extensions — avoids adding a mime-types dependency.
 * Default: "application/octet-stream" for unknown/binary extensions.
 */
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
 * Upload all dist/ entries to S3 under the tenant-scoped prefix.
 *
 * @param entries - Extracted ZIP entries (already normalized by zip-validate.ts).
 * @param workspaceId - The workspace ID from the server session — never from client.
 * @param templateId - The template ID (crypto.randomUUID()) pre-generated in actions.ts.
 *                     The DB row uses the same ID so Phase 7 can resolve S3 files from template.id.
 * @param s3Client - Caller-provided S3 client singleton (no env vars read here).
 */
export async function uploadDistToS3(
  entries: ZipEntry[],
  workspaceId: string,
  templateId: string,
  s3Client: S3Client
): Promise<void> {
  // Upload all entries in parallel — entries are already in-memory from zip-validate.ts
  await Promise.all(
    entries.map(async (entry) => {
      const key = `workspaces/${workspaceId}/project-templates/${templateId}/dist/${entry.fileName}`;
      const ext = path.extname(entry.fileName).toLowerCase();
      const contentType = MIME[ext] ?? "application/octet-stream";

      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: key,
          Body: entry.buffer,
          ContentType: contentType,
        })
      );
    })
  );
}
