import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PageForge",
  description: "Forge landing pages from templates without touching code.",
  icons: {
    icon: "/brand/pageforge-anvil-real.png",
    shortcut: "/brand/pageforge-anvil-real.png",
    apple: "/brand/pageforge-anvil-real.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={spaceGrotesk.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
