/**
 * New project template page — /w/[slug]/project-templates/new
 *
 * RSC page. Gates access to owner/admin/editor, then mounts the
 * ProjectTemplateForm client component for ZIP upload.
 *
 * Security:
 * - requireWorkspaceRole gates access. Viewers and unauthenticated users
 *   are redirected before the form is rendered (T-06-11).
 */
import { requireWorkspaceRole } from "@/lib/workspaces/guards";
import { ProjectTemplateForm } from "./ProjectTemplateForm";

interface NewProjectTemplatePageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewProjectTemplatePage({
  params,
}: NewProjectTemplatePageProps) {
  const { slug } = await params;

  // Gate: viewers are redirected — only owner/admin/editor can upload project templates
  await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  return <ProjectTemplateForm slug={slug} />;
}
