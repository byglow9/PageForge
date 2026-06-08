import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="flex max-w-sm flex-col items-center gap-6 px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          PageForge
        </h1>
        <p className="text-base text-muted-foreground">
          Generate landing pages from templates — without touching code.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/signup"
            className={buttonVariants({ variant: "default", size: "lg" })}
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
