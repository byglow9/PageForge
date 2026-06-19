import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Resolve pageforge-engine from the monorepo root (worktree-safe path)
      // In the main repo, this is a symlink; in a worktree it must be resolved explicitly.
      "pageforge-engine": path.resolve(__dirname, "../../src/engine/index.ts"),
    },
  },
});
