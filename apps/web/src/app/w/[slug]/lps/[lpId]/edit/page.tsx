/**
 * LP edit page — /w/[slug]/lps/[lpId]/edit
 *
 * RSC page shell: fetches LP, re-parses schema from markupSnapshot, fetches
 * source template for version mismatch detection (D-08), then renders LpForm
 * in "edit" mode with pre-populated values.
 *
 * Architecture:
 * - Only { parse } is imported from pageforge-engine (never render).
 * - metadataOverlay: fetched from source template if still exists (approach a).
 *   Falls back to {} if template deleted (LP is self-sufficient via markupSnapshot).
 * - D-08: templateCurrentSchemaVersion passed for mismatch detection.
 *
 * Security:
 * - requireWorkspaceRole gates to owner/admin/editor.
 * - db.lp.findById and db.template.findById both filter by workspaceId (T-04-02-04).
 */
import { redirect } from "next/navigation";
import { parse } from "pageforge-engine";
import { z } from "zod";
import { requireWorkspaceRole } from "@/lib/workspaces/guards";
import { withTenantDb } from "@/lib/db/tenant-db";
import { LpForm } from "@/components/lps/LpForm";
import type { MetadataOverlay } from "@/lib/templates/metadata";

interface EditLpPageProps {
  params: Promise<{ slug: string; lpId: string }>;
}

export default async function EditLpPage({ params }: EditLpPageProps) {
  const { slug, lpId } = await params;

  // Gate: owner/admin/editor only
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // Fetch LP — filters by workspaceId (T-04-02-04)
  const lp = await withTenantDb({ workspaceId: ctx.workspaceId }, (db) =>
    db.lp.findById(lpId)
  );

  if (!lp) {
    redirect(`/w/${slug}/lps`);
  }

  // Re-parse schema from markupSnapshot (the LP's stored snapshot, not live template)
  // Only { parse } imported — never render (Pitfall 1 prevention)
  let parsedSchema;
  try {
    parsedSchema = parse(lp.markupSnapshot);
  } catch {
    // If snapshot is somehow invalid, redirect to list
    redirect(`/w/${slug}/lps`);
  }

  // Fetch source template for metadataOverlay + templateCurrentSchemaVersion (D-08)
  // Approach (a): fetch from source template if it still exists, fallback to {}
  let metadataOverlay: MetadataOverlay = {};
  let templateCurrentSchemaVersion: number | undefined = undefined;

  if (lp.templateId) {
    const sourceTemplate = await withTenantDb(
      { workspaceId: ctx.workspaceId },
      (db) => db.template.findById(lp.templateId!)
    );

    if (sourceTemplate) {
      metadataOverlay = (sourceTemplate.metadataOverlay as unknown as MetadataOverlay) ?? {};
      templateCurrentSchemaVersion = sourceTemplate.schemaVersion;
    }
  }

  // Validate LP values from DB (never cast DB JSON directly)
  const valuesResult = z
    .record(z.string(), z.unknown())
    .safeParse(lp.values);
  const safeValues = valuesResult.success ? valuesResult.data : {};

  // Fetch brand config (D-04: live resolution at render time)
  const brandConfig = await withTenantDb({ workspaceId: ctx.workspaceId }, (db) =>
    db.brandConfig.findFirst()
  );

  return (
    <div className="px-8 py-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        Edit Landing Page
      </h1>
      <LpForm
        slug={slug}
        mode="edit"
        template={{
          id: lp.templateId ?? "",
          markup: lp.markupSnapshot,
          schemaVersion: lp.schemaVersion,
          schema: parsedSchema,
          metadataOverlay,
        }}
        brandConfig={
          brandConfig
            ? {
                logoUrl: brandConfig.logoUrl,
                primaryColor: brandConfig.primaryColor,
                whatsapp: brandConfig.whatsapp,
              }
            : null
        }
        initialValues={safeValues}
        lpId={lp.id}
        lpName={lp.name}
        templateCurrentSchemaVersion={templateCurrentSchemaVersion}
      />
    </div>
  );
}
