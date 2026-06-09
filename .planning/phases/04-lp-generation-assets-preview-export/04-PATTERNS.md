# Phase 4: LP Generation, Assets, Preview & Export — Pattern Map

**Mapped:** 2026-06-09
**Files analyzed:** 18 new/modified files
**Analogs found:** 16 / 18

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/web/src/lib/lps/actions.ts` | service | CRUD + request-response | `apps/web/src/lib/templates/actions.ts` | exact |
| `apps/web/src/lib/lps/schema.ts` | utility | transform | `apps/web/src/lib/templates/schema.ts` | exact |
| `apps/web/src/lib/lps/render.ts` | utility | request-response | `apps/web/src/lib/brand/actions.ts` (getBrandConfig read path) | role-match |
| `apps/web/src/lib/lps/schema-derive.ts` | utility | transform | `apps/web/src/lib/templates/metadata.ts` | role-match |
| `apps/web/src/lib/db/tenant-db.ts` (modified) | utility | CRUD | `apps/web/src/lib/db/tenant-db.ts` (existing TenantTemplateHelpers) | exact |
| `apps/web/prisma/schema.prisma` (modified) | model | CRUD | `apps/web/prisma/schema.prisma` (Template + BrandConfig models) | exact |
| `apps/web/src/app/w/[slug]/lps/page.tsx` | component | request-response | `apps/web/src/app/w/[slug]/templates/page.tsx` | exact |
| `apps/web/src/app/w/[slug]/lps/new/page.tsx` | component | request-response | `apps/web/src/app/w/[slug]/brand/page.tsx` (RSC shell + client form) | role-match |
| `apps/web/src/app/w/[slug]/lps/new/[templateId]/page.tsx` | component | request-response | `apps/web/src/app/w/[slug]/templates/[id]/edit/page.tsx` | exact |
| `apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx` | component | request-response | `apps/web/src/app/w/[slug]/templates/[id]/edit/page.tsx` | role-match |
| `apps/web/src/app/w/[slug]/lps/[lpId]/edit/page.tsx` | component | request-response | `apps/web/src/app/w/[slug]/templates/[id]/edit/page.tsx` | exact |
| `apps/web/src/app/api/lps/[lpId]/export/route.ts` | service | streaming + file-I/O | `apps/web/src/app/api/auth/[...all]/route.ts` (shape only) | partial |
| `apps/web/src/components/lps/LpForm.tsx` | component | request-response | `apps/web/src/components/templates/TemplateEditor.tsx` | exact |
| `apps/web/src/components/lps/LpCard.tsx` | component | request-response | `apps/web/src/components/templates/TemplateCard.tsx` | exact |
| `apps/web/src/components/lps/LpPreview.tsx` | component | request-response | `apps/web/src/components/templates/TemplateEditor.tsx` (client island shape) | role-match |
| `apps/web/src/components/lps/RepeaterBlock.tsx` | component | event-driven | `apps/web/src/components/templates/TemplateEditor.tsx` (metadata overlay list) | role-match |
| `apps/web/src/components/lps/ImageUploadField.tsx` | component | file-I/O | no analog | none |
| `apps/web/src/components/lps/RichTextField.tsx` | component | event-driven | no analog | none |
| `apps/web/src/components/lps/BrandGlobalsPanel.tsx` | component | request-response | `apps/web/src/components/brand/BrandConfigForm.tsx` (token reference block) | role-match |

---

## Pattern Assignments

### `apps/web/src/lib/lps/actions.ts` (service, CRUD)

**Analog:** `apps/web/src/lib/templates/actions.ts`

**File-level header comment** (lines 1-27):
```typescript
/**
 * LP Server Actions.
 *
 * All mutations require an authenticated workspace member with role
 * owner, admin, or editor. workspaceId is always derived from the
 * server session via requireWorkspaceRole — never from client input.
 *
 * Architecture:
 * - generateLpAction calls render(snapshotMarkup, values, liveBrand) server-side.
 *   render is NOT imported here — it lives in lib/lps/render.ts (Pitfall 1 from
 *   Phase 3: importing render in a "use server" file bundles sanitize-html into
 *   the client bundle and breaks the build).
 * - workspaceId is always from requireWorkspaceRole, never from client input.
 * - LP CRUD (generate, update, duplicate, delete, list, get) follows the same
 *   shape as template actions.
 */
"use server";
```

**Imports pattern** (lines 28-37 of templates/actions.ts):
```typescript
import { requireWorkspaceRole, requireWorkspace } from "@/lib/workspaces/guards";
import { withTenantDb } from "@/lib/db/tenant-db";
import { GenerateLpSchema, UpdateLpSchema } from "./schema";
import type { ActionResult } from "@/lib/workspaces/actions";
// NOTE: Do NOT import render or renderLp here — use lib/lps/render.ts instead
// (see Pitfall 1 in 04-RESEARCH.md: sanitize-html build error)
```

**Auth + guard pattern** (lines 63 of templates/actions.ts):
```typescript
const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);
```

**Zod validation pattern** (lines 66-75 of templates/actions.ts):
```typescript
const parsed = CreateTemplateSchema.safeParse(input);
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

