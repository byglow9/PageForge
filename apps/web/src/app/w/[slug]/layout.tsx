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
import { requireWorkspace } from "@/lib/workspaces/guards";

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

  return (
    <div>
      {/* Minimal workspace shell — UI components added in later phases */}
      <nav
        style={{
          padding: "0.75rem 1.5rem",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          background: "#fff",
        }}
      >
        <span style={{ fontWeight: "600", fontSize: "0.95rem" }}>
          PageForge
        </span>
        <span style={{ color: "#9ca3af" }}>/</span>
        <span style={{ fontWeight: "500", fontSize: "0.95rem" }}>
          {ctx.workspaceSlug}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.75rem",
            background: "#f3f4f6",
            padding: "0.2rem 0.5rem",
            borderRadius: "4px",
            color: "#4b5563",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {ctx.role}
        </span>
      </nav>
      <main style={{ padding: "1.5rem" }}>{children}</main>
    </div>
  );
}
