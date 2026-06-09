/**
 * Template picker page — /w/[slug]/lps/new
 *
 * RSC page shell: requires owner/admin/editor role, fetches workspace templates,
 * then renders the TemplatePickerForm client island.
 *
 * Security:
 * - requireWorkspaceRole gates to owner/admin/editor (lp.create permission).
 * - listTemplatesAction scopes to ctx.workspaceId (T-04-02-05).
 */
import { redirect } from "next/navigation";
import { requireWorkspaceRole } from "@/lib/workspaces/guards";
import { listTemplatesAction } from "@/lib/templates/actions";
import { TemplatePickerForm } from "./TemplatePickerForm";

interface NewLpPageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewLpPage({ params }: NewLpPageProps) {
  const { slug } = await params;

  // Gate: viewers cannot create LPs
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);
  void ctx; // workspaceId used by listTemplatesAction internally

  // Fetch workspace templates for picker
  const result = await listTemplatesAction(slug);
  const templates = result.ok
    ? result.data.map((t) => ({
        id: t.id,
        name: t.name,
        schemaVersion: t.schemaVersion,
      }))
    : [];

  return (
    <div className="px-8 py-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        Generate a Landing Page
      </h1>
      <TemplatePickerForm slug={slug} templates={templates} />
    </div>
  );
}