**Core CRUD + withTenantDb pattern** (lines 88-107 of templates/actions.ts):
```typescript
return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
  const lp = await db.lp.create({
    templateId,
    name,
    markupSnapshot,
    schemaVersion,
    values: values as object,
  });
  return { ok: true, data: { id: lp.id } };
});
```

**Error handling pattern** (lines 105-107 of templates/actions.ts):
```typescript
} catch {
  return { ok: false, error: "Failed to save. Please try again." };
}
```

**Delete with cross-workspace guard** (lines 220-232 of templates/actions.ts):
```typescript
return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
  const existing = await db.lp.findById(lpId);
  if (!existing) {
    return { ok: false, error: "Landing page not found in this workspace." };
  }
  await db.lp.delete(lpId);
  return { ok: true, data: undefined };
});
```

**List pattern** (lines 263-283 of templates/actions.ts — listTemplatesAction):
```typescript
// Any workspace member can list LPs (viewer has lp.read permission)
const ctx = await requireWorkspace(slug);
return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
  const lps = await db.lp.list();
  return { ok: true, data: lps.map((lp) => ({ id: lp.id, name: lp.name, /* ... */ })) };
});
```

**Duplicate pattern** — new for this file, copy from delete then create:
```typescript
export async function duplicateLpAction(slug: string, lpId: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);
  try {
    return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
      const origin = await db.lp.findById(lpId);
      if (!origin) return { ok: false, error: "Landing page not found in this workspace." };
      const copy = await db.lp.create({
        templateId: origin.templateId ?? undefined,
        name: `Copy of ${origin.name}`,
        markupSnapshot: origin.markupSnapshot,
        schemaVersion: origin.schemaVersion,
        values: origin.values as object,
      });
      return { ok: true, data: { id: copy.id } };
    });
  } catch {
    return { ok: false, error: "Failed to duplicate. Please try again." };
  }
}
```

**Presigned upload action** — no analog in codebase; use RESEARCH.md Pattern 4 code directly (lines 446-477 of 04-RESEARCH.md).

---

### `apps/web/src/lib/lps/schema.ts` (utility, transform)

**Analog:** `apps/web/src/lib/templates/schema.ts`

**File header + Zod import** (lines 1-16 of templates/schema.ts):
```typescript
/**
 * Zod schemas for LP input validation.
 * workspaceId never comes from client payload — derived from server session.
 */
import { z } from "zod";
```

**Schema pattern** (lines 36-58 of templates/schema.ts — CreateTemplateSchema):
```typescript
export const GenerateLpSchema = z.object({
  /** ID of the source template. */
  templateId: z.string().cuid("Invalid template ID"),

  /** User-provided LP name (D-11). */
  name: z
    .string()
    .min(1, "Landing page name is required")
    .max(128, "Landing page name must be 128 characters or less")
    .trim(),

  /**
   * Filled field values. Keys are field names; values are strings, objects
   * (button type), or arrays (repeater type). Validated at runtime by
   * deriveZodSchema in the form; here we only validate the outer container.
   */
  values: z.record(z.string(), z.unknown()),
});

export type GenerateLpInput = z.infer<typeof GenerateLpSchema>;
```

**Update schema pattern** (lines 64-83 of templates/schema.ts — UpdateTemplateSchema):
```typescript
export const UpdateLpSchema = z.object({
  id: z.string().cuid("Invalid LP ID"),
  name: z.string().min(1).max(128).trim().optional(),
  values: z.record(z.string(), z.unknown()).optional(),
  // markupSnapshot + schemaVersion updated only when user applies new template version (D-08)
  markupSnapshot: z.string().min(1).optional(),
  schemaVersion: z.number().int().positive().optional(),
});

export type UpdateLpInput = z.infer<typeof UpdateLpSchema>;
```

---

### `apps/web/src/lib/lps/render.ts` (utility, request-response)

**Analog:** `apps/web/src/lib/brand/actions.ts` (getBrandConfigAction read path, lines 104-140) + engine import pattern from `apps/web/src/lib/templates/actions.ts`

**Critical constraint** (from templates/actions.ts lines 15-18):
```typescript
// Only { parse } is imported from pageforge-engine in actions.ts to avoid
// bundling sanitize-html into the client bundle.
// render.ts must NOT have "use server" — it is a server-only utility module
// called from RSC pages and route handlers, never directly from client components.
```

**Brand resolution pattern** (lines 117-130 of brand/actions.ts):
```typescript
// From lib/brand/actions.ts getBrandConfigAction — how to fetch brand config
return await withTenantDb(
  { workspaceId: ctx.workspaceId },
  async (db) => {
    const config = await db.brandConfig.findFirst();
    return {
      ok: true,
      data: config
        ? { logoUrl: config.logoUrl, primaryColor: config.primaryColor, whatsapp: config.whatsapp }
        : null,
    };
  }
);
```

