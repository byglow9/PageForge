/**
 * Edit template page — /w/[slug]/templates/[id]/edit
 *
 * RSC page. Fetches template from DB, validates schema, and passes initial data
 * to TemplateEditor in edit mode.
 *
 * Security:
 * - requireWorkspaceRole gates access to owner/admin/editor (T-03-03-03).
 * - db.template.findById filters by workspaceId — cross-workspace IDs return null
 *   and redirect to the templates list (T-03-03-02).
 * - template.schema from DB is validated with ParsedSchemaSchema before passing
 *   to client (RESEARCH anti-pattern: never cast DB JSON directly as ParsedSchema).
 */
import { redirect } from "next/navigation";
import { ParsedSchemaValidator } from "@/lib/templates/parsed-schema-validator";
import { requireWorkspaceRole } from "@/lib/workspaces/guards";
import { withTenantDb } from "@/lib/db/tenant-db";
import { TemplateEditor } from "@/components/templates/TemplateEditor";

interface EditTemplatePageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function EditTemplatePage({ params }: EditTemplatePageProps) {
  const { slug, id } = await params;

  // Gate: viewers are redirected to workspace root (T-03-03-03)
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  // Fetch template — findById filters by workspaceId (T-03-03-02)
  const template = await withTenantDb({ workspaceId: ctx.workspaceId }, (db) =>
    db.template.findById(id)
  );

  // Cross-workspace ID or non-existent template: redirect to templates list
  if (!template) {
    redirect(`/w/${slug}/templates`);
  }

  // Validate DB JSON with ParsedSchemaValidator before passing to client
  // (RESEARCH anti-pattern: never cast DB JSON directly as ParsedSchema).
  const schemaParsed = ParsedSchemaValidator.safeParse(template.schema);
  const safeSchema = schemaParsed.success ? schemaParsed.data : null;

  return (
    <TemplateEditor
      slug={slug}
      mode="edit"
      initialTemplate={{
        id: template.id,
        name: template.name,
        markup: template.markup,
        schema: safeSchema,
        metadataOverlay: template.metadataOverlay,
        schemaVersion: template.schemaVersion,
      }}
    />
  );
}
