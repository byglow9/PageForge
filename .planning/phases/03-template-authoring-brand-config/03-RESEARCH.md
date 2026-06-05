# Phase 3: Template Authoring + Brand Config - Research

**Researched:** 2026-06-05
**Domain:** Next.js 16 App Router — template authoring UI, Prisma 7 jsonb schema, engine integration, shadcn/ui + Tailwind v4 bootstrap
**Confidence:** HIGH (all critical claims verified against codebase, official docs, or npm registry)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Authoring uses a code editor + live side panel. Exact editor library is researcher/planner call.
- **D-02:** Authoritative parse runs on save. Live feedback is advisory.
- **D-03:** Tolerant parse — unknown types degrade to `text` with a warning. Authors can save a template with warnings.
- **D-04:** Per-field metadata: friendly `label` + `required` flag per field. Stored as an app-level overlay keyed by field name. Engine's `ParsedSchema` stays pure.
- **D-05:** On edit/re-parse, overlay is reconciled: keep matched-by-name, drop removed, create defaults (label = field name, required = false) for new fields.
- **D-06:** `required` is the only field-level validation in v1.
- **D-07:** Brand config is a fixed set: `logo`, `primary_color`, `whatsapp`.
- **D-08:** Logo is a pasted URL in v1 — no S3/image upload.
- **D-09:** Brand config is one record per workspace, editable by owner/admin/editor (all three have `brand: ["read", "update"]` in permissions.ts).
- **D-10:** `schema_version` is a monotonically incrementing integer per template per save.
- **D-11:** Phase 3 does not migrate downstream LPs on schema change.

### Claude's Discretion

- Exact editor library (plain textarea vs. CodeMirror/Monaco).
- Whether live parse runs client-side or via debounced Server Action.
- Exact Prisma schema shape for Template and BrandConfig tables.
- Whether metadata overlay is inline in the same jsonb as the schema or separately stored.
- Template list UI presentation (table vs. cards — UI-SPEC locked to cards).
- Whether `brand.*` token presence surfaces to the author.

### Deferred Ideas (OUT OF SCOPE)

- Image upload for the logo (Phase 4 / AST-01).
- Dynamic form generation, preview, export (Phase 4).
- Migrating existing LPs on template schema change (Phase 4+).
- Free-form / arbitrary brand fields.
- Advanced field validation (v2 VAL-01).
- Template duplication / versioned schema history UI.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TPL-01 | User can create a template by writing markup with tokens | Editor UI + `createTemplateAction` Server Action + `parse()` on save |
| TPL-03 | User can assign a type to each token (text, richtext, image, color, button, repeater) | Engine `parse()` detects types from inline `:type` annotation; 6 types in `FieldTypeSchema` |
| TPL-05 | User can edit an existing template | `updateTemplateAction` + `/w/[slug]/templates/[id]/edit` route + `schema_version` increment |
| TPL-06 | Templates are listed and selectable within the workspace | `listTemplatesAction` + `/w/[slug]/templates` page + card grid UI |
| BRD-01 | User can configure global brand/contact values per workspace | `saveBrandConfigAction` + `/w/[slug]/brand` page + `BrandConfig` table (upsert) |
| BRD-02 | Templates can reference global brand values | `brand.*` tokens already resolved by engine's `render()` at Phase 4 render time; Phase 3 persists the brand config that render() will consume |
</phase_requirements>

---

## Summary

Phase 3 introduces the first UI layer in the Next.js app — templating authoring pages, brand config pages, and the shadcn/ui + Tailwind v4 design system — on top of the tenant isolation layer established in Phase 2. The primary technical work is: (1) wiring `apps/web` to consume `pageforge-engine`'s `parse()` function, (2) adding `Template` and `BrandConfig` Prisma models with `jsonb` storage and RLS policies, (3) building Server Actions for CRUD behind `withTenantDb`, and (4) implementing a plain `<textarea>`-based authoring editor with client-side debounced live parse feedback.

The engine's `parse()` function is **cleanly bundleable for the browser**: it imports only from `./schema.js` (pure Zod) and uses only JavaScript regex — no Node.js APIs, no `sanitize-html`, no filesystem access. `sanitize-html` only enters through `renderer.ts`, which Phase 3 does not import. This makes client-side live parse the correct choice: debounce parse calls in the browser, avoid a round-trip Server Action for every keystroke.

The editor choice for MVP is **plain `<textarea>` (shadcn `<Textarea>`)** with `font-mono`. The UI-SPEC has already locked this: "plain `<Textarea>` with resize-y disabled, `h-full`" and "no syntax highlighting in v1". CodeMirror or Monaco would add complexity and bundle weight with no v1 benefit.

