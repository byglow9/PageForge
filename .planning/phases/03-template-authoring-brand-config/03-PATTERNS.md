# Phase 3: Template Authoring + Brand Config - Pattern Map

**Mapped:** 2026-06-05
**Files analyzed:** 19 new/modified files
**Analogs found:** 18 / 19

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/src/lib/templates/actions.ts` | service | CRUD | `apps/web/src/lib/workspaces/actions.ts` | exact |
| `apps/web/src/lib/templates/schema.ts` | utility | transform | `apps/web/src/lib/workspaces/schema.ts` | exact |
| `apps/web/src/lib/templates/metadata.ts` | utility | transform | `apps/web/src/lib/workspaces/schema.ts` | role-match (pure transform) |
| `apps/web/src/lib/brand/actions.ts` | service | CRUD | `apps/web/src/lib/workspaces/actions.ts` | exact |
| `apps/web/src/lib/brand/schema.ts` | utility | transform | `apps/web/src/lib/workspaces/schema.ts` | exact |
| `apps/web/src/lib/db/tenant-db.ts` (modify) | service | CRUD | itself — extend `TenantClient` interface with `TenantTemplateHelpers` and `TenantBrandHelpers` inline | exact |
| `apps/web/prisma/schema.prisma` (modify) | model | CRUD | `apps/web/prisma/schema.prisma` `TenantIsolationProbe` block | exact |
| `apps/web/prisma/migrations/0004_.../migration.sql` | config | CRUD | `apps/web/prisma/migrations/0002_rls_real_tenant_tables/migration.sql` | exact |
| `apps/web/src/app/w/[slug]/templates/page.tsx` | component | request-response | `apps/web/src/app/w/[slug]/members/page.tsx` | exact |
| `apps/web/src/app/w/[slug]/templates/new/page.tsx` | component | request-response | `apps/web/src/app/w/[slug]/members/page.tsx` | role-match |
| `apps/web/src/app/w/[slug]/templates/[id]/edit/page.tsx` | component | request-response | `apps/web/src/app/w/[slug]/members/page.tsx` | role-match |
| `apps/web/src/app/w/[slug]/brand/page.tsx` | component | request-response | `apps/web/src/app/w/[slug]/members/page.tsx` | role-match |
| `apps/web/src/app/w/[slug]/layout.tsx` (modify) | component | request-response | itself — current inline-style nav | exact |
| `apps/web/src/components/templates/TemplateEditor.tsx` | component | event-driven | `apps/web/src/app/invitations/[id]/AcceptButton.tsx` | role-match |
| `apps/web/src/components/templates/TemplateCard.tsx` | component | request-response | `apps/web/src/app/invitations/[id]/AcceptButton.tsx` | role-match |
| `apps/web/src/components/templates/SchemaPanel.tsx` | component | event-driven | `apps/web/src/app/invitations/[id]/AcceptButton.tsx` | role-match |
| `apps/web/src/components/templates/DeleteTemplateDialog.tsx` | component | event-driven | `apps/web/src/app/invitations/[id]/AcceptButton.tsx` | role-match |
| `apps/web/src/components/brand/BrandConfigForm.tsx` | component | event-driven | `apps/web/src/app/(auth)/login/page.tsx` | role-match |
| `apps/web/next.config.ts` (modify) | config | — | itself — current minimal config | exact |
| `apps/web/tests/templates.test.ts` | test | — | `apps/web/tests/workspaces.test.ts` | exact |
| `apps/web/tests/brand.test.ts` | test | — | `apps/web/tests/workspaces.test.ts` | exact |
| `apps/web/tests/metadata.test.ts` | test | — | `apps/web/tests/workspaces.test.ts` | role-match |
| `apps/web/tests/schema-conventions.test.ts` (modify) | test | — | itself — `TENANT_OWNED_MODELS` list | exact |

---

## Pattern Assignments

### `apps/web/src/lib/templates/actions.ts` (service, CRUD)

**Analog:** `apps/web/src/lib/workspaces/actions.ts`

**Directive + imports pattern** (lines 1-32):
```typescript
"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import {
  CreateWorkspaceSchema,
  UpdateWorkspaceSchema,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
} from "./schema";
import { requireVerifiedUser, requireWorkspaceRole } from "./guards";
```

**ActionResult type** (lines 37-39) — re-export or import this type, do not redefine:
```typescript
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
```

**Core action pattern** (lines 171-202) — `createInvitationAction` is the closest analog because it takes a `slug` + input and calls `requireWorkspaceRole` then `withTenantDb`:
```typescript
export async function createInvitationAction(
  slug: string,
  input: CreateInvitationInput
): Promise<ActionResult<{ inviteUrl: string; invitationId: string }>> {
  // D-09: only owner/admin can invite members
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin"]);

  const parsed = CreateInvitationSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = fieldErrors[field] ?? [];
      fieldErrors[field].push(issue.message);
    }
    return { ok: false, error: "Validation failed", fieldErrors };
  }

  try {
    // workspaceId comes from server-side context only (T-02-03-04)
    const invitation = await createInvitation(ctx.workspaceId, parsed.data);
    ...
    return { ok: true, data: { ... } };
  } catch (err: unknown) {
    console.error("[createInvitationAction] error:", err);
    return { ok: false, error: "Failed to create invitation. Please try again." };
  }
}
```

**Differences for templates actions:**
- Use `requireWorkspaceRole(slug, ["owner", "admin", "editor"])` (editor can create/edit templates — see `permissions.ts` lines 39, 82)
- Replace `prisma.workspaceMember.create(...)` with `db.template.create(...)` inside `withTenantDb` callback (see tenant-helpers pattern below)
- Add `schemaVersion: { increment: 1 }` on update (Prisma atomic increment)
- Call `parse(markup)` from `pageforge-engine` to derive schema on save (server-authoritative)
- Call `reconcileMetadataOverlay(schema.fields, existingOverlay)` before writing

**`deleteTemplateAction` pattern** (follows `removeMemberAction`, lines 339-392):
```typescript
export async function removeMemberAction(
  slug: string,
  memberId: string
): Promise<ActionResult> {
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin"]);
  const targetMember = await prisma.workspaceMember.findFirst({
    where: { id: memberId, workspaceId: ctx.workspaceId },
  });
  if (!targetMember) {
    return { ok: false, error: "Member not found in this workspace." };
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.workspaceMember.delete({ where: { id: memberId } });
      ...
    });
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    ...
    return { ok: false, error: "Failed to remove member. Please try again." };
  }
}
```

---

### `apps/web/src/lib/templates/schema.ts` (utility, transform)

**Analog:** `apps/web/src/lib/workspaces/schema.ts`

**Full file pattern** (lines 1-65):
```typescript
/**
 * Zod schemas for workspace input validation.
 * Security: workspaceId never comes from client payload...
 */
