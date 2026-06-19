/**
 * ZIP validation and extraction for VITE_SPA project template uploads.
 *
 * Security hardening:
 * - Zip-slip prevention: path.normalize() + reject absolute paths / ".." prefixes
 * - Zip-bomb prevention: uncompressed size cap via entry.uncompressedSize before stream open
 * - Compressed size cap: reject before calling yauzl (no parsing needed)
 * - No disk I/O: all entries kept in-memory as Buffers
 *
 * References:
 * - T-06-05 (zip-slip), T-06-06 (zip-bomb), T-06-07 (compressed size)
 * - Source: zip-slip prevention pattern — [CITED: medium.com/intrinsic-blog/protecting-node-js-applications-from-zip-slip]
 */
import yauzl from "yauzl";
import path from "path";

export interface ZipEntry {
  fileName: string;
  buffer: Buffer;
}

export interface ZipValidationResult {
  ok: boolean;
  error?: string;
  entries?: ZipEntry[];
}

// Size limits are env-var-backed so they can be tuned in production
const MAX_COMPRESSED_BYTES =
  parseInt(process.env.PROJECT_TEMPLATE_MAX_ZIP_MB ?? "50") * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES =
  parseInt(process.env.PROJECT_TEMPLATE_MAX_UNCOMPRESSED_MB ?? "200") * 1024 * 1024;

export async function validateAndExtractZip(
  zipBuffer: Buffer
): Promise<ZipValidationResult> {
  // T-06-07: First check — reject oversized compressed ZIP before any parsing
  if (zipBuffer.length > MAX_COMPRESSED_BYTES) {
    return {
      ok: false,
      error: `ZIP file exceeds the ${parseInt(process.env.PROJECT_TEMPLATE_MAX_ZIP_MB ?? "50")} MB compressed size limit.`,
    };
  }

  return new Promise((resolve) => {
    yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        return resolve({ ok: false, error: "Invalid or corrupt ZIP file." });
      }

      const entries: ZipEntry[] = [];
      let totalUncompressed = 0;
      let hasIndexHtml = false;

      zipfile.readEntry();

      zipfile.on("entry", (entry) => {
        const fileName = entry.fileName;

        // T-06-05: Zip-slip prevention — normalize and verify path stays within root
        const normalizedFileName = path.normalize(fileName);
        if (
          normalizedFileName.startsWith("..") ||
          normalizedFileName.includes("../") ||
          path.isAbsolute(normalizedFileName)
        ) {
          zipfile.close();
          return resolve({
            ok: false,
            error: `ZIP contains a path traversal entry: "${fileName}". Upload rejected.`,
          });
        }

        // Track index.html presence (accept at root OR in a dist/ subfolder)
        if (
          normalizedFileName === "index.html" ||
          normalizedFileName.endsWith("/index.html")
        ) {
          hasIndexHtml = true;
        }

        // T-06-06: Zip-bomb check — read uncompressedSize from central directory BEFORE opening stream
        totalUncompressed += entry.uncompressedSize;
        if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
          zipfile.close();
          return resolve({
            ok: false,
            error: "ZIP total uncompressed size exceeds the 200 MB limit.",
          });
        }

        // Skip directory entries — only extract file entries
        if (fileName.endsWith("/")) {
          zipfile.readEntry();
          return;
        }

        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) {
            zipfile.close();
            return resolve({ ok: false, error: "Failed to read ZIP entry." });
          }

          const chunks: Buffer[] = [];
          readStream.on("data", (chunk: Buffer) => chunks.push(chunk));
          readStream.on("end", () => {
            entries.push({ fileName: normalizedFileName, buffer: Buffer.concat(chunks) });
            zipfile.readEntry();
          });
          readStream.on("error", () => {
            zipfile.close();
            resolve({ ok: false, error: "Failed to read ZIP entry stream." });
          });
        });
      });

      zipfile.on("end", () => {
        if (!hasIndexHtml) {
          return resolve({
            ok: false,
            error: "ZIP must contain an index.html file at the root or in a subfolder.",
          });
        }
        resolve({ ok: true, entries });
      });

      zipfile.on("error", () =>
        resolve({ ok: false, error: "Invalid or corrupt ZIP file." })
      );
    });
  });
}