**Primary recommendation:** Plain `<textarea>` + client-side debounced `parse()` + Server Actions for save/list/delete/brand-save, all behind `withTenantDb` + `requireWorkspaceRole`. Prisma `Json` columns for `schema` and `metadataOverlay`, separate columns (not merged jsonb blob).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Template list page | Frontend Server (SSR) | — | RSC fetches templates via `withTenantDb` on server before render |
| Template editor UI | Browser / Client | Frontend Server (SSR) | Client island handles textarea state, debounced parse, metadata toggle; SSR renders initial data |
| Live parse feedback | Browser / Client | — | `parse()` is pure JS, bundle-safe; run in browser on debounce, no server round-trip |
| Save template (parse + persist) | API / Backend (Server Action) | — | Authoritative parse on server; increment `schema_version`; write `withTenantDb` |
| Brand config form | Browser / Client | Frontend Server (SSR) | Client island for hex color preview; SSR renders current brand values |
| Save brand config | API / Backend (Server Action) | — | Upsert `BrandConfig` via `withTenantDb` |
| Metadata overlay reconciliation | API / Backend (Server Action) | — | Reconcile overlay against save-time schema on server, never client |
| shadcn/ui component rendering | Browser / Client | Frontend Server (SSR) | shadcn components are RSC-compatible by default; interactive ones are client islands |
| RBAC enforcement | API / Backend (Server Action) | Frontend Server (SSR) | `requireWorkspaceRole` in Server Actions is authoritative; layout guard for page access |

---

## Standard Stack

### Core (already installed in apps/web)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js (App Router) | 16.2.7 | Full-stack framework | [VERIFIED: apps/web/package.json] |
| Prisma + @prisma/adapter-pg | 7.8.0 | ORM + migrations | [VERIFIED: apps/web/package.json] |
| Zod | 4.4.3 | Schema + Server Action validation | [VERIFIED: apps/web/package.json] |
| React | 19.0.0 | UI runtime | [VERIFIED: apps/web/package.json] |

### New — Phase 3 installs
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui (CLI) | 4.10.0 (latest) | Component scaffolding + Tailwind v4 wiring | Init at phase start; adds components.json + globals.css |
| tailwindcss | 4.3.0 (latest) | Utility CSS | Installed and configured by `shadcn@latest init` |
| tw-animate-css | latest | Animations (replaces tailwindcss-animate in v4) | shadcn init handles this automatically |
| lucide-react | bundled by shadcn | Icons | Included with shadcn init; no separate install |

[VERIFIED: npm registry — shadcn@4.10.0, tailwindcss@4.3.0 as of 2026-06-05]

### Engine Workspace Dependency (net-new integration)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| pageforge-engine | workspace:* | `parse()` + types | Root package (pnpm workspace `.`) — add to apps/web dependencies |

[VERIFIED: pnpm-workspace.yaml lists `.` as workspace package; root package.json name is `pageforge-engine`]

### shadcn Components to Install (from UI-SPEC, exact list)
```bash
pnpm dlx shadcn@latest add button input textarea label badge card separator dialog alert tooltip switch skeleton sonner
```

### Installation Sequence
```bash
# Step 1: Init shadcn (run from apps/web directory)
cd apps/web && pnpm dlx shadcn@latest init
# Select: neutral palette, system font, standard radius (matches UI-SPEC preset)

# Step 2: Wire pageforge-engine workspace dependency
# In apps/web/package.json, add to dependencies:
#   "pageforge-engine": "workspace:*"
# Then install:
pnpm install

# Step 3: Add transpilePackages to next.config.ts (see Patterns below)

# Step 4: Install shadcn components (one command)
pnpm dlx shadcn@latest add button input textarea label badge card separator dialog alert tooltip switch skeleton sonner

# Step 5: Create Prisma migration for Template + BrandConfig models
cd apps/web && pnpm prisma migrate dev --name add_template_brand_config
```

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Client Island)
  │  textarea value change
  │  debounce(400ms)
  ▼
parse(markup) [pageforge-engine, bundle-safe]
  │  ParsedSchema { fields, repeaters, globals, warnings }
  ▼
Schema Panel UI update (React state)

Browser (User clicks "Save Template")
  │  { name, markup, metadataOverlay }
  ▼
Server Action: createTemplateAction / updateTemplateAction
  │  1. requireWorkspaceRole(slug, ["owner","admin","editor"])
  │  2. Zod validate input
  │  3. parse(markup) → authoritative ParsedSchema
  │  4. reconcileMetadataOverlay(schema.fields, existingOverlay)
  │  5. withTenantDb → tx.template.create/update (increment schema_version)
  │  Returns: { ok: true, data: { id, schemaVersion } }
  ▼
Server Component (RSC) re-render / client state update
  │  toast "Template saved — schema vN"
  ▼
Template List Page (RSC)
  Server: withTenantDb → db.template.list({ workspaceId })
  Client: Card grid + Delete dialog