import { z } from "zod";

export const CreateWorkspaceSchema = z.object({
  name: z
    .string()
    .min(1, "Workspace name is required")
    .max(64, "Workspace name must be 64 characters or less")
    .trim(),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    ...
});

export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;

export const UpdateWorkspaceSchema = z.object({
  name: z.string()...optional(),
  slug: z.string()...optional(),
});

export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>;
```

**Differences for templates schema:**
- `CreateTemplateSchema`: `name: z.string().min(1).max(128).trim()`, `markup: z.string().min(1)`, `metadataOverlay: z.record(z.object({ label: z.string(), required: z.boolean() })).optional()`
- `UpdateTemplateSchema`: same fields as Create but all optional + `id: z.string().cuid()` required
- For `SaveBrandConfigSchema` (in `lib/brand/schema.ts`): `logoUrl: z.string().url().startsWith("https://").optional().or(z.literal(""))`, `primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal(""))`, `whatsapp: z.string().max(32).optional()`

---

### `apps/web/src/lib/db/tenant-db.ts` — Inline TenantClient Extension (service, CRUD)

**Note:** There are no separate `apps/web/src/lib/templates/tenant-helpers.ts` or `apps/web/src/lib/brand/tenant-helpers.ts` files. Both `TenantTemplateHelpers` and `TenantBrandHelpers` are inline extensions of `apps/web/src/lib/db/tenant-db.ts`, following the established pattern where `TenantProbeHelpers` and its implementations all live inside `withTenantDb` in `tenant-db.ts`.

**Analog:** `apps/web/src/lib/db/tenant-db.ts`

**TenantProbeHelpers interface pattern** (lines 50-57) — copy the interface shape, substitute model:
```typescript
export interface TenantProbeHelpers {
  create: (label: string) => Promise<{ id: string; workspaceId: string; label: string; createdAt: Date }>;
  list: () => Promise<Array<{ id: string; workspaceId: string; label: string; createdAt: Date }>>;
  findById: (id: string) => Promise<{ id: string; workspaceId: string; label: string; createdAt: Date } | null>;
}
```

**TenantClient interface extension pattern** (lines 63-68) — add `template` and `brandConfig` alongside existing members:
```typescript
export interface TenantClient {
  readonly workspaceId: string;
  readonly tenantIsolationProbe: TenantProbeHelpers;
  readonly template: TenantTemplateHelpers;   // Phase 3 addition — inline in tenant-db.ts
  readonly brandConfig: TenantBrandHelpers;   // Phase 3 addition — inline in tenant-db.ts
}
```

**tenantIsolationProbe helper implementations** (lines 106-133) — copy `create`, `list`, `findById` bodies verbatim, change model from `tenantIsolationProbe` to `template`:
```typescript
tenantIsolationProbe: {
  create: async (label: string) => {
    return tx.tenantIsolationProbe.create({
      data: { workspaceId, label },  // workspaceId injected from server context
    });
  },
  list: async () => {
    return tx.tenantIsolationProbe.findMany({
      where: { workspaceId },  // app-level filter (D-14)
    });
  },
  findById: async (id: string) => {
    return tx.tenantIsolationProbe.findFirst({
      where: { id, workspaceId },  // app-level isolation
    });
  },
},
```

**Template-specific additions needed (added inline in `withTenantDb` tenantClient object):**
- `create(data)`: `tx.template.create({ data: { ...data, workspaceId } })`
- `findById(id)`: `tx.template.findFirst({ where: { id, workspaceId } })`
- `list()`: `tx.template.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } })`
- `update(id, data)`: `tx.template.update({ where: { id, workspaceId }, data: { ...data, schemaVersion: { increment: 1 } } })`
- `delete(id)`: `tx.template.delete({ where: { id, workspaceId } })` — but first confirm via `findFirst` (app-level check before delete)

---

### `apps/web/src/lib/templates/metadata.ts` (utility, transform)

**Analog:** No direct analog. Pure function, no DB access.

**Closest structural analog:** `apps/web/src/lib/workspaces/schema.ts` (pure transformation module shape — no side effects, just exports typed functions/values).

**Pattern:** A module that exports typed functions and interfaces only. No `"use server"` directive. No imports from `@/lib/db/`.

```typescript
// Pattern: header comment, imports from engine only, export typed functions
import type { TokenField } from "pageforge-engine";

