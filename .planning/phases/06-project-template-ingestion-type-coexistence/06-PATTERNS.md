# Phase 6: Project-Template Ingestion + Type Coexistence — Pattern Map

**Mapped:** 2026-06-18
**Files analyzed:** 14 (new/modified files derived from RESEARCH.md extension points)
**Analogs found:** 13 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/prisma/migrations/0006_kind_discriminator/migration.sql` | migration | batch | `apps/web/prisma/migrations/0005_catalog_folders_tags/migration.sql` | exact |
| `apps/web/prisma/schema.prisma` (modify Template + LandingPage) | model | — | `apps/web/prisma/schema.prisma` (existing models) | exact |
| `apps/web/src/lib/project-templates/schema.ts` | utility (Zod schema) | request-response | `apps/web/src/lib/templates/schema.ts` | exact |
| `apps/web/src/lib/project-templates/zip-validate.ts` | utility | file-I/O | no close analog (new capability) | none |
| `apps/web/src/lib/project-templates/secret-scan.ts` | utility | transform | no close analog (new capability) | none |
| `apps/web/src/lib/project-templates/s3-upload.ts` | utility | file-I/O | `apps/web/src/lib/lps/actions.ts` (`requestPresignedUploadAction`) | role-match |
| `apps/web/src/lib/project-templates/actions.ts` | server action | request-response | `apps/web/src/lib/lps/actions.ts` | exact |
| `apps/web/src/app/w/[slug]/project-templates/new/page.tsx` | RSC page | request-response | `apps/web/src/app/w/[slug]/templates/new/page.tsx` | exact |
| `apps/web/src/app/w/[slug]/project-templates/new/ProjectTemplateForm.tsx` | client component | request-response | `apps/web/src/components/templates/TemplateEditor.tsx` (FormData client) | role-match |
| `apps/web/src/lib/lps/render.ts` (modify — add kind guard) | utility | request-response | self (add guard to existing function) | exact |
| `apps/web/src/lib/lps/actions.ts` (modify — `listLpsAction` return type) | server action | CRUD | self | exact |
| `apps/web/src/components/catalog/CatalogGrid.tsx` (modify — `CatalogLp` interface) | client component | CRUD | self | exact |
| `apps/web/src/components/catalog/LpCatalogCard.tsx` (modify — kind badge) | client component | request-response | self + `LpCatalogCard.tsx` Badge pattern | exact |
| `apps/web/src/components/templates/TemplateCard.tsx` (modify — kind badge) | client component | request-response | `apps/web/src/components/catalog/LpCatalogCard.tsx` (Badge pattern) | exact |
| `apps/web/src/lib/db/tenant-db.ts` (modify — `TenantTemplateHelpers.create`) | lib module | CRUD | self | exact |
| `apps/web/tests/type-boundary.test.ts` | test | — | `apps/web/tests/tenant-isolation.test.ts` | role-match |

---

## Pattern Assignments

---

### `apps/web/prisma/migrations/0006_kind_discriminator/migration.sql` (migration)

**Analog:** `apps/web/prisma/migrations/0005_catalog_folders_tags/migration.sql`

**How to create the file:**
Run `prisma migrate dev --create-only --name kind_discriminator` to generate the shell, then **delete the generated SQL body** and replace it with the raw ALTER TABLE statements below. The generated body would produce a native PG ENUM type, which triggers Postgres error 55P04. TEXT + CHECK sidesteps this entirely.

**Migration SQL pattern to use verbatim:**
```sql
-- Migration: 0006_kind_discriminator
-- Adds kind discriminator to template and landing_page tables.
-- ADDITIVE: existing LIQUID rows are unaffected (DEFAULT 'LIQUID').
-- Pattern: TEXT + CHECK constraint instead of native PG enum to avoid
-- Prisma error 55P04 ("new enum values must be committed before they can be used").
-- Postgres 11+ stores constant defaults in catalog — no table rewrite, no lock.

ALTER TABLE "template"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'LIQUID'
    CHECK ("kind" IN ('LIQUID', 'VITE_SPA'));

