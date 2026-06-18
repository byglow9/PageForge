import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="pageforge-grid-bg relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16 text-[#151515]">
      <div className="relative -translate-y-10 flex w-full max-w-md flex-col items-center gap-7 text-center">
        <div className="flex h-32 w-48 items-center justify-center">
          <Image
            src="/brand/pageforge-anvil-real.png"
            alt="Bigorna PageForge"
            width={256}
            height={256}
            priority
            className="h-32 w-48 object-contain drop-shadow-[0_18px_22px_rgba(21,21,21,0.2)]"
          />
        </div>

        <div className="space-y-3">
          <h1 className="text-5xl font-bold text-[#151515]">PageForge</h1>
          <p className="text-pretty text-lg leading-7 text-[#5f6773]">
            Generate landing pages from templates without touching code.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/signup"
            className={buttonVariants({
              variant: "default",
              size: "lg",
              className:
                "bg-[#151515] text-white shadow-sm hover:bg-[#2a2a2a]",
            })}
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className:
                "border-[#151515]/15 bg-white/80 text-[#151515] hover:bg-white",
            })}
          >
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
