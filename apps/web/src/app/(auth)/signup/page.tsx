"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/auth/auth-client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };

export default function SignupPage() {
  const [formState, setFormState] = useState<FormState>({ status: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormState({ status: "loading" });

    const form = event.currentTarget;
    const data = new FormData(form);
    const name = data.get("name") as string;
    const email = data.get("email") as string;
    const password = data.get("password") as string;

    const result = await signUp.email({
      name,
      email,
      password,
    });

    if (result.error) {
      setFormState({
        status: "error",
        message: result.error.message ?? "Sign up failed. Please try again.",
      });
      return;
    }

    // Signup succeeded; email verification is required before accessing
    // workspaces. Send the user straight to the login screen with a notice,
    // preserving the invitationId if this signup came from an invite link.
    const invitationId = new URLSearchParams(window.location.search).get(
      "invitationId",
    );
    const params = new URLSearchParams({ registered: "1" });
    if (invitationId) params.set("invitationId", invitationId);
    window.location.href = `/login?${params.toString()}`;
  }

  return (
    <main className="pageforge-grid-bg flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Fill in the details below to get started</CardDescription>
        </CardHeader>
        <CardContent>
          {formState.status === "error" && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{formState.message}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                autoComplete="name"
              />
            </div>

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
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={formState.status === "loading"}>
              {formState.status === "loading" ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-foreground underline underline-offset-4 hover:text-foreground/80">
              Log in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
