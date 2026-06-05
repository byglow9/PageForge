import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict mode for better React error detection
  reactStrictMode: true,
  // Transpile the pageforge-engine workspace package (ESM source, not pre-built)
  // Per RESEARCH.md Pattern 1 — required for Next.js to resolve ESM imports from the engine
  transpilePackages: ["pageforge-engine"],
};

export default nextConfig;
