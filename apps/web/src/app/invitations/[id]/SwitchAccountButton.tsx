"use client";

/**
 * SwitchAccountButton — client island for the invitation page.
 *
 * Lets a signed-in user whose email does NOT match the invited address sign
 * out and return to /login (with the invitationId preserved) so they can
 * accept the invitation from the correct account.
 *
 * Navigation is guaranteed in a finally block: even if signOut() rejects or
 * hangs at the network layer, the user is still taken to /login so the button
 * never appears to do nothing.
 *
 * Security: invitationId comes from server-rendered props (await params in the
 * page) — never from client-sourced URL search params or form fields.
 */

import { useState } from "react";
import { signOut } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";

interface SwitchAccountButtonProps {
  invitationId: string;
}

export function SwitchAccountButton({ invitationId }: SwitchAccountButtonProps) {
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    setIsPending(true);
    try {
      await signOut();
    } catch {
      // Ignore — navigate regardless so the user can re-authenticate.
    } finally {
      window.location.href = `/login?invitationId=${invitationId}`;
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? "Switching…" : "Switch account"}
    </Button>
  );
}