```

### Recommended Project Structure
```
apps/web/src/
├── app/w/[slug]/
│   ├── layout.tsx                    # existing workspace shell — UPGRADE with shadcn Sidebar
│   ├── page.tsx                      # existing dashboard — update links
│   ├── templates/
│   │   ├── page.tsx                  # TPL-06: template list (RSC)
│   │   ├── new/
│   │   │   └── page.tsx              # TPL-01: new template editor (RSC wrapper)
│   │   └── [id]/
│   │       └── edit/
│   │           └── page.tsx          # TPL-05: edit template editor (RSC wrapper)
│   └── brand/
│       └── page.tsx                  # BRD-01: brand config (RSC wrapper)
├── components/
│   ├── ui/                           # shadcn-generated components (DO NOT EDIT)
│   └── templates/
│       ├── TemplateEditor.tsx        # client island: textarea + schema panel + metadata
│       ├── TemplateCard.tsx          # template card for list grid
│       ├── SchemaPanel.tsx           # live parse results display
│       └── DeleteTemplateDialog.tsx  # confirm delete dialog
├── components/brand/
│   └── BrandConfigForm.tsx           # client island: brand form + hex swatch
└── lib/
    └── templates/
        ├── actions.ts                # createTemplateAction, updateTemplateAction, deleteTemplateAction, listTemplatesAction
        ├── schema.ts                 # Zod: CreateTemplateSchema, UpdateTemplateSchema
        ├── tenant-helpers.ts         # TenantTemplateHelpers added to TenantClient
        ├── metadata.ts               # reconcileMetadataOverlay() pure function
    └── brand/
        ├── actions.ts                # getBrandConfigAction, saveBrandConfigAction
        ├── schema.ts                 # Zod: SaveBrandConfigSchema
        └── tenant-helpers.ts         # TenantBrandHelpers added to TenantClient
```

### Pattern 1: Engine Workspace Dependency + transpilePackages

The `pageforge-engine` package is at the monorepo root (`package.json` name = `pageforge-engine`, `type: module`, `moduleResolution: NodeNext`). `apps/web` uses `moduleResolution: bundler`. Without `transpilePackages`, Next.js may not transpile the engine's ESM source imports (`.js` extension in source files).

**Step 1 — apps/web/package.json: add dependency**
```json
{
  "dependencies": {
    "pageforge-engine": "workspace:*"
  }
}
```

**Step 2 — apps/web/next.config.ts: add transpilePackages**
```typescript
// Source: nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["pageforge-engine"],
};

export default nextConfig;
```

**Step 3 — import in Server Action or client component**
```typescript
// Server Action (server-side parse on save)
import { parse } from "pageforge-engine";
import type { ParsedSchema } from "pageforge-engine";

// Client component (live parse feedback)
// "use client"
import { parse } from "pageforge-engine";
```

The engine's `parse()` and its transitive imports (`schema.ts` via Zod) are browser-safe:
- No `fs`, `path`, `crypto`, or Node built-ins
- No `sanitize-html` (that is only in `renderer.ts`, not imported by `parser.ts`)
- Pure regex + Zod validation

[VERIFIED: src/engine/parser.ts imports only `./schema.js`; src/engine/schema.ts imports only `zod`]

### Pattern 2: Prisma Schema — Template Model

```prisma
/// Template — user-authored markup template, workspace-scoped.
/// schema is the ParsedSchema JSON derived at save time.
/// metadataOverlay is the per-field label/required overlay (D-04).
/// RLS policy: workspaceId = current_setting('app.current_workspace_id', true)::text
model Template {
  id              String   @id @default(cuid())
  workspaceId     String
  name            String
  markup          String   @db.Text
  schema          Json     // ParsedSchema { fields, repeaters, globals, warnings }
  metadataOverlay Json     // Record<fieldName, { label: string, required: boolean }>
  schemaVersion   Int      @default(1)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
  @@map("template")
}
```

**Rationale for split jsonb (schema vs metadataOverlay):**
- `schema` is the pure engine output (ParsedSchema shape). Phase 4 reads only `schema` when building the form — it never needs the overlay shape.
- `metadataOverlay` is the app-level enrichment. Phase 4 reads it separately to enrich form fields.
- Keeping them separate avoids mixing engine types with app types in one blob, simplifies typed deserialization, and is cheap (both are small JSON objects).

[ASSUMED: separate columns vs. one merged blob. Both approaches work; separate is recommended for Phase 4 readability.]

### Pattern 3: Prisma Schema — BrandConfig Model

```prisma
/// BrandConfig — one record per workspace (upsert on save, D-09).
/// Fields map 1:1 to brand.* tokens (brand.logo, brand.primary_color, brand.whatsapp).
/// logoUrl is String? to allow "not configured yet" state.
/// RLS policy: workspaceId = current_setting('app.current_workspace_id', true)::text
model BrandConfig {
  id           String   @id @default(cuid())
  workspaceId  String   @unique  // one record per workspace
  logoUrl      String?
  primaryColor String?
  whatsapp     String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@map("brand_config")
}
```

**Why `@unique` on workspaceId:** The "one record per workspace" invariant is enforced at the DB level, enabling safe `upsert` without a separate lookup. The `saveBrandConfigAction` uses:
```typescript
prisma.brandConfig.upsert({
  where: { workspaceId },
  create: { workspaceId, logoUrl, primaryColor, whatsapp },
  update: { logoUrl, primaryColor, whatsapp },
})
```

### Pattern 4: Migration SQL — RLS Policies for New Tables

Each new tenant-owned table needs the same RLS pattern as existing tables (migration 0002). The new migration must include:

```sql
-- Migration: 0004_template_brand_config
-- (file: apps/web/prisma/migrations/0004_template_brand_config/migration.sql)
-- Prisma generates the CREATE TABLE statements; this file adds RLS on top.

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

