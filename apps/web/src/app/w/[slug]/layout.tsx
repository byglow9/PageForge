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
import Image from "next/image";
import {
  requireWorkspace,
  requireVerifiedUser,
  can,
} from "@/lib/workspaces/guards";
import { SidebarUser } from "./SidebarUser";
import { SidebarNav } from "./SidebarNav";

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

  // Authoring nav is gated by role: viewers can't create templates or edit
  // brand settings, so those links are hidden for them.
  const canAuthorTemplates = can(ctx.role, "template", "create");
  const canEditBrand = can(ctx.role, "brand", "update");

  return (
    <div className="pageforge-grid-bg flex h-screen">
      {/* Sidebar navigation (240px) */}
      <aside className="w-60 shrink-0 bg-white/88 border-r border-gray-200 flex flex-col backdrop-blur-sm">
        {/* Workspace header — brand mark + wordmark + workspace slug */}
        <div className="py-3 px-4 border-b border-gray-200 flex items-center gap-2">
          <Image
            src="/brand/pageforge-anvil-logo.png"
            alt=""
            width={24}
            height={24}
            className="shrink-0"
            priority
          />
          <span className="font-display font-semibold text-[15px] tracking-tight text-gray-900">
            PageForge
          </span>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-600 truncate">{ctx.workspaceSlug}</span>
        </div>

        {/* Role badge */}
        <div className="px-6 pt-3 pb-1">
          <span className="inline-block bg-gray-100 border border-gray-200 text-gray-500 text-xs uppercase tracking-wide px-2 py-0.5 rounded">
            {ctx.role}
          </span>
        </div>

        {/* Nav links with active-route highlighting */}
        <SidebarNav
          slug={slug}
          canAuthorTemplates={canAuthorTemplates}
          canEditBrand={canEditBrand}
        />

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