ALTER TABLE "landing_page"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'LIQUID'
    CHECK ("kind" IN ('LIQUID', 'VITE_SPA'));

-- RLS policies are already active on both tables (from 0004/0005 migrations).
-- The kind column inherits the existing workspace_id RLS policy automatically
-- (no new policy needed; the existing USING/WITH CHECK covers all columns).
```

**RLS pattern** (from `0005_catalog_folders_tags/migration.sql` lines 186–214 — do NOT repeat for this migration; existing policies on `template` and `landing_page` already cover new columns):
```sql
-- Pattern reference only — already in place from 0004/0005:
ALTER TABLE "template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "template" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "template"
    USING ("workspaceId" = current_setting('app.current_workspace_id', true)::text)
    WITH CHECK ("workspaceId" = current_setting('app.current_workspace_id', true)::text);
```

---

### `apps/web/prisma/schema.prisma` (modify — Template + LandingPage models)

**Analog:** `apps/web/prisma/schema.prisma` (existing models, lines 209–269)

**Current Template model** (lines 209–224 — confirmed by read):
```prisma
model Template {
  id              String   @id @default(cuid())
  workspaceId     String
  name            String
  markup          String   @db.Text
  schema          Json
  metadataOverlay Json
  schemaVersion   Int      @default(1)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
  @@map("template")
}
```

**Add to Template model** (after `schemaVersion` line):
```prisma
  kind            String   @default("LIQUID") // "LIQUID" | "VITE_SPA" — enforced by CHECK in migration
```

**Current LandingPage model** (lines 249–269 — confirmed by read):
```prisma
model LandingPage {
  id             String   @id @default(cuid())
  workspaceId    String
  templateId     String?
  name           String
  markupSnapshot String   @db.Text
  schemaVersion  Int
  values         Json
  folderId       String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  ...
}
```

**Add to LandingPage model** (after `folderId` line):
```prisma
  kind           String   @default("LIQUID") // "LIQUID" | "VITE_SPA" — enforced by CHECK in migration
```

**After schema edit:** Run `prisma generate` (NOT `prisma migrate dev` again — migration was deployed separately). This regenerates `apps/web/src/generated/prisma/` so `template.kind` and `landingPage.kind` become available on all Prisma result types.

---

### `apps/web/src/lib/project-templates/schema.ts` (utility — Zod schema)

**Analog:** `apps/web/src/lib/templates/schema.ts`

**Imports pattern** (from `lib/templates/schema.ts` lines 16–16):
```typescript
import { z } from "zod";
```

**Core schema pattern** (from `lib/templates/schema.ts` lines 36–58):
```typescript
// Copy the name field validation exactly from CreateTemplateSchema:
export const CreateProjectTemplateSchema = z.object({
  /** Human-readable template name, 1-128 characters. */
  name: z
    .string()
    .min(1, "Template name is required")
    .max(128, "Template name must be 128 characters or less")
    .trim(),
  // No markup field — project templates get markup from the ZIP dist/
});