**Full render.ts shape** (from RESEARCH.md Pattern 6, lines 528-553):
```typescript
// NO "use server" directive — this is a server-only utility, not a Server Action
import { render } from "pageforge-engine";
import type { TenantClient } from "@/lib/db/tenant-db";

export async function renderLp(
  lp: { markupSnapshot: string; values: Record<string, unknown> },
  db: TenantClient
): Promise<string> {
  const brand = await db.brandConfig.findFirst();
  const brandScope: Record<string, unknown> = {
    logo: brand?.logoUrl ?? "",
    primary_color: brand?.primaryColor ?? "",
    whatsapp: brand?.whatsapp ?? "",
  };
  return render(lp.markupSnapshot, lp.values, brandScope);
}
```

**Key note:** Brand scope keys (`logo`, `primary_color`, `whatsapp`) must match the token grammar in `src/engine/`. Cross-check `src/engine/renderer.ts` at implementation time — the renderer maps `brand.*` prefix by stripping `brand.` from the token name and looking it up in the brandScope object.

---

### `apps/web/src/lib/lps/schema-derive.ts` (utility, transform)

**Analog:** `apps/web/src/lib/templates/metadata.ts` (reconcileMetadataOverlay pattern)

**Pure utility module header** (lines 1-8 of metadata.ts):
```typescript
/**
 * Dynamic Zod schema derivation for LP forms.
 * No "use server" — pure utility module with no side effects.
 */
import type { TokenField } from "pageforge-engine";
```

**Reconcile loop pattern** (lines 56-77 of metadata.ts):
```typescript
// metadata.ts reconcileMetadataOverlay iterates fields, matches by name,
// creates defaults for new fields, implicitly drops removed ones.
// deriveZodSchema follows the same iteration pattern but emits ZodTypeAny
// instead of FieldMeta.
export function reconcileMetadataOverlay(
  fields: TokenField[],
  existing: MetadataOverlay
): MetadataOverlay {
  const result: MetadataOverlay = {};
  for (const field of fields) {
    if (field.global) { continue; }
    result[field.name] = existing[field.name] ?? { label: field.name, required: false };
  }
  return result;
}
```

**Full schema-derive.ts shape** — use RESEARCH.md Pattern 1 (lines 248-332 of 04-RESEARCH.md) directly. It derives `z.ZodObject` keyed by field name, skipping globals, building repeater arrays via `z.array(z.object({...}))`.

---

### `apps/web/src/lib/db/tenant-db.ts` (modified — add TenantLpHelpers + TenantAssetHelpers)

**Analog:** `apps/web/src/lib/db/tenant-db.ts` — existing `TenantTemplateHelpers` interface (lines 75-102) and `TenantBrandHelpers` interface (lines 114-123).

**Interface declaration pattern** (lines 75-102 of tenant-db.ts):
```typescript
export interface TenantTemplateHelpers {
  create: (data: {
    name: string;
    markup: string;
    schema: Prisma.InputJsonValue;
    metadataOverlay: Prisma.InputJsonValue;
  }) => Promise<Template>;
  findById: (id: string) => Promise<Template | null>;
  list: () => Promise<Template[]>;
  update: (id: string, data: { name?: string; markup?: string; schema?: Prisma.InputJsonValue; metadataOverlay?: Prisma.InputJsonValue }) => Promise<Template>;
  delete: (id: string) => Promise<Template | null>;
}
```

**TenantClient extension pattern** (lines 129-138 of tenant-db.ts):
```typescript
export interface TenantClient {
  readonly workspaceId: string;
  readonly tenantIsolationProbe: TenantProbeHelpers;
  readonly template: TenantTemplateHelpers;
  readonly brandConfig: TenantBrandHelpers;
  // Add:
  readonly lp: TenantLpHelpers;
  readonly lpAsset: TenantAssetHelpers;
}
```

**Implementation pattern for create** (lines 206-213 of tenant-db.ts):
```typescript
lp: {
  create: async (data) => {
    return tx.landingPage.create({
      data: {
        ...data,
        workspaceId, // injected from server context — never from client
      },
    });
  },
  findById: async (id: string) => {
    return tx.landingPage.findFirst({
      where: { id, workspaceId }, // app-level isolation
    });
  },
  list: async () => {
    return tx.landingPage.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
    });
  },
  update: async (id: string, data) => {
    return tx.landingPage.update({
      where: { id, workspaceId },
      data,
    });
  },
  delete: async (id: string) => {
    const existing = await tx.landingPage.findFirst({ where: { id, workspaceId } });
    if (!existing) return null;
    return tx.landingPage.delete({ where: { id, workspaceId } });
  },
},
```