**Migration workflow:** The project uses `prisma migrate dev` (not `db push`). The `--name` flag makes it non-interactive:
```bash
cd apps/web && pnpm prisma migrate dev --name add_template_brand_config
```
This generates the migration SQL file, then the RLS policies must be appended manually to that file (same pattern as 0002 and 0003).

[VERIFIED: apps/web/package.json `prisma:migrate` script = `prisma migrate dev`; migration files 0001–0003 exist with hand-appended RLS SQL]

### Pattern 5: Server Action Module (mirrors lib/workspaces/actions.ts)

```typescript
// apps/web/src/lib/templates/actions.ts
"use server";
import { parse } from "pageforge-engine";
import type { ParsedSchema } from "pageforge-engine";
import { requireWorkspaceRole } from "@/lib/workspaces/guards";
import { withTenantDb } from "@/lib/db/tenant-db";
import { CreateTemplateSchema, UpdateTemplateSchema } from "./schema";
import { reconcileMetadataOverlay } from "./metadata";
import type { ActionResult } from "@/lib/workspaces/actions"; // re-use ActionResult type

export async function createTemplateAction(
  slug: string,
  input: { name: string; markup: string; metadataOverlay?: Record<string, { label: string; required: boolean }> }
): Promise<ActionResult<{ id: string; schemaVersion: number }>> {
  // RBAC: owner, admin, editor can create templates (from permissions.ts)
  const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);

  const parsed = CreateTemplateSchema.safeParse(input);
  if (!parsed.success) { /* fieldErrors */ }

  // Authoritative parse on server (D-02)
  const schema: ParsedSchema = parse(parsed.data.markup);
  const overlay = reconcileMetadataOverlay(schema.fields, parsed.data.metadataOverlay ?? {});

  return withTenantDb({ workspaceId: ctx.workspaceId }, async (db) => {
    const template = await db.template.create({
      name: parsed.data.name,
      markup: parsed.data.markup,
      schema,                    // ParsedSchema stored as Json
      metadataOverlay: overlay,  // Record<string, { label, required }> stored as Json
    });
    return { ok: true, data: { id: template.id, schemaVersion: template.schemaVersion } };
  });
}
```

### Pattern 6: Metadata Overlay Reconciliation (D-05)

The reconciliation algorithm is a pure function — no DB access, no side effects. Lives in `lib/templates/metadata.ts`.

```typescript
// apps/web/src/lib/templates/metadata.ts
import type { TokenField } from "pageforge-engine";

export interface FieldMeta {
  label: string;
  required: boolean;
}

export type MetadataOverlay = Record<string, FieldMeta>;

/**
 * Reconcile the metadata overlay against the current field set.
 * - Keep metadata for fields that still exist (match by field.name)
 * - Drop metadata for removed fields
 * - Create defaults (label = field.name, required = false) for new fields
 * - brand.* global fields (field.global === true) are excluded from the overlay
 *   (they have no user-editable metadata; brand config is separate)
 *
 * D-05: called on every save (server-side, authoritative).
 */
export function reconcileMetadataOverlay(
  fields: TokenField[],
  existing: MetadataOverlay
): MetadataOverlay {
  const result: MetadataOverlay = {};
  for (const field of fields) {
    if (field.global) continue; // brand.* tokens are not in the overlay
    result[field.name] = existing[field.name] ?? {
      label: field.name,
      required: false,
    };
  }
  return result;
}
```

**Note on global/brand fields:** `brand.*` fields have `global: true` in `TokenField`. They should NOT appear in the metadata overlay — they have no label/required metadata since they are always sourced from brand config. The reconcile function must skip them.

[VERIFIED: src/engine/schema.ts — `TokenField.global: boolean`; parser.ts sets `global = isBrandToken(tokenName)`]

### Pattern 7: TenantClient Extension

New tenant helpers for `Template` and `BrandConfig` are added to `TenantClient` in `tenant-db.ts`, following the `tenantIsolationProbe` pattern:

```typescript
// Addition to TenantClient interface in tenant-db.ts
export interface TenantClient {
  readonly workspaceId: string;
  readonly tenantIsolationProbe: TenantProbeHelpers;
  readonly template: TenantTemplateHelpers;   // Phase 3 addition
  readonly brandConfig: TenantBrandHelpers;   // Phase 3 addition
}
```

Each helper set follows the same shape: `create`, `findById`, `list`, `update`, `delete` — always injecting `workspaceId` into writes and filtering reads by `workspaceId`.

### Pattern 8: Live Parse — Client-Side Debounce