export type CreateProjectTemplateInput = z.infer<typeof CreateProjectTemplateSchema>;
```

---

### `apps/web/src/lib/project-templates/zip-validate.ts` (utility — file I/O)

**Analog:** No analog in the codebase. Use RESEARCH.md Pattern 2 verbatim.

**No analog — use RESEARCH.md Pattern 2 directly.** The complete implementation is provided in `06-RESEARCH.md` lines 185–297 (`validateAndExtractZip` function with yauzl). Key points:
- Import: `import yauzl from "yauzl"; import path from "path";`
- Exports `ZipEntry`, `ZipValidationResult`, `validateAndExtractZip(zipBuffer: Buffer)`
- Size cap: `MAX_COMPRESSED_BYTES = 50 * 1024 * 1024`; `MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024`
- Zip-slip check: `path.normalize(fileName)` then reject if starts with `..` or is absolute
- Bomb check: `totalUncompressed += entry.uncompressedSize` before opening stream
- No disk I/O — keep all entries as in-memory `Buffer`s

---

### `apps/web/src/lib/project-templates/secret-scan.ts` (utility — transform)

**Analog:** No analog in the codebase. Use RESEARCH.md Pattern 3 verbatim.

**No analog — use RESEARCH.md Pattern 3 directly.** The complete implementation is in `06-RESEARCH.md` lines 311–368 (`scanDistFiles` function). Key points:
- Exports `ScanFinding`, `scanDistFiles(entries)`
- Text extensions to scan: `.html`, `.js`, `.mjs`, `.cjs`, `.css`, `.json`, `.ts`, `.tsx`
- Five regex patterns: `SUPABASE_JWT`, `SUPABASE_URL`, `STRIPE_LIVE_KEY`, `AWS_ACCESS_KEY`, `LOVABLE_APP_URL`
- Returns advisory `ScanFinding[]` — never blocks upload

---

### `apps/web/src/lib/project-templates/s3-upload.ts` (utility — file I/O)

**Analog:** `apps/web/src/lib/lps/actions.ts` (S3 client + `PutObjectCommand` pattern, lines 49–57 and 522–530)

**S3 client init pattern** (from `lib/lps/actions.ts` lines 49–57 — do NOT duplicate; import a shared singleton or replicate this exact initialization):
```typescript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});
```

**Core S3 upload pattern** (from `lib/lps/actions.ts` lines 523–530):
```typescript
// Existing pattern: one PutObjectCommand per file, tenant-scoped key
const command = new PutObjectCommand({
  Bucket: process.env.S3_BUCKET!,
  Key: key,
  ContentType: input.contentType,
  ContentLength: input.fileSize,
});
```

**New S3 key convention for dist/ (from RESEARCH.md Pattern 4):**
```typescript
// New: per-entry key — mirrors lps/assets/ convention with project-templates/ prefix
const key = `workspaces/${workspaceId}/project-templates/${templateId}/dist/${entry.fileName}`;
```

**Full multi-file upload pattern:**
```typescript
// Upload in parallel (Promise.all) — entries already in-memory from zip-validate.ts
await Promise.all(
  entries.map(async (entry) => {
    const key = `workspaces/${workspaceId}/project-templates/${templateId}/dist/${entry.fileName}`;
    // Inline MIME map for Vite dist/ extensions (avoids mime-types dependency):
    const MIME: Record<string, string> = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".mjs": "application/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
      ".woff2": "font/woff2",
    };
    const ext = path.extname(entry.fileName).toLowerCase();
    const contentType = MIME[ext] ?? "application/octet-stream";

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        Body: entry.buffer,
        ContentType: contentType,
      })
    );
  })
);
```

---

### `apps/web/src/lib/project-templates/actions.ts` (server action — request-response)

**Analog:** `apps/web/src/lib/lps/actions.ts`

**File header + "use server" pattern** (from `lib/lps/actions.ts` lines 32–42):
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceRole } from "@/lib/workspaces/guards";
import { withTenantDb } from "@/lib/db/tenant-db";
import type { ActionResult } from "@/lib/workspaces/actions";
```

**Auth gate pattern** (from `lib/lps/actions.ts` lines 152–153):
```typescript
// Always first line of action body — workspaceId comes from session, never client
const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);
```

**Zod validation + fieldErrors pattern** (from `lib/lps/actions.ts` lines 155–165):
```typescript
const parsed = CreateProjectTemplateSchema.safeParse({ name });
if (!parsed.success) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as string;
    fieldErrors[field] = fieldErrors[field] ?? [];
    fieldErrors[field].push(issue.message);
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}
```

**withTenantDb pattern** (from `lib/lps/actions.ts` lines 169–219):
```typescript
return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
  const template = await db.template.create({
    id: templateId,       // explicit — DB row id MUST equal the S3 key prefix templateId
    name: parsed.data.name,
    markup: "",           // VITE_SPA has no LiquidJS markup; empty string satisfies NOT NULL
    schema: {},           // VITE_SPA has no token schema
    metadataOverlay: {},  // VITE_SPA has no metadata overlay
    kind: "VITE_SPA",     // explicit — after TenantTemplateHelpers.create() is extended
  });
  revalidatePath(`/w/${slug}/templates`);
  return { ok: true, data: { id: template.id, findings } };
});
```

