/**
 * Raw Prisma client — INTERNAL USE ONLY.
 *
 * This singleton is the raw database client used by:
 *   - better-auth Prisma adapter (auth.ts)
 *   - Prisma CLI tooling
 *   - Low-level utilities (migrations, seeds)
 *
 * IMPORTANT: Feature modules must NOT import this client directly.
 * They must use the tenant-scoped helpers from `./tenant-db.ts` (plan 02).
 * Direct raw client access bypasses workspace_id injection and RLS setup.
 *
 * @internal
 */
import { PrismaClient } from "@prisma/client";

declare global {
  // Allow global `var` declaration to persist the Prisma client across hot reloads in dev
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prisma =
  global.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

export { prisma };