```typescript
// Inside TemplateEditor.tsx ("use client")
import { parse } from "pageforge-engine";
import type { ParsedSchema } from "pageforge-engine";
import { useCallback, useRef, useState } from "react";

const DEBOUNCE_MS = 400; // matches UI-SPEC

function useDebounced(fn: () => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  return useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(fn, delay);
  }, [fn, delay]);
}

// In component:
const [liveSchema, setLiveSchema] = useState<ParsedSchema | null>(null);
const [isParsing, setIsParsing] = useState(false);

const triggerLiveParse = useDebounced(() => {
  try {
    const schema = parse(markupValue);
    setLiveSchema(schema);
  } catch {
    // parse() only throws on internal Zod validation failure (pathological)
    // treat as "no schema" in live mode
    setLiveSchema(null);
  } finally {
    setIsParsing(false);
  }
}, DEBOUNCE_MS);
```

### Anti-Patterns to Avoid

- **Raw `prisma` client in feature modules:** All Template/BrandConfig reads and writes MUST go through `withTenantDb` → `TenantClient`. The `prisma` singleton is for better-auth identity lookup only.
- **workspaceId from client payload:** Always derive from `requireWorkspaceRole(slug, roles)` return value. Never trust `workspaceId` from form input.
- **Calling `render()` in Phase 3:** Phase 3 only calls `parse()`. `render()` (which imports `sanitize-html`, a Node-only package) belongs exclusively in Phase 4's LP generation.
- **Unchecked JSON deserialization from DB:** When reading `schema` or `metadataOverlay` from Prisma, validate with Zod (`ParsedSchemaSchema.parse(template.schema)`) before using. Prisma returns `Json` as `unknown`.
- **Nested `<form>` elements:** The metadata overlay section lives inside the template editor — do not nest forms. Use separate `action` calls or a unified form.
- **Using `db push` instead of `migrate dev`:** `prisma db push` skips migration history; use `migrate dev --name` to generate a named migration file.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-tenant data isolation | Custom WHERE clauses sprinkled in actions | `withTenantDb` → `TenantClient` helper | RLS backstop only works when `app.current_workspace_id` is set in transaction |
| Role gate in Server Actions | `if (role === 'editor')` inline checks | `requireWorkspaceRole(slug, roles)` | Consistent redirect behavior; authoritative role from session, not client |
| JSON schema validation after DB read | `as ParsedSchema` type cast | `ParsedSchemaSchema.parse(row.schema)` | DB Json is `unknown`; cast bypasses Zod guarantee |
| "One brand record per workspace" uniqueness | Application-level check + insert | `@unique` on `workspaceId` + Prisma `upsert` | Atomic at DB level; avoids race condition |
| Custom debounce timer logic | Manual `setTimeout` with closure | `useRef` + `useCallback` pattern (see Pattern 8) | Standard React pattern; no extra library needed for simple debounce |
| Token type detection | Custom regex in UI | Import `parse()` from `pageforge-engine` | Engine already handles all 6 types + tolerant degradation + deduplication |

**Key insight:** The engine (`parse()`) and tenant isolation layer (`withTenantDb` + `requireWorkspaceRole`) are the two reusable systems this phase assembles — not builds. All new code is wiring and UI.

---

## Common Pitfalls

### Pitfall 1: engine's `renderer.ts` pulled into the browser bundle
**What goes wrong:** `import { render } from "pageforge-engine"` in a client component pulls in `renderer.ts` → `sanitizers.ts` → `sanitize-html`, which requires Node.js APIs. Build fails or bundle bloats.
**Why it happens:** `pageforge-engine`'s `index.ts` re-exports both `parse` and `render`. Bundler tree-shakes, but only if the import is named and the module has no side effects.
**How to avoid:** In client components, import only `parse`:
```typescript
import { parse } from "pageforge-engine"; // OK in "use client"
// NEVER: import { render } from "pageforge-engine" in a client component
```
In Server Actions, `render` is fine (server-only). Consider adding `"sideEffects": false` to the engine's package.json to help tree-shaking.
**Warning signs:** Build error mentioning `sanitize-html`, `readable-stream`, or `node:fs`; or `window is not defined` in sanitizers.

### Pitfall 2: RLS policies not applied to new tables → cross-tenant data leak
**What goes wrong:** Template or BrandConfig rows are created but RLS is never enabled on their tables. `withTenantDb` sets `app.current_workspace_id` but no policy enforces it — every query returns all workspaces' data.
**Why it happens:** Prisma `migrate dev` generates CREATE TABLE but never generates RLS policies (not representable in Prisma schema syntax).
**How to avoid:** Always append the RLS SQL block to the generated migration file immediately after `migrate dev` creates it, before applying to any live environment. Follow the 0002 pattern exactly.
**Warning signs:** The schema-conventions test will pass (it only checks `workspaceId` field presence), but cross-tenant integration tests (apps/web/tests/tenant-isolation.test.ts) will catch missing RLS.

### Pitfall 3: `schema_version` not incremented on update
**What goes wrong:** Every save overwrites the schema without bumping `schemaVersion`. Phase 4 cannot detect "this LP was generated against an old schema."
**Why it happens:** `prisma.template.update({ data: { schema: ..., markup: ... } })` without explicit `schemaVersion: { increment: 1 }`.
**How to avoid:** Use Prisma's atomic increment:
```typescript
tx.template.update({
  where: { id },
  data: {
    markup,
    schema,
    metadataOverlay: overlay,
    schemaVersion: { increment: 1 },
  },
});
```
**Warning signs:** All templates show `v1` in the UI badge regardless of edit count.

