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
 * Prisma 7 uses a driver adapter pattern. @prisma/adapter-pg is required.
 *
 * @internal
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  // Allow global `var` declaration to persist the Prisma client across hot reloads in dev
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL ?? "";
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const prisma = global.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

export { prisma };
