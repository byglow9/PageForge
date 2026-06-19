/**
 * Secret scanner for VITE_SPA project template dist/ files.
 *
 * Scans extracted ZIP entries for known credential patterns and Lovable artifacts.
 * Returns advisory findings — NEVER blocks the upload. The caller decides what to
 * do with findings (typically: surface as warning toast, then proceed with creation).
 *
 * Security: T-06-08 (information disclosure — baked credentials in dist/)
 *
 * Patterns confirmed from renova-turismo-jornada-main reference project:
 * - Supabase JWT/URL: baked via import.meta.env in Vite builds
 * - Lovable app URL: present in index.html OG meta tags
 * - Stripe live key, AWS access key: high-severity — warn the user
 */
import path from "path";

export interface ScanFinding {
  file: string;
  type: string;
  description: string;
}

const SECRET_PATTERNS: Array<{ type: string; pattern: RegExp; description: string }> = [
  {
    type: "SUPABASE_JWT",
    // Supabase JWTs always start with this specific header (HS256 alg + JWT typ)
    pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
    description:
      "Supabase JWT anon key detected. This key is baked into the bundle and visible to all users. Ensure it is intentional and your Supabase project's Row Level Security is enabled.",
  },
  {
    type: "SUPABASE_URL",
    pattern: /https:\/\/[a-z0-9]+\.supabase\.co/,
    description:
      "Supabase project URL detected. This LP depends on a live Supabase backend — it may not function correctly without that backend.",
  },
  {
    type: "STRIPE_LIVE_KEY",
    pattern: /sk_live_[A-Za-z0-9]{24,}/,
    description:
      "Stripe live secret key detected. This is a high-severity credential — remove it from your project before uploading.",
  },
  {
    type: "AWS_ACCESS_KEY",
    pattern: /AKIA[A-Z0-9]{16}/,
    description:
      "AWS access key detected. This is a credential — remove it before uploading.",
  },
  {
    type: "LOVABLE_APP_URL",
    pattern: /[a-z0-9-]+\.lovable\.app/,
    description:
      "Lovable-hosted URL detected in the bundle. You may want to update canonical URLs to your own domain after registering this template.",
  },
];

/** Text extensions to scan (skip binary assets like images, fonts, etc.) */
const TEXT_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".mjs",
  ".cjs",
  ".css",
  ".json",
  ".ts",
  ".tsx",
]);

/**
 * Scan extracted dist/ entries for known credential/artifact patterns.
 *
 * @param entries - Array of extracted ZIP entries with fileName and buffer.
 * @returns Array of advisory findings. Empty array means no issues found.
 *          This function NEVER throws — all findings are advisory only.
 */
export function scanDistFiles(
  entries: Array<{ fileName: string; buffer: Buffer }>
): ScanFinding[] {
  const findings: ScanFinding[] = [];

  for (const entry of entries) {
    const ext = path.extname(entry.fileName).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) continue;

    const content = entry.buffer.toString("utf-8");

    for (const { type, pattern, description } of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        findings.push({ file: entry.fileName, type, description });
      }
    }
  }

  return findings;
}
