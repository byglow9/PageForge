import Link from "next/link";

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string; error?: string }>;
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const params = await searchParams;
  const { token, error } = params;

  // Better Auth handles the actual verification via the API route.
  // This page is shown after the user clicks the email link and is redirected here.
  if (error) {
    return (
      <main>
        <h1>Verification failed</h1>
        <p>
          The verification link is invalid or has expired. Please sign in again
          to receive a new verification email.
        </p>
        <p>
          <Link href="/login">Go to login</Link>
        </p>
      </main>
    );
  }

  if (!token) {
    return (
      <main>
        <h1>Email verification</h1>
        <p>
          After signing up, you should receive a verification email. Click the
          link in the email to activate your account.
        </p>
        <p>
          Once verified, you can create or join workspaces.
        </p>
        <p>
          <Link href="/login">Go to login</Link>
        </p>
      </main>
    );
  }

  // Token present — verification was processed by the API route.
  // Better Auth redirects users here after successful verification.
  return (
    <main>
      <h1>Email verified</h1>
      <p>
        Your email address has been verified. You can now create your first
        workspace.
      </p>
      <p>
        <Link href="/workspaces/new">Create workspace</Link>
        {" | "}
        <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