**S3 client singleton pattern** (from `lib/lps/actions.ts` lines 49–57 — replicate at module level):
```typescript
// Module-level singleton — initialized once per cold start (same pattern as lps/actions.ts)
const s3Client = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});
```

**FormData read pattern** (from RESEARCH.md lines 666–672 — no existing codebase analog for FormData-based upload actions):
```typescript
const name = formData.get("name");
const zipFile = formData.get("zipFile");
if (typeof name !== "string" || !(zipFile instanceof File)) {
  return { ok: false, error: "Invalid form data." };
}
const zipBuffer = Buffer.from(await zipFile.arrayBuffer());
```

**Return type pattern** (from `lib/workspaces/actions.ts` lines 37–39):
```typescript
// ActionResult<T> is the canonical return type for all Server Actions:
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
```

**Action signature — must use `FormData` (not plain object), matching the pattern for actions that receive file uploads:**
```typescript
export async function createProjectTemplateAction(
  slug: string,
  formData: FormData
): Promise<ActionResult<{ id: string; findings: ScanFinding[] }>>
```

---

### `apps/web/src/app/w/[slug]/project-templates/new/page.tsx` (RSC page)

**Analog:** `apps/web/src/app/w/[slug]/templates/new/page.tsx`

**Full pattern** (from `templates/new/page.tsx` lines 1–24 — copy verbatim, swap component name):
```typescript
import { requireWorkspaceRole } from "@/lib/workspaces/guards";
import { ProjectTemplateForm } from "./ProjectTemplateForm";

interface NewProjectTemplatePageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewProjectTemplatePage({ params }: NewProjectTemplatePageProps) {
  const { slug } = await params;

  // Gate: viewers are redirected — only owner/admin/editor can upload project templates
  await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  return <ProjectTemplateForm slug={slug} />;
}
```

**Key convention:** `params` is always `Promise<{ slug: string }>` in App Router — must be awaited before use (all existing pages follow this pattern).

---

### `apps/web/src/app/w/[slug]/project-templates/new/ProjectTemplateForm.tsx` (client component)

**Analog:** `apps/web/src/components/templates/TemplateEditor.tsx` (client-side form pattern)

**"use client" + imports pattern** (from `LpCatalogCard.tsx` lines 1–51 — use client + shadcn + toast):
```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createProjectTemplateAction } from "@/lib/project-templates/actions";
```

**Form submission with useTransition pattern** (from `LpCatalogCard.tsx` lines 219–228):
```typescript
const [isPending, startTransition] = useTransition();

function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);
  startTransition(async () => {
    const result = await createProjectTemplateAction(slug, formData);
    if (result.ok) {
      // Surface findings as warning toast if any
      if (result.data.findings.length > 0) {
        toast.warning(`Template created with ${result.data.findings.length} warning(s). Check the findings list.`);
      } else {
        toast.success("Project template created.");
      }
      router.push(`/w/${slug}/templates`);
    } else {
      toast.error(result.error ?? "Failed to create template.");
    }
  });
}
```

**File input pattern (no existing analog — new capability):** Use a native `<input type="file" accept=".zip" name="zipFile" />` inside a `<form>` with `encType="multipart/form-data"`. No presigned URL pattern needed here — the ZIP goes to the Server Action directly.

---

### `apps/web/src/lib/lps/render.ts` (modify — add kind type guard)

**Analog:** Self (`apps/web/src/lib/lps/render.ts` lines 42–58)

**Current signature** (lines 42–44):
```typescript
export async function renderLp(
  lp: { markupSnapshot: string; values: Record<string, unknown> },
  db: TenantClient
): Promise<string> {
```

