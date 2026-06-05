/**
 * New template page — /w/[slug]/templates/new
 *
 * RSC page. Wraps TemplateEditor in create mode.
 *
 * Security:
 * - requireWorkspaceRole gates access to owner/admin/editor.
 *   Viewers attempting to access this route are redirected to /w/[slug] (T-03-03-03).
 */
import { requireWorkspaceRole } from "@/lib/workspaces/guards";
import { TemplateEditor } from "@/components/templates/TemplateEditor";

interface NewTemplatePageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewTemplatePage({ params }: NewTemplatePageProps) {
  const { slug } = await params;

  // Gate: viewers are redirected to workspace root (T-03-03-03)
  await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  return <TemplateEditor slug={slug} mode="create" />;
}