**RLS SET LOCAL pattern** (lines 167-170 of tenant-db.ts — this already exists, new tables inherit it automatically):
```typescript
await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${workspaceId}, true)`;
```

---

### `apps/web/prisma/schema.prisma` (modified — add LandingPage + LpAsset)

**Analog:** `apps/web/prisma/schema.prisma` — `Template` model (lines 200-219) and `BrandConfig` model (lines 222-237).

**Template model pattern to copy** (lines 200-219):
```prisma
/// Template stores the markup (with tokens) and the derived schema for a landing page template.
/// RLS policy: workspace_id = current_setting('app.current_workspace_id', true)::text
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

**New LandingPage model** (from RESEARCH.md Pattern 8, lines 614-653):
```prisma
/// LandingPage stores the filled LP values and a snapshot of the template markup at generation time.
/// markupSnapshot and values are stored as Json/Text (jsonb in Postgres).
/// D-06: markup is snapshotted at generation time — editing the source template does NOT alter existing LPs.
/// D-11: name is user-provided at generation time.
/// templateId is a soft reference (nullable) — LP survives template deletion.
/// RLS policy: workspace_id = current_setting('app.current_workspace_id', true)::text
model LandingPage {
  id              String   @id @default(cuid())
  workspaceId     String
  templateId      String?  // soft ref — LP survives template deletion (D-06)
  name            String
  markupSnapshot  String   @db.Text        // snapshot at generation time (D-06)
  schemaVersion   Int                      // template schemaVersion at generation time (D-06)
  values          Json                     // LP field values (jsonb)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace    Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  assets       LpAsset[]

  @@index([workspaceId])
  @@map("landing_page")
}

/// LpAsset tracks S3 keys for images uploaded per LP (enables cleanup on LP delete).
/// RLS policy: workspace_id = current_setting('app.current_workspace_id', true)::text
model LpAsset {
  id            String   @id @default(cuid())
  workspaceId   String
  landingPageId String
  s3Key         String   // e.g. workspaces/{wId}/lps/assets/{uuid}.jpg
  publicUrl     String
  filename      String
  mimeType      String
  fileSize      Int      // bytes
  createdAt     DateTime @default(now())

  workspace    Workspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  landingPage  LandingPage  @relation(fields: [landingPageId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
  @@index([landingPageId])
  @@map("lp_asset")
}
```

**Workspace model relations** (lines 149-153 of schema.prisma — add to existing Workspace model):
```prisma
// Add to Workspace model relations block:
landingPages LandingPage[]
lpAssets     LpAsset[]
```

---

### `apps/web/src/app/w/[slug]/lps/page.tsx` (component, request-response)

**Analog:** `apps/web/src/app/w/[slug]/templates/page.tsx` (exact match)

**RSC page structure** (lines 1-78 of templates/page.tsx):
```typescript
// Security gate (line 24-25):
const ctx = await requireWorkspace(slug);
const result = await listLpsAction(slug);

// Permission check (line 29):
const canCreate = can(ctx.role, "lp", "create");

// Empty state + grid pattern (lines 47-75):
{lps.length === 0 ? (
  <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
    <FileText className="h-12 w-12 text-gray-300 mb-4" aria-hidden="true" />
    <h2 className="text-xl font-semibold text-gray-900 mb-2">No landing pages yet</h2>
    <p className="text-sm text-gray-500 mb-6">
      Pick a template and fill in the form to generate your first landing page.
    </p>
    {canCreate && (
      <Link href={`/w/${slug}/lps/new`} className="inline-flex ...">Generate LP</Link>
    )}
  </div>
) : (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    {lps.map((lp) => <LpCard key={lp.id} lp={lp} slug={slug} />)}
  </div>
)}
```

---

### `apps/web/src/app/w/[slug]/lps/new/[templateId]/page.tsx` (component, request-response)

**Analog:** `apps/web/src/app/w/[slug]/templates/[id]/edit/page.tsx` (exact match)

**RSC shell pattern** (lines 1-59 of edit/page.tsx):
```typescript
// 1. Require role gate
const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

// 2. Fetch template with workspaceId filter (cross-workspace returns null)
const template = await withTenantDb({ workspaceId: ctx.workspaceId }, (db) =>
  db.template.findById(templateId)
);

// 3. Redirect on not-found
if (!template) { redirect(`/w/${slug}/lps/new`); }

// 4. Validate DB JSON before passing to client component
const schemaParsed = ParsedSchemaValidator.safeParse(template.schema);
const safeSchema = schemaParsed.success ? schemaParsed.data : null;

// 5. Also fetch brand config (D-04 live resolution) for BrandGlobalsPanel
const brandConfig = await withTenantDb({ workspaceId: ctx.workspaceId }, (db) =>
  db.brandConfig.findFirst()
);

// 6. Pass serialized data to client island
return <LpForm slug={slug} mode="generate" template={...} brandConfig={brandConfig} />;
```

---

### `apps/web/src/app/w/[slug]/lps/[lpId]/preview/page.tsx` (component, request-response)

**Analog:** `apps/web/src/app/w/[slug]/templates/[id]/edit/page.tsx` (RSC shell shape)

