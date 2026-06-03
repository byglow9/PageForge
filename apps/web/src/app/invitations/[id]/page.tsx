/**
 * Invitation acceptance page.
 *
 * This Server Component handles the copyable invite link flow (D-06, D-07).
 *
 * Security (D-07, D-12, T-02-03-01, T-02-03-04):
 * - The invitation record is looked up server-side by ID.
 * - workspaceId and role are read from the invitation row — never from client input.
 * - Signed-out users are redirected to /login or /signup with the invitation ID
 *   preserved in the query string so they return after authentication.
 * - Unverified (signed-in) users are redirected to /verify-email.
 * - Expired, accepted, and revoked invitations show an appropriate message.
 * - On acceptance, the user is redirected to /w/{slug}.
 *
 * Account-on-accept (D-07): if the invitee has no account, they click "Sign up"
 * which takes them to /signup?invitationId={id}. After signup+verify they land
 * back here and can accept.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import {
  lookupInvitation,
  isInvitationExpired,
  acceptInvitation,
} from "@/lib/workspaces/invitations";

interface InvitationPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ action?: string }>;
}

export default async function InvitationPage({
  params,
  searchParams,
}: InvitationPageProps) {
  const { id } = await params;
  const { action } = await searchParams;

  // Look up invitation server-side
  const invitation = await lookupInvitation(id);

  if (!invitation) {
    return (
      <div>
        <h1>Invitation not found</h1>
        <p>This invitation link is invalid or has been removed.</p>
        <a href="/">Go to home</a>
      </div>
    );
  }

  if (invitation.status === "revoked") {
    return (
      <div>
        <h1>Invitation revoked</h1>
        <p>This invitation has been revoked by the workspace administrator.</p>
        <a href="/">Go to home</a>
      </div>
    );
  }

  if (invitation.status === "accepted") {
    return (
      <div>
        <h1>Invitation already accepted</h1>
        <p>This invitation has already been used.</p>
        <a href="/">Go to home</a>
      </div>
    );
  }

  if (isInvitationExpired(invitation)) {
    return (
      <div>
        <h1>Invitation expired</h1>
        <p>This invitation link has expired. Please ask the workspace administrator for a new invite.</p>
        <a href="/">Go to home</a>
      </div>
    );
  }

  // Check current session
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  // Case 1: Not signed in → redirect to login/signup with invitation ID preserved (D-07)
  if (!session?.user) {
    return (
      <div>
        <h1>You have been invited</h1>
        <p>
          You have been invited to join a workspace as <strong>{invitation.role}</strong>.
        </p>
        <p>To accept this invitation, please sign in or create an account.</p>
        <div>
          <a href={`/login?invitationId=${id}`}>Sign in</a>
          <span> or </span>
          <a href={`/signup?invitationId=${id}`}>Create an account</a>
        </div>
        <p>
          <small>This invitation expires on {invitation.expiresAt.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}.</small>
        </p>
      </div>
    );
  }

  // Case 2: Signed in but email not verified → redirect to verify-email (T-02-03-01)
  if (!session.user.emailVerified) {
    return (
      <div>
        <h1>Email verification required</h1>
        <p>You must verify your email address before accepting an invitation.</p>
        <a href={`/verify-email?invitationId=${id}`}>Verify your email</a>
      </div>
    );
  }

  // Case 3: Signed in and verified + action=accept → process acceptance
  if (action === "accept") {
    try {
      const result = await acceptInvitation(id, {
        id: session.user.id,
        email: session.user.email,
        emailVerified: session.user.emailVerified,
      });
      // Redirect to the workspace after acceptance (D-05)
      redirect(`/w/${result.slug}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      return (
        <div>
          <h1>Unable to accept invitation</h1>
          <p>{message}</p>
          <a href="/">Go to home</a>
        </div>
      );
    }
  }

  // Case 4: Signed in and verified — show accept prompt
  return (
    <div>
      <h1>Workspace invitation</h1>
      <p>
        You have been invited to join as <strong>{invitation.role}</strong>.
      </p>
      <p>
        Signed in as: <strong>{session.user.email}</strong>
      </p>
      <p>
        <small>
          This invitation expires on{" "}
          {invitation.expiresAt.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          .
        </small>
      </p>
      {/* Accept form — posts to this same page with action=accept */}
      <form action={`/invitations/${id}?action=accept`} method="GET">
        <button type="submit">Accept invitation</button>
      </form>
      <p>
        <a href="/">Decline</a>
      </p>
    </div>
  );
}
