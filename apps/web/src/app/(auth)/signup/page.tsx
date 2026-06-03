"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/auth/auth-client";

type FormState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "verification_sent"; email: string }
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

    // Signup succeeded; email verification is required before accessing workspaces.
    setFormState({ status: "verification_sent", email });
  }

  if (formState.status === "verification_sent") {
    return (
      <main>
        <h1>Check your email</h1>
        <p>
          We sent a verification link to <strong>{formState.email}</strong>.
          Click the link in the email to verify your address and activate your
          account.
        </p>
        <p>
          You cannot create or join a workspace until your email is verified.
        </p>
        <p>
          <Link href="/login">Back to login</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Create your account</h1>

      {formState.status === "error" && (
        <p role="alert" style={{ color: "red" }}>
          {formState.message}
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
          />
        </div>

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
            minLength={8}
            autoComplete="new-password"
          />
          <small>Minimum 8 characters</small>
        </div>

        <button type="submit" disabled={formState.status === "loading"}>
          {formState.status === "loading" ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