export interface FieldMeta { label: string; required: boolean; }
export type MetadataOverlay = Record<string, FieldMeta>;

export function reconcileMetadataOverlay(
  fields: TokenField[],
  existing: MetadataOverlay
): MetadataOverlay {
  const result: MetadataOverlay = {};
  for (const field of fields) {
    if (field.global) continue;  // brand.* excluded (D-05 / RESEARCH Pitfall 4)
    result[field.name] = existing[field.name] ?? { label: field.name, required: false };
  }
  return result;
}
```

---

### `apps/web/src/lib/brand/actions.ts` (service, CRUD)

**Analog:** `apps/web/src/lib/workspaces/actions.ts` — specifically `updateWorkspaceSettingsAction` (lines 408-473), which is an owner/admin-gated upsert-like operation.

**Core pattern** (lines 408-473):
```typescript
export async function updateWorkspaceSettingsAction(
  slug: string,
  input: UpdateWorkspaceInput
): Promise<ActionResult<{ newSlug?: string }>> {
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin"]);

  const parsed = UpdateWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = fieldErrors[field] ?? [];
      fieldErrors[field].push(issue.message);
    }
    return { ok: false, error: "Validation failed", fieldErrors };
  }
  ...
  try {
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({ where: { id: ctx.workspaceId }, data: updateData });
      ...
    });
    return { ok: true, data: { newSlug: updateData.slug } };
  } catch (err: unknown) {
    ...
    return { ok: false, error: "Failed to update workspace settings. Please try again." };
  }
}
```

**Differences for brand actions:**
- Use `requireWorkspaceRole(slug, ["owner", "admin", "editor"])` — editor has `brand: ["read", "update"]` (permissions.ts line 82)
- `saveBrandConfigAction` uses Prisma `upsert` with `where: { workspaceId }` (enabled by `@unique` constraint on `workspaceId` in BrandConfig model)
- `getBrandConfigAction` is a read-only query: `withTenantDb(ctx, (db) => db.brandConfig.findFirst({ where: { workspaceId } }))`

---

### `apps/web/prisma/schema.prisma` (modify — add Template + BrandConfig models)

**Analog:** `TenantIsolationProbe` model block (lines 185-196):
```prisma
/// TenantIsolationProbe is an exemplar tenant-owned table used in
/// cross-tenant access tests (Phase 2 isolation verification).
/// RLS policy: workspace_id = current_setting('app.current_workspace_id', true)::text
model TenantIsolationProbe {
  id          String   @id @default(cuid())
  workspaceId String
  label       String
  createdAt   DateTime @default(now())

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@map("tenant_isolation_probe")
}
```

**Template model pattern** — copy the probe shape, extend with Json columns:
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

**BrandConfig model pattern** — same shape but `@unique` on `workspaceId` (one record per workspace):
```prisma
model BrandConfig {
  id           String   @id @default(cuid())
  workspaceId  String   @unique
  logoUrl      String?
  primaryColor String?
  whatsapp     String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@map("brand_config")
}
```

**Workspace model relation additions** — every new model must be back-referenced in Workspace (lines 139-152):
```prisma
model Workspace {
  ...
  members     WorkspaceMember[]
  invitations WorkspaceInvitation[]
  probes      TenantIsolationProbe[]
  // Phase 3 additions:
  templates   Template[]
  brandConfig BrandConfig?
}
```

---

### `apps/web/prisma/migrations/0004_.../migration.sql` (new migration)

**Analog:** `apps/web/prisma/migrations/0002_rls_real_tenant_tables/migration.sql` (lines 1-31) — the exact SQL block pattern:
```sql
ALTER TABLE "workspace_member" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_member" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "workspace_member"
    USING ("workspaceId" = current_setting('app.current_workspace_id', true)::text)
    WITH CHECK ("workspaceId" = current_setting('app.current_workspace_id', true)::text);
