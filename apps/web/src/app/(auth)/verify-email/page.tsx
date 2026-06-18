import Link from "next/link";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
      <main className="pageforge-grid-bg flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Verification failed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The verification link is invalid or has expired. Please sign in
              again to receive a new verification email.
            </p>
          </CardContent>
          <CardFooter>
            <Link
              href="/login"
              className="text-sm text-foreground underline underline-offset-4 hover:text-foreground/80"
            >
              Go to login
            </Link>
          </CardFooter>
        </Card>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="pageforge-grid-bg flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Email verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              After signing up, you should receive a verification email. Click
              the link in the email to activate your account.
            </p>
            <p className="text-sm text-muted-foreground">
              Once verified, you can create or join workspaces.
            </p>
          </CardContent>
          <CardFooter>
            <Link
              href="/login"
              className="text-sm text-foreground underline underline-offset-4 hover:text-foreground/80"
            >
              Go to login
            </Link>
          </CardFooter>
        </Card>
      </main>
    );
  }

  // Token present — verification was processed by the API route.
  // Better Auth redirects users here after successful verification.
  return (
    <main className="pageforge-grid-bg flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Email verified</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your email address has been verified. You can now create your first
            workspace.
          </p>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Link
            href="/workspaces/new"
            className="text-sm text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            Create workspace
          </Link>
          <Link
            href="/login"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Log in
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