**Modified signature** (add `kind` parameter — make required after both call sites are updated in same wave):
```typescript
export async function renderLp(
  lp: { markupSnapshot: string; values: Record<string, unknown>; kind: string },
  db: TenantClient
): Promise<string> {
  // Type boundary guard (V2-11): VITE_SPA templates cannot enter the LIQUID render path.
  // Throws explicitly rather than silently producing corrupt output.
  if (lp.kind === "VITE_SPA") {
    throw new Error(
      "Type boundary violation: VITE_SPA templates cannot be rendered via the LIQUID render path. Use the VITE_SPA serve path instead."
    );
  }

  // ... existing render logic unchanged below (lines 46–58) ...
  const brand = await db.brandConfig.findFirst();
  const brandScope: Record<string, unknown> = {
    logo: brand?.logoUrl ?? "",
    primary_color: brand?.primaryColor ?? "",
    whatsapp: brand?.whatsapp ?? "",
  };
  return render(lp.markupSnapshot, lp.values, brandScope);
}
```

**Call sites that must also be updated (same wave):**
- `apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx` — pass `lp.kind` to `renderLp()`
- `apps/web/src/app/api/lps/[lpId]/export/route.ts` — pass `lp.kind` to `renderLp()`

Both callers already fetch the LP via `db.lp.findById()` or `prisma.landingPage.findUnique()`. After `prisma generate`, `lp.kind` is available on the returned record — just add it to the argument object.

---

### `apps/web/src/lib/lps/actions.ts` (modify — `listLpsAction` return type)

**Analog:** Self (`apps/web/src/lib/lps/actions.ts` lines 383–420)

**Current return type shape** (lines 387–397):
```typescript
Array<{
  id: string;
  name: string;
  templateId: string | null;
  schemaVersion: number;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
}>
```

**Modified return type** (add `kind: string`):
```typescript
Array<{
  id: string;
  name: string;
  templateId: string | null;
  schemaVersion: number;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  kind: string;   // "LIQUID" | "VITE_SPA" — add here
}>
```

**Modified map body** (lines 404–411 — add `kind: lp.kind`):
```typescript
data: lps.map((lp) => ({
  id: lp.id,
  name: lp.name,
  templateId: lp.templateId,
  schemaVersion: lp.schemaVersion,
  folderId: lp.folderId,
  createdAt: lp.createdAt,
  updatedAt: lp.updatedAt,
  kind: lp.kind,   // add this line
})),
```

**Same pattern applies to `listTemplatesAction`** in `apps/web/src/lib/templates/actions.ts` (lines 269–284) — add `kind: t.kind` to the map and `kind: string` to the return type.

---

### `apps/web/src/components/catalog/CatalogGrid.tsx` (modify — `CatalogLp` interface)

**Analog:** Self (`apps/web/src/components/catalog/CatalogGrid.tsx` lines 35–43)

**Current `CatalogLp` interface** (lines 35–43):
```typescript
export interface CatalogLp {
  id: string;
  name: string;
  templateId: string | null;
  schemaVersion: number;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Modified `CatalogLp` interface** (add `kind`):
```typescript
export interface CatalogLp {
  id: string;
  name: string;
  templateId: string | null;
  schemaVersion: number;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  kind: string;   // "LIQUID" | "VITE_SPA"
}
```

No other changes needed in `CatalogGrid.tsx` — `kind` passes through to `LpCatalogCard` automatically via the `lp` prop (line 251: `<LpCatalogCard ... lp={lp} ...>`).

---

### `apps/web/src/components/catalog/LpCatalogCard.tsx` (modify — kind badge)

**Analog:** Self (`apps/web/src/components/catalog/LpCatalogCard.tsx`)

**Current `LpCatalogCardProps.lp` shape** (lines 178–191):
```typescript
export interface LpCatalogCardProps {
  lp: {
    id: string;
    name: string;
    templateId: string | null;
    schemaVersion: number;
    createdAt: Date;
    updatedAt: Date;
    folderId: string | null;
  };
  ...
}
```

**Modified `LpCatalogCardProps.lp`** (add `kind`):
```typescript
  lp: {
    id: string;
    name: string;
    templateId: string | null;
    schemaVersion: number;
    createdAt: Date;
    updatedAt: Date;
    folderId: string | null;
    kind: string;   // "LIQUID" | "VITE_SPA"
  };