```

**Template + BrandConfig RLS pattern** — copy this block twice, change table names:
```sql
-- Appended manually after `prisma migrate dev --name add_template_brand_config` generates the file
ALTER TABLE "template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "template" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "template"
    USING ("workspaceId" = current_setting('app.current_workspace_id', true)::text)
    WITH CHECK ("workspaceId" = current_setting('app.current_workspace_id', true)::text);

ALTER TABLE "brand_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brand_config" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "brand_config"
    USING ("workspaceId" = current_setting('app.current_workspace_id', true)::text)
    WITH CHECK ("workspaceId" = current_setting('app.current_workspace_id', true)::text);
```

**Workflow:** `prisma migrate dev` generates `CREATE TABLE` SQL. Then append these RLS lines to the generated file before applying to any live environment.

---

### `apps/web/src/app/w/[slug]/templates/page.tsx` (component, request-response)

**Analog:** `apps/web/src/app/w/[slug]/members/page.tsx`

**Page shape pattern** (lines 21-46) — RSC, `params: Promise<{ slug: string }>`, `requireWorkspace` at top, inline server actions:
```typescript
interface MembersPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ inviteUrl?: string }>;
}

export default async function MembersPage({
  params,
  searchParams,
}: MembersPageProps) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);

  async function inviteAction(formData: FormData): Promise<void> {
    "use server";
    const email = String(formData.get("email") ?? "");
    ...
    redirect(`/w/${slug}/members?inviteUrl=...`);
  }

  // Fetch data server-side
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "asc" },
  });
  ...
  return (<div>...</div>);
}
```

**Differences for templates list page:**
- Use `withTenantDb` instead of raw `prisma` for template reads (template table is RLS-protected unlike workspaceMember for identity lookups)
- Import and call `listTemplatesAction` (or fetch inside `withTenantDb` directly)
- Render `<TemplateCard>` components in a grid, not a table
- Role gate for create button: `can(ctx.role, "template", "create")`

---

### `apps/web/src/app/w/[slug]/templates/new/page.tsx` and `[id]/edit/page.tsx` (component, request-response)

**Analog:** `apps/web/src/app/w/[slug]/members/page.tsx`

**Pattern:** RSC wrapper that fetches initial data and passes it to a `"use client"` island (`TemplateEditor`). Uses `requireWorkspaceRole` with `["owner", "admin", "editor"]` (not just `requireWorkspace`) to gate access.

```typescript
// Pattern from members/page.tsx lines 26-46:
export default async function TemplateNewPage({ params }) {
  const { slug } = await params;
  // Gate: editors can author templates (D-09)
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);
  // Pass ctx.workspaceId and slug to client island (never trust client payload)
  return <TemplateEditor slug={slug} workspaceId={ctx.workspaceId} />;
}
```

For `/[id]/edit/page.tsx` — additionally fetch the existing template via `withTenantDb` before rendering:
```typescript
const template = await withTenantDb({ workspaceId: ctx.workspaceId }, (db) =>
  db.template.findById(id)
);
if (!template) redirect(`/w/${slug}/templates`);
// Pass template as initial data to TemplateEditor
```

---

### `apps/web/src/app/w/[slug]/brand/page.tsx` (component, request-response)

**Analog:** `apps/web/src/app/w/[slug]/members/page.tsx`

**Pattern:** Same RSC shape. Fetch existing brand config via `withTenantDb`, pass to `BrandConfigForm` client island.

```typescript
const ctx = await requireWorkspace(slug);
// All roles can read brand (permissions.ts: brand: ["read", "update"] for owner/admin/editor, ["read"] for viewer)
const brandConfig = await withTenantDb({ workspaceId: ctx.workspaceId }, (db) =>
  db.brandConfig.findFirst({ where: { workspaceId: ctx.workspaceId } })
);
return <BrandConfigForm slug={slug} initial={brandConfig} canEdit={can(ctx.role, "brand", "update")} />;
```

---

### `apps/web/src/app/w/[slug]/layout.tsx` (modify — add shadcn sidebar nav)

**Analog:** itself (lines 20-68 — current inline-style nav):
```typescript
export default async function WorkspaceLayout({ children, params }) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);

  return (
    <div>
      <nav style={{ padding: "0.75rem 1.5rem", borderBottom: "1px solid #e5e7eb", ... }}>
        <span style={{ fontWeight: "600" }}>PageForge</span>
        <span style={{ color: "#9ca3af" }}>/</span>
        <span>{ctx.workspaceSlug}</span>
        <span style={{ marginLeft: "auto", ... }}>{ctx.role}</span>
      </nav>
      <main style={{ padding: "1.5rem" }}>{children}</main>
    </div>
  );
}
```

**Modification pattern:** Replace inline-style `<nav>` with shadcn layout (2-column: sidebar 240px + main content). The `requireWorkspace` call, `params` destructuring, and server-component shape remain identical.

---

### `apps/web/src/components/templates/TemplateEditor.tsx` (component, event-driven)

**Analog:** `apps/web/src/app/invitations/[id]/AcceptButton.tsx`

**Client island directive + imports pattern** (lines 1-25):
```typescript
"use client";
/**
 * AcceptButton — client island for accepting a workspace invitation.
 * ...Security (T-02-07-01, T-02-07-02):
 * - invitationId comes from server-rendered props...
 */
