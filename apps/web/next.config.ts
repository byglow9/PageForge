import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict mode for better React error detection
  reactStrictMode: true,
  // Transpile the pageforge-engine workspace package (ESM source, not pre-built)
  // Per RESEARCH.md Pattern 1 — required for Next.js to resolve ESM imports from the engine.
  // Uses webpack (--webpack flag in build script) to support the NodeNext .js import extensions
  // used in the engine source files (Turbopack cannot resolve .js -> .ts without extensionAlias
  // support that is not yet stable in Next.js 16).
  transpilePackages: ["pageforge-engine"],
  experimental: {
    // Map .js extension imports to their TypeScript source files.
    // The engine uses NodeNext ESM imports with explicit .js extensions (e.g. './parser.js'),
    // but the source files are .ts. This alias lets webpack resolve them correctly when
    // transpiling the engine package.
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    },
  },
};

export default nextConfig;