```

**Badge rendering pattern** (follows existing folder badge pattern at lines 280–286):
```typescript
{/* Existing folder badge — lines 281–285: */}
{folderName && (
  <Badge variant="secondary" className="text-xs">
    {folderName}
  </Badge>
)}

{/* Add kind badge immediately after folderName badge: */}
{lp.kind === "VITE_SPA" && (
  <Badge variant="outline" className="text-xs shrink-0">
    Vite SPA
  </Badge>
)}
```

The `Badge` component is already imported at line 30. Place the kind badge within the existing `<div className="flex flex-wrap items-center gap-1 mt-2">` (line 279) — put it before or after the folder badge.

---

### `apps/web/src/components/templates/TemplateCard.tsx` (modify — kind badge)

**Analog:** `apps/web/src/components/catalog/LpCatalogCard.tsx` (Badge + variant="outline" pattern)

**Current `TemplateCardProps.template` shape** (lines 27–34):
```typescript
export interface TemplateCardProps {
  template: {
    id: string;
    name: string;
    schemaVersion: number;
    schema: unknown;
  };
  slug: string;
}
```

**Modified `TemplateCardProps.template`** (add `kind`):
```typescript
  template: {
    id: string;
    name: string;
    schemaVersion: number;
    schema: unknown;
    kind: string;   // "LIQUID" | "VITE_SPA"
  };
```

**Badge import** (not currently imported in TemplateCard — add):
```typescript
import { Badge } from "@/components/ui/badge";
```

**Badge rendering** (place inside `CardHeader` next to the schema version span at lines 68–73):
```typescript
<CardTitle className="flex items-center justify-between gap-2">
  <span className="truncate text-base font-semibold text-gray-900">
    {template.name}
  </span>
  <div className="flex items-center gap-1.5 shrink-0">
    {template.kind === "VITE_SPA" && (
      <Badge variant="outline" className="text-xs">
        Vite SPA
      </Badge>
    )}
    <span className="text-sm text-gray-400 font-normal">
      v{template.schemaVersion}
    </span>
  </div>
</CardTitle>
```

---

### `apps/web/src/lib/db/tenant-db.ts` (modify — `TenantTemplateHelpers.create`)

**Analog:** Self (`apps/web/src/lib/db/tenant-db.ts` lines 76–102)

**Current `TenantTemplateHelpers.create` signature** (lines 77–82):
```typescript
create: (data: {
  name: string;
  markup: string;
  schema: Prisma.InputJsonValue;
  metadataOverlay: Prisma.InputJsonValue;
}) => Promise<Template>;
```

**Modified signature** (add optional `kind`):
```typescript
create: (data: {
  name: string;
  markup: string;
  schema: Prisma.InputJsonValue;
  metadataOverlay: Prisma.InputJsonValue;
  kind?: string;   // optional: undefined → DB default "LIQUID"; pass "VITE_SPA" explicitly
}) => Promise<Template>;
```

**Implementation body** (lines 354–361 — no change needed in the spread; `kind` passes through via `...data`):
```typescript
template: {
  create: async (data) => {
    return tx.template.create({
      data: {
        ...data,         // kind is included in the spread if present
        workspaceId,     // always injected from server context
      },
    });
  },
  // ...
}
```

The `...data` spread already includes any optional fields — no structural change to the implementation body is needed. Only the interface signature and type annotation change.

---

### `apps/web/tests/type-boundary.test.ts` (test)

**Analog:** `apps/web/tests/tenant-isolation.test.ts` (Vitest structure, lines 1–60)

**Imports + describe block pattern** (from `tenant-isolation.test.ts` lines 20–22):
```typescript
import { describe, it, expect, vi } from "vitest";
```

**Test structure** (from RESEARCH.md lines 717–742):
```typescript
// apps/web/tests/type-boundary.test.ts
import { describe, it, expect } from "vitest";
import { renderLp } from "@/lib/lps/render";