import { useState, useTransition } from "react";
import { acceptInvitationAction } from "@/lib/workspaces/actions";
```

**Pending state + server action call pattern** (lines 30-62):
```typescript
export function AcceptButton({ invitationId }: AcceptButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvitationAction(invitationId);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={isPending}>
        {isPending ? "Accepting…" : "Accept invitation"}
      </button>
      {error !== null && <p role="alert">{error}</p>}
    </div>
  );
}
```

**TemplateEditor differences:**
- Add `parse` import from `pageforge-engine` — client-side live parse (browser-safe)
- Use `useRef` + `useCallback` for debounce timer (400ms per UI-SPEC)
- State: `markup`, `name`, `liveSchema` (ParsedSchema | null), `isParsing`, `metadataOverlay`
- `useTransition` for save pending state (same pattern as AcceptButton)
- Debounce pattern from RESEARCH.md Pattern 8:
  ```typescript
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const triggerLiveParse = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try { setLiveSchema(parse(markup)); }
      catch { setLiveSchema(null); }
    }, 400);
  }, [markup]);
  ```

---

### `apps/web/src/components/brand/BrandConfigForm.tsx` (component, event-driven)

**Analog:** `apps/web/src/app/(auth)/login/page.tsx`

**Client form pattern** (lines 1-115) — `"use client"`, `useState` for form fields, pending state, error handling:
```typescript
"use client";