**Preview-specific pattern** — RSC fetches LP + renders HTML server-side:
```typescript
// All workspace members can preview (viewer has lp.preview)
const ctx = await requireWorkspace(slug);

const lp = await withTenantDb({ workspaceId: ctx.workspaceId }, (db) =>
  db.lp.findById(lpId)
);
if (!lp) { redirect(`/w/${slug}/lps`); }

// Render server-side — same pipeline as export (preview == export guarantee)
const html = await withTenantDb({ workspaceId: ctx.workspaceId }, (db) =>
  renderLp({ markupSnapshot: lp.markupSnapshot, values: lp.values as Record<string, unknown> }, db)
);

return <LpPreview html={html} lp={{ id: lp.id, name: lp.name }} slug={slug} />;
```

---

### `apps/web/src/app/api/lps/[lpId]/export/route.ts` (service, streaming + file-I/O)

**Analog:** `apps/web/src/app/api/auth/[...all]/route.ts` (route handler shape only — the auth handler is too simple; rely on RESEARCH.md Pattern 7 for the full implementation).

**Route handler export pattern** (line 3 of auth route.ts):
```typescript
export async function GET(req: Request, { params }: { params: { lpId: string } }) {
  // 1. Auth: requireWorkspace — all members including viewer can export (lp.export)
  // 2. Fetch LP via withTenantDb
  // 3. renderLp() — same as preview
  // 4. Extract img srcs, download from S3, rewrite to ./assets/
  // 5. injectCsp(html)
  // 6. Stream ZIP via archiver → Readable.toWeb() → NextResponse
}
```

**Full implementation shape** — use RESEARCH.md Pattern 7 (lines 563-605 of 04-RESEARCH.md) and Pitfall 4 (lines 773-788) for the `Readable.toWeb()` bridge pattern.

---

### `apps/web/src/components/lps/LpForm.tsx` (component, request-response)

**Analog:** `apps/web/src/components/templates/TemplateEditor.tsx`

**Client island directive + imports** (lines 1-36 of TemplateEditor.tsx):
```typescript
"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
// LpForm adds:
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
```

**useTransition + startTransition pattern** (lines 65-66, 124-145 of TemplateEditor.tsx):
```typescript
const [isPending, startTransition] = useTransition();

function handleSave() {
  startTransition(async () => {
    const result = await generateLpAction(slug, { templateId, name, values });
    if (result.ok) {
      toast.success("LP generated successfully.");
      router.push(`/w/${slug}/lps/${result.data.id}/preview`);
    } else {
      toast.error("Failed to generate LP. Try again.");
    }
  });
}
```

**Pending button pattern** (lines 165-179 of TemplateEditor.tsx):
```typescript
<Button onClick={handleSubmit(handleSave)} disabled={isPending}>
  {isPending ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      Generating…
    </>
  ) : (
    "Generate LP"
  )}
</Button>
```

**Alert for warnings pattern** (lines 217-229 of TemplateEditor.tsx — reuse for schema version mismatch D-08):
```typescript
{schemaVersionMismatch && (
  <Alert>
    <AlertTitle>Template updated</AlertTitle>
    <AlertDescription>
      The template has been updated to v{N}. New fields have been added and
      missing ones removed. Your existing values are preserved where possible.
      <Button variant="outline" onClick={handleApplyNewVersion}>Apply new version</Button>
    </AlertDescription>
  </Alert>
)}
```

**Color input + swatch pattern** (lines 166-197 of BrandConfigForm.tsx):
```typescript
// Reuse for color field type in LpForm:
<div className="flex items-center gap-2">
  <Input type="text" value={colorValue} onChange={...} placeholder="#0f172a" />
  <div
    className="inline-flex shrink-0 rounded border border-gray-200"
    style={{ width: "24px", height: "24px", backgroundColor: swatchColor }}
    aria-label="Color preview"
    role="img"
  />
</div>
```

**Inline validation error pattern** (lines 153-160 of BrandConfigForm.tsx):
```typescript
{fieldError ? (
  <p id="{field}-error" className="text-sm text-red-600 mt-1" role="alert">
    {fieldError}
  </p>
) : (
  <p id="{field}-help" className="text-sm text-gray-500">{helperText}</p>
)}
```

---

### `apps/web/src/components/lps/LpCard.tsx` (component, request-response)

**Analog:** `apps/web/src/components/templates/TemplateCard.tsx` (exact match)

**Card structure** (lines 52-131 of TemplateCard.tsx):
```typescript
"use client";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function LpCard({ lp, slug }: LpCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <Card className="min-h-[120px]">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="truncate text-base font-semibold text-gray-900">{lp.name}</span>
            <span className="shrink-0 text-sm text-gray-400 font-normal">
              from {lp.templateName} v{lp.schemaVersion}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">{formattedDate}</p>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-2">
          <Link href={`/w/${slug}/lps/${lp.id}/preview`} className="inline-flex ...">Preview</Link>
          <Link href={`/w/${slug}/lps/${lp.id}/edit`} className="inline-flex ...">Edit</Link>
          {/* Kebab menu with Duplicate, Export ZIP, separator, Delete */}
          <div className="relative">
            <button type="button" onClick={() => setMenuOpen(v => !v)} aria-label="Landing page options">
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
            {menuOpen && (/* backdrop + dropdown */)}
          </div>
        </CardFooter>
      </Card>
      <DeleteLpDialog ... />
    </>
  );
}
```

