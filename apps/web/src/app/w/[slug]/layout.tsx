/**
 * Workspace shell layout — /w/[slug]/*
 *
 * This layout resolves and validates the workspace context from the URL slug
 * and session on every request. The slug is never trusted alone — it is
 * cross-checked against membership before rendering any workspace content (D-12).
 *
 * Any child page rendered inside this layout can trust that:
 * - The user is authenticated and email-verified.
 * - The user is a member of the workspace identified by `slug`.
 * - The workspace context (id, slug, userId, role) is valid.
 */
import Link from "next/link";
import { FileText } from "lucide-react";
import { requireWorkspace, requireVerifiedUser } from "@/lib/workspaces/guards";
import { SidebarUser } from "./SidebarUser";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { slug } = await params;

  // Guard: validates session, verifies email, and confirms membership.
  // Redirects to /login, /verify-email, or /workspaces/new if any check fails.
  const ctx = await requireWorkspace(slug);
  const user = await requireVerifiedUser();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar navigation (240px) */}
      <aside className="w-60 shrink-0 bg-gray-100 border-r border-gray-200 flex flex-col">
        {/* Workspace header */}
        <div className="py-3 px-6 border-b border-gray-200 flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-900">PageForge</span>
          <span className="text-gray-400">/</span>
          <span className="text-sm text-gray-700 truncate">{ctx.workspaceSlug}</span>
        </div>

        {/* Role badge */}
        <div className="px-6 pt-3 pb-1">
          <span className="inline-block bg-gray-100 border border-gray-200 text-gray-500 text-xs uppercase tracking-wide px-2 py-0.5 rounded">
            {ctx.role}
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4">
          <ul className="space-y-1 px-2">
            <li>
              <Link
                href={`/w/${slug}/templates`}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm text-gray-700 hover:bg-white hover:text-gray-900 transition-colors"
              >
                Templates
              </Link>
            </li>
            <li>
              <Link
                href={`/w/${slug}/lps`}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm text-gray-700 hover:bg-white hover:text-gray-900 transition-colors"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                Landing Pages
              </Link>
            </li>
            <li>
              <Link
                href={`/w/${slug}/brand`}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm text-gray-700 hover:bg-white hover:text-gray-900 transition-colors"
              >
                Brand Settings
              </Link>
            </li>
            <li>
              <Link
                href={`/w/${slug}/members`}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm text-gray-700 hover:bg-white hover:text-gray-900 transition-colors"
              >
                Members
              </Link>
            </li>
          </ul>
        </nav>

        {/* Account + logout footer */}
        <SidebarUser name={user.name || user.email} />
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