### Pitfall 4: `brand.*` fields appearing in the metadata overlay
**What goes wrong:** `reconcileMetadataOverlay` includes `brand.logo`, `brand.primary_color`, `brand.whatsapp` in the overlay with label/required entries. Phase 4 form generation would show brand fields as editable form inputs — but they are sourced from brand config, not user input.
**Why it happens:** `field.global` is not checked during overlay reconciliation.
**How to avoid:** The reconcile function MUST skip fields where `field.global === true` (see Pattern 6).
**Warning signs:** Brand config form inputs appear duplicated in the LP generation form (Phase 4 symptom).

### Pitfall 5: shadcn init run inside wrong directory
**What goes wrong:** Running `pnpm dlx shadcn@latest init` from the monorepo root (`/PageForge/`) instead of `apps/web` creates `components.json` at the root and fails to wire `globals.css` correctly.
**Why it happens:** shadcn uses `cwd` to detect the project root and tsconfig `paths`.
**How to avoid:** Always run shadcn CLI from `apps/web/`. Alternatively, use `-c apps/web` flag.
**Warning signs:** `components.json` appears at monorepo root; `src/components/ui/` not created under `apps/web`.

### Pitfall 6: `schema-conventions.test.ts` fails because TENANT_OWNED_MODELS not updated
**What goes wrong:** After adding `Template` and `BrandConfig` to `schema.prisma`, the Phase 2 schema convention test (`apps/web/tests/schema-conventions.test.ts`) fails because `TENANT_OWNED_MODELS` still has those models commented out.
**Why it happens:** The test already anticipates Phase 3 models but they are commented out. The comment says "add before implementing."
**How to avoid:** Uncomment `"Template"` and `"BrandConfig"` in `TENANT_OWNED_MODELS` in the same task that adds the Prisma models. The test then validates that both models carry `workspaceId`.
**Warning signs:** `vitest run` in `apps/web` shows the schema convention test throwing "Model Template is listed as tenant-owned but does not exist in schema.prisma."

### Pitfall 7: `parse()` throws on pathological input — unhandled in client component
**What goes wrong:** `parse()` can throw if Zod's final `ParsedSchemaSchema.parse()` fails (internal invariant — extremely unlikely but possible). An unhandled throw in the debounced client parse crashes the React component.
**Why it happens:** Parser wraps the result in `ParsedSchemaSchema.parse(raw)` and throws if it fails.
**How to avoid:** Wrap the live parse call in try/catch; treat an error as "no live schema" (show spinner or no fields).

---

## Code Examples

### Prisma `Json` Column Read + Zod Validation
```typescript
// Source: verified against existing Prisma 7 generated types (apps/web/src/generated/prisma/)
// Prisma Json type is typed as: Prisma.JsonValue = string | number | boolean | null | Prisma.JsonObject | Prisma.JsonArray
import { ParsedSchemaSchema } from "pageforge-engine";
// or from the generated types if engine is not imported on server:
// import type { ParsedSchema } from "pageforge-engine";

const row = await tx.template.findFirst({ where: { id, workspaceId } });
if (!row) return null;

// Zod validates and narrows the unknown Json to ParsedSchema
const schema = ParsedSchemaSchema.parse(row.schema);
// schema is now fully typed as ParsedSchema
```

### Prisma `schema_version` Atomic Increment
```typescript
// Source: Prisma docs atomic operations on numeric fields
await tx.template.update({
  where: { id, workspaceId }, // always include workspaceId for app-level isolation
  data: {
    markup,
    schema: schema as object,       // Prisma Json accepts any serializable object
    metadataOverlay: overlay as object,
    schemaVersion: { increment: 1 },
    updatedAt: new Date(),
  },
});
```

### shadcn init — Neutral Preset (from UI-SPEC)
```bash
# From apps/web/ directory:
pnpm dlx shadcn@latest init
# CLI prompts:
#   Which color would you like to use as the base color? → neutral
#   Would you like to use CSS variables for theming? → yes
# This installs tailwindcss@4.x, tw-animate-css, and creates components.json + globals.css
```

[CITED: ui.shadcn.com/docs/installation/next — init command and path alias requirement verified]