**Kebab menu + backdrop pattern** (lines 87-118 of TemplateCard.tsx):
```typescript
{menuOpen && (
  <>
    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
    <div className="absolute right-0 bottom-full mb-1 z-20 min-w-[140px] bg-white border border-gray-200 rounded-md shadow-md py-1">
      <button type="button" onClick={handleDuplicate} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
        Duplicate
      </button>
      <button type="button" onClick={handleExport} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
        Export ZIP
      </button>
      {/* separator */}
      <button type="button" onClick={() => { setMenuOpen(false); setDeleteOpen(true); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">
        Delete landing page
      </button>
    </div>
  </>
)}
```

---

### `apps/web/src/components/lps/LpPreview.tsx` (component, request-response)

**Analog:** `apps/web/src/components/templates/TemplateEditor.tsx` (client island shape)

**Client island directive** (line 1 of TemplateEditor.tsx):
```typescript
"use client";
```

**Preview toolbar + iframe pattern** (no direct analog — compose from existing patterns):
```typescript
"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface LpPreviewProps {
  html: string;     // rendered HTML string from server RSC
  lp: { id: string; name: string };
  slug: string;
}

export function LpPreview({ html, lp, slug }: LpPreviewProps) {
  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <div className="h-12 px-4 border-b border-gray-200 bg-white flex items-center gap-4 sticky top-0">
        <Link href={`/w/${slug}/lps`} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Landing Pages
        </Link>
        <span className="text-base font-semibold text-gray-900 flex-1">{lp.name}</span>
        <Link href={`/w/${slug}/lps/${lp.id}/edit`} className="...">Edit</Link>
        <a href={`/api/lps/${lp.id}/export`} download className="...">Export ZIP</a>
      </div>
      {/* iframe — srcdoc, no scripts (D-10 preview sandbox) */}
      <iframe
        title="Landing page preview"
        srcDoc={html}
        sandbox="allow-same-origin"
        className="w-full flex-1 border-0"
        style={{ height: "calc(100vh - 3rem)" }}
      />
    </div>
  );
}
```

---

### `apps/web/src/components/lps/RepeaterBlock.tsx` (component, event-driven)

**Analog:** `apps/web/src/components/templates/TemplateEditor.tsx` — metadata overlay expansion section (lines 254-318)

**Collapsible section toggle pattern** (lines 257-261 of TemplateEditor.tsx):
```typescript
const [metadataExpanded, setMetadataExpanded] = useState(false);

<button type="button" onClick={() => setMetadataExpanded(v => !v)} className="text-sm text-gray-500">
  {metadataExpanded ? <ChevronDown /> : <ChevronRight />}
  {repeaterName} ({fields.length} items)
</button>
```

**useFieldArray integration** — no analog; use RESEARCH.md Pattern 2 (lines 341-365 of 04-RESEARCH.md):
```typescript
const { fields, append, remove, move } = useFieldArray({ control, name: repeaterName });
```

**Item sub-card pattern** (from UI-SPEC repeater block layout):
```typescript
{fields.map((item, index) => (
  <div key={item.id} className="border border-gray-200 rounded-md p-4 mb-2">
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm font-semibold text-gray-700">{repeaterLabel} {index + 1}</span>
      <div className="flex items-center gap-1">
        <GripVertical className="h-4 w-4 text-gray-300" aria-hidden="true" />
        <button type="button" onClick={() => remove(index)} aria-label={`Remove ${repeaterLabel} ${index + 1}`}
          className="p-1 text-gray-400 hover:text-red-500 transition-colors">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
    {/* Render item fields here */}
  </div>
))}
```

---

### `apps/web/src/components/lps/BrandGlobalsPanel.tsx` (component, request-response)

**Analog:** `apps/web/src/components/brand/BrandConfigForm.tsx` — brand token reference block (lines 234-253)

**Token reference block pattern** (lines 234-253 of BrandConfigForm.tsx):
```typescript
<div>
  <p className="text-sm font-semibold text-gray-500 mb-2">Brand tokens in this workspace</p>
  <div className="font-mono text-sm text-gray-600 bg-gray-50 rounded p-3 border border-gray-200 space-y-1">
    <p><span className="text-gray-400">brand.logo</span> = {logoUrl || "(not configured)"}</p>
    <p><span className="text-gray-400">brand.primary_color</span> = {primaryColor || "(not configured)"}</p>
    <p><span className="text-gray-400">brand.whatsapp</span> = {whatsapp || "(not configured)"}</p>
  </div>
</div>
```

