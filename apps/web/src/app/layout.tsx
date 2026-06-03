import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PageForge",
  description: "Landing page generation platform for agencies and marketing teams",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