import { useState } from "react";

type FormState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };

export default function LoginPage() {
  const [formState, setFormState] = useState<FormState>({ status: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormState({ status: "loading" });
    const form = event.currentTarget;
    const data = new FormData(form);
    ...
    // on error:
    setFormState({ status: "error", message: result.error.message ?? "..." });
  }

  return (
    <main>
      {formState.status === "error" && <p role="alert">{formState.message}</p>}
      <form onSubmit={handleSubmit}>
        ...
        <button type="submit" disabled={formState.status === "loading"}>
          {formState.status === "loading" ? "Saving…" : "Save Brand Settings"}
        </button>
      </form>
    </main>
  );
}
```

**BrandConfigForm differences:**
- Use `useTransition` instead of manual `status` state (aligns with AcceptButton pattern — the preferred server-action call pattern in this codebase)
- Add live hex color swatch: `useState<string>` for `primaryColor`, derive swatch background color inline
- Validate `primaryColor` on blur: `/^#[0-9a-fA-F]{6}$/`

---

### `apps/web/next.config.ts` (modify — add transpilePackages)

**Analog:** itself (lines 1-8):
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

**Modification pattern** — add `transpilePackages` array:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["pageforge-engine"],
};

export default nextConfig;
```

---

### `apps/web/tests/templates.test.ts` (test)

**Analog:** `apps/web/tests/workspaces.test.ts`

**Test file structure** (lines 14-30) — vitest imports, describe blocks, vi.doMock for DB isolation:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CreateWorkspaceSchema,
  UpdateWorkspaceSchema,
  type CreateWorkspaceInput,
} from "@/lib/workspaces/schema";

describe("CreateWorkspaceSchema", () => {
  it("accepts a valid name and slug", () => { ... });
  it("rejects an empty name", () => { ... });
});
```

