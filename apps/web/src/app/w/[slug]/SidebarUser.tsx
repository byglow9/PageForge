"use client";

/**
 * SidebarUser — footer of the workspace shell sidebar.
 *
 * Shows the signed-in account name and a Log out button. Navigation is
 * guaranteed in a finally block so the button always returns the user to
 * /login even if signOut() rejects or hangs.
 */

import { useState } from "react";
import { signOut } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";

interface SidebarUserProps {
  name: string;
}

export function SidebarUser({ name }: SidebarUserProps) {
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
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
    <div className="mt-auto border-t border-gray-200 px-4 py-3">
      <p className="mb-2 truncate text-xs text-gray-500">{name}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleLogout}
        disabled={isPending}
      >
        {isPending ? "Logging out…" : "Log out"}
      </Button>
    </div>
  );
}
