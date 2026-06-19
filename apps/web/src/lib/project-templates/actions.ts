/**
 * Server Actions for VITE_SPA project template ingestion.
 *
 * createProjectTemplateAction orchestrates the full ingestion pipeline:
 * 1. Auth gate — requireWorkspaceRole (FIRST, before any data access)
 * 2. FormData validation — name (Zod) + zipFile (instanceof File)
 * 3. ZIP validation — zip-slip, zip-bomb, index.html presence (validateAndExtractZip)
 * 4. Secret scan — advisory findings for baked credentials (scanDistFiles)
 * 5. S3 upload — all dist/ files under tenant-scoped prefix (uploadDistToS3)
 * 6. DB persist — Template row with kind='VITE_SPA', id matching S3 prefix
 * 7. Return findings — warnings surfaced in UI, never block the upload (D6 decision)
 *
 * Security (T-06-09, T-06-11, T-06-14):
 * - workspaceId always from requireWorkspaceRole (session), never from FormData
 * - kind='VITE_SPA' hardcoded in action body — not read from FormData
 * - requireWorkspaceRole is the FIRST await — viewers and unauthenticated requests
 *   are rejected before any ZIP data is read
 */
"use server";

import { revalidatePath } from "next/cache";
import { S3Client } from "@aws-sdk/client-s3";
import { requireWorkspaceRole } from "@/lib/workspaces/guards";
import { withTenantDb } from "@/lib/db/tenant-db";
import type { ActionResult } from "@/lib/workspaces/actions";
import { CreateProjectTemplateSchema } from "./schema";
import { validateAndExtractZip } from "./zip-validate";
import { scanDistFiles } from "./secret-scan";
import type { ScanFinding } from "./secret-scan";
import { uploadDistToS3 } from "./s3-upload";

// -----------------------------------------------------------------------
// S3 client singleton (module-level, initialized once per cold start)
// Security: credentials come from server-side env vars only (T-06-09)
// Pattern: follows apps/web/src/lib/lps/actions.ts exactly
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
// createProjectTemplateAction
// -----------------------------------------------------------------------

/**
 * Upload a Vite dist/ ZIP and create a VITE_SPA project template.
 *
 * @param slug - Workspace slug from the URL (used for auth gate + revalidation).
 * @param formData - FormData with "name" (string) and "zipFile" (File).
 * @returns ActionResult with template id and advisory scan findings.
 */
export async function createProjectTemplateAction(
  slug: string,
  formData: FormData
): Promise<ActionResult<{ id: string; findings: ScanFinding[] }>> {
  try {
    // Step 1: Auth gate — FIRST operation. workspaceId comes from session, never FormData.
    // T-06-11, T-06-09: viewers and unauthenticated requests rejected before any ZIP is read.
    const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

    // Step 2: Read and type-check FormData fields
    const name = formData.get("name");
    const zipFile = formData.get("zipFile");
    if (typeof name !== "string" || !(zipFile instanceof File)) {
      return { ok: false, error: "Invalid form data." };
    }

    // Step 3: Zod validation for name field
    const parsed = CreateProjectTemplateSchema.safeParse({ name });
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as string;
        fieldErrors[field] = fieldErrors[field] ?? [];
        fieldErrors[field].push(issue.message);
      }
      return { ok: false, error: "Validation failed", fieldErrors };
    }

    // Step 4: Read ZIP buffer from FormData file
    const zipBuffer = Buffer.from(await zipFile.arrayBuffer());

    // Step 5: Validate ZIP — zip-slip, zip-bomb, index.html presence
    // T-06-05, T-06-06, T-06-07
    const validation = await validateAndExtractZip(zipBuffer);
    if (!validation.ok) {
      return { ok: false, error: validation.error! };
    }

    // Step 6: Secret scan — advisory only, NEVER blocks upload (D6 decision)
    // T-06-08: findings are returned in the ActionResult for the UI to surface as warnings
    const findings = scanDistFiles(validation.entries!);

    // Step 7: Generate templateId BEFORE S3 upload — the DB row id MUST equal the S3 key prefix
    // This enables Phase 7 to resolve S3 files from template.id without an extra lookup
    const templateId = crypto.randomUUID();

    // Step 8: Upload all dist/ files to S3 under the tenant-scoped prefix
    // T-06-10: entry.fileName is already path.normalize()-d by zip-validate.ts
    await uploadDistToS3(validation.entries!, ctx.workspaceId, templateId, s3Client);

    // Step 9: Persist Template row with kind='VITE_SPA'
    // - id: templateId is passed explicitly so the DB row id equals the S3 key prefix
    // - markup: "" — VITE_SPA templates have no LiquidJS markup; content lives in S3 dist/
    // - schema: {} — VITE_SPA has no token schema (no dynamic fields)
    // - metadataOverlay: {} — VITE_SPA has no metadata overlay
    // - kind: "VITE_SPA" — hardcoded, never from FormData (T-06-14)
    // Note: VITE_SPA templates have no LiquidJS markup and no token schema — the content
    //   lives in S3 under the dist/ prefix. parse/render guards in lib/lps/render.ts and
    //   lib/templates/actions.ts skip LiquidJS processing when kind === 'VITE_SPA'.
    const template = await withTenantDb(
      { workspaceId: ctx.workspaceId },
      async (db) => {
        return db.template.create({
          id: templateId,
          name: parsed.data.name,
          markup: "",
          schema: {},
          metadataOverlay: {},
          kind: "VITE_SPA",
        });
      }
    );

    // Step 10: Invalidate the templates list cache
    revalidatePath(`/w/${slug}/templates`);

    // Step 11: Return success with advisory findings
    return { ok: true, data: { id: template.id, findings } };
  } catch (error) {
    // Re-throw redirect/notFound responses from requireWorkspaceRole
    if (
      error instanceof Error &&
      (error.message.includes("NEXT_REDIRECT") || error.message.includes("NEXT_NOT_FOUND"))
    ) {
      throw error;
    }
    console.error("[createProjectTemplateAction] unexpected error:", error);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}
