"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "@/lib/auth/auth-client";

type FormState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "verification_required"; email: string }
  | { status: "error"; message: string };

export default function LoginPage() {
  const [formState, setFormState] = useState<FormState>({ status: "idle" });

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
      <main>
        <h1>Verify your email first</h1>
        <p>
          You need to verify your email address before you can log in. We sent a
          verification link to <strong>{formState.email}</strong>.
        </p>
        <p>
          Check your inbox and click the verification link, then try logging in
          again.
        </p>
        <p>
          <Link href="/login">Back to login</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Log in to PageForge</h1>

      {formState.status === "error" && (
        <p role="alert" style={{ color: "red" }}>
          {formState.message}
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>

        <button type="submit" disabled={formState.status === "loading"}>
          {formState.status === "loading" ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p>
        Don&apos;t have an account? <Link href="/signup">Sign up</Link>
      </p>
    </main>
  );
}