**vi.doMock for DB isolation** (lines 426-446):
```typescript
beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.clearAllMocks(); vi.resetModules(); });

it("returns an empty array when the user has no memberships", async () => {
  vi.doMock("@/lib/db/prisma", () => ({
    prisma: {
      member: { findMany: vi.fn().mockResolvedValue([]) },
    },
  }));
  const { getUserWorkspaces } = await import("@/lib/workspaces/listing");
  const result = await getUserWorkspaces("user-with-no-memberships");
  expect(result).toEqual([]);
});
```

**Source code assertion pattern** (lines 307-325) — for proving invariants without a live DB:
```typescript
it("sets app.current_workspace_id before workspace insert (RLS backstop)", async () => {
  const fs = await import("fs");
  const path = await import("path");
  const source = fs.readFileSync(
    path.join(__dirname, "../src/lib/workspaces/actions.ts"), "utf-8"
  );
  expect(source).toContain("set_config('app.current_workspace_id'");
});
```

**Tests to include for templates:**
- `CreateTemplateSchema` / `UpdateTemplateSchema` validation (name required, markup required)
- `createTemplateAction` module exports callable function
- `schemaVersion: { increment: 1 }` present in `updateTemplateAction` source
- `requireWorkspaceRole` called with `["owner", "admin", "editor"]` in template actions
- `parse(markup)` called inside save actions (source code assertion)

---

### `apps/web/tests/brand.test.ts` (test)

**Analog:** `apps/web/tests/workspaces.test.ts`

Same structure as templates.test.ts. Key test cases:
- `SaveBrandConfigSchema` validates hex color regex and https:// URL
- `saveBrandConfigAction` uses upsert (source code assertion: `upsert` present in brand actions source)
- editor can update brand — `can("editor", "brand", "update")` returns true
- viewer cannot update brand — `can("viewer", "brand", "update")` returns false

---

### `apps/web/tests/metadata.test.ts` (test)

**Analog:** `apps/web/tests/workspaces.test.ts` (schema validation block, lines 26-126)

This is the simplest test file — `reconcileMetadataOverlay` is a pure function with no DB or server dependencies, so no mocking needed:
```typescript
import { describe, it, expect } from "vitest";
import { reconcileMetadataOverlay } from "@/lib/templates/metadata";

describe("reconcileMetadataOverlay (D-05)", () => {
  it("keeps metadata for fields that still exist", () => { ... });
  it("drops metadata for removed fields", () => { ... });
  it("creates defaults (label = field.name, required = false) for new fields", () => { ... });
  it("excludes brand.* global fields (field.global === true)", () => { ... });
});
```

---

### `apps/web/tests/schema-conventions.test.ts` (modify — uncomment models)

**Analog:** itself, lines 46-57:
```typescript
const TENANT_OWNED_MODELS: string[] = [
  "TenantIsolationProbe",
  // ---- Phase 3: add these when introducing the models ----
  // "Template",
  // "BrandConfig",
  ...
];
```

**Modification:** Uncomment `"Template"` and `"BrandConfig"` in the same task that adds the Prisma models. The test already contains the exact expected assertion logic — no new test code needed.

---

## Shared Patterns

### RBAC Guard in Server Actions
**Source:** `apps/web/src/lib/workspaces/actions.ts` lines 171-176 and 258-259
**Apply to:** All files in `lib/templates/actions.ts`, `lib/brand/actions.ts`
```typescript
// Template actions (owner/admin/editor can create/update/delete templates):
const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

// Brand actions (owner/admin/editor can update brand):
const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);
```
`ctx.workspaceId` is then the only safe source for `withTenantDb` — never use a client-provided workspaceId.

