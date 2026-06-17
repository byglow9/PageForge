"use client";

/**
 * LogoutButton — client island for the /workspaces screen.
 *
 * Signs the current user out and returns them to the login screen. Rendered
 * fixed to the top-right corner so it is reachable from both the empty state
 * and the workspace list.
 */

import { useTransition } from "react";
import { signOut } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await signOut();
      window.location.href = "/login";
    });
  }

  return (
    <div style={{ position: "fixed", top: "1rem", right: "1rem", zIndex: 10 }}>
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
