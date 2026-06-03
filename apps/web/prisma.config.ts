import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // DATABASE_URL is resolved at runtime by Prisma from env
  // (prisma generate does not require a valid URL)
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/pageforge",
  },
});
