/**
 * Template list page — /w/[slug]/templates
 *
 * RSC page. Lists all templates for the workspace, or shows an empty state CTA.
 *
 * Security:
 * - requireWorkspaceRole gates access to owner/admin/editor; viewers are
 *   redirected to /w/{slug} (no read access to the templates area).
 * - Only members with template.create permission see the "Create Template" button.
 * - listTemplatesAction uses withTenantDb which scopes queries to ctx.workspaceId
 *   (T-03-03-01).
 */
import Link from "next/link";
import { FileCode } from "lucide-react";
import { requireWorkspaceRole, can } from "@/lib/workspaces/guards";
import { listTemplatesAction } from "@/lib/templates/actions";
import { TemplateCard } from "@/components/templates/TemplateCard";

interface TemplatesPageProps {
  params: Promise<{ slug: string }>;
}

export default async function TemplatesPage({ params }: TemplatesPageProps) {
  const { slug } = await params;
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  const result = await listTemplatesAction(slug);
  const templates = result.ok ? result.data : [];

  const canCreate = can(ctx.role, "template", "create");

  return (
    <div className="px-8 py-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Templates</h1>
        {canCreate && (
          <div className="flex items-center gap-3">
            <Link
              href={`/w/${slug}/project-templates/new`}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
            >
              New Project Template (ZIP)
            </Link>
            <Link
              href={`/w/${slug}/templates/new`}
              className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              Create Template
            </Link>
          </div>
        )}
      </div>

      {/* Template grid or empty state */}
      {templates.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <FileCode className="h-12 w-12 text-gray-300 mb-4" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No templates yet</h2>
          <p className="text-sm text-gray-500 mb-6">
            Create your first template to start building landing pages.
          </p>
          {canCreate && (
            <div className="flex items-center gap-3">
              <Link
                href={`/w/${slug}/templates/new`}
                className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
              >
                Create Template
              </Link>
              <Link
                href={`/w/${slug}/project-templates/new`}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
              >
                New Project Template (ZIP)
              </Link>
            </div>
          )}
        </div>
      ) : (
        /* Template card grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              slug={slug}
            />
          ))}
        </div>
      )}
    </div>
  );
}
