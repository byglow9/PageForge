/**
 * Workspace index page — /workspaces
 *
 * Server Component: lists all workspaces the current user is a member of.
 * Security (T-02-08-01, T-02-08-02):
 * - requireVerifiedUser() validates the session before any DB access; an
 *   unauthenticated or unverified request is redirected before getUserWorkspaces
 *   is called.
 * - getUserWorkspaces(user.id) filters by the session user ID — no URL param,
 *   query string, or client-supplied input is used to select workspaces,
 *   preventing cross-user enumeration.
 */
import Link from "next/link";
import { requireVerifiedUser } from "@/lib/workspaces/guards";
import { getUserWorkspaces } from "@/lib/workspaces/listing";
import { LogoutButton } from "./LogoutButton";

export default async function WorkspacesPage() {
  const user = await requireVerifiedUser();
  const workspaces = await getUserWorkspaces(user.id);

  if (workspaces.length === 0) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
        }}
      >
        <LogoutButton />
        <div style={{ width: "100%", maxWidth: "480px", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
            No workspaces yet
          </h1>
          <p style={{ color: "#666", marginBottom: "1.5rem" }}>
            You don&apos;t have any workspaces yet.
          </p>
          <Link
            href="/workspaces/new"
            style={{
              display: "inline-block",
              padding: "0.625rem 1.25rem",
              background: "#111827",
              color: "#fff",
              borderRadius: "6px",
              fontSize: "1rem",
              fontWeight: "500",
              textDecoration: "none",
            }}
          >
            Create your first workspace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <LogoutButton />
      <div style={{ width: "100%", maxWidth: "480px" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1.5rem" }}>
          Your workspaces
        </h1>

        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {workspaces.map((ws) => (
            <li
              key={ws.workspaceId}
              style={{
                borderBottom: "1px solid #e5e7eb",
                padding: "0.75rem 0",
              }}
            >
              <Link
                href={`/w/${ws.slug}`}
                style={{
                  fontWeight: "500",
                  fontSize: "1rem",
                  color: "#111827",
                  textDecoration: "none",
                }}
              >
                {ws.name}
              </Link>
              <span
                style={{
                  marginLeft: "0.5rem",
                  fontSize: "0.8rem",
                  color: "#6b7280",
                }}
              >
                ({ws.role})
              </span>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: "1.5rem" }}>
          <Link
            href="/workspaces/new"
            style={{
              fontSize: "0.875rem",
              color: "#6b7280",
              textDecoration: "underline",
            }}
          >
            Create another workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