### Zod Validation + fieldErrors in Server Actions
**Source:** `apps/web/src/lib/workspaces/actions.ts` lines 66-75
**Apply to:** All Server Actions that accept structured input
```typescript
const parsed = CreateWorkspaceSchema.safeParse(input);
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

### withTenantDb Transaction Pattern
**Source:** `apps/web/src/lib/db/tenant-db.ts` lines 90-138
**Apply to:** All template and brand config reads and writes
```typescript
return withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
  // db.template.create / db.template.findById / db.template.list / etc.
  // db exposes only tenant-scoped helpers — never raw tx
  return { ok: true, data: result };
});
```
The `withTenantDb` function opens a transaction, sets `app.current_workspace_id` via `set_config`, then calls the callback with a `TenantClient`.

### ActionResult Type
**Source:** `apps/web/src/lib/workspaces/actions.ts` lines 37-39
**Apply to:** All Server Actions
```typescript
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
```
Import from `@/lib/workspaces/actions` — do not redefine.

### RSC Page Shape
**Source:** `apps/web/src/app/w/[slug]/members/page.tsx` lines 21-46
**Apply to:** All new pages under `apps/web/src/app/w/[slug]/`
```typescript
interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);  // or requireWorkspaceRole for gated pages
  // Fetch server-side data...
  return <ClientIsland slug={slug} data={fetchedData} />;
}
```
The layout at `w/[slug]/layout.tsx` already calls `requireWorkspace`, but pages re-call it to access `ctx.workspaceId` and `ctx.role` for rendering decisions and data fetching.

### Client Island Pattern
**Source:** `apps/web/src/app/invitations/[id]/AcceptButton.tsx` lines 1-62
**Apply to:** `TemplateEditor.tsx`, `BrandConfigForm.tsx`, `DeleteTemplateDialog.tsx`
```typescript
"use client";

import { useState, useTransition } from "react";
import { someAction } from "@/lib/something/actions";

export function ClientIsland({ propFromServer }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAction() {
    setError(null);
    startTransition(async () => {
      const result = await someAction(propFromServer);
      if (!result.ok) { setError(result.error); }
    });
  }

  return (
    <button onClick={handleAction} disabled={isPending}>
      {isPending ? "Loading…" : "Action"}
    </button>
  );
}
```

### RLS SQL Block
**Source:** `apps/web/prisma/migrations/0002_rls_real_tenant_tables/migration.sql` lines 14-18
**Apply to:** New migration SQL file for `template` and `brand_config` tables
```sql
ALTER TABLE "<tablename>" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "<tablename>" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "<tablename>"
    USING ("workspaceId" = current_setting('app.current_workspace_id', true)::text)
    WITH CHECK ("workspaceId" = current_setting('app.current_workspace_id', true)::text);
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/src/components/templates/SchemaPanel.tsx` | component | event-driven | No existing live-feedback/read-only display panel components exist. Closest structural reference is `AcceptButton.tsx` for the client island shape, but the actual panel content (field list, badge rendering, parse warning chips) has no analog. Use shadcn `<Badge>` + `<Alert>` components and the UI-SPEC field/badge color map. |
| `apps/web/src/components/templates/TemplateCard.tsx` | component | request-response | No card-based list components exist yet (Phase 2 used plain tables). First use of shadcn `<Card>`. Follow UI-SPEC for card structure (header name + version badge, body field count, footer Edit button + kebab). |

---

## Metadata

**Analog search scope:** `apps/web/src/lib/`, `apps/web/src/app/`, `apps/web/tests/`, `apps/web/prisma/`, `apps/web/next.config.ts`, `src/engine/`
**Files scanned:** 26
**Pattern extraction date:** 2026-06-05