describe("type boundary (V2-11)", () => {
  it("throws when kind=VITE_SPA is passed to renderLp", async () => {
    await expect(
      renderLp(
        { markupSnapshot: "<h1>Hello</h1>", values: {}, kind: "VITE_SPA" },
        {} as any
      )
    ).rejects.toThrow("Type boundary violation");
  });

  it("does NOT throw when kind=LIQUID is passed to renderLp", async () => {
    const mockDb = { brandConfig: { findFirst: async () => null } } as any;
    await expect(
      renderLp(
        { markupSnapshot: "{{ title:text }}", values: { title: "Test" }, kind: "LIQUID" },
        mockDb
      )
    ).resolves.toBeTruthy();
  });
});
```

---

## Shared Patterns

### Authentication + Authorization Gate
**Source:** `apps/web/src/lib/workspaces/guards.ts` (via `requireWorkspaceRole`)
**Apply to:** `createProjectTemplateAction` and the RSC `page.tsx`
```typescript
// First line of every mutating server action:
const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);
// ctx.workspaceId is the only safe source of workspace scope

// First line of RSC page that requires a specific role:
await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);
```

### `ActionResult<T>` Return Type
**Source:** `apps/web/src/lib/workspaces/actions.ts` (lines 37–39)
**Apply to:** `createProjectTemplateAction` and all other server actions
```typescript
import type { ActionResult } from "@/lib/workspaces/actions";

// Canonical success return:
return { ok: true, data: { id: template.id, findings } };

// Canonical failure return:
return { ok: false, error: "Human-readable message." };

// Canonical validation failure:
return { ok: false, error: "Validation failed", fieldErrors };
```

### `withTenantDb` + Tenant Isolation
**Source:** `apps/web/src/lib/db/tenant-db.ts` (lines 309–665)
**Apply to:** `createProjectTemplateAction`
```typescript
// All DB writes must go through withTenantDb — never raw prisma client
return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
  // ctx.workspaceId is injected automatically into all helpers
  return db.template.create({ ... });
});
```

### `revalidatePath` After Mutations
**Source:** `apps/web/src/lib/lps/actions.ts` (line 217), `apps/web/src/lib/templates/actions.ts` (line 103)
**Apply to:** `createProjectTemplateAction`
```typescript
// After successful DB write, revalidate the templates listing page:
revalidatePath(`/w/${slug}/templates`);
```

### Toast Feedback Pattern (Client Components)
**Source:** `apps/web/src/components/catalog/LpCatalogCard.tsx` (lines 219–228)
**Apply to:** `ProjectTemplateForm.tsx`
```typescript
import { toast } from "sonner";

// Success:
toast.success("Project template created.");

// Warning (scan findings):
toast.warning(`Template created with ${result.data.findings.length} warning(s).`);

// Error:
toast.error(result.error ?? "Upload failed. Try again.");
```

### `useTransition` for Async Server Action Calls
**Source:** `apps/web/src/components/catalog/LpCatalogCard.tsx` (line 199)
**Apply to:** `ProjectTemplateForm.tsx`
```typescript
const [isPending, startTransition] = useTransition();

startTransition(async () => {
  const result = await createProjectTemplateAction(slug, formData);
  // handle result
});
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/src/lib/project-templates/zip-validate.ts` | utility | file-I/O | No ZIP extraction exists anywhere in the codebase; `archiver` is write-only (export); `yauzl` is a new read-side library |
| `apps/web/src/lib/project-templates/secret-scan.ts` | utility | transform | No credential scanning or regex-based content analysis exists in the codebase |

---

## Metadata

**Analog search scope:** `apps/web/src/lib/`, `apps/web/src/components/`, `apps/web/src/app/`, `apps/web/prisma/`, `apps/web/tests/`
**Files scanned:** 15 source files read in full
**Pattern extraction date:** 2026-06-18