### `requireWorkspaceRole` for template actions
```typescript
// From permissions.ts (VERIFIED): editor has template: ["create","read","update","delete","duplicate"]
// brand has ["read","update"] for owner, admin, and editor
const ctx = await requireWorkspaceRole(slug, ["owner", "admin", "editor"]);
// ctx.workspaceId is now safe to use in withTenantDb
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| shadcn + tailwindcss-animate | shadcn + tw-animate-css | Tailwind v4 release | `tailwindcss-animate` deprecated; shadcn init handles this automatically |
| Separate `tailwind.config.js` | No config file needed (Tailwind v4 CSS-first) | Tailwind v4 | Config is in CSS (`@theme` directive in globals.css); no `tailwind.config.ts` needed |
| `forwardRef` in shadcn components | `data-slot` attributes, no forwardRef | shadcn v4-era | Components render correctly; no breaking change for users |
| CodeMirror 5 (monolithic) | CodeMirror 6 (modular) | 2021 | v6 is tree-shakable; but UI-SPEC locks plain textarea for v1 |
| `next-transpile-modules` | `transpilePackages` in next.config | Next.js 13+ | Built-in; `next-transpile-modules` is obsolete |

---

## Open Questions (RESOLVED)

1. **`pageforge-engine` exports field for tree-shaking**
   - What we know: engine's package.json has no `exports` field and no `dist/` directory. Next.js will transpile source directly via `transpilePackages`. Tree-shaking of `renderer.ts` depends on named imports.
   - What's unclear: whether `"sideEffects": false` needs to be added to the engine's package.json to help Next.js/webpack tree-shake `renderer.ts` when client components import only `parse`.
   - Recommendation: Add `"sideEffects": false` to root package.json at the start of Phase 3 as a safety measure. The planner should include this as a Wave 0 task.
   - **RESOLVED:** `"sideEffects": false` added to root package.json in plan 03-01 Task 1 as a Wave 0 safety measure.

2. **shadcn monorepo flag**
   - What we know: shadcn docs mention a `--monorepo` flag that separates UI components into a `@workspace/ui` package. UI-SPEC says "shadcn not yet installed — first UI-component phase."
   - What's unclear: whether to use `--monorepo` mode (components go to a separate package) or the simpler default (components go to `apps/web/src/components/ui/`).
   - Recommendation: Use default mode (no `--monorepo` flag). Only one app consumes these components; the added workspace complexity is not worth it in v1.
   - **RESOLVED:** `--monorepo` flag not used; standard `pnpm dlx shadcn@latest init` runs in `apps/web/` per plan 03-01, components land in `apps/web/src/components/ui/`.

3. **BrandConfig — Phase 2 isolation tests**
   - What we know: `apps/web/tests/tenant-isolation.test.ts` tests cross-tenant access. BrandConfig rows need to be covered by equivalent cross-tenant tests.
   - What's unclear: whether the existing isolation test scaffold automatically covers new models or needs explicit BrandConfig test cases.
   - Recommendation: The planner should include a task to add BrandConfig cross-tenant tests mirroring the existing Template ones.
   - **RESOLVED:** Explicit BrandConfig cross-tenant test cases added in plan 03-04 Task 2 as an extension to `tenant-isolation.test.ts` (new describe block "BrandConfig tenant isolation (Phase 3)").

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Engine transpile, Next.js | ✓ | (system) | — |
| pnpm | Package management | ✓ | (system) | — |
| PostgreSQL | Prisma + RLS | ✓ (Docker Compose) | 16+ | — |
| prisma CLI | Migrations | ✓ | 7.8.0 | — |
| shadcn CLI | Component scaffolding | fetched via `pnpm dlx` | 4.10.0 | — |

**Missing dependencies with no fallback:** None identified.

[VERIFIED: pnpm-workspace.yaml, apps/web/package.json, Docker Compose pattern noted in CLAUDE.md]

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter @pageforge/web test` |
| Full suite command | `pnpm --filter @pageforge/web test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TPL-01/05 | createTemplateAction validates input, calls parse, stores schema | unit | `pnpm --filter @pageforge/web test tests/templates.test.ts` | ❌ Wave 0 |
| TPL-01/05 | updateTemplateAction increments schemaVersion | unit | same | ❌ Wave 0 |
| TPL-03 | All 6 field types correctly reflected in persisted schema | unit (via parse) | `pnpm test` (engine tests cover this) | ✅ existing engine tests |
| BRD-01 | saveBrandConfigAction creates/updates one record per workspace | unit | `pnpm --filter @pageforge/web test tests/brand.test.ts` | ❌ Wave 0 |
| D-05 | reconcileMetadataOverlay keeps matched, drops removed, defaults new | unit | `pnpm --filter @pageforge/web test tests/metadata.test.ts` | ❌ Wave 0 |
| D-05 | reconcileMetadataOverlay excludes brand.* global fields | unit | same | ❌ Wave 0 |
| WS-05 cross-tenant | Template.findById returns null for wrong workspace | integration (requires live DB) | `pnpm --filter @pageforge/web test tests/tenant-isolation.test.ts` | ✅ (extend existing) |
| schema-conventions | Template and BrandConfig have workspaceId | unit | `pnpm --filter @pageforge/web test tests/schema-conventions.test.ts` | ✅ (uncomment models) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @pageforge/web test`
- **Per wave merge:** `pnpm --filter @pageforge/web test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/web/tests/templates.test.ts` — unit tests for createTemplateAction, updateTemplateAction, listTemplatesAction, deleteTemplateAction
- [ ] `apps/web/tests/brand.test.ts` — unit tests for saveBrandConfigAction, getBrandConfigAction
- [ ] `apps/web/tests/metadata.test.ts` — unit tests for reconcileMetadataOverlay (pure function, easiest to test)
- [ ] Uncomment `"Template"` and `"BrandConfig"` in `TENANT_OWNED_MODELS` in `apps/web/tests/schema-conventions.test.ts`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireVerifiedUser()` (already established, Phase 2) |
| V3 Session Management | yes | better-auth session (established, Phase 2) |
| V4 Access Control | yes | `requireWorkspaceRole(slug, roles)` — role from server session, never client |
| V5 Input Validation | yes | Zod schemas at all Server Action boundaries |
| V6 Cryptography | no | No cryptographic operations in this phase |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-workspace template access (IDOR) | Information Disclosure | `withTenantDb` injects `workspaceId` + RLS backstop; never fetch by `id` alone |
| Malicious markup in template (SSTI) | Tampering | `parse()` does not execute templates — no eval, no Liquid engine run; SSTI risk is at render time (Phase 4) |
| XSS via template name/metadata in UI | Tampering | React auto-escapes string values rendered in JSX; shadcn components use safe DOM APIs |
| Role escalation via forged slug | Elevation of Privilege | `requireWorkspaceRole` derives role from session membership, not slug; slug is a routing hint only |
| Hex color injection (primary_color) | Tampering | Validated server-side with Zod regex `/^#[0-9a-fA-F]{6}$/`; used only in brand token reference display in Phase 3 (no CSS injection risk until Phase 4 render) |
| URL injection (logoUrl) | Tampering | Validated server-side as valid `https://` URL; Phase 4 must sanitize before injecting into LP HTML |
| DB Json deserialization without validation | Tampering | Always validate Json columns via `ParsedSchemaSchema.parse()` — never cast `row.schema as ParsedSchema` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Separate `schema` and `metadataOverlay` jsonb columns is better than one merged blob | Prisma Schema Pattern | Low — both work; separate is easier to read in Phase 4 but merged also works |
| A2 | No `--monorepo` shadcn flag; components land in `apps/web/src/components/ui/` | Installation | Low — only one consuming app; monorepo mode adds complexity with no benefit |
| A3 | `"sideEffects": false` should be added to engine package.json for better tree-shaking | Open Questions | Medium — without it, renderer.ts may not be tree-shaken when only `parse` is imported in client component; could cause build failure |

