"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "@/lib/auth/auth-client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "verification_required"; email: string }
  | { status: "error"; message: string };

export default function LoginPage() {
  const [formState, setFormState] = useState<FormState>({ status: "idle" });
  const [justRegistered, setJustRegistered] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setJustRegistered(params.get("registered") === "1");
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormState({ status: "loading" });

    const form = event.currentTarget;
    const data = new FormData(form);
    const email = data.get("email") as string;
    const password = data.get("password") as string;

    const result = await signIn.email({
      email,
      password,
    });

    if (result.error) {
      // Better Auth signals unverified email via a specific error code
      const errorCode = result.error.code;
      if (
        errorCode === "EMAIL_NOT_VERIFIED" ||
        errorCode === "email_not_verified"
      ) {
        setFormState({ status: "verification_required", email });
        return;
      }

      setFormState({
        status: "error",
        message: result.error.message ?? "Login failed. Check your credentials and try again.",
      });
      return;
    }

    // Login succeeded — redirect to workspace list
    // (Using window.location for simplicity; will use Next.js router when auth guard is wired)
    window.location.href = "/workspaces";
  }

  if (formState.status === "verification_required") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Verify your email first</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                You need to verify your email address before you can log in. We sent a
                verification link to <strong>{formState.email}</strong>.
              </AlertDescription>
              <AlertDescription>
                Check your inbox and click the verification link, then try logging in
                again.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Back to login
            </Link>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Log in to PageForge</CardTitle>
          <CardDescription>Enter your email and password to access your workspace</CardDescription>
        </CardHeader>
        <CardContent>
          {justRegistered && (
            <Alert className="mb-4">
              <AlertDescription>
                Account created. We sent a verification link to your email —
                verify it, then log in below.
              </AlertDescription>
            </Alert>
          )}

          {formState.status === "error" && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{formState.message}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={formState.status === "loading"}>
              {formState.status === "loading" ? "Logging in…" : "Log in"}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-foreground underline underline-offset-4 hover:text-foreground/80">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