**BrandGlobalsPanel adaptation** (read-only, no inputs):
```typescript
// From UI-SPEC: gray-50 panel, border border-gray-200 rounded-md p-4 mb-6
// Section heading: "Brand Globals" (text-sm font-semibold text-gray-500 uppercase tracking-wide)
// Unconfigured: "(not configured)" in text-gray-400 italic
// Configure link at bottom right

interface BrandGlobalsPanelProps {
  brand: { logoUrl: string | null; primaryColor: string | null; whatsapp: string | null } | null;
  slug: string;
}

export function BrandGlobalsPanel({ brand, slug }: BrandGlobalsPanelProps) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6" aria-label="Brand globals (read-only)">
      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Brand Globals</p>
      <div className="font-mono text-sm text-gray-600 space-y-1">
        <p><span className="text-gray-400">brand.logo</span> = {brand?.logoUrl || <em className="text-gray-400 not-italic">(not configured)</em>}</p>
        <p><span className="text-gray-400">brand.primary_color</span> = {brand?.primaryColor || <em ...>(not configured)</em>}</p>
        <p><span className="text-gray-400">brand.whatsapp</span> = {brand?.whatsapp || <em ...>(not configured)</em>}</p>
      </div>
      <div className="flex justify-end mt-3">
        <Link href={`/w/${slug}/brand`} className="text-sm text-gray-500 underline">Configure brand →</Link>
      </div>
    </div>
  );
}
```

---

### `apps/web/src/components/lps/ImageUploadField.tsx` (component, file-I/O)

**No analog in codebase.** Use RESEARCH.md Pattern 4 (lines 428-492) and UI-SPEC ImageUploadField section (lines 239-286 of 04-UI-SPEC.md) for the full implementation.

**Key patterns to assemble:**
- XHR presigned PUT upload with progress (RESEARCH.md lines 480-492)
- State machine: `idle | uploading | uploaded | error`
- Client-side pre-validation: MIME type from `file.type` + file size ≤ 5 MB (UX pre-check only; server re-validates with magic bytes)
- Server Action call for presigned URL: `requestPresignedUploadAction(slug, { filename, contentType, fileSize, firstBytes })`
- File picker via hidden `<input type="file" accept="image/png,image/jpeg,image/webp">`
- Drag-over state: `border-blue-300 bg-blue-50`
- Progress bar: shadcn `<Progress value={pct} className="h-1.5" aria-label="Upload progress" />`
- Success thumbnail: `<img src={publicUrl} alt={filename} className="w-12 h-12 object-cover rounded" />`

---

### `apps/web/src/components/lps/RichTextField.tsx` (component, event-driven)

**No analog in codebase.** Use RESEARCH.md Pattern 3 (lines 369-418) directly.

**Critical notes:**
- Must NOT call `useEditor` inside the `Controller` render prop (Pitfall 2 from RESEARCH.md lines 743-751). Extract a separate `RichTextEditor` component that receives `value` and `onChange` as props.
- Set `immediatelyRender: false` to avoid React hydration mismatch in Next.js SSR.
- Wrap with `Controller` from react-hook-form (not `register`) since Tiptap manages its own state.
- Toolbar: Bold, Italic, BulletList, OrderedList, Link (5 controls — UI-SPEC line 198).

**Correct pattern** (RESEARCH.md lines 393-417):
```typescript
// Outer component wires Controller:
export function RichTextField({ name, control, defaultValue = "", label }: RichTextFieldProps) {
  return (
    <Controller name={name} control={control} defaultValue={defaultValue}
      render={({ field }) => (
        <RichTextEditor value={field.value} onChange={field.onChange} label={label} />
      )}
    />
  );
}

// Inner component owns useEditor (hooks allowed here — it's a real component):
function RichTextEditor({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    immediatelyRender: false, // REQUIRED for Next.js SSR
    onUpdate: ({ editor }) => { onChange(editor.getHTML()); },
  });
  return (
    <div aria-label={`${label} rich text editor`} className="border border-input rounded-md p-3 min-h-[120px]">
      {/* Toolbar */}
      <EditorContent editor={editor} />
    </div>
  );
}
```

---

## Shared Patterns

### Authentication + Workspace Guard
**Source:** `apps/web/src/lib/workspaces/guards.ts`
**Apply to:** All new Server Actions and RSC pages in lib/lps/ and app/w/[slug]/lps/

```typescript
// For mutations (generate, update, duplicate, delete): owner/admin/editor only
const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

// For reads (list, get, preview): any member including viewer
const ctx = await requireWorkspace(slug);
```

### ActionResult Type
**Source:** `apps/web/src/lib/workspaces/actions.ts` (lines 37-39)
**Apply to:** All new Server Actions in lib/lps/actions.ts

```typescript
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
```

### withTenantDb Wrapper
**Source:** `apps/web/src/lib/db/tenant-db.ts` (lines 160-278)
**Apply to:** All new Server Actions, RSC pages, and route handler in lps/

```typescript
return await withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
  // db.lp.create / findById / list / update / delete
  // db.brandConfig.findFirst() for brand globals resolution
});
```

