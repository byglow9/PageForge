"use client";

/**
 * LogoutButton — client island for the /workspaces screen.
 *
 * Shows the signed-in account name and a button to sign out and return to the
 * login screen. Rendered fixed to the top-right corner so it is reachable from
 * both the empty state and the workspace list.
 *
 * Navigation is guaranteed in a finally block: even if signOut() rejects or
 * hangs at the network layer, the user is still taken to /login.
 */

import { useState } from "react";
import { signOut } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";

interface LogoutButtonProps {
  userName?: string;
}

export function LogoutButton({ userName }: LogoutButtonProps) {
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    setIsPending(true);
    try {
      await signOut();
    } catch {
      // Ignore — navigate regardless.
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top: "1rem",
        right: "1rem",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
      }}
    >
      {userName ? (
        <span style={{ fontSize: "0.875rem", color: "#6b7280" }}>{userName}</span>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? "Logging out…" : "Log out"}
      </Button>
    </div>
  );
}
