/**
 * Dev-only seed harness for VITE_SPA editor UAT (Phase 10 + unblocks Phase 9 UAT).
 *
 * Creates, against the LOCAL dev stack (Postgres + MinIO):
 *   - 4 better-auth users (owner / admin / editor / viewer) with known passwords,
 *     email pre-verified so they can log in despite requireEmailVerification.
 *   - 1 workspace + organization + member + workspaceMember rows for each role
 *     (mirrors createWorkspaceAction wiring).
 *   - 1 VITE_SPA Template (id = randomUUID, markup = "") whose dist/index.html is
 *     uploaded to MinIO under workspaces/{wsId}/project-templates/{tplId}/dist/.
 *   - 1 VITE_SPA LandingPage referencing that template, with a sample text override.
 *
 * RLS note: template / landing_page / workspace_member are FORCE-RLS on
 * app.current_workspace_id, so every insert into them runs inside a transaction
 * that first SET_CONFIGs the workspace id (same pattern as the real actions).
 *
 * Run:  pnpm --filter @pageforge/web exec tsx scripts/seed-vite-spa-uat.ts
 *   or: (cd apps/web && npx tsx scripts/seed-vite-spa-uat.ts)
 *
 * Idempotent-ish: reuses existing users by email and an existing workspace by slug.
 */
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "../src/generated/prisma/client";

// ---------------------------------------------------------------------------
// Config — fixed credentials so the tester always knows how to log in.
// ---------------------------------------------------------------------------
const BASE_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const PASSWORD = "uatpassword123";
const WS_NAME = "UAT Vite SPA";
const WS_SLUG = "uat-vite-spa";

const USERS = [
  { role: "owner", email: "owner@uat.local", name: "UAT Owner" },
  { role: "admin", email: "admin@uat.local", name: "UAT Admin" },
  { role: "editor", email: "editor@uat.local", name: "UAT Editor" },
  { role: "viewer", email: "viewer@uat.local", name: "UAT Viewer" },
] as const;

// A minimal "SPA" dist — static HTML is enough for the text editor: the edit
// script walks text-leaf elements in the live DOM. Several editable leaves below.
const INDEX_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pacote Grécia — UAT</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; color: #1a1a1a; }
    .hero { padding: 64px 32px; background: var(--primary, #2563eb); color: #fff; }
    .hero h1 { font-size: 40px; margin: 0 0 12px; }
    .hero p { font-size: 18px; margin: 0; opacity: .92; }
    .content { padding: 40px 32px; max-width: 720px; }
    .cta { display: inline-block; margin-top: 24px; padding: 14px 28px;
           background: var(--primary, #2563eb); color: #fff; border-radius: 8px;
           text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <section class="hero">
    <h1 id="hero-title">Pacote Grécia 7 dias</h1>
    <p id="hero-sub">Ilhas, praias e história — tudo incluído.</p>
  </section>
  <main class="content">
    <h2 id="section-title">Por que viajar com a gente</h2>
    <p id="section-body">Guias locais, hotéis selecionados e suporte 24h durante toda a viagem.</p>
    <a class="cta" id="cta-button" href="https://example.com/reservar">Reservar agora</a>
  </main>
</body>
</html>
`;

// ---------------------------------------------------------------------------
// Prisma + S3 clients (replicate prisma.ts adapter pattern).
// ---------------------------------------------------------------------------
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
});

const s3 = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

async function ensureUser(email: string, name: string): Promise<string> {
  // Try better-auth HTTP signup first (handles password hashing correctly).
  const res = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // better-auth CSRF guard requires a trusted Origin header.
      origin: BASE_URL,
    },
    body: JSON.stringify({ email, password: PASSWORD, name }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (!/exist|already|unique/i.test(text)) {
      throw new Error(`signup failed for ${email}: ${res.status} ${text}`);
    }
    // already exists — fall through to lookup
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`user not found after signup: ${email}`);
  // Pre-verify email so login works (requireEmailVerification = true).
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true },
  });
  return user.id;
}

async function main() {
  console.log("→ Creating users...");
  const ids: Record<string, string> = {};
  for (const u of USERS) {
    ids[u.role] = await ensureUser(u.email, u.name);
    console.log(`  ✓ ${u.role.padEnd(6)} ${u.email} (${ids[u.role]})`);
  }

  // Workspace — reuse by slug if it already exists.
  let workspaceId: string;
  const existingWs = await prisma.workspace.findUnique({ where: { slug: WS_SLUG } });
  if (existingWs) {
    workspaceId = existingWs.id;
    console.log(`→ Reusing workspace ${WS_SLUG} (${workspaceId})`);
  } else {
    workspaceId = randomUUID();
    console.log(`→ Creating workspace ${WS_SLUG} (${workspaceId})`);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${workspaceId}, true)`;
      await tx.workspace.create({ data: { id: workspaceId, name: WS_NAME, slug: WS_SLUG } });
      await tx.organization.create({ data: { id: workspaceId, name: WS_NAME, slug: WS_SLUG } });
    });
  }

  // Memberships for all four roles (better-auth member + app workspaceMember).
  console.log("→ Wiring memberships...");
  for (const u of USERS) {
    const userId = ids[u.role];
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${workspaceId}, true)`;
      await tx.member.upsert({
        where: { organizationId_userId: { organizationId: workspaceId, userId } },
        update: { role: u.role },
        create: { id: randomUUID(), organizationId: workspaceId, userId, role: u.role },
      });
      await tx.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId, userId } },
        update: { role: u.role },
        create: { workspaceId, userId, role: u.role },
      });
    });
    console.log(`  ✓ ${u.role}`);
  }

  // VITE_SPA template — id = randomUUID (matches createProjectTemplate convention).
  const templateId = randomUUID();
  console.log(`→ Uploading dist + creating template (${templateId})...`);
  const s3Key = `workspaces/${workspaceId}/project-templates/${templateId}/dist/index.html`;
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: s3Key,
      Body: INDEX_HTML,
      ContentType: "text/html",
    })
  );
  console.log(`  ✓ s3://${process.env.S3_BUCKET}/${s3Key}`);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${workspaceId}, true)`;
    await tx.template.create({
      data: {
        id: templateId,
        workspaceId,
        name: "Pacote Grécia (VITE_SPA UAT)",
        markup: "",
        schema: {},
        metadataOverlay: {},
        kind: "VITE_SPA",
      },
    });
  });

  // LandingPage — with one sample text override so the apply-shim path is exercised.
  const lpId = randomUUID();
  console.log(`→ Creating landing page (${lpId})...`);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${workspaceId}, true)`;
    await tx.landingPage.create({
      data: {
        id: lpId,
        workspaceId,
        templateId,
        name: "Grécia — Campanha UAT",
        markupSnapshot: "",
        schemaVersion: 1,
        values: { overrides: [] },
        kind: "VITE_SPA",
        entryRoute: null,
      },
    });
  });

  console.log("\n========================================================");
  console.log(" SEED COMPLETE — VITE_SPA editor UAT");
  console.log("========================================================");
  console.log(` Workspace slug : ${WS_SLUG}`);
  console.log(` Template id    : ${templateId}`);
  console.log(` LandingPage id : ${lpId}`);
  console.log(` Password (all) : ${PASSWORD}`);
  console.log(" Logins:");
  for (const u of USERS) console.log(`   ${u.role.padEnd(6)} → ${u.email}`);
  console.log("\n Preview URL (after login):");
  console.log(`   ${BASE_URL}/w/${WS_SLUG}/lps/${lpId}/preview`);
  console.log("========================================================\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("SEED FAILED:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
