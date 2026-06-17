"use client";

/**
 * SwitchAccountButton — client island for the invitation page.
 *
 * Lets a signed-in user whose email does NOT match the invited address sign
 * out and return to /login (with the invitationId preserved) so they can
 * accept the invitation from the correct account.
 *
 * Security: invitationId comes from server-rendered props (await params in the
 * page) — never from client-sourced URL search params or form fields.
 */

import { useTransition } from "react";
import { signOut } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";

interface SwitchAccountButtonProps {
  invitationId: string;
}

export function SwitchAccountButton({ invitationId }: SwitchAccountButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await signOut();
      window.location.href = `/login?invitationId=${invitationId}`;
    });
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
