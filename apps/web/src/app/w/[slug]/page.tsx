/**
 * Workspace dashboard page — /w/[slug]
 *
 * This is the root page of the workspace shell. The workspace context
 * (membership and role) is already validated by the parent layout.tsx.
 *
 * D-05: Active workspace resolved from /w/{slug} + server session membership.
 */
import { requireWorkspace } from "@/lib/workspaces/guards";

interface WorkspacePageProps {
  params: Promise<{ slug: string }>;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { slug } = await params;

  // The layout already guards this page, but we re-fetch context here
  // to access workspaceId and role for rendering content.
  const ctx = await requireWorkspace(slug);

  return (
    <div className="px-8 py-6">
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
        {ctx.workspaceSlug}
      </h1>
      <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
        Workspace dashboard — templates and LPs will appear here in Phase 3+.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        <div
          style={{
            padding: "1rem",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            background: "#f9fafb",
          }}
        >
          <h2 style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.25rem" }}>
            Your role
          </h2>
          <p
            style={{
              fontSize: "1.25rem",
              fontWeight: "bold",
              textTransform: "capitalize",
            }}
          >
            {ctx.role}
          </p>
        </div>

        <div
          style={{
            padding: "1rem",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            background: "#f9fafb",
          }}
        >
          <h2 style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.25rem" }}>
            Templates
          </h2>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            Coming in Phase 3
          </p>
        </div>

        <div
          style={{
            padding: "1rem",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            background: "#f9fafb",
          }}
        >
          <h2 style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.25rem" }}>
            Landing Pages
          </h2>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            Coming in Phase 4
          </p>
        </div>
      </div>
    </div>
  );
}
