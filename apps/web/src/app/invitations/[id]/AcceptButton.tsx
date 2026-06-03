"use client";

/**
 * AcceptButton — client island for accepting a workspace invitation.
 *
 * This component is intentionally kept as a small "client island" embedded
 * in the otherwise server-rendered invitation page. It:
 * - Calls acceptInvitationAction imperatively (not via a native <form>),
 *   which allows the returned ActionResult to propagate back to the UI.
 * - Shows a visible error message when the action returns {ok:false}.
 * - Disables the button while the action is in-flight to prevent rapid
 *   re-submission (T-02-07-04).
 *
 * Security (T-02-07-01, T-02-07-02):
 * - invitationId comes from server-rendered props (await params in the page);
 *   the client never sources it from URL search params or a form field.
 * - The error message displayed does NOT reveal whether the invited email
 *   is or is not a registered account (prevents user enumeration via the
 *   invite page). The message text is owned by acceptInvitation() on the
 *   server: "This invitation was issued to a different email address."
 */

import { useState, useTransition } from "react";
import { acceptInvitationAction } from "@/lib/workspaces/actions";

interface AcceptButtonProps {
  invitationId: string;
}

export function AcceptButton({ invitationId }: AcceptButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvitationAction(invitationId);
      // On {ok:true}: redirect() fires inside the action — we never reach here.
      // On {ok:false}: surface the error message in the UI.
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? "Accepting…" : "Accept invitation"}
      </button>
      {error !== null && (
        <p role="alert" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}
    </div>
  );
}
