/**
 * Invitation acceptance page.
 *
 * This Server Component handles the copyable invite link flow (D-06, D-07).
 *
 * Security (D-07, D-12, T-02-03-01, T-02-03-04, T-02-07-01, T-02-07-02):
 * - The invitation record is looked up server-side by ID.
 * - workspaceId and role are read from the invitation row — never from client input.
 * - Signed-out users are redirected to /login or /signup with the invitation ID
 *   preserved in the query string so they return after authentication.
 * - Unverified (signed-in) users are redirected to /verify-email.
 * - Expired, accepted, and revoked invitations show an appropriate message.
 * - On acceptance, the user is redirected to /w/{slug}.
 * - invitationId is passed to AcceptButton from server-rendered await params;
 *   the client never sources it from URL search params or form fields (T-02-07-01).
 *
 * Account-on-accept (D-07): if the invitee has no account, they click "Sign up"
 * which takes them to /signup?invitationId={id}. After signup+verify they land
 * back here and can accept.
 */
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth/auth";
import {
  lookupInvitation,
  isInvitationExpired,
} from "@/lib/workspaces/invitations";
import { AcceptButton } from "./AcceptButton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

interface InvitationPageProps {
  params: Promise<{ id: string }>;
}

export default async function InvitationPage({
  params,
}: InvitationPageProps) {
  const { id } = await params;

  // Look up invitation server-side
  const invitation = await lookupInvitation(id);

  if (!invitation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Invitation not found</CardTitle>
            <CardDescription>
              This invitation link is invalid or has been removed.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Go to home
            </Link>
          </CardFooter>
        </Card>
      </main>
    );
  }

  if (invitation.status === "revoked") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Invitation revoked</CardTitle>
            <CardDescription>
              This invitation has been revoked by the workspace administrator.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Go to home
            </Link>
          </CardFooter>
        </Card>
      </main>
    );
  }

  if (invitation.status === "accepted") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Invitation already accepted</CardTitle>
            <CardDescription>
              This invitation has already been used.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Go to home
            </Link>
          </CardFooter>
        </Card>
      </main>
    );
  }

  if (isInvitationExpired(invitation)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Invitation expired</CardTitle>
            <CardDescription>
              This invitation link has expired. Please ask the workspace administrator for a new invite.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Go to home
            </Link>
          </CardFooter>
        </Card>
      </main>
    );
  }

  // Check current session
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  // Case 1: Not signed in → redirect to login/signup with invitation ID preserved (D-07)
  if (!session?.user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>You have been invited</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              You have been invited to join a workspace as{" "}
              <strong>{invitation.role}</strong>.
            </p>
            <p className="text-sm">
              To accept, please sign in or create an account.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              This invitation expires on{" "}
              {invitation.expiresAt.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              .
            </p>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Link
              href={`/login?invitationId=${id}`}
              className={buttonVariants()}
            >
              Sign in
            </Link>
            <Link
              href={`/signup?invitationId=${id}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Create an account
            </Link>
          </CardFooter>
        </Card>
      </main>
    );
  }

  // Case 2: Signed in but email not verified → redirect to verify-email (T-02-03-01)
  if (!session.user.emailVerified) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Email verification required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              You must verify your email address before accepting an invitation.
            </p>
          </CardContent>
          <CardFooter>
            <Link
              href={`/verify-email?invitationId=${id}`}
              className={buttonVariants()}
            >
              Verify your email
            </Link>
          </CardFooter>
        </Card>
      </main>
    );
  }

  // Case 3: Signed in and verified — show accept prompt.
  // AcceptButton is a client island that calls acceptInvitationAction imperatively,
  // allowing the returned {ok:false, error} to be surfaced in the UI (UAT Test 7).
  // invitationId flows from server-rendered await params — never from client input (T-02-07-01).
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Workspace invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">
            You have been invited to join as <strong>{invitation.role}</strong>.
          </p>
          <p className="text-sm">
            Signed in as: <strong>{session.user.email}</strong>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            This invitation expires on{" "}
            {invitation.expiresAt.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            .
          </p>
          <AcceptButton invitationId={id} />
        </CardContent>
        <CardFooter>
          <Link
            href="/"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Decline
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