---

## Sources

### Primary (HIGH confidence)
- `src/engine/parser.ts`, `src/engine/schema.ts` — confirmed `parse()` imports only Zod, no Node.js APIs, browser-safe [VERIFIED: codebase]
- `apps/web/prisma/schema.prisma` — existing model shape, `TenantIsolationProbe` as pattern for `Template`/`BrandConfig` [VERIFIED: codebase]
- `apps/web/prisma/migrations/0002_rls_real_tenant_tables/migration.sql` — exact RLS SQL pattern to replicate [VERIFIED: codebase]
- `apps/web/src/lib/db/tenant-db.ts` — `withTenantDb` signature and `TenantClient` extension pattern [VERIFIED: codebase]
- `apps/web/src/lib/workspaces/guards.ts` — `requireWorkspaceRole` signature [VERIFIED: codebase]
- `apps/web/src/lib/auth/permissions.ts` — RBAC matrix; editor has template create/read/update/delete and brand read/update [VERIFIED: codebase]
- `apps/web/tests/schema-conventions.test.ts` — models `Template` and `BrandConfig` already anticipated by test; Phase 3 must uncomment them [VERIFIED: codebase]
- `apps/web/package.json` — exact dependency versions; no shadcn/Tailwind yet installed [VERIFIED: codebase]
- `pnpm-workspace.yaml` — root (`.`) is a workspace package; engine name is `pageforge-engine` [VERIFIED: codebase]
- npm registry — shadcn@4.10.0, tailwindcss@4.3.0, codemirror@6.0.2, @uiw/react-codemirror@4.25.10 [VERIFIED: npm view, 2026-06-05]
- `nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages` — `transpilePackages` config syntax [CITED]
- `ui.shadcn.com/docs/installation/next` — `pnpm dlx shadcn@latest init` and component add commands [CITED]
- `ui.shadcn.com/docs/tailwind-v4` — Tailwind v4 setup via CLI, `tw-animate-css` replaces `tailwindcss-animate` [CITED]

### Secondary (MEDIUM confidence)
- UI-SPEC (03-UI-SPEC.md) — approved design contract; plain textarea locked for v1, exact component list, neutral preset [VERIFIED: .planning/phases/03-template-authoring-brand-config/03-UI-SPEC.md]

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against registry and codebase
- Architecture: HIGH — patterns derived directly from existing codebase (tenant-db.ts, actions.ts, prisma schema)
- Engine bundleability: HIGH — verified by reading parser.ts and schema.ts imports
- shadcn/Tailwind v4 setup: HIGH — verified against official docs (ui.shadcn.com)
- Editor choice (textarea): HIGH — UI-SPEC explicitly locked this; no additional research needed
- Prisma jsonb schema shape: MEDIUM — recommended split (two columns) is conventional; alternative (one merged blob) also works

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (stable stack; shadcn minor versions may advance but breaking changes are rare)
