/**
 * Workspace creation page — /workspaces/new
 *
 * D-04: Workspace creation is explicit after signup. No workspace is
 * auto-created during signup or login.
 *
 * This page is protected: only verified users can create a workspace.
 * The guard redirect happens inside createWorkspaceAction on the server.
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWorkspaceAction } from "@/lib/workspaces/actions";

export default function NewWorkspacePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Auto-generate slug from name unless user has manually edited it
  function handleNameChange(value: string) {
    setName(value);
    if (!slugManuallyEdited) {
      const autoSlug = value
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/^-+|-+$/g, "")
        .substring(0, 48);
      setSlug(autoSlug);
    }
  }

  function handleSlugChange(value: string) {
    setSlug(value);
    setSlugManuallyEdited(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setGlobalError(null);

    startTransition(async () => {
      const result = await createWorkspaceAction({ name, slug });

      // createWorkspaceAction redirects on success — if we get a result back, it's an error
      if (result && !result.ok) {
        if (result.fieldErrors) {
          setErrors(result.fieldErrors);
        } else {
          setGlobalError(result.error);
        }
      }
    });
  }

  return (
    <div
      className="pageforge-grid-bg"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "480px" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
          Create a workspace
        </h1>
        <p style={{ color: "#666", marginBottom: "1.5rem" }}>
          A workspace groups your landing page templates, generated LPs, and team members.
        </p>

        {globalError && (
          <div
            style={{
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              borderRadius: "6px",
              padding: "0.75rem",
              marginBottom: "1rem",
              color: "#dc2626",
            }}
          >
            {globalError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="name"
              style={{ display: "block", fontWeight: "500", marginBottom: "0.25rem" }}
            >
              Workspace name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Agency"
              required
              disabled={isPending}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: errors.name ? "1px solid #dc2626" : "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "1rem",
                boxSizing: "border-box",
              }}
            />
            {errors.name && (
              <p style={{ color: "#dc2626", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                {errors.name[0]}
              </p>
            )}
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="slug"
              style={{ display: "block", fontWeight: "500", marginBottom: "0.25rem" }}
            >
              Workspace URL
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "0" }}>
              <span
                style={{
                  padding: "0.5rem 0.75rem",
                  background: "#f3f4f6",
                  border: "1px solid #d1d5db",
                  borderRight: "none",
                  borderRadius: "6px 0 0 6px",
                  color: "#6b7280",
                  fontSize: "0.9rem",
                  whiteSpace: "nowrap",
                }}
              >
                /w/
              </span>
              <input
                id="slug"
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="my-agency"
                required
                disabled={isPending}
                style={{
                  flex: 1,
                  padding: "0.5rem 0.75rem",
                  border: errors.slug ? "1px solid #dc2626" : "1px solid #d1d5db",
                  borderRadius: "0 6px 6px 0",
                  fontSize: "1rem",
                  minWidth: 0,
                }}
              />
            </div>
            {errors.slug && (
              <p style={{ color: "#dc2626", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                {errors.slug[0]}
              </p>
            )}
            <p style={{ color: "#6b7280", fontSize: "0.8rem", marginTop: "0.25rem" }}>
              Lowercase letters, numbers, and hyphens only.
            </p>
          </div>

          <button
            type="submit"
            disabled={isPending}
            style={{
              width: "100%",
              padding: "0.625rem 1rem",
              background: isPending ? "#9ca3af" : "#111827",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: "1rem",
              fontWeight: "500",
              cursor: isPending ? "not-allowed" : "pointer",
            }}
          >
            {isPending ? "Creating..." : "Create workspace"}
          </button>
        </form>

        <p style={{ marginTop: "1rem", textAlign: "center", color: "#6b7280", fontSize: "0.875rem" }}>
          You will be redirected to your new workspace after creation.
        </p>
      </div>
    </div>
  );
}