### Server-Side Zod Validation
**Source:** `apps/web/src/lib/templates/actions.ts` (lines 66-75) and `apps/web/src/lib/brand/actions.ts` (lines 53-61)
**Apply to:** All new Server Actions

```typescript
const parsed = GenerateLpSchema.safeParse(input);
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

### Toast Notifications (Client Components)
**Source:** `apps/web/src/components/templates/DeleteTemplateDialog.tsx` (lines 52-57) and `apps/web/src/components/brand/BrandConfigForm.tsx` (lines 108-115)
**Apply to:** LpForm.tsx, LpCard.tsx, any client component that calls Server Actions

```typescript
// Success:
toast.success("LP generated successfully.");
// Error:
toast.error("Failed to generate LP. Try again.");
// With description:
toast("Failed.", { description: result.error });
```

### useTransition for Server Actions
**Source:** `apps/web/src/components/templates/DeleteTemplateDialog.tsx` (lines 47-57) and `apps/web/src/components/brand/BrandConfigForm.tsx` (lines 74, 101-116)
**Apply to:** LpForm.tsx, LpCard.tsx (duplicate, delete)

```typescript
const [isPending, startTransition] = useTransition();

function handleAction() {
  startTransition(async () => {
    const result = await someAction(slug, input);
    if (result.ok) { toast.success("..."); }
    else { toast.error("..."); }
  });
}
```

### DB JSON Validation (ParsedSchemaValidator Pattern)
**Source:** `apps/web/src/lib/templates/parsed-schema-validator.ts` and `apps/web/src/app/w/[slug]/templates/[id]/edit/page.tsx` (lines 42-43)
**Apply to:** Any RSC page that reads `LandingPage.values` or `Template.schema` from the DB

```typescript
// Never cast DB JSON directly — validate with Zod first:
const schemaParsed = ParsedSchemaValidator.safeParse(template.schema);
const safeSchema = schemaParsed.success ? schemaParsed.data : null;
// Similarly for LandingPage.values — use a ValuesValidator before passing to renderLp()
```

### Permission Check in RSC Pages
**Source:** `apps/web/src/app/w/[slug]/templates/page.tsx` (lines 29) and `apps/web/src/app/w/[slug]/brand/page.tsx` (line 37)
**Apply to:** lps/page.tsx, lps/[lpId]/preview/page.tsx

```typescript
const canCreate = can(ctx.role, "lp", "create");
const canExport = can(ctx.role, "lp", "export");
// Pass as boolean prop to client components — client never computes authorization
```

### CSP Injection Utility
**Source:** RESEARCH.md Pattern 10 (lines 683-701 of 04-RESEARCH.md)
**Apply to:** `apps/web/src/app/api/lps/[lpId]/export/route.ts`

```typescript
const CSP_META = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'none';">`;

function injectCsp(html: string): string {
  if (html.includes("<head>")) {
    return html.replace("<head>", `<head>\n  ${CSP_META}`);
  }
  return `${CSP_META}\n${html}`;
}
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `apps/web/src/components/lps/ImageUploadField.tsx` | component | file-I/O | No file upload components exist in the codebase yet. Use RESEARCH.md Pattern 4 + UI-SPEC section AST-01. |
| `apps/web/src/components/lps/RichTextField.tsx` | component | event-driven | No Tiptap/rich-text editors exist in the codebase yet. Use RESEARCH.md Pattern 3. |

---

## Critical Constraints (Copy These Into Every Plan)

1. **Never import `render` from `pageforge-engine` in a `"use server"` file.** Keep `render` in `lib/lps/render.ts` (no `"use server"` directive). Server Actions in `lib/lps/actions.ts` call `renderLp()` from `render.ts`. Mixing causes "sanitize-html is not a browser module" build errors. Source: templates/actions.ts lines 15-18 comment.

2. **Never pass `workspaceId` from client input to DB queries.** Always derive from `requireWorkspace()` or `requireWorkspaceRole()`. Source: guards.ts pattern, used throughout templates/actions.ts and brand/actions.ts.

3. **Never render LP templates client-side.** The `render()` call always runs server-side (RSC page or route handler). Preview uses `iframe srcdoc` fed by a server-rendered HTML string.

4. **Never call `useEditor` inside a `Controller` render prop.** Extract a separate `RichTextEditor` component. Source: RESEARCH.md Pitfall 2.

5. **Never cast DB JSON columns directly as typed objects.** Always validate with `ParsedSchemaValidator.safeParse()` or equivalent. Source: parsed-schema-validator.ts + edit/page.tsx lines 42-43.

6. **`file-type` v22 is ESM-only.** Add to `transpilePackages` in `next.config.ts` or use dynamic import `await import("file-type")`. Source: RESEARCH.md Pitfall 3.

---

## Metadata

**Analog search scope:** `apps/web/src/` (all TS/TSX), `apps/web/prisma/schema.prisma`, `src/engine/index.ts`
**Files scanned:** 27 source files
**Pattern extraction date:** 2026-06-09
